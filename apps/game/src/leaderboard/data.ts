import { MAX_COMBO_MULT } from '@pourline/sim';
import { ANON_KEY, REST_URL } from '../supabase.ts';
import type { LeaderboardRow } from './types.ts';

interface LeaderboardRecord {
  display_name: string;
  score: number;
  max_combo: number | null;
  moulds_completed: number | null;
}

/** Reads the public_leaderboard view — one row per player, best verified run only. */
export async function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  const url = `${REST_URL}/public_leaderboard?select=display_name,score,max_combo,moulds_completed&order=score.desc&limit=${limit}`;

  const res = await fetch(url, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });

  if (!res.ok) {
    throw new Error(`leaderboard fetch failed with ${res.status}`);
  }

  const records = (await res.json()) as LeaderboardRecord[];
  return records.map((r, i) => ({
    rank: i + 1,
    displayName: r.display_name,
    score: r.score,
    // Capped to match the multiplier ceiling the player saw on their results screen.
    bestCombo: Math.min(r.max_combo ?? 0, MAX_COMBO_MULT),
    mouldsCompleted: r.moulds_completed ?? 0,
  }));
}
