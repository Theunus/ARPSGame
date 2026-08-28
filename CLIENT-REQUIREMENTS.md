# What I Need From The Client

Everything that has to come **from ARPS** before Pour Line can go live safely and legally.
Nothing in here is something I can decide or build around — each item is either a legal
requirement, a commercial decision that is theirs to make, or an access credential.

> Not legal advice. This is an engineering checklist derived from the design in
> [`artifacts/grill-me/`](./artifacts/grill-me/PourLine-Grill-Me-index.md). The client's
> legal advisor signs off the compliance items; my job is to make that a review, not a rebuild.

**Legend:** 🔴 blocks launch · 🟠 blocks a build phase · 🟡 needed, not blocking yet

---

## Ask for these in the first conversation

The four things with the longest lead times. Everything else can follow.

1. 🔴 **The event date, times and venue** — sets the competition window and, more importantly,
   reveals the printed-materials deadline, which is usually the earliest hard date in the
   whole project.
2. 🔴 **Decision on marketing consent** (item 2.2). This one cannot be fixed after the event.
3. 🔴 **Who writes the competition T&Cs, and by when** (item 1.6). They must exist before the
   QR code goes to print.
4. 🟠 **DNS access or a DNS contact** (item 4.1). Getting a CNAME added at a corporate can
   take longer than writing the game.

---

## 1. Legal and compliance

### 1.1 🔴 Confirmation that ARPS is the Responsible Party

They determine the purpose and the means; I process on their behalf as **Operator** under
POPIA. Needs to be stated explicitly, because everything below follows from it — whose
privacy notice appears, whose Information Officer is named, and who carries the liability.

### 1.2 🔴 Information Officer: name, role, email address

POPIA requires every Responsible Party to designate an Information Officer, and registration
with the Information Regulator is mandatory.

Ask for:
- Full name and job title
- A contact email address that appears publicly on the privacy notice
- **Confirmation they are registered with the Information Regulator** — if the answer is a
  blank look, that is a problem they need to fix, and it is not a problem I can fix for them

### 1.3 🔴 Existing privacy policy URL, or approval of a standalone notice

Either they have a policy I link to, or I write a short competition-specific privacy notice
and **they approve the wording**. I will not publish a notice on their behalf that nobody at
ARPS has read.

### 1.4 🔴 Signed Operator Agreement (POPIA s21)

A written contract between ARPS (Responsible Party) and me (Operator) is a **statutory
requirement**, not a nicety. It is a one-pager, and it must exist before any real personal
data is collected.

It needs to cover:
- That I process only on their documented instruction
- That I maintain appropriate security measures (s19)
- That I notify them **immediately** of any compromise (s22)
- What happens to the data when the engagement ends
- That the data is processed in the EU (see item 1.9)

### 1.5 🔴 Approved consent wording for both checkboxes

I will supply drafts. They must approve the exact final text, because the version string
they approve gets stored against every single entry as proof of what each person agreed to.

**Box 1 — required to enter:** processing name, email and phone to run the competition,
verify entries and contact winners, plus an 18+ affirmation.

**Box 2 — separate, unticked, optional:** marketing contact.

### 1.6 🔴 Promotional competition T&Cs — Consumer Protection Act s36 / Regulation 11

**This is the item most likely to be overlooked.** POPIA governs the data; the CPA governs
promotional competitions, and this is unambiguously one. It is ARPS's legal obligation, but
the entry form must link to the rules, so someone has to write them.

They must cover, at minimum:
- Who is running the competition, and that entry is free
- Who may enter — 18+, and exclusions for staff and immediate family
- The competition window: opening and closing date and time
- How the winner is determined: **highest single verified run**
- **That finalists must play a verification round at the stand to claim a prize**
- The tie-break rule: **earliest submission wins**
- The prize, its value, and how and when it is handed over
- How and when winners are notified
- That the rules are available free of charge on request
- That records are retained for **three years**, as the CPA requires

Get their legal advisor to confirm whether the prize value triggers any additional audit or
independent-observer requirements.

### 1.7 🔴 Prize details

- What exactly is the prize?
- **How many winners** — single winner, top 3, or top 10? This determines how many finalists
  play the live final and shapes the T&Cs.
- Approximate value, for the T&Cs and for judging how much anti-cheat is proportionate
- Who fulfils it, and who bears any tax consequence

### 1.8 🟠 Retention instruction

