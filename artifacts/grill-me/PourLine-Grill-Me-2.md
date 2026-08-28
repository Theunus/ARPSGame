# Pour Line — Grill Me 2: Game Design

_Branch 2 of 6. See the [index](./PourLine-Grill-Me-index.md)._

## The concept

**Pour Line.** Formwork moulds scroll right-to-left along the bottom of a portrait screen.
A mixer chute is fixed at the top. When a mould passes under the chute, you hold to pour;
concrete rises inside the mould; a marked line shows the target level. Release at the line.

Chosen over three alternatives (a crane-stacking game, a conveyor QC sorter, and a cement
truck endless runner). It is more original than all three, and precision-under-pressure
suits a trade audience better than a reflex test does.

## Decisions

| Question | Decision |
|---|---|
| Control scheme | **Fixed chute, hold anywhere to pour, release to stop** |
| Fail state | **Three strikes** |
| Scoring | **Points with a combo multiplier** |
| Skill ceiling | **Pronounced, learnable tail on the pour** |
| Run length target | **30–60s typical, hard ramp, expert capped near 90s** |
| Brand depth | **Themed but not preachy** |
| Attempts | **3 per person, best single run counts** |

## The core mechanic in detail

### The tail is the whole game

When you release, **a little more concrete still falls**. The column of concrete already in
the air has to land. So you must release *early*, anticipating the overshoot.

This single property is what turns a stop-the-bar toy into a skill game:

- Run one, everyone overfills. It feels slightly unfair.
- Run two, it clicks. This is the moment the game earns its three attempts.
- It is never fully mastered, because tail length varies by mix and mould geometry.

The overshoot must be **telegraphed** — the chute visibly closes over a few frames and the
falling column is clearly rendered. Punishing but readable. If a player can't see *why*
they overfilled, the mechanic reads as random and the whole thing collapses.

### Pour outcomes

| Outcome | Band | Result |
|---|---|---|
| **Perfect** | Within the tight band on the line | Full points, combo multiplier increments |
| **Good** | Close, above the minimum threshold | Partial points, combo holds |
| **Underfilled** | Below threshold when the mould exits | Minimal points, **combo resets** |
| **Spill** | Fill exceeds the mould | **Strike**, combo resets |

Overflow is deliberately punished harder than underfill. It creates the central tension:
chasing perfects to grow the multiplier is exactly what makes you spill. Greedy players
blow up; timid players score low. That is where the skill spread comes from.

### Ground spill

Pouring with no mould under the chute — starting too early, or holding through the gap
between moulds — is also a spill. A small bleed is forgiven (the tail already carries a
brief early pour safely into the next mould, so this only bites a genuinely careless or
sustained stream), but cross the limit and it costs a strike exactly like overflowing a
mould, shown as the same "SPILL" call-out at the chute with no mould to point at.

This closes a loophole the tail otherwise leaves open: without it, the only cost of pouring
early is wasted concrete with no scoreboard consequence, so a player under pressure can
just hold the button through every gap and let the tail sort out where it lands. Now the
*press* has to be timed, not only the release — which is the point: it makes the game a
little trickier without changing what a correct pour looks like.

A puddle at the chute base grows and reddens as it builds, so the danger is visible before
it strikes rather than a strike arriving out of nowhere — the same fairness principle as
the telegraphed tail above.

### Three strikes

A strike is a mould spilling, a mould exiting the screen badly underfilled, or a ground
spill. Three icons across the top, filled in as you lose them.

Chosen because it needs no explanation to anyone anywhere, it is readable at a glance
mid-panic, and combined with the difficulty ramp it caps run length naturally — which is a
queue-management requirement, not just a design preference.

### Scoring

```
mouldScore = basePoints(mouldType) × accuracyTier × comboMultiplier
```

- `comboMultiplier` climbs on consecutive Perfects, caps at some ceiling (start with ×8),
  resets to ×1 on any underfill or spill.
