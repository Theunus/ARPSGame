# Pour Line

A 2D competition game for an ARPS event stand. Attendees scan a QR code, register
on their own phone, play, and the top verified score wins a prize.

**Hold to pour. Release at the line.** Concrete already in the air still has to
land, so release *early*. Overfill and you spill; pour with no mould under the
chute and you spill on the ground; three strikes ends the run. Perfect pours chain
a combo multiplier, and chasing it is what makes you spill.

---

## Quick start

```bash
npm install
```

Start the backend (Postgres + Edge Functions in Docker), then the game:

```bash
npx supabase start
```

```bash
npm run dev
```

Open the printed **Network** URL on a phone (the pour is tuned by thumb) and start
at `/register.html` — that's the QR-code destination. `/index.html` redirects there
if you have no attempt.

| Command | |
|---|---|
| `npx supabase start` / `stop` | Local backend in Docker |
| `npm run dev` | Dev server, exposed on the LAN |
| `npm run build` | Production build (game, register, leaderboard) |
| `npm test` | Simulation tests |
| `npm run typecheck` | Typecheck both workspaces |
| `npm run tune --workspace=@pourline/sim` | Difficulty / score distribution report |

---

## Layout

```
packages/sim/      Deterministic simulation. No DOM, no Phaser, no randomness.
apps/game/         Phaser 3 game + register/leaderboard pages.
supabase/          Schema, RLS, Edge Functions. Local in Docker; deploys to Supabase's free tier.
```

Three pages: `register.html` (entry + attempts gate), `index.html` (the game),
`leaderboard.html` (a plain table for a stand TV).

---

## How scores stay honest

`packages/sim` is deterministic — fixed 60 Hz timestep, seeded PRNG, no
`Math.random`, no `Date.now`, no DOM. The same module runs in the browser and on
the server. The client never sets `pouring` directly; it appends to an input log
that the sim reads and the server replays. A score is accepted only if replaying
the player's own inputs against the server-issued seed reproduces it exactly.

Treat a failure in `packages/sim/test/determinism.test.ts` as a stop-the-line
event — forged scores become undetectable if determinism breaks.

---

## How player data stays safe

- **Registration** (`supabase/functions/register`) stores the email and phone
  **AES-GCM encrypted**; a keyed HMAC of the normalised email is what dedupes and
  caps attempts, so those never need decrypting. No code currently decrypts the
  stored contact fields — an audited admin export would add that deliberately.
- **Row-level security** is on every table with no policies for the anon key. The
  only thing the public key can read is the `public_leaderboard` view, which
  returns a display name (`First L.`) and score and nothing else.
- **Consent** is competition-only; no marketing opt-in is collected.
- **Secrets** live in `supabase/functions/.env` (gitignored). Three separate keys:
  email-hash HMAC, email-encryption AES key, token-signing HMAC.

Set local secrets by copying `supabase/functions/.env.example` to
`supabase/functions/.env` and filling in random base64 values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

---

## Attempts

Three per player, enforced server-side. `register` issues three signed play tokens;
`submit-run` verifies the token, claims it, replays the run, and records the result.
The client's `localStorage` session is a convenience only — it can't get a bad score
onto the leaderboard. Demo/staff mode (`?staff=<code>`, set `VITE_STAFF_CODE`)
plays unlimited and never calls the backend.

---

## Deploying

Needs a free Supabase project (ideally in ARPS's own account) and Cloudflare Pages:

```bash
npx supabase link --project-ref <ref>
npx supabase db push
npx supabase secrets set --env-file supabase/functions/.env   # use NEW random values
npx supabase functions deploy register
npx supabase functions deploy submit-run
```

Then set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the Cloudflare Pages
build environment. `CLIENT-REQUIREMENTS.md` lists the legal/POPIA items to settle
before going live.
