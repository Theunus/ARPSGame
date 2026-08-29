# What we need from ARPS before going live

Not legal advice — an engineering checklist. ARPS's advisor signs off the
compliance items; the code is built so that sign-off is a review, not a rebuild.

## Blocks a real deployment

- **A Supabase project** (ideally in ARPS's own account, so the personal data
  sits with the Responsible Party). The schema and both Edge Functions are built
  and proven against a local copy — this is the only thing left before deploying.
  Free tier is enough at this scale (500 MB DB, 5 GB bandwidth, ~500 players).
- **DNS**: one CNAME for the QR-code subdomain pointing at Cloudflare Pages.

## POPIA / data protection

- **Roles**: ARPS is the Responsible Party; whoever operates the game is the
  Operator. This needs a written s21 Operator agreement before any real data is
  collected.
- **Information Officer**: ARPS must name one (on the privacy notice) and confirm
  they're registered with the Information Regulator.
- **Privacy notice**: ARPS's policy URL, or approval of a short competition notice.
- **Consent**: built competition-only — the form collects a single entry consent
  and no marketing opt-in. This is the safest position, but it means ARPS cannot
  later market to entrants; s69 consent can't be captured retroactively. Confirm
  this is the intended call before the event.
- **Data region**: hosted in the EU (GDPR adequacy satisfies POPIA s72 on
  cross-border transfer). ARPS should acknowledge this in the notice.
- **Retention**: a purge/anonymisation job for non-winners is not yet built —
  agree a retention window and who runs it.
- **Breach contact**: a named person to notify immediately if data is compromised.
- **Lead handover**: contact details are encrypted at rest; export them to ARPS
  over a secure channel, never an emailed spreadsheet. (No decryption/export code
  exists yet — it would be added deliberately and audited.)

## Consumer Protection Act (promotional competition)

CPA s36 / Reg 11 governs this. ARPS needs written T&Cs (free entry, who may enter,
the competition window, how the winner is determined, that finalists play a
verification round, prize details, records kept 3 years) linked from the entry form
before the QR code goes to print.

## Brand assets still outstanding

- Logo files (SVG/PNG) — colours are already applied; the mark itself isn't.
- Licensed **web** font — the game uses a system-font stack until then.
- Approval to use real product names for the concrete mixes in-game.
