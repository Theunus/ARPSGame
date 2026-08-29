# Pour Line

A 2D competition game for an ARPS event stand. Attendees scan a QR code, play on
their own phone, and the top score wins a prize.

**Hold to pour. Release at the line.** Concrete already in the air still has to
land, so you must release *early*. Overfill and you spill — three strikes ends the
run. Perfect pours chain a combo multiplier, and chasing that multiplier is
exactly what makes you spill.

The full design record, including every decision and why, is in
[`artifacts/grill-me/`](artifacts/grill-me/PourLine-Grill-Me-index.md).
Everything needed from the client is in [`CLIENT-REQUIREMENTS.md`](CLIENT-REQUIREMENTS.md).

---

## Status

Week 1 of a 2–6 week build. **The game is playable end to end.**

| | |
|---|---|
| ✅ | Deterministic simulation, 17 tests green |
| ✅ | Server-side replay verification — proven at 4 ms per run |
| ✅ | Phaser client: full loop, scoring, strikes, difficulty ramp |
| ✅ | Tuning harness with synthetic players |
| ✅ | Staff/demo showcase mode — unlimited plays, never saved |
| ✅ | Big-screen leaderboard page — reads real submitted scores via PostgREST |
| ✅ | ARPS brand colours — light navy/orange theme (`theme.arps.ts`) |
| ✅ | Registration, POPIA consent capture, attempt limiting, score submission |
| ✅ | Supabase schema, RLS, Edge Functions — proven end to end against a real local stack |
| ⬜ | Deployed to a real (non-local) Supabase project — see CLIENT-REQUIREMENTS 4.2 |
| ⬜ | Service worker, offline submission queue |
| ⬜ | Admin page |
| ⬜ | ARPS logo art + licensed brand font (colours already in) |

---

## Getting started

```bash
npm install
```

