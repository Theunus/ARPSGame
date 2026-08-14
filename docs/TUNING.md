# Tuning Pour Line

Everything that affects play is in [`packages/sim/src/config.ts`](../packages/sim/src/config.ts).
Change numbers there, run the harness, then go and put it in front of people.

```bash
npm run tune --workspace=@pourline/sim
```

The harness is a sighting shot, not a verdict. It cannot tell you whether the
pour *feels* good — only real thumbs can. What it does catch is the class of
problem playtesting is too slow to find: a mould that has become unfillable, a
ramp so flat the leaderboard is a lottery, or a change that quietly made expert
runs unbounded.

---

## How the difficulty actually works

Three levers ramp over `RAMP_FRAMES` (60 seconds):

1. **Scroll speed** — `SCROLL_SPEED_START` → `SCROLL_SPEED_END`. Less time to read
   and react. Plateaus at full difficulty.
2. **Perfect window** — `PERFECT_WINDOW_START` → `PERFECT_WINDOW_END`, defined in
   *frames of pour time*, not as a fraction of the mould. Human release precision
   is measured in frames, so this is the only way to keep a narrow column as fair
   as a wide slab.
3. **Tolerance** — `SPILL_MARGIN_*` and `MISS_FLOOR_*`. Deliberately **uncapped**.

### Why the tolerance must keep closing

This is the non-obvious part, and the first version got it wrong.

Strikes come from spills and misses. An accurate player never spills, and pouring
slightly short is only an underfill, which costs points but not a strike. So at
constant difficulty a precise player **plays forever** — the first tuning pass had
expert and average bots both hitting the five-minute safety cap.

Raising the scroll speed does not fix it. To force a *miss* by speed alone the
line would have to move so fast the mould cannot reach even 55% full, which
happens far too late to be useful.

So the survivable window closes from both sides instead: the brim drops toward
the target line while the minimum acceptable fill rises toward it. Any player with
a fixed precision eventually runs out of room. The window reaches zero around 85
seconds, which is the queue guarantee the event needs.

**If you clamp `tolProgress`, runs become unbounded again.** There is a test for
this — an idle run must end inside 25 seconds — but it will not catch the expert
case. Watch the `max secs` column in the harness.

---

## Targets

From [the design record](../artifacts/grill-me/PourLine-Grill-Me-2.md):

| | Target | Currently |
|---|---|---|
| Median run | 35–45s | 45s first-run, 62s average |
| Expert cap | ~90s | 82–90s ✅ |
| Score magnitude | Thousands, well spread | 2.5k–70k ✅ |
| Ties at the top | Rare | 0–1 in the top 20 ✅ |

The average tier running long is the known gap. Most event players will use all
three attempts, so the *first* run is the one at target — and runs lengthening as
someone improves is a reasonable reward. Worth confirming against real players
before touching it.

---

## What to watch when you playtest

Get at least **8 people who have never seen it** to play three runs each, before
week 5. Watch their eyes, not the screen.

- **They never look at the target line.** The line is wrong — too dim, wrong
  place, or the fill is drawing attention away from it.
- **Fewer than half beat their first score by run three.** The tail is not
  learnable enough. Reduce it, or telegraph the chute closing harder. The whole
  design rests on run two being the one where it clicks.
- **Everyone scores within 10% of each other.** The ramp is too flat and the
  leaderboard becomes a lottery. A prize needs a defensible winner.
- **Someone spills without understanding why.** Fatal. The mechanic reads as
  random and they will not come back for run three. The falling column and the
  chute animation exist entirely to prevent this.
- **They tilt the phone to see the band.** Contrast problem — expo lighting is
  brutal and phones are often on low brightness to save battery.
- **They try to use two thumbs.** The control scheme has failed; it is meant to
  work one-handed with a bag in the other hand.

Test with the sound off. That is how essentially everyone will play it.

---

## Adding a mould or a mix

Both are data. Add to `MOULDS` or `MIXES`, then add it to the relevant schedule
band so it can actually appear.

Two things to check:

- **`height` is purely cosmetic.** It maps fill units to pixels and never enters
  the simulation. Change it freely for readability.
- **Feasibility.** `width / scrollSpeed` (dwell) must comfortably exceed
  `target / flow` (fill time) at the fastest speed the mix can be encountered at.
  The harness checks this and prints a ratio; below 1.1× the mould is
  near-impossible rather than hard.

Mixes are scheduled back-loaded on purpose: fast-flowing, long-tailed mixes arrive
late so late game means maximum overshoot pressure, and slow mixes stay away from
the fastest scroll speeds where they would be unfillable.

---

## Before you commit a tuning change

```bash
npm test && npm run tune --workspace=@pourline/sim
```

Determinism tests must stay green. A tuning change that alters the sim is fine —
scores are only ever compared within one build — but a change that makes the sim
*non-deterministic* silently destroys the anti-cheat model.

If you deploy a tuning change mid-event, previously submitted runs will no longer
replay to their recorded scores. Don't.
