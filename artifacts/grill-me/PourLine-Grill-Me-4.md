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
   creates the player record and issues **all three play tokens at once** — each carrying a
   `seed`, an `attempt_no`, an expiry at the end of the competition window, and an HMAC
   signature over those fields.

   Issuing all three up front is deliberate: it means a player who loses signal after
   registering can still complete all three runs offline. See branch 6.

2. **Play.** The game runs the deterministic sim from `/packages/sim` at a fixed 60 Hz using
   the token's seed. It records every input as `{ frame, type }`.

3. **Submit.** On game over the client POSTs `{ token, signature, inputLog, claimedScore, durationFrames }`.

4. **Validate.** The `submit-run` Edge Function:
   - verifies the HMAC signature
   - confirms the token is unused, unexpired, and belongs to that player
   - **re-runs `simulate(seed, inputLog)` server-side** using the identical module
   - compares the result to `claimedScore`

5. **Record.** Match → `status = 'verified'`, `verified_score` stored. Mismatch →
   `status = 'rejected'` and flagged in the admin view. Token marked used either way, so a
   rejected run burns an attempt.

**Only `verified_score` ever reaches the leaderboard.** A forged score is not merely
detected, it is structurally incapable of ranking.

### Why this is cheap here

Pour Line's entire input history is a list of press and release events — a few hundred bytes
per run. The sim is already isolated and deterministic because branch 3 required it. The
validation function is a dozen lines wrapping an existing module. This is roughly a day's
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

## Open items

- Prize value drives how much of this is proportionate. If the prize is significant, revisit
  stand-issued codes. Tracked in [CLIENT-REQUIREMENTS.md](../../CLIENT-REQUIREMENTS.md).
- How many finalists play the live final — follows from the prize structure.
