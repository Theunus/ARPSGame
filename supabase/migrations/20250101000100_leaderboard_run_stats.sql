-- Adds combo/moulds stats and rebuilds public_leaderboard to pull one whole
-- best run per player rather than independently maxed columns.

alter table runs add column max_combo int;
alter table runs add column moulds_completed int;

drop view public_leaderboard;

-- DISTINCT ON picks one run per player: best verified score, earliest
-- submission breaking a tie. Wrapped so the outer query can sort by score.
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

grant select on public_leaderboard to anon, authenticated;
