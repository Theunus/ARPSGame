-- Adds the two stats the leaderboard UI shows alongside score, and rebuilds
-- public_leaderboard to pull a player's whole best run (not independently
-- maxed columns, which could Frankenstein stats from two different runs).
--
-- This is a new migration rather than an edit to 20250101000000_init.sql on
-- purpose — that one is already applied; a real deployed project is changed
-- by adding migrations, never by rewriting one that already shipped.

alter table runs add column max_combo int;
alter table runs add column moulds_completed int;

drop view public_leaderboard;

-- DISTINCT ON picks exactly one run per player — their best verified score,
-- earliest submission breaking a tie, which is the tie-break rule stated in
-- the T&Cs (artifacts/grill-me/PourLine-Grill-Me-4.md). Wrapped so the outer
-- query can re-sort by score across players, since DISTINCT ON's own ORDER BY
-- has to start with the distinct column (player).
create view public_leaderboard as
select display_name, score, max_combo, moulds_completed
from (
  select distinct on (p.id)
    p.id as player_id,
    p.display_name,
    r.verified_score as score,
    r.max_combo,
    r.moulds_completed,
    r.submitted_at
  from runs r
  join players p on p.id = r.player_id
  where r.status = 'verified'
  order by p.id, r.verified_score desc, r.submitted_at asc
) best
order by score desc;

comment on view public_leaderboard is
  'The ONLY thing the anon key can read. One row per player: their single best verified run (score + combo + moulds from that same run), tie-broken by earliest submission. Cannot return an email, a phone number, or a full name — the query does not select them.';

grant select on public_leaderboard to anon, authenticated;
