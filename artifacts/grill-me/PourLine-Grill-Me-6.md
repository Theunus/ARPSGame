# Pour Line — Grill Me 6: Event Day Operations

_Branch 6 of 6. See the [index](./PourLine-Grill-Me-index.md)._

These things fail on the day, not in the repo. This branch is about 14:30, when the wifi has
died and someone is asking why their score vanished.

## Decisions

| Question | Decision |
|---|---|
| Entry point | **QR code on stand materials → client subdomain** |
| Competition window | **Hard server-side window, plus a manual kill switch** |
| Offline resilience | **Service worker + pre-fetched tokens + queued submission** |
| Admin | **Minimal password-gated admin page** |
| Big-screen leaderboard | Yes, if a screen is available at the stand |

## Getting people to the game

A **QR code** pointing at a client subdomain — `build.arps.co.za` or similar. Needs one
CNAME record from whoever runs the client's DNS.

Practical details that matter more than they sound:

- **Large QR on the main banner, plus small ones on table talkers and the counter.** One QR
  on one banner creates a physical bottleneck — people crowd one spot and the queue stops
  being a queue.
- Print the URL in readable text underneath. QR scans fail in bad light and on old cameras.
- Test the printed QR with several real phones **before** the print run. Test the actual
  printed artefact, not the screen version.
- A `.pages.dev` URL on a printed banner looks like a test build. Worth the DNS request.

**Lead time.** Printed materials have a deadline weeks before the event, and the QR must
point at a domain that already resolves. This is often the earliest hard deadline in the
project — earlier than the game being finished. Confirm it in week 1.

## Competition window

Scores are accepted **only between a configured open and close time**, enforced server-side.

Without this, the link works forever and someone grinds attempts from their couch at
midnight, or wins without attending. The window also gives a clean judging cut-off.

Plus a **manual kill switch** in the admin, because events start late and overrun. Barely
any extra work and it removes a whole category of panic.

Before the window opens the game runs in **practice mode**: fully playable, scores not
submitted, clearly labelled. Lets you demo it to the client, lets staff learn it, and gives
early arrivals something to do.

## Offline resilience

Branch 1 assumed the network will be bad. Concretely:

1. **Service worker caches the whole game** — code, atlases, fonts. First load pulls it
   down; from then on the game starts instantly and survives a dropout entirely.
2. **All three play tokens are fetched at registration**, while the player is still on
   decent signal filling in the form (branch 4). A player who loses signal after registering
   can still complete all three runs.
3. **Scores queue locally** in IndexedDB and sync when connectivity returns. Replay payloads
   are a few hundred bytes, so the queue is tiny and survives a reload.
4. **A visible "saving…" state** with a clear resolution — "Score saved ✓" or "Saved on your
   device, will sync automatically". Never a silent failure. The failure mode you are
   avoiding is a player believing their run vanished, because they will tell the person next
   to them and the queue will evaporate.
5. **Retry with exponential backoff** plus a manual "retry now" button on the results screen.

If a score genuinely cannot sync before the player leaves, the results screen shows a short
**recovery code** they can give to stand staff, who can reconcile it later from the admin.

## Admin page

Password-gated, a single screen, deliberately small:

- **Live top 50**, auto-refreshing
- **Flagged runs** — replay-validation failures and plausibility outliers
- **Void a run** and **grant an extra attempt** (branch 4), both audited
- **CSV export** of consented leads, decrypting on the way out, with the export logged
- **Window toggle** — the kill switch
- **Recovery code lookup**, for scores that never synced

Built rather than relying on the Supabase table UI because at 16:00 on event day with the
client standing next to you, you want one screen with buttons, not SQL in a browser tab in a
noisy hall. Roughly half a day, and it is the thing that saves you.

The Supabase UI remains the fallback if the admin page itself has a problem.

## Big-screen leaderboard

If the stand has a TV: a full-screen auto-refreshing view showing rank, `display_name` and
score. Names shown as first name plus last initial only (branch 5).

This is the single biggest driver of a stand competition working. People play, see their
name go up, watch it get pushed down, and come back to use their remaining attempts. Without
it the game is a private experience and the crowd never forms.

**Built:** `apps/game/leaderboard.html`, a plain HTML/CSS page — not a Phaser scene, since a
data table has no business on a canvas, and this needs to be a normal page a browser can sit
on for hours unattended, not a game loop. Polls every 15s, top-3 get a rank badge, changed
rows flash briefly on refresh so a crowd watching the screen notices a shakeup without the
whole board re-animating every cycle. Reads sample rows today; the one thing left is pointing
`fetchLeaderboard()` at the real `public_leaderboard` view once Supabase exists — the row
shape it returns was designed to match that view exactly, so nothing else here changes.

Requirements to confirm with the client: is there a screen, what resolution and orientation,
and what drives it — a laptop with a browser is fine, and should be on **wired or tethered**
connectivity rather than the venue wifi.

## Event-day runbook

**A week before**

- [ ] Verify the Supabase project is awake (free tier pauses after 7 days idle — branch 3)
- [ ] Confirm the daily keep-alive ping is running
- [ ] Load test: simulate 50 concurrent submissions
- [ ] Full dry run on real phones, start to finish, including a deliberate offline run
- [ ] Confirm the competition window times are set correctly, including the timezone
- [ ] Confirm T&Cs and privacy notice are live and linked from the form (branch 5)

**Morning of**

- [ ] Load the game on two different phones on venue wifi
- [ ] Confirm admin login works, on the actual laptop being used
- [ ] Confirm the big-screen view is running
- [ ] Test one full run end to end, then void it
- [ ] Check the QR scans from where people will actually stand
- [ ] Brief stand staff: how to explain it in one sentence, what to do about a spoiled run,
      who has admin access, and **not to promise anything the T&Cs don't say**

**During**

- [ ] Watch flagged runs periodically
- [ ] Watch for unsynced scores accumulating — an early sign the network is degrading
- [ ] Keep the tablet or laptop charged; expo power is unreliable

**At close**

- [ ] Flip the kill switch to close the window
- [ ] Let the submission queue drain — wait a few minutes before judging
- [ ] Review flagged runs among the top finishers
- [ ] Run the **live final** with the top finalists (branch 4)
- [ ] Export the consented leads and hand over via the agreed secure channel — **not an
      emailed CSV of personal data**
- [ ] Record the result in a form that satisfies the CPA three-year record requirement

**After**

- [ ] Confirm the 30-day anonymisation job is scheduled and will actually fire (branch 5)
- [ ] Hand the marketing opt-in list to the client through the agreed channel
- [ ] Confirm winners were contacted and prizes fulfilled

## One-sentence pitch for stand staff

> "Pour the concrete to the line — three tries, highest score wins."

If it needs more than that, the game is too complicated for the venue.

## Open items

- Event date, times and timezone, to set the window.
- Whether a screen is available at the stand.
- Printed-materials deadline — likely the earliest hard date in the project.
- Which channel is used to hand over the exported leads.
