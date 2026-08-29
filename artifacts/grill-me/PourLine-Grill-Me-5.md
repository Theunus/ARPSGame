# Pour Line — Grill Me 5: POPIA, Consent & Data Protection

_Branch 5 of 6. See the [index](./PourLine-Grill-Me-index.md)._

> **Not legal advice.** This is an engineering design shaped to satisfy POPIA, written so
> that the client's legal sign-off is a review rather than a rebuild. Section references
> should be confirmed by their advisor. Everything the client must supply or approve is
> listed in [CLIENT-REQUIREMENTS.md](../../CLIENT-REQUIREMENTS.md).

## Decisions

| Question | Decision |
|---|---|
| Responsible Party | **The client (ARPS). You are the Operator.** |
| Consent structure | **Two separate checkboxes; marketing one unticked by default** |
| Retention | **Non-winners anonymised 30 days post-event** |
| Public leaderboard | **First name + last initial only** |
| Data residency | **EU** |

## Roles

Under POPIA, the **Responsible Party** determines the purpose and means of processing. That
is the client: they want the leads, they set the competition, they own the outcome.

You are the **Operator** — you process on their behalf and on their instruction.

Two hard consequences:

1. **s21 requires a written contract between Responsible Party and Operator.** It is a
   one-pager, but it must exist before the event. It obliges you to secure the data and to
   notify them immediately of any compromise.
2. **Their Information Officer** is named on the privacy notice, not you. Their Information
   Officer must be registered with the Information Regulator.

The notice text, the named party and the contact address are all **config values**, not
hardcoded strings, so they can be corrected late without a code change.

## The consent structure

This was the sharpest issue in the whole design, and it needs the client to make a
commercial decision before the form is finalised.

Your original brief was a single box confirming the data would be used to contact winners
and **not used for other purposes**. That is the cleanest possible POPIA position — and it
also means the client legally cannot add these 500 people to a mailing list afterwards.
A cement supplier running a lead-capture competition at a trade expo almost certainly wants
exactly that.

**s69 requires prior opt-in consent for electronic direct marketing to anyone who is not
already a customer.** That consent cannot be manufactured after the event. So it is captured
correctly on the day, or the leads are unusable for marketing. Permanently.

### What gets built

**Box 1 — required to enter.**

> I agree that [Client] may process my name, email address and phone number in order to run
> this competition, verify my entries and contact me if I win. I confirm I am 18 or older.

**Box 2 — separate, unticked, entirely optional.**

> I would also like [Client] to contact me about their products and services. I can
> unsubscribe at any time.

Design rules, enforced in code:

- Box 2 **defaults to unticked**. Never pre-ticked.
- Entry is **not conditional** on box 2. Ticking it grants no advantage, no bonus attempt,
  no in-game perk — bundling consent to a reward puts it on shakier ground.
- The two are visually distinct, not stacked to look like one control.

Both stored as separate booleans, alongside `consent_version` and `consented_at` — so you
can always prove exactly which wording a specific person agreed to.

Bundling these into one checkbox is the classic POPIA failure and is not being built.

**Built, with a decision made:** competition-only. `register.html` ships **box 1 only** —
`consentMarketing` is always sent `false`, and there is no marketing checkbox in the form at
all. This landed as a straight decision rather than the feature flag originally sketched
above — simpler, and reversing it is still a small, well-understood change: box 2's exact
copy already exists in this document, the `players.consent_marketing` column already exists
in the schema and already defaults correctly, and `register.html`'s existing `.check-row`
markup is a direct template for adding it back. See
[CLIENT-REQUIREMENTS.md item 2.2](../../CLIENT-REQUIREMENTS.md) — this default needs an
explicit sign-off from ARPS, not just inheriting a developer's privacy-first instinct,
**before** the event, since s69 consent cannot be captured retroactively once it's run.

## Data minimisation

- **Phone number is optional and marked optional.** Email alone is sufficient to contact a
  winner, so a mandatory number is hard to justify as necessary for running a competition.
  Optional keeps it defensible while still capturing it from most trade visitors, who expect
  follow-up.
- No date of birth, no company, no job title, no address. Every extra field needs a
  justification and none of them have one.
- Nothing is collected silently. No third-party analytics, no advertising pixels, no session
  recording. The IP and user-agent hashes used for abuse detection are **hashes**, retained
  only until the purge.

## Age

POPIA treats under-18s as children requiring a competent person's consent. The audience is
trade buyers, so a self-declared **"I am 18 or older"** affirmation inside box 1 is
proportionate. The T&Cs should restrict entry to 18+ so this is consistent, and stand staff
should be told not to hand the QR to visiting kids as an activity.

## Security measures (s19)

