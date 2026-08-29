# Pour Line — Grill Me Index

Design record for **Pour Line**, a 2D browser game built as a competition activation for
ARPS, a cement and building-materials supplier. Played by attendees on their own phones at a
trade event, with lead capture, three attempts per person, and a prize for the top score.

Twenty-four design questions resolved across six branches.

---

## The one-paragraph summary

Formwork moulds scroll along the bottom of a portrait phone screen; a mixer chute sits fixed
at the top. Hold to pour, release at the marked line. The pour has a **tail** — concrete
already in the air still has to land — so you must release early, anticipating the overshoot.
Overfill and you spill, which costs a strike; three strikes ends the run. Perfect pours chain
into a combo multiplier, and chasing that multiplier is exactly what makes you spill. Three
attempts per person, best single run counts. Built in **Phaser 3** on **Cloudflare Pages**
with **Supabase in the EU**, with a deterministic simulation shared between client and server
so every score is re-simulated and verified rather than trusted.

---

## Branches

| # | Branch | Covers |
|---|---|---|
| [1](./PourLine-Grill-Me-1.md) | **Event Context & Constraints** | Volume, timeline, connectivity, audience, brand-asset situation |
| [2](./PourLine-Grill-Me-2.md) | **Game Design** | The Pour Line mechanic, the tail, scoring, difficulty, game feel |
| [3](./PourLine-Grill-Me-3.md) | **Technical Architecture** | Phaser, hosting, the deterministic sim, data model, schedule |
| [4](./PourLine-Grill-Me-4.md) | **Identity, Attempts & Anti-Cheat** | Three-attempt enforcement, replay validation, the live final |
| [5](./PourLine-Grill-Me-5.md) | **POPIA, Consent & Data Protection** | Roles, consent structure, encryption, retention, the CPA |
| [6](./PourLine-Grill-Me-6.md) | **Event Day Operations** | QR entry, competition window, offline, admin, runbook |

**Also:** [`CLIENT-REQUIREMENTS.md`](../../CLIENT-REQUIREMENTS.md) — everything that must come
from ARPS before this can launch safely.

---

## All decisions

### Constraints (branch 1)

| Decision | |
|---|---|
| Players | 100–500, single day |
| Build window | 2–6 weeks |
| Connectivity | Assume bad — design offline-tolerant |
| Audience | Trade buyers and contractors |
| Branding | Real client, assets pending — neutral theme behind a swappable layer |

### Game (branch 2)

| Decision | |
|---|---|
| Concept | Pour Line — fill scrolling formwork moulds to a marked line |
| Control | One input. Hold anywhere to pour, release to stop |
| Skill ceiling | Pronounced, telegraphed tail on the pour. Release early |
| Fail state | Three strikes — spill or badly underfilled mould |
| Scoring | Points × accuracy tier × combo multiplier. Scores in the thousands |
| Run length | 35–45s median, expert capped near 90s |
| Variety | Four mould types, four mixes with different flow rates and tails |
| Brand depth | Themed, not preachy. Mixes named as real products. No interstitials |
| Attempts | 3 per person, **best single run counts**. Tie-break: earliest submission |

### Stack (branch 3)

| Decision | |
|---|---|
| Engine | Phaser 3 — 338 KB gzip measured, mobile-first, MIT. **Explicitly not Godot** |
| Frontend | Cloudflare Pages — Johannesburg and Cape Town edge PoPs |
| Backend | Supabase — Postgres, RLS, Edge Functions, usable admin UI |
| Region | EU (Frankfurt or Ireland) |
| Architecture rule | **Deterministic sim in `/packages/sim`, shared client and server.** Fixed 60Hz timestep, seeded PRNG, no `Math.random` |
| Build mode | I build, you review and learn |

### Integrity (branch 4)

