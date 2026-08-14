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
| ⬜ | Registration, POPIA consent, Supabase schema, Edge Functions |
| ⬜ | Service worker, offline submission queue, play tokens |
| ⬜ | Admin page, big-screen leaderboard |
| ⬜ | ARPS brand assets |

---

## Getting started

```bash
npm install
```

```bash
npm run dev
```

Vite prints a **Network** URL alongside the local one. Open that on your phone —
this game is tuned by thumb, and a desktop mouse tells you nothing about whether
the pour feels right.

| Command | |
|---|---|
| `npm run dev` | Dev server, exposed on the LAN for phone testing |
| `npm run build` | Production build |
| `npm test` | Simulation tests — **the load-bearing ones** |
| `npm run typecheck` | Typecheck both workspaces |
| `npm run tune --workspace=@pourline/sim` | Difficulty and score distribution report |

---

## Layout

```
packages/sim/      Deterministic simulation. No DOM, no Phaser, no randomness.
apps/game/         Phaser 3 client. Renders the sim; never owns game state.
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

Not yet wired up — see the status table above.
