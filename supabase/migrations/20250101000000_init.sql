-- Pour Line core schema.
--
-- Every table has RLS enabled with NO policies for anon/authenticated. The anon
-- key reaches data through exactly one door, the public_leaderboard view; every
-- other read and write goes through an Edge Function using the service-role key.

create extension if not exists pgcrypto;

-- players -------------------------------------------------------------------
-- Contact fields are AES-GCM encrypted; email_hmac is a keyed hash of the
-- normalised email used for dedupe and the 3-attempt cap without decrypting.

create table players (
  id                   uuid primary key default gen_random_uuid(),

  email_hmac           text not null unique,
  email_ciphertext     text not null,
  email_iv             text not null,

  full_name            text not null,
  display_name         text not null,  -- "First L." — the only public identity

  phone_hmac           text,
  phone_ciphertext     text,
  phone_iv             text,

  consent_competition  boolean not null,
  consent_marketing    boolean not null default false,
  consent_version      text not null,  -- exact wording the entrant agreed to
  consented_at         timestamptz not null default now(),
  is_adult             boolean not null,

  created_at           timestamptz not null default now(),
  anonymised_at        timestamptz  -- set by the retention purge (not yet built)
);

alter table players enable row level security;

-- play_tokens ---------------------------------------------------------------
-- Three capability tokens per player, issued together at registration. seed is
-- not secret (the client needs it to run the sim); the token string's HMAC
-- signature is. used_at is set when a run is submitted, verified or not.

create table play_tokens (
  id           uuid primary key default gen_random_uuid(),
  player_id    uuid not null references players(id) on delete cascade,
  attempt_no   int  not null check (attempt_no between 1 and 3),
  seed         bigint not null,
  issued_at    timestamptz not null default now(),
  expires_at   timestamptz not null,
  used_at      timestamptz,

  unique (player_id, attempt_no)
);

alter table play_tokens enable row level security;

create index play_tokens_player_id_idx on play_tokens (player_id);

-- runs ----------------------------------------------------------------------
-- input_log keeps the run replayable by hand later. verified_score is only ever
-- the value simulate() produced on replay, never the claimed score directly.

create table runs (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null references players(id) on delete cascade,
  token_id        uuid not null references play_tokens(id),
  attempt_no      int  not null,
  seed            bigint not null,
  input_log       jsonb not null,
  claimed_score   int  not null,
  verified_score  int,
  status          text not null default 'pending'
                    check (status in ('pending', 'verified', 'rejected', 'void')),
  duration_frames int,
  client_version  text,
  submitted_at    timestamptz not null default now(),
  validated_at    timestamptz
);

alter table runs enable row level security;

create index runs_player_id_idx on runs (player_id);
create index runs_leaderboard_idx on runs (status, verified_score desc) where status = 'verified';

-- admin_audit ---------------------------------------------------------------
-- Records discretionary admin actions. No admin UI yet; table is ready for it.

create table admin_audit (
  id         uuid primary key default gen_random_uuid(),
  actor      text not null,
  action     text not null,
  target_id  uuid,
  detail     jsonb,
  created_at timestamptz not null default now()
);

alter table admin_audit enable row level security;

-- public_leaderboard --------------------------------------------------------
-- The only thing the anon key can read: one row per player, best verified score
-- and display name, nothing else. Runs with the migration role's privileges
-- (not the caller's), which is what lets it read the RLS-protected base tables.
-- Do NOT add security_invoker — that would break this.

create view public_leaderboard as
select
  p.display_name,
  max(r.verified_score) as score
from runs r
join players p on p.id = r.player_id
where r.status = 'verified'
group by p.id, p.display_name
order by score desc;

grant select on public_leaderboard to anon, authenticated;