- Final scores land in the thousands — e.g. `14,850`.

Why points rather than a simple count of moulds: **ties**. A plain count produces heavy
clustering at the top, and with a prize on the line an ambiguous winner is a real problem.
Multiplicative scoring spreads the distribution out so the top of the leaderboard is
unambiguous.

**Tie-break rule:** if two players do somehow tie, the **earlier submission wins** — first
to reach the score. Stated in the T&Cs so nobody argues on the day.

### Difficulty ramp

Three levers, all scaling with time survived:

1. **Scroll speed** — moulds arrive faster, less time to read and react.
2. **Tolerance band width** — the Perfect band narrows.
3. **Mix switching** — the chute changes product mid-run, changing flow rate and tail
   length. This is the highest-skill pressure and it arrives last.

Tuning target: **median run 35–45 seconds; a strong player capped near 90.** Tune against
real people, not intuition — see the playtest note below.

### Variety without extra buttons

Depth comes from the objects, not the controls.

**Mould types:**

| Mould | Shape | Behaviour |
|---|---|---|
| Slab | Wide, shallow | Forgiving. Fills slowly, generous band. Early game. |
| Lintel | Medium | The workhorse. Baseline difficulty. |
| Column | Narrow, tall | Fills fast, punishing. Small tail is a big overshoot. |
| Foundation strip | Very wide | Long pour, tests holding steady rather than timing. |

**Mixes** (this is where the product range lives):

| Mix | Flow rate | Tail |
|---|---|---|
| Screed | Fast | Long — worst overshoot |
| General purpose | Medium | Medium |
| High-strength | Slow | Short — most controllable, but slow means fewer moulds |
| Mortar | Slow, viscous | Very short, almost no tail |

Named on the chute as real ARPS products once the brand pack lands (branch 1). A player
learns the product range by developing a feel for it, which is a far better outcome than an
interstitial telling them about it.

### Brand depth: themed, not preachy

- Real product types as game objects, named subtly on the chute and mould art.
- Logo on the title, results and leaderboard screens.
- **No interstitials, no product facts between rounds, no gameplay interruption.**

A trade buyer at a stand has already opted into the sales conversation by being there. The
game's job is to be worth playing; the branding rides along.

## Attempts and what counts

Three attempts per person. **Best single run counts.**

This frees players to experiment on run one, which matters enormously given the tail
mechanic needs a run to click. A "sum of three" rule would have made a fumbled first run
feel unrecoverable and soured people on the stand.

## Game feel checklist

The difference between a forgettable stand game and one people queue for is almost entirely
in the juice. Budget real time for this — it is the highest-risk item on the schedule
because it cannot be estimated, only iterated.

- Screen shake on spill, scaled to severity
- Dust puff and aggregate chips on pour impact
- Concrete surface ripple while filling, settling when you stop
- Combo counter that scales, rotates and glows as it climbs
- Perfect pours flash a screed line across the mould with a satisfying snap
- Time hitch (2–3 frames) on a spill — sells the mistake
- Chute closing animation that clearly telegraphs the tail
- Score numbers that fly to the counter rather than incrementing invisibly
- **All of it must read with sound off**

## Playtesting

Non-negotiable, and the single most common thing skipped:

- Get **at least 8 people who have never seen it** to play three runs each, before week 5.
- Watch where they look. If they never see the target line, the line is wrong.
- If more than half don't beat their first score by run three, the tail is not learnable
  enough — soften it.
- If nearly everyone is scoring within 10% of each other, the ramp is too flat and the
  leaderboard will be a lottery.

## Open items

- Prize structure — single winner, top 3, or top 10? Affects how many finalists get
  verified in the live final (branch 4) and the T&Cs wording (branch 5).
- Whether to show a player their rank immediately after each run. Recommended yes; it
  drives the third attempt. Needs a live leaderboard read on submit, which the offline
  design (branch 6) must tolerate failing gracefully.