My default is **anonymise non-winners 30 days after the event**, automatically. They need to
confirm this or specify otherwise, and reconcile it with the CPA's three-year
competition-record requirement — keeping the *record of who won* is not the same as keeping
*everyone's contact details*.

### 1.9 🟠 Acknowledgement of EU data processing

Neither Supabase nor Firebase has a South African region. Data will be processed in the EU,
which satisfies POPIA s72 because GDPR is comparable protection. They need to know and
accept this, and it must be disclosed in the privacy notice.

### 1.10 🟡 Breach notification contact and process

Who at ARPS do I call, at what number, if something goes wrong? Agree this **before** the
event, not during an incident. Should be named in the s21 agreement.

### 1.11 🟡 Age policy confirmation

Entry is 18+. If they expect under-18s at the stand, that needs a guardian-consent process,
which I would strongly advise against building for a one-day event — much simpler to keep it
18+ and brief the staff.

---

## 2. Commercial decisions

### 2.1 🔴 Who receives the lead data, and how

- Named individuals authorised to receive the export
- A secure channel — **not an emailed CSV of personal data**. A password-protected share, or
  direct access to the admin. Emailing a spreadsheet of 500 people's contact details is
  precisely the kind of thing POPIA exists to discourage.

### 2.2 🔴 Marketing consent: yes or no

The commercial decision underneath the legal one, and it must be made **before the event**.

- **Yes** → box 2 appears, and ARPS can market to everyone who ticks it.
- **No** → the data is used solely to run the competition and contact winners. ARPS gets a
  winner and nothing else.

Under POPIA s69, electronic direct marketing to non-customers requires prior opt-in consent.
If that consent is not captured on the day, **it cannot be obtained retroactively** — those
leads are permanently unusable for marketing. Make sure whoever signs off understands this
before the event rather than after it.

### 2.3 🟡 Unsubscribe mechanism

If marketing consent is on, where do the opt-ins go, and how are unsubscribes honoured? If
the answer is "a spreadsheet on someone's laptop", that is a compliance risk sitting on
their side of the line — worth flagging to them in writing.

---

## 3. Brand and creative

### 3.1 🟠 Logo files

SVG preferred, PNG with transparency acceptable. Both a full-colour and a
single-colour/reversed version. **Still needed** — the colours have landed but the mark
itself hasn't, so the game currently spells "ARPS" as styled text rather than showing the
logo. A vector logo also lets us put the mark on the QR banner and the leaderboard header.

### 3.2 ✅ Brand colours — received

