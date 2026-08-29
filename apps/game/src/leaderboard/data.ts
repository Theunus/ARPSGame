import { MAX_COMBO_MULT } from '@pourline/sim';
import type { LeaderboardRow } from './types.ts';

// Same fixed local-dev demo key used by api.ts — see the comment there.
const LOCAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

const REST_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/rest/v1`
  : 'http://127.0.0.1:54321/rest/v1';
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? LOCAL_ANON_KEY;

interface LeaderboardRecord {
  display_name: string;
  score: number;
  max_combo: number | null;
  moulds_completed: number | null;
}

/**
 * Reads `public_leaderboard` directly via PostgREST — no Edge Function needed
 * for this, since the view (supabase/migrations/20250101000100_leaderboard_run_stats.sql)
 * is already narrow enough to expose to the anon key on its own: one row per
 * player, their single best verified run, nothing that could identify them
 * beyond the display name computed at registration.
 */
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
    // The stored value is the raw longest perfect streak, which can run well
    // past the multiplier ceiling. ResultsScene caps its own "Best combo"
    // stat at MAX_COMBO_MULT for the same run, so this has to match — showing
    // an uncapped number here would look like a discrepancy against what the
    // player already saw on their own screen for the identical run.
    bestCombo: Math.min(r.max_combo ?? 0, MAX_COMBO_MULT),
    mouldsCompleted: r.moulds_completed ?? 0,
  }));
}
