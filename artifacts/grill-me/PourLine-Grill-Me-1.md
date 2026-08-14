# Pour Line — Grill Me 1: Event Context & Constraints

_Branch 1 of 6. See the [index](./PourLine-Grill-Me-index.md)._

These are the constraints every other decision hangs off. If any of these change, re-read
branches 2 and 3 — the game design and the stack were both chosen to fit these numbers.

## Decisions

| Question | Decision |
|---|---|
| Player volume | **100–500 players, single day** |
| Build time available | **2–6 weeks** |
| Venue connectivity | **Assume it is bad** — design offline-tolerant |
| Client branding | **Real client (ARPS), assets not yet available** |
| Audience | **Trade buyers and contractors** |

## What each one means in practice

### 100–500 players, one day

Peak concurrency is the number that matters, not the total. A stand competition does not
trickle — it spikes when a talk lets out or someone announces the leaderboard. Plan for
**20–50 concurrent players** at peak, with a long tail of near-zero.

Consequences:

- Every free tier under consideration handles this without breaking a sweat. Storage is
  trivial: 500 players × 3 runs, with input logs, is comfortably under 20 MB.
- The real risk is not throughput, it is a **cold start or a slow first load** during the
  spike. Which is why the asset bundle size in branch 3 matters more than the database tier.
- Score spread matters at this volume. With 500 players you need scoring that rarely ties
  at the top, or picking a winner becomes a coin flip. Handled in branch 2.

### 2–6 weeks

Enough for one well-tuned mechanic with real polish, **not** enough for a second mechanic,
a tutorial mode, or a custom art commission. The schedule in branch 3 front-loads the
riskiest work: game feel. Everything else is known quantity; how the pour *feels* is the
only thing that can't be estimated.

### Bad connectivity assumed

This is the single most influential constraint in the whole design. It rules out:

- Any engine with a heavy download (branch 3 — this is why not Godot).
- Email or SMS OTP before play, because it puts a network round trip between a person in a
  queue and the thing they queued for (branch 4).
- Online-only score submission (branch 6).

Expo halls are genuinely hostile: hundreds of devices, one saturated AP, and concrete
everywhere. Design as if the network will vanish mid-run, because it will.

### Real client, no brand assets yet

The build proceeds on a **neutral industrial palette** — concrete greys, safety yellow,
hazard orange, steel blue — with all brand-specific values behind a theme layer:

```
/apps/game/src/theme/
  theme.ts          # typed shape: colours, fonts, logo path, product names
  theme.neutral.ts  # build with this today
  theme.arps.ts     # drop in when assets arrive, no other code changes
```

Product names for the concrete mixes live in the theme file too, so the branch 2
"mixes have different flow rates" mechanic can be re-labelled with real ARPS products
without touching game logic.

**Do not** hardcode a colour or a product name anywhere in the game code. When the brand
pack lands in week 5 you want a one-file change, not a hunt.

### Trade buyers and contractors

Shapes the design more than it first appears:

- **Older skew, larger hands, sometimes gloves.** Controls must tolerate imprecise touch.
  Drove the one-input control scheme in branch 2.
- **Low patience for fiddly things**, but high patience for something that rewards
  precision — this is a crowd that values doing a job accurately.
- **Phone numbers are realistic to collect.** They came to an expo to be sold to; lead
  capture is expected, not resented. Compare a general-public audience, where asking for a
  number tanks conversion.
- **Sound will be off.** Nobody unmutes their phone in a noisy hall. No mechanic may depend
  on audio; sound is garnish only.
- **Sunlight and hall lighting.** Contrast must be high. Test the fill-line indicator under
  a bright light before the event.

## Open items

- Exact event date and hall — needed to set the competition window (branch 6) and to
  confirm the printed-materials deadline.
- Whether a TV or screen is available at the stand for the big-screen leaderboard.
- Expected attendance from the organiser, to sanity-check the 500 figure.

Tracked in [CLIENT-REQUIREMENTS.md](../../CLIENT-REQUIREMENTS.md).
