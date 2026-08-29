# Pour Line — Grill Me 4: Identity, Attempts & Anti-Cheat

_Branch 4 of 6. See the [index](./PourLine-Grill-Me-index.md)._

## The framing

**You do not need every score to be honest. You need the winner to be honest.**

Everything below follows from that. Cheap, zero-friction deterrence for the crowd; hard
verification concentrated at the top of the leaderboard where the prize actually is.

## Decisions

| Question | Decision |
|---|---|
| Attempt limit enforcement | **Normalised email as key, phone as secondary dedupe** |
| Phone number | **Optional, clearly marked** |
| Anti-cheat | **Deterministic replay validation + live final for the top finalists** |
| Which attempt counts | **Best single run** |
| Staff/demo access | **Separate credential, unlimited attempts, never reaches the leaderboard** |

## Enforcing three attempts

### Normalisation

The lookup key is a **normalised** email, not the raw string:

- Lowercase everything
- Strip `+tag` suffixes (`theunus+1@gmail.com` → `theunus@gmail.com`)
- Strip dots in the local part for Gmail and Googlemail domains only
- Trim whitespace, normalise Unicode

Phone numbers normalise to E.164 (`+27…`) and act as a **secondary dedupe signal**: a repeat
number on a different email raises a flag in the admin view rather than hard-blocking, since
shared landlines and typos are real.

Enforcement is **server-side**. The client never decides how many attempts remain — it asks.

### What this stops, and what it doesn't

Stops: the same person tapping "play again", refreshing, clearing storage, using private
browsing, or trying an obvious `+1` variant. That is the overwhelming majority of casual
abuse at a stand.

Does not stop: someone deliberately registering with genuinely different email addresses.
That is a conscious, repeated act of fraud to win a prize — and it is caught by the live
final, below, not by the form.

Rejected alternatives:

- **Email OTP** — puts a network round trip and an inbox check between a person in a queue
  and the thing they queued for. On bad expo wifi this is a conversion disaster.
- **SMS OTP** — strongest cheap identity and validates the phone number, but costs real
  money (~R150 for 500 players) and is the highest-friction option of all.
- **Stand-issued codes** — effectively airtight because a human gates it, and worth
  reconsidering if the prize value rises sharply. Costs printed materials and staff attention.

## Score integrity: deterministic replay

A client-side game means anyone with dev tools can POST any score they like. The answer is
not to hide the score — it is to make an unearned one **fail validation**.

### The flow

1. **Registration.** Player submits the form while still on decent connectivity. The server
   creates the player record and issues **all three play tokens at once** — each a signed
   capability string, `<tokenId>.<hmac(tokenId)>`, with the `seed` and `attempt_no` it belongs
   to held server-side against `tokenId`, not embedded in the string itself.

   Issuing all three up front is deliberate: it means a player who loses signal after
   registering can still complete all three runs offline. See branch 6.

2. **Play.** The game runs the deterministic sim from `/packages/sim` at a fixed 60 Hz using
   the token's seed. It records every input as `{ frame, type }`.

3. **Submit.** On game over the client POSTs `{ token, inputLog, claimedScore, durationFrames }`.

4. **Validate.** The `submit-run` Edge Function:
   - recomputes the HMAC over the token's `tokenId` and rejects a mismatch outright
   - looks up that `tokenId`, confirms it is unused and unexpired
   - claims it (`used_at`) with a guard that only the first concurrent request wins — a
     retried request on flaky venue wifi is the realistic case this defends, not an attacker
   - **re-runs `simulate(seed, inputLog)` server-side** using the identical module
   - compares the result to `claimedScore`

5. **Record.** Match → `status = 'verified'`, `verified_score` stored. Mismatch →
   `status = 'rejected'`. Token claimed either way, so a rejected run burns an attempt.

**Only `verified_score` ever reaches the leaderboard.** A forged score is not merely
detected, it is structurally incapable of ranking.

**Built and proven** — not just designed. Against a real local Supabase stack (Postgres,
PostgREST, Edge Functions, all in Docker — `supabase/`), a genuine run played through the
actual Phaser client replayed to an identical score server-side; a claimed score edited to
`999999` before submission was rejected while still burning the attempt; a token with its
signature tampered was rejected before the database was ever touched; replaying an
already-used token was rejected with no second write. See the README's "Registration &
attempts" section for how to run this locally.

### Why this is cheap here

Pour Line's entire input history is a list of press and release events — a few hundred bytes
per run. The sim is already isolated and deterministic because branch 3 required it. The
validation function is a dozen lines wrapping an existing module. This was roughly a day's
work for by far the strongest anti-cheat available.

### Plausibility flags

Belt and braces on top. Flag, don't block:

- Input timing with superhuman consistency (release always within the same 1–2 frames — a bot)
- Score-to-duration ratio outside the observed distribution
- Many runs from one IP hash against different emails
- Replay validation failures clustered on one player