Taken from the ARPS logo: deep navy, hazard orange, cool grey on light. Applied as a light
theme in `apps/game/src/theme/theme.arps.ts` — navy structure and text, orange as the hero
accent (target line, combo, buttons, the winner's badge), on a soft light-grey ground that
mirrors the logo's field. The whole game and leaderboard re-themed from that one file, as
designed. If any exact hex values differ from what I sampled off the logo, they're a
one-line change each.

### 3.3 🟠 Fonts, **and the web licence**

Font files plus confirmation they are licensed for **web** use. Corporate brand fonts are
frequently print-only licensed, and this catches people out late. Until they arrive the game
uses a clean system-font stack styled to echo the logo's spaced geometric caps — no webfont
request, so nothing to load on bad venue wifi. Swapping in the real face is a two-line change
in the theme's `fonts` block. If the licence is print-only, I'll pick a close open-source
alternative.

### 3.4 🟠 Product range, with approval to use the names in-game

The concrete mixes in the game are named after real ARPS products — screed, general purpose,
high-strength, mortar or their actual equivalents. I need:
- The real product names to use
- Confirmation that using them in a game context is approved
- A check that nothing in the game implies a performance claim about a real product

### 3.5 🟡 Any product photography or textures

Optional. Helpful for the mould and material art. Not blocking.

---

## 4. Technical access

### 4.1 🟠 DNS — one CNAME record

For `build.arps.co.za` or whatever subdomain they prefer, pointing at Cloudflare Pages.

I need: who controls DNS, what the turnaround is, and the preferred subdomain. At larger
organisations this can genuinely take weeks, which is why it is in the "ask first" list.

### 4.2 🟠 Whose cloud account?

Does the Supabase project live in **their** account or mine?

- **Theirs** — better data ownership, cleaner hand-over, and it means the personal data sits
  under their control, which is the more defensible position given they are the Responsible
  Party. Needs someone at ARPS to create the project and add me.
- **Mine** — faster to set up, but the data lives with the Operator and hand-over is messier.

I would recommend theirs, and it is worth the extra setup friction.

### 4.3 🟡 Stand screen

- Is there a TV or monitor at the stand?
- Resolution and orientation?
- What drives it — a laptop is fine, but it should be on **wired or tethered** connectivity,
  not the venue wifi

### 4.4 🟡 Venue connectivity

Whatever they know: is there a dedicated stand connection, or is it shared hall wifi? The
game is built to survive a bad network either way, but it is useful to know what to expect.

### 4.5 🟡 Who holds the staff/demo code

The game has a separate showcase mode — a staff member visits a link once on their own
device to unlock unlimited plays that never touch the leaderboard, for demoing the game to
a passer-by or in a sales meeting without spending a real attendee's attempt. Covered in
full in [the design record](artifacts/grill-me/PourLine-Grill-Me-4.md#the-arps-staffdemo-account).

I need:
- Who at ARPS should receive the code (treat it like a shared password, not something to
  post in a group chat that outlives the event)
- Confirmation it should be rotated after the event, so a leaked code from this event
  doesn't work at the next one

Nothing here touches personal data or the competition record, so this is a low-priority
item — just needs an answer before the code is generated and handed over.

---

## 5. Event logistics

### 5.1 🔴 Date, times and timezone

Sets the competition window. Include the intended open and close times, not just the day.

### 5.2 🔴 Printed materials deadline

**Likely the earliest hard deadline in the project.** The QR code must point at a domain
that already resolves, so the DNS record (item 4.1) has to be live before artwork goes to
print — potentially weeks before the game itself is finished.

Confirm in week one:
- When does artwork have to be submitted?
- What is being printed — banner, table talkers, counter cards?
- Who produces the artwork, and do they need the QR as a vector file?

### 5.3 🟡 Expected attendance

To sanity-check the 500-player estimate. Not critical — the design has headroom — but it
affects staffing and how long the queue gets.

### 5.4 🟡 Stand staffing

Who is working the stand, and who gets admin access? Admin can void runs and grant extra
attempts, so it should be one or two named people, not the whole team.

### 5.5 🟡 Winner announcement plan

Announced live at the stand, or contacted afterwards? Affects the closing runbook and what
the T&Cs promise about notification.

---

## Quick status tracker

| # | Item | Priority | Status |
|---|---|---|---|
| 1.1 | ARPS confirmed as Responsible Party | 🔴 | ☐ |
| 1.2 | Information Officer details + registration | 🔴 | ☐ |
| 1.3 | Privacy policy URL or notice approved | 🔴 | ☐ |
| 1.4 | Signed s21 Operator Agreement | 🔴 | ☐ |
| 1.5 | Consent wording approved | 🔴 | ☐ |
| 1.6 | CPA competition T&Cs written | 🔴 | ☐ |
| 1.7 | Prize details and number of winners | 🔴 | ☐ |
| 1.8 | Retention instruction confirmed | 🟠 | ☐ |
| 1.9 | EU processing acknowledged | 🟠 | ☐ |
| 1.10 | Breach contact agreed | 🟡 | ☐ |
| 1.11 | Age policy confirmed | 🟡 | ☐ |
| 2.1 | Lead recipients + secure channel | 🔴 | ☐ |
| 2.2 | Marketing consent decision | 🔴 | ☐ |
| 2.3 | Unsubscribe mechanism | 🟡 | ☐ |
| 3.1 | Logo files | 🟠 | ☐ |
| 3.2 | Brand colours | ✅ | ☑ received, applied |
| 3.3 | Fonts + web licence | 🟠 | ☐ |
| 3.4 | Product names approved | 🟠 | ☐ |
| 3.5 | Product photography | 🟡 | ☐ |
| 4.1 | DNS CNAME | 🟠 | ☐ |
| 4.2 | Cloud account ownership decided | 🟠 | ☐ |
| 4.3 | Stand screen details | 🟡 | ☐ |
| 4.4 | Venue connectivity | 🟡 | ☐ |
| 4.5 | Who holds the staff/demo code | 🟡 | ☐ |
| 5.1 | Event date, times, timezone | 🔴 | ☐ |
| 5.2 | Printed materials deadline | 🔴 | ☐ |
| 5.3 | Expected attendance | 🟡 | ☐ |
| 5.4 | Stand staffing + admin access | 🟡 | ☐ |
| 5.5 | Winner announcement plan | 🟡 | ☐ |
