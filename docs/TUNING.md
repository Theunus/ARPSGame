# Tuning Pour Line

Everything that affects play is in [`packages/sim/src/config.ts`](../packages/sim/src/config.ts).
Change numbers there, run the harness, then go and put it in front of people.

```bash
npm run tune --workspace=@pourline/sim
```

The harness is a sighting shot, not a verdict. It cannot tell you whether the
pour *feels* good — only real thumbs can. What it does catch is the class of
problem playtesting is too slow to find: a mould that goes unfillable too early,
a ramp so flat the leaderboard is a lottery, a change that quietly makes expert
runs unbounded, or — the failure mode below — a wall that arrives so early it
erases the difference between skill tiers instead of testing it.

---

## How the difficulty actually works

Four levers, three of them ramping over `RAMP_FRAMES` (60 seconds) and then
holding at full difficulty. One of them — scroll speed — never holds.

1. **Scroll speed** — `SCROLL_SPEED_START` + `SCROLL_SPEED_PER_RAMP` per
   `RAMP_FRAMES` survived. Deliberately **unbounded**, Piano-Tiles style: the
   line keeps accelerating for as long as the player keeps not-losing, so
   surviving is what makes the game hard rather than a fixed timer. See "The
   wall", below, for what this means for a flawless run.
2. **Perfect window** — `PERFECT_WINDOW_START` → `PERFECT_WINDOW_END`, defined in
   *frames of pour time*, not as a fraction of the mould. Human release precision
   is measured in frames, so this is the only way to keep a narrow column as fair
   as a wide slab. Plateaus at full difficulty.
3. **Tolerance** — `SPILL_MARGIN_*` and `MISS_FLOOR_*`. Deliberately **uncapped**,
   same shape as speed — see below.
4. **Gap between moulds** — `GAP_START` → `GAP_END`. Plateaus; not pushed further
   because a shrinking gap on top of ever-rising speed would eventually overlap
   moulds. Acceleration alone already shortens the *time* between them.

### Why the tolerance must keep closing — and why speed alone can't replace it

This is the non-obvious part, and the first version got it wrong twice.

Strikes come from spills and misses. An accurate player never spills, and pouring
slightly short is only an underfill, which costs points but not a strike. So at
*constant* difficulty a precise player plays forever — the very first pass had
expert and average bots both hitting the five-minute safety cap.

Raising scroll speed alone doesn't fix that either. To force a *miss* by speed
alone the line would have to move so fast the mould can't reach even 55% full,
which happens far too late to be useful — and once speed is unbounded, that
same effect becomes a different problem: a mould whose dwell time drops below
its fill time is simply unfillable, a strike nobody could have avoided. Push
speed hard enough on its own and every skill tier converges on that same
physical wall instead of dying at their own precision limit — which flattens
the leaderboard, exactly wrong for a competition.

So both levers do a job the other can't:

- **Tolerance** (`SPILL_MARGIN_*` / `MISS_FLOOR_*`) closes the band a player must
  hit, so a precise player still eventually runs out of room. This is what
  separates skill tiers — it's *why* Expert outlasts Average.
- **Speed** (`SCROLL_SPEED_PER_RAMP`) is the escalating pressure a Piano-Tiles
  game needs, and the hard backstop for the rare player good enough to dodge
  tolerance for a very long time.

**If you clamp the tolerance ramp, runs become unbounded again for precise
players.** There is a test for this — an idle run must end inside 25 seconds —
but it won't catch the expert case. Watch the `max secs` column in the harness,
and the wall table below.

### The wall

`npm run tune` prints the point at which each mould/mix pair stops being
fillable at all — dwell time (`width / speed`) drops below fill time
(`target / flow`). This is the ceiling speed puts under everything else.

It only matters for **general purpose** and **screed** — mortar and
high-strength retire from the mix schedule long before their wall could ever
be reached. At the current tuning the wall for general sits at **~120–123s**
and screed at **>200s**, both comfortably past the top tier's max observed run
(~86s). That gap is the point: the wall should read as "you broke the game",
not as an unfair strike at a normal death time. If you raise
`SCROLL_SPEED_PER_RAMP`, re-check this table — the harness flags any
combination that walls before its pacing floor.

### Ground spill

`GROUND_SPILL_LIMIT` — fill units you may pour with no mould under the chute before it
strikes, same as overflowing one. Exists so a player can't just hold the button through
every gap between moulds and let the tail sort out where it lands; the *press* now has to
be timed, not only the release.

**A well-timed early press never touches this limit, at any flow rate.** Delivery is
deferred by the mix's `tail` — concrete judged as landing "on the ground" is checked only
when it *arrives*, not when it's poured. Press up to exactly `tail` frames before a mould
shows up and every unit arrives the moment the mould does, contributing zero to
`groundSpill` regardless of how large the limit is. Verified directly: pressing exactly
`tail` frames early for screed (the tightest mix — fastest flow, longest tail) produces
`groundSpill: 0`.

What the limit actually catches is pressing *more* than `tail` frames before a mould
arrives — real anticipation error, not a timing edge case — or holding through a genuine
empty gap with nothing coming. Pressing 10 frames too early on screed wastes exactly
`10 × flow` units on the ground before the mould ever shows, confirmed to trigger the
strike at precisely that amount.

Deliberately independent of the tolerance ramp — it doesn't tighten over a run, because
timing the press is a fixed skill the difficulty curve doesn't need to escalate.

---

## Targets

From [the design record](../artifacts/grill-me/PourLine-Grill-Me-2.md):

| | Target | Currently |
|---|---|---|
| Median run | 35–45s | 44s first-run, 61s average |
| Expert median / max | — | 82s / 86s ✅ |
| Score magnitude | Thousands, well spread | 2.3k–66k ✅ |
| Ties at the top | Rare | 0 in the top 20 ✅ |
| Skill separation | Tiers should score visibly apart | 2.3k → 15k → 38k → 52k ✅ |

The average tier running long is the known gap. Most event players will use all
three attempts, so the *first* run is the one at target — and runs lengthening as
someone improves is a reasonable reward. Worth confirming against real players
before touching it.

Skill separation is the number to watch most closely now that speed is
unbounded: it's what collapsed to almost nothing during tuning when the wall
first landed too early (Expert and Good converged on the same physical
impossibility instead of dying at their own precision). If a future change
brings tiers close together again, suspect the wall before anything else —
check `npm run tune`'s wall table.

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
- **Feasibility.** Speed is unbounded now, so every mould/mix pair becomes
  unfillable *eventually* — that's expected, see "The wall" above. What matters
  is *when*: a mix that retires from the schedule (mortar, high-strength) must
  retire before its wall; a mix that never retires (general, screed) must wall
  well past the top tier's longest observed run. The harness checks both and
  marks a genuine problem with `!`.

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
