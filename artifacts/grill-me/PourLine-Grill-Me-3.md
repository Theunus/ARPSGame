# Pour Line — Grill Me 3: Technical Architecture

_Branch 3 of 6. See the [index](./PourLine-Grill-Me-index.md)._

## Decisions

| Question | Decision |
|---|---|
| Game engine | **Phaser 3** |
| Frontend hosting | **Cloudflare Pages** |
| Backend + database | **Supabase, EU region** |
| Data residency | **EU (Frankfurt or Ireland)** |
| Build mode | **I build, you review and learn** |

## Why Phaser, and explicitly why not Godot

Godot is the obvious answer to "which game engine" and it is the wrong one here.

| | Phaser 3 | Godot 4 web export |
|---|---|---|
| Bundle | 338 KB gzipped (measured) | 20–40 MB wasm |
| Mobile Safari | First-class | Known problems, officially caveated |
| Server headers | None needed | Wants COOP/COEP for threads |
| Sim reuse on server | Same TypeScript runs in Deno | Would need a second implementation |
| Learning material | Enormous | Good, but sparse for web-on-mobile |

On a three-year-old iPhone on saturated expo wifi, a 30 MB payload is a black screen and a
bounced lead. Combined with the offline requirement from branch 1 and the shared-simulation
requirement below, Phaser is the only comfortable fit.

Phaser gives you what you asked for on polish: tweens, particle emitters, camera effects,
scene transitions, and a spritesheet/atlas pipeline — all built in, all MIT.

## The one architectural rule

**The simulation must be deterministic and separate from rendering, from day one.**

This is what makes server-side replay validation possible (branch 4). It cannot be
retrofitted in week five without rewriting the game loop, which is why it was decided
before any code was written.

```
/packages/sim/          Pure TypeScript. No DOM, no Phaser, no Math.random, no Date.now.
  step(state, input) -> state
  simulate(seed, inputLog) -> { score, frames, strikes }
```

Rules the sim must obey:

- **Fixed timestep.** 60 Hz logical ticks, accumulator-driven. Rendering interpolates;
  the sim never sees a variable delta.
- **Seeded PRNG.** A small deterministic generator (mulberry32 or xorshift128). `Math.random`
  is banned inside `/packages/sim` — enforce it with an ESLint rule so it can't creep in.
- **Integer frame counter** as the only clock.
- **Input as a discrete event list**: `[{ frame: 142, type: 'down' }, { frame: 171, type: 'up' }]`.

Both the browser (V8) and Supabase Edge Functions (Deno, also V8) run the same module, so
IEEE-754 float behaviour is identical. Same code, same seed, same inputs, same score.

Phaser consumes the sim and draws it. Phaser never *owns* game state.

## Repository layout

```
/apps/game/            Vite + TypeScript + Phaser 3   → Cloudflare Pages
  src/scenes/          Boot, Register, Play, Results, Leaderboard
  src/theme/           Swappable brand layer (see branch 1)
  src/net/             Token fetch, submission queue, service worker
/apps/admin/           Password-gated admin (route within the same deploy)
/packages/sim/         Deterministic simulation — shared client and server
/supabase/
  migrations/          SQL schema
  functions/           register, issue-tokens, submit-run, leaderboard, admin-*
/docs/
/artifacts/grill-me/   These documents
```

## Hosting

**Cloudflare Pages** for the frontend. Chosen over Vercel for two reasons that matter on
event day: Cloudflare has edge PoPs in **Johannesburg and Cape Town**, so first load over
venue wifi is served locally rather than from Europe; and the free-tier bandwidth allowance
is effectively unlimited for this workload.

**Supabase (EU)** for Postgres, row-level security and Edge Functions. Chosen over an
all-Cloudflare stack primarily for the admin experience: at 16:00 on event day with the
client watching, you want a working table UI and SQL editor as a fallback, not a D1 CLI.

Two known free-tier caveats, both manageable:

- **Supabase pauses a free project after 7 days of inactivity.** If the build is finished
  early and sits idle before the event, it will be asleep. Mitigate with a scheduled ping
  (Cloudflare Cron Worker hitting a health endpoint daily), and verify it is awake the
  morning of the event.
- Free tier is 500 MB database and 5 GB egress. This workload uses a rounding error of both.

**Data region: EU.** Neither Supabase nor Firebase offers a South African region. POPIA s72
restricts cross-border transfer unless the destination has comparable protection — GDPR
qualifies, so EU hosting is defensible on its own merits rather than resting entirely on the
consent clause. Full reasoning in branch 5.