| Control | Implementation |
|---|---|
| In transit | TLS everywhere. HSTS. No mixed content. |
| At rest | Supabase encrypts the volume. **Plus** application-level encryption of email and phone — see below. |
| Access control | Postgres RLS on every table. The anon key has **no** select on `players`. |
| Public surface | The leaderboard view exposes only `display_name` and `verified_score` — structurally incapable of returning contact details. |
| Admin access | Password-gated, separate credential, not shared with stand staff. |
| Auditability | Every admin action — void, grant, export, window toggle — written to `admin_audit` with the actor. |
| Logs | No PII in application logs or error reports. Log the player UUID, never the email. |
| Secrets | Encryption key and HMAC key as Supabase/Cloudflare secrets. Never in the repo. |

### Application-level encryption

You said the data must be stored securely, so this goes beyond the platform default:

- `email_ciphertext` — AES-GCM, key held as a server secret, encrypted and decrypted only
  inside Edge Functions.
- `email_hmac` — a keyed HMAC of the *normalised* address, with a unique index.

The HMAC is what makes this practical: **duplicate detection and attempt counting work
without ever decrypting anything.** Plaintext contact details are reachable only by a
deliberate, audited export.

Cost: the admin CSV export has to decrypt, and losing the key means losing the leads. Keep
the key in a password manager as well as in the platform secret store. Roughly half a day of
work for meaningful defence in depth on the only genuinely sensitive data in the system.

## Cross-border transfer (s72)

Neither Supabase nor Firebase has a South African region. s72 restricts transfer abroad
unless the recipient is subject to comparable protection — **GDPR qualifies**, so EU hosting
(Frankfurt or Ireland) stands on its own legal footing rather than resting entirely on
consent.

US hosting would be defensible only by leaning on the consent clause alone, which is a
weaker position if anyone ever asks. South African hosting removes the question entirely but
means a self-managed VPS: not free, and your problem at 2am on event night.

The privacy notice must still disclose that data is processed in the EU.

## The public leaderboard

Displays **first name plus last initial** — "Theunus S. — 14,850". Enough for someone to
recognise themselves, minimal disclosure.

`display_name` is computed **at registration** and stored as its own column. The public
endpoint reads a view that has no access to `full_name`, `email_ciphertext` or
`phone_ciphertext`. This is a structural guarantee, not a filtering convention — it cannot
leak by someone forgetting a `select` clause.

The privacy notice states that a first name and last initial may appear on a public
leaderboard at the event.

## Retention

| Data | Retention |
|---|---|
| Non-winners, no marketing consent | **Anonymised 30 days after the event** |
| Marketing opt-ins | Retained by the client under their own policy, unsubscribe honoured |
| Winners | Until prizes are fulfilled, then per client policy |
| Competition records (CPA) | See below — three years |
| Scores and runs | Retained indefinitely in **anonymised** form for stats |

"Anonymised" means the contact columns are nulled and the HMACs destroyed, leaving an
unlinkable score row. Not a soft delete.

Implemented as a **scheduled job**, not a diary reminder. The retention window is a config
value so the client can change it without a deployment.

## Data subject rights

The notice carries an email address for access, correction and deletion requests (ss23–24).
Deletion is a real operation in the admin, not a manual SQL statement — and it is audited.

## Breach notification (s22)

If personal data is compromised, POPIA requires notifying the Information Regulator and the
affected people. Practically:

- You are the Operator, so you must tell the client **immediately** — this is in the s21
  agreement.
- The client, as Responsible Party, notifies the Regulator and the data subjects.
- Agree the contact person and channel **before** the event, not during an incident.

## The Consumer Protection Act — the thing nobody mentioned

POPIA governs the data. **CPA s36 and Regulation 11 govern promotional competitions in
South Africa**, and this is one. This is the client's legal obligation, not yours, but the
entry form has to link to the rules, so someone must write them.

The T&Cs need to cover, at minimum:

- Who is running it, and that entry is free
- Who may enter (18+, exclusions for staff and family)
- The competition window — opening and closing date and time
- Exactly how the winner is determined: **highest single verified run**
- **That finalists must play a verification round at the stand to claim a prize** (branch 4)
- The tie-break rule: **earliest submission wins**
- The prize, its value, and how and when it will be handed over
- How and when winners are notified
- That the rules are available free on request
- That records are retained for **three years**, as the CPA requires

Note the three-year competition-records requirement sits alongside the 30-day POPIA purge.
These are reconcilable — keep the *competition record* (who won, what score, when) for three
years, and purge the *marketing-irrelevant contact details* of non-winners at 30 days. Have
the client's advisor confirm the split.

## Open items

- ~~Client's decision on marketing consent — box 2 on or off.~~ Built as off
  (competition-only) by default — needs ARPS's explicit sign-off, not just inheriting that
  default, before the event.
- Client's Information Officer name, contact and registration status.
- Signed s21 Operator agreement.
- Who writes the CPA T&Cs, and by when. **They are needed before the QR code goes to print.**

All tracked in [CLIENT-REQUIREMENTS.md](../../CLIENT-REQUIREMENTS.md).