Flagged runs appear in the admin view for a human to look at. They do not auto-reject,
because a false positive that voids a genuine winner is worse than a flagged run someone
glances at.

### The live final

The top finalists **replay at the stand, in front of staff, before prizes are awarded.**

This is the actual guarantee. Any cheating strategy that survives replay validation still
has to survive a person watching you play — and it doubles as a genuinely good event moment:
a crowd, a screen, a real final. It converts the weakest part of the security model into the
best part of the event.

The T&Cs must state that finalists are required to play a verification round to claim a
prize (branch 5), or someone will refuse and have a point.

## Attempts and scoring

Three attempts, **best single run counts.**

Best-of-three rather than sum or average because the tail mechanic (branch 2) needs a run to
click. Players should feel free to burn run one learning. A sum rule would make a fumbled
opener feel unrecoverable and sour people on the stand.

**Tie-break: earlier submission wins.** Stated in the T&Cs.

## Spoiled runs

A phone will ring mid-run. Someone will get bumped. The admin page (branch 6) can **void a
run** and **grant an extra attempt**, both written to `admin_audit` with the actor recorded.

Discretionary, staff-only, logged. Without it there is no recourse and you will be arguing
with a customer; with it unlogged, there is no defence if someone later questions the result.

## The ARPS staff/demo account

ARPS needs to be able to showcase the game — at the stand, to a passer-by, in a sales
meeting — without spending a real attendee's attempt and without a demo run ever
contaminating the leaderboard or the prize.

### What exists today (client-side, built)

`apps/game/src/demo.ts`. A staff member visits `<site>/?staff=<code>` once on their own
device; the code is checked against a build-time secret (`VITE_STAFF_CODE`), and if it
matches, a flag is written to that browser's `localStorage`. From then on:

- Every run is tagged `demo: true`, threaded through `PlayScene` → `ResultsScene` alongside
  the seed and input log.
- The game visibly marks itself — **"DEMO MODE — SCORE NOT SAVED"** during play, **"DEMO
  RUN — NOT SAVED"** on the results screen — so nobody watching mistakes a showcase run for
  a real entry, and so a staff member's phone can't be mistaken for a competitive one if
  handed to someone else.
- `?staff=off` clears the flag, to hand a demo device back to normal.

**This is explicitly a labelling boundary, not a security boundary.** The whole reason
`packages/sim` is deterministic and every score gets replayed server-side (above) is that
nothing client-asserted can be trusted for anything that matters. A `demo: true` sent by the
page is exactly that kind of client assertion — trivially spoofable by anyone with dev
tools. Today that costs nothing, because there is no backend yet: every run, demo or not,
already goes unsaved. The flag exists now so the seam is in the right place before the
backend exists, the same reasoning that put determinism in from day one rather than
retrofitting it.

### What the backend must do (not yet built)

When registration and `submit-run` land, the demo account has to be authenticated
server-side, the same way a real player's token is:

- A **separate demo credential** — not a row in `players`, not an email — issued to ARPS.
  Whatever form it takes (a static secret held by the Edge Function, a distinct token type),
  it must be checked independently of anything the client claims.
- **Exempt from the per-email attempt count.** The demo credential doesn't consume, and
  isn't limited by, the three-attempt check.
- **Structurally excluded from the leaderboard**, not filtered out after the fact. The
  safest shape: demo runs are validated (still worth replaying — a broken demo looks bad in
  front of a client) but written with `status = 'demo'`, and every leaderboard and
  live-final query filters on `status = 'verified'` explicitly rather than merely excluding
  `'demo'`. An allowlist of what counts, not a blocklist of what doesn't — the same
  precautionary shape as the public-leaderboard view in branch 5, which is incapable of
  returning contact details rather than merely filtered to not return them.
- The demo credential should **not** appear in `players`, so it can never be swept up by the
  30-day anonymisation job (branch 5) or exported in the leads CSV.

### Distributing the code

`VITE_STAFF_CODE` is a Cloudflare Pages build-time environment variable, not something in
the repo. Whoever holds it can demo the game at will; treat it like a shared password —
rotate it after the event, and don't put it in a group chat that outlives the event.

## Open items

- Prize value drives how much of this is proportionate. If the prize is significant, revisit
  stand-issued codes. Tracked in [CLIENT-REQUIREMENTS.md](../../CLIENT-REQUIREMENTS.md).
- How many finalists play the live final — follows from the prize structure.
- The demo credential's exact server-side shape (see above) is still not built — the token
  and `submit-run` design shipped without it, on purpose (the client-only bypass never calls
  `submit-run` at all, so there was nothing to retrofit). If a more integrated staff flow is
  ever wanted, design it as an addition to what exists now, not a rework.