## Data model

```sql
-- Lookup by HMAC so we can dedupe without ever decrypting. See branch 5.
create table players (
  id                  uuid primary key default gen_random_uuid(),
  email_hmac          text not null unique,
  email_ciphertext    text not null,
  full_name           text not null,
  display_name        text not null,          -- "Theunus S." — the only public identity
  phone_hmac          text,
  phone_ciphertext    text,
  consent_competition boolean not null,
  consent_marketing   boolean not null default false,
  consent_version     text not null,          -- which notice text they actually saw
  consented_at        timestamptz not null,
  is_adult            boolean not null,
  attempts_granted    int not null default 3,
  created_at          timestamptz not null default now(),
  anonymised_at       timestamptz
);

create table play_tokens (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references players(id) on delete cascade,
  attempt_no  int  not null,
  seed        bigint not null,
  signature   text not null,
  issued_at   timestamptz not null default now(),
  expires_at  timestamptz not null,
  used_at     timestamptz,
  unique (player_id, attempt_no)
);

create table runs (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references players(id) on delete cascade,
  token_id       uuid not null references play_tokens(id),
  attempt_no     int  not null,
  seed           bigint not null,
  input_log      jsonb not null,
  claimed_score  int  not null,
  verified_score int,
  status         text not null default 'pending',  -- pending|verified|rejected|voided
  duration_frames int,
  client_version text,
  submitted_at   timestamptz not null default now(),
  validated_at   timestamptz
);

create table admin_audit (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,
  action     text not null,       -- void_run | grant_attempt | export_leads | toggle_window
  target_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);
```

The public leaderboard is a view exposing **only** `display_name` and `verified_score` —
structurally incapable of returning an email address. See branch 5.

**Built:** `supabase/migrations/`, applied and proven against a real local Supabase stack
(schema, RLS, both Edge Functions, the whole registration → play → submit → leaderboard round
trip, including replay rejection of a tampered score). A few details landed differently than
this sketch:

- No `signature` column on `play_tokens` — the token handed to the client is
  `<tokenId>.<hmac(tokenId)>`, verified by recomputing the HMAC against `TOKEN_SECRET` rather
  than storing it. One less thing that could drift out of sync with what was actually issued.
- No `attempts_granted` on `players` — how many attempts remain is just "how many
  `play_tokens` rows for this player have `used_at is null`", so there is nothing to keep in
  sync by hand.
- `runs` gained `max_combo` and `moulds_completed` (a follow-up migration, not an edit to the
  original one — see that migration's own comment for why) so the leaderboard can show a
  player's combo and moulds from their actual best-scoring run, not independently maxed
  numbers that could Frankenstein stats from two different attempts.
- `public_leaderboard` uses `distinct on` to pick one full row per player — their best
  verified run, earliest submission breaking a tie — rather than independent `max()`
  aggregates, which is what makes the tie-break rule in branch 4 actually true in the data,
  not just true in the T&Cs copy.
- `admin_audit` exists in the schema, unused — no admin page yet (branch 6), but the table
  needs no new migration when one lands.

## Build schedule (6-week shape; compress from the back if it's 4)

| Week | Work |
|---|---|
| 1 | `/packages/sim` core. Phaser prototype. **Tune the pour feel.** Highest-risk week — this is the part that cannot be estimated. |
| 2 | Full loop: mould and mix variety, difficulty ramp, three strikes, combo scoring. Neutral-theme art pass. |
| 3 | Registration and consent form. Supabase schema, RLS, Edge Functions. Replay validation. |
| 4 | Service worker, token pre-fetch, offline submission queue. Admin page. Big-screen leaderboard. |
| 5 | ARPS brand assets swapped in. Device test matrix. Load test. **Full dry run.** |
| 6 | Buffer. Something will need it. |

Playtesting (branch 2) happens continuously from week 2, not as a week-5 gate.

## Device test matrix

Test on real hardware, not just responsive mode:

- Older iPhone on Safari (the most likely device and the most likely to break)
- Mid-range Android on Chrome
- A small screen — iPhone SE class — for layout
- One-handed use, thumb only
- With work gloves on
- Under bright light, for contrast on the target line
- **With sound off**, which is how essentially everyone will play it

## Open items

- Whether the Supabase project lives in your account or the client's. Client-owned is
  better for data ownership and hand-over; yours is faster to set up. Raised in
  [CLIENT-REQUIREMENTS.md](../../CLIENT-REQUIREMENTS.md).
- Load-test target: simulate 50 concurrent submissions before the event.
