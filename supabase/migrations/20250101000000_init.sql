-- Pour Line — core schema.
--
-- Design record: artifacts/grill-me/PourLine-Grill-Me-4.md (attempts/anti-cheat)
-- and PourLine-Grill-Me-5.md (POPIA). This migration is the schema those two
-- documents describe, not a simplified version of it.
--
-- Access model: every table here has row-level security enabled with NO
-- policies granted to anon/authenticated. That is deliberate, not an
-- oversight — the anon key can reach this data through exactly one door,
-- `public_leaderboard`, and that view is structurally incapable of returning
-- anything but a display name and a score. Every other read and every write
-- goes through an Edge Function using the service-role key, which bypasses
-- RLS by design. If a future change adds a policy here, it should be because
-- a specific, narrow case needs it — not as a convenience.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------

create table players (
  id                   uuid primary key default gen_random_uuid(),

  -- Keyed HMAC of the *normalised* email (lowercase, +tag stripped, Gmail dots
  -- stripped). This is what enforces "one email, three attempts" and what
  -- dedupe-checks against on registration — without ever decrypting anything.
  email_hmac           text not null unique,
  -- AES-GCM ciphertext of the real email, plus its IV. Only an Edge Function
  -- holding EMAIL_ENC_KEY can ever turn this back into a plaintext address —
  -- see supabase/functions/_shared/crypto.ts.
  email_ciphertext     text not null,
  email_iv             text not null,

  full_name            text not null,
  -- "First L." — first name plus last initial. The ONLY name-shaped thing
  -- that ever reaches the public leaderboard view.
  display_name         text not null,

  phone_hmac           text,
  phone_ciphertext     text,
  phone_iv             text,

  consent_competition  boolean not null,
  consent_marketing    boolean not null default false,
  -- Which exact wording they agreed to — see Grill-Me-5. Lets us prove later
  -- what a specific person actually consented to.
  consent_version      text not null,
  consented_at         timestamptz not null default now(),
  is_adult             boolean not null,

  created_at           timestamptz not null default now(),
  -- Set by the 30-day purge job (not yet built). Non-null means the contact
  -- columns above have been nulled and the HMACs destroyed.
  anonymised_at        timestamptz
);

comment on table players is
  'One row per registered attendee. Contact fields are encrypted; email_hmac is what dedupe and the 3-attempt cap key against.';

alter table players enable row level security;

-- ---------------------------------------------------------------------------
-- play_tokens
-- ---------------------------------------------------------------------------

create table play_tokens (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  -- 1, 2 or 3. All three are issued at once at registration (Grill-Me-4) so a
  -- player who loses signal after registering can still complete every run.
  attempt_no   int  not null check (attempt_no between 1 and 3),
  -- The sim seed for this attempt. Not a secret — the client needs it to run
  -- the deterministic simulation locally. What IS secret is the HMAC
  -- signature carried in the token string handed to the client; this row's
  -- id is only ever reachable by presenting a token that verifies against it.
  seed         bigint not null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz,

  unique (player_id, attempt_no)
);

comment on table play_tokens is
  'Capability tokens, three per player, issued together at registration. used_at is set the moment a run is submitted against it, whether or not that run verifies.';

alter table play_tokens enable row level security;

create index play_tokens_player_id_idx on play_tokens (player_id);

-- ---------------------------------------------------------------------------
-- runs
-- ---------------------------------------------------------------------------

create table runs (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  token_id        uuid not null references play_tokens(id),
  attempt_no      int  not null,
  seed            bigint not null,
  -- The exact input log submitted, as recorded by packages/sim. This is what
  -- lets a disputed score be re-replayed by hand later, not just re-checked
  -- once at submission time.
  input_log       jsonb not null,
  claimed_score   int  not null,
  -- Null until validated. Only ever set to the value packages/sim's
  -- simulate() actually produced when replaying seed + input_log — never to
  -- claimed_score directly.
  verified_score  int,
  status          text not null default 'pending'
                    check (status in ('pending', 'verified', 'rejected', 'void')),
  duration_frames int,
  client_version  text,
  submitted_at    timestamptz not null default now(),
  validated_at    timestamptz
);

comment on table runs is
  'Every submitted run, verified or not. The leaderboard reads only status = verified — see public_leaderboard.';

alter table runs enable row level security;

create index runs_player_id_idx on runs (player_id);
-- Serves the leaderboard's "best verified score per player" query directly.
create index runs_leaderboard_idx on runs (status, verified_score desc) where status = 'verified';

-- ---------------------------------------------------------------------------
-- admin_audit
-- ---------------------------------------------------------------------------

create table admin_audit (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,
  action     text not null,
  target_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);

comment on table admin_audit is
  'Every discretionary admin action — void a run, grant an attempt, export leads, toggle the window. No admin UI exists yet; this table is ready for it.';

alter table admin_audit enable row level security;

-- ---------------------------------------------------------------------------
-- public_leaderboard
-- ---------------------------------------------------------------------------

-- The only door anon ever gets. A player's best VERIFIED score, and nothing
-- about them except the display name computed at registration. This works
-- despite RLS being enabled on both base tables because the view is owned by
-- the migration role (which bypasses RLS on tables it owns) and is queried
-- for its own privileges, not the caller's — the standard Postgres/Supabase
-- pattern for exposing a narrow slice of an RLS-protected table. Do not add
-- `security_invoker` to this view; that would defeat the point.
create view public_leaderboard as
select
  p.display_name,
  max(r.verified_score) as score
from runs r
join players p on p.id = r.player_id
where r.status = 'verified'
group by p.id, p.display_name
order by score desc;

comment on view public_leaderboard is
  'The ONLY thing the anon key can read. One row per player: display name and their best verified score. Cannot return an email, a phone number, or a full name — the query does not select them.';

grant select on public_leaderboard to anon, authenticated;