The game needs its backend running to let anyone actually play (see
[Registration & attempts](#registration--attempts--the-backend) below) —
start that first:

```bash
npx supabase start
```

The first run pulls several Docker images and takes a few minutes; every run
after that is seconds. Then the game itself:

```bash
npm run dev
```

Vite prints a **Network** URL alongside the local one. Open that on your phone —
this game is tuned by thumb, and a desktop mouse tells you nothing about whether
the pour feels right. Start at `/register.html`, not `/index.html` — that's the
actual QR-code destination, and `index.html` will send you there anyway if you
don't have a registered attempt (see below).

| Command | |
|---|---|
| `npx supabase start` / `stop` | The local backend — Postgres, PostgREST, Edge Functions, all in Docker |
| `npm run dev` | Dev server, exposed on the LAN for phone testing |
| `npm run build` | Production build (three pages: game, register, leaderboard) |
| `npm test` | Simulation tests — **the load-bearing ones** |
| `npm run typecheck` | Typecheck both workspaces |
| `npm run tune --workspace=@pourline/sim` | Difficulty and score distribution report |

---

## Registration & attempts — the backend

Free, and genuinely serverless: **Docker only runs locally**, for development.
The live version runs on Supabase's free tier and Cloudflare Pages — nothing
for you to patch, restart, or pay uptime on. See
[Grill-Me-3](artifacts/grill-me/PourLine-Grill-Me-3.md) for why this stack and
not a self-hosted container.

```bash
npx supabase start   # boots Postgres + PostgREST + Edge Functions in Docker
npx supabase status  # URLs and local keys, if you need them again
npx supabase stop    # when you're done
```

**The flow:** `register.html` collects name, email, phone (optional) and the
two POPIA consent checkboxes (Grill-Me-5), then calls the `register` Edge
Function. That function normalises the email, hashes it (`EMAIL_HASH_SECRET`)
to dedupe without ever decrypting anything, encrypts the real address
(`EMAIL_ENC_KEY`), and either creates a new player with three fresh play
tokens or — if that email has already registered — returns whichever of the
three are still unused. Tokens are signed capability strings
(`TOKEN_SECRET`), not just database IDs; see
[Grill-Me-4](artifacts/grill-me/PourLine-Grill-Me-4.md).

The client caches that response in `localStorage` (`src/session.ts`) purely
as a convenience — `main.ts` uses it to decide whether to boot the game at
all, and skips constructing Phaser entirely (no ~340KB engine load) if there's
no usable attempt and it isn't staff/demo mode. **None of this is the real
enforcement.** The actual limit is `submit-run`: it verifies the token's
signature, replays the submitted input log through the identical
`packages/sim` module using the seed *it* issued, and only a score that
matches is ever written as `verified`. A stale or tampered client-side cache
can only ever show the wrong button state — it can't get a bad score onto the
leaderboard.

Three secrets the functions need beyond what Supabase injects automatically —
copy `supabase/functions/.env.example` to `supabase/functions/.env` (gitignored)
and fill in random values for local dev:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run that three times for `EMAIL_HASH_SECRET`, `EMAIL_ENC_KEY`, `TOKEN_SECRET`.

**Deploying for real** needs a free Supabase project (CLIENT-REQUIREMENTS 4.2 —
ideally in ARPS's own account, not yours) and Cloudflare Pages for hosting:

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push                              # applies both migrations
npx supabase secrets set --env-file supabase/functions/.env   # use NEW random values, not the local ones
npx supabase functions deploy register
npx supabase functions deploy submit-run
```

Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (from
`npx supabase status`) in Cloudflare Pages' build environment — `src/api.ts`
and `src/leaderboard/data.ts` fall back to the local Docker URLs otherwise.

---

## Showcasing the game (staff/demo mode)

For demoing to a passer-by or in a sales meeting without spending a real attendee's
attempt. Set `VITE_STAFF_CODE` in `apps/game/.env.local` (copy from
[`.env.example`](apps/game/.env.example); gitignored, never commit the real value),
then on any device visit:

```
<site>/?staff=<the code>
```

That device now plays with unlimited attempts and every run is clearly marked
**DEMO — not saved**, in-game and on the results screen. Visit `<site>/?staff=off`
to hand the device back to normal. In dev builds only, the code `dev-demo` works
without any `.env` file — it does not exist in a production build.

This is a client-side labelling convenience, not a security boundary — the real
3-attempt limit and leaderboard now do exist (see above), and demo mode is
deliberately kept outside both: a demo run never fetches a play token and
never calls `submit-run`, so it cannot consume a real attempt or reach the
leaderboard no matter what the client claims. The server-side demo credential
described in
[the design record](artifacts/grill-me/PourLine-Grill-Me-4.md#the-arps-staffdemo-account)
— authenticated independently, exempt from the attempt count, excluded from
`public_leaderboard` by construction — is still the intended eventual design
if a more integrated version is ever needed; today's client-only bypass never
touches the backend at all, which sidesteps that problem rather than solving it.

---

## Leaderboard

A separate page, not a Phaser scene — tables belong in the DOM, not on a canvas,
and this is meant to run unattended on a laptop driving a TV at the stand (see
[Grill-Me-6](artifacts/grill-me/PourLine-Grill-Me-6.md)), not inside the phone
game.

```bash
npm run dev
```

then open `/leaderboard.html`. It polls `fetchLeaderboard()`
([`src/leaderboard/data.ts`](apps/game/src/leaderboard/data.ts)) every 15s,
which reads `public_leaderboard` directly via PostgREST — no Edge Function
needed for this half, since the view itself (migration
`20250101000100_leaderboard_run_stats.sql`) is already narrow enough to give
the anon key: one row per player, their single best *verified* run only,
first name plus last initial, nothing that could identify them. A player's
combo/moulds shown here come from that same best-scoring run, not
independently maxed stats from different attempts, and the combo figure is
capped at `MAX_COMBO_MULT` to match what their own results screen showed them
for that run.

---

## Layout

```
packages/sim/      Deterministic simulation. No DOM, no Phaser, no randomness.
apps/game/         Phaser 3 client + register/leaderboard pages. Never owns game state.
supabase/          Schema, RLS, Edge Functions. Runs locally in Docker; deploys to Supabase's free cloud.
artifacts/         Design record.
```

### The one rule

**`packages/sim` must stay deterministic.** Fixed 60 Hz timestep, seeded PRNG, no
`Math.random`, no `Date.now`, no DOM. The same module runs in the browser and on
the server, and a submitted score is accepted only if replaying the player's own
inputs against their server-issued seed reproduces it exactly.

This is why the client never sets `pouring` directly — it appends to the same
input log it will later submit, and the sim reads from that log. The run the
player sees *is* the run the server replays, not a parallel implementation that
happens to agree.

Break determinism and forged scores become undetectable. Treat a failure in
`packages/sim/test/determinism.test.ts` as a stop-the-line event.

---

## Tuning

All gameplay numbers live in [`packages/sim/src/config.ts`](packages/sim/src/config.ts).
Nothing outside that file should contain a magic number that affects play.

```bash
npm run tune --workspace=@pourline/sim
```

Current distribution across 200 seeds per skill tier:

| Tier | Median score | Median run |
|---|---|---|
| Expert | 51,685 | 81.8s |
| Good | 37,765 | 74.8s |
| Average | 15,173 | 60.6s |
| First run | 2,289 | 43.9s |

Scroll speed is **unbounded** — Piano Tiles-style, it keeps accelerating for as
long as the player survives, rather than plateauing after a fixed ramp. What
still ends most runs is the **closing tolerance**: the brim drops toward the
target line while the minimum acceptable fill rises toward it, so even a player
who never spills eventually runs out of room. Speed alone can't do that job —
pouring slightly short costs no strike, so an accurate player would underfill
forever if tolerance stayed fixed.

Unbounded speed does eventually make a mould literally unfillable — dwell time
drops below fill time. That's an intentional hard backstop, not a bug, but it
has to land *late*: the report also prints "the wall", the point each mould/mix
pair stops being fillable, and flags any combination that arrives too early. A
wall that lands too soon converges every skill tier on the same unavoidable
strike instead of testing precision — that's a real failure mode this project
hit once already; see [`docs/TUNING.md`](docs/TUNING.md).

These are a considered first pass, not final values.

---

## Deployment target

Cloudflare Pages (Johannesburg and Cape Town edge PoPs) with Supabase in the EU
for Postgres, row-level security and Edge Functions. EU hosting because GDPR
satisfies POPIA s72 on cross-border transfer without leaning on consent alone.

The Supabase half is built and proven against a real local stack — schema,
RLS, both Edge Functions, replay verification, the works (see
[Registration & attempts](#registration--attempts--the-backend) above). What's
missing is a real (non-local) Supabase project to point it at, which needs
someone at ARPS to create one — tracked as item 4.2 in
[`CLIENT-REQUIREMENTS.md`](CLIENT-REQUIREMENTS.md) — and the Cloudflare Pages
hosting itself, which is still just `npm run build`'s output sitting in
`apps/game/dist/` waiting for a place to live.