| Decision | |
|---|---|
| Framing | Don't need every score honest — need the **winner** honest |
| Attempt key | Normalised email (lowercase, strip +tags and Gmail dots), phone as secondary flag |
| Phone field | Optional, clearly marked |
| Anti-cheat | Server re-simulates every run from seed + input log. Only verified scores rank |
| Plausibility | Outliers flagged for human review, never auto-rejected |
| Final guarantee | **Top finalists replay at the stand** before prizes |
| Spoiled runs | Admin can void a run and grant an attempt. Both audited |

### Compliance (branch 5)

| Decision | |
|---|---|
| Roles | ARPS is Responsible Party, you are Operator. **s21 written agreement required** |
| Consent | Two separate boxes. Marketing box unticked, optional, no reward for ticking |
| Minimisation | Name, email, optional phone. Nothing else. No analytics, no pixels |
| Encryption | App-level AES-GCM on contact details, HMAC index for dedupe without decrypting |
| Public data | First name + last initial only, via a view that cannot reach contact columns |
| Retention | Non-winners anonymised 30 days post-event, by scheduled job |
| Cross-border | EU hosting satisfies s72 via GDPR adequacy |
| Also | **CPA s36 promotional competition T&Cs** — nobody had raised these |

### Operations (branch 6)

| Decision | |
|---|---|
| Entry | QR on stand materials → `build.arps.co.za`. Multiple QRs to avoid a bottleneck |
| Window | Hard server-side open/close, plus a manual kill switch |
| Pre-window | Practice mode — playable, scores not submitted |
| Offline | Service worker, all three tokens pre-fetched at registration, IndexedDB submission queue, visible saving state |
| Admin | Password-gated: top 50, flagged runs, void, grant, CSV export, kill switch, recovery lookup |
| Big screen | Auto-refreshing leaderboard if a screen exists — the main driver of crowd energy |

---

## The three decisions that shaped everything else

1. **The sim is deterministic and separate from rendering.** Decided before a line of code,
   because it cannot be retrofitted. It is what makes replay validation possible, and replay
   validation is what makes the leaderboard trustworthy.

2. **Two consent checkboxes, not one.** Your original brief was a single box promising the
   data wouldn't be used for anything else. Legally cleanest, but it would have left the
   client with 500 unusable leads and no way to fix it after the fact.

3. **Assume the network is broken.** Ruled out Godot, ruled out OTP verification, and forced
   the token pre-fetch and offline queue. Nearly every technical choice traces back to it.

---

## Still open

Not blockers for starting, but they need answers before launch.

| Item | Where | Needed by |
|---|---|---|
| Prize structure — 1, 3 or 10 winners? | Branches 2, 4 | Before T&Cs are written |
| Event date, times, timezone | Branches 1, 6 | Week 1 — drives the print deadline |
| Printed-materials deadline | Branch 6 | **Week 1** — likely the earliest hard date |
| Client decision on marketing consent | Branch 5 | Before the form is finalised |
| Who writes the CPA T&Cs | Branch 5 | Before the QR goes to print |
| Information Officer details + registration | Branch 5 | Before launch |
| Signed s21 Operator agreement | Branch 5 | Before any real data is collected |
| Supabase project in whose account | Branch 3 | **Now the only blocker on a real deploy** — schema and Edge Functions are built and proven locally |
| Is there a screen at the stand | Branch 6 | Before week 4 |
| ~~Show rank immediately after each run?~~ | Branch 2 | Resolved — Results screen links straight to the live leaderboard |

All client-side items are tracked with priorities in
[`CLIENT-REQUIREMENTS.md`](../../CLIENT-REQUIREMENTS.md).

---

## Next step

Done, as of this writing: the sim, the Phaser client, the ARPS theme, and — the last big
piece — registration, POPIA consent capture, attempt limiting and server-side replay
verification, proven end to end against a real local Supabase stack (see the README's
"Registration & attempts" section for how to run it).

What's left is mostly *other people's* actions, not more code: a real Supabase project in
ARPS's account (branch 3; the one genuine blocker), the offline submission queue for bad
venue wifi (branch 6), and the admin page. See the README status table for the current
picture — it changes faster than this document does.
