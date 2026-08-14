import type { LeaderboardRow } from './types.ts';

/**
 * Sample rows so the UI, the polling, and the reorder animation can all be
 * built and demoed before the backend exists. Scores are hand-picked to sit
 * inside the real distribution `npm run tune` measures (expert median ~52k,
 * max observed ~66k) rather than round or implausible numbers, so this reads
 * as "the leaderboard with nobody playing yet," not as obviously fake data.
 *
 * THE SEAM: when Supabase lands, replace the body of `fetchLeaderboard` with
 * a query against the `public_leaderboard` view from
 * artifacts/grill-me/PourLine-Grill-Me-5.md — `select display_name,
 * verified_score, ... order by verified_score desc limit $1`. That view is
 * structurally incapable of returning contact details, so nothing else here
 * — the row shape, the polling loop, the rendering — needs to change.
 */
const MOCK_ROWS: ReadonlyArray<Omit<LeaderboardRow, 'rank'>> = [
  { displayName: 'Sipho M.', score: 68420, bestCombo: 8, mouldsCompleted: 52 },
  { displayName: 'Chloe R.', score: 64110, bestCombo: 8, mouldsCompleted: 49 },
  { displayName: 'Aisha K.', score: 59870, bestCombo: 7, mouldsCompleted: 47 },
  { displayName: 'Pieter V.', score: 55340, bestCombo: 7, mouldsCompleted: 45 },
  { displayName: 'Naledi T.', score: 51920, bestCombo: 6, mouldsCompleted: 43 },
  { displayName: 'Ryan D.', score: 47680, bestCombo: 6, mouldsCompleted: 41 },
  { displayName: 'Zanele P.', score: 44210, bestCombo: 6, mouldsCompleted: 39 },
  { displayName: 'Kabelo S.', score: 40850, bestCombo: 5, mouldsCompleted: 38 },
  { displayName: 'Emma W.', score: 37600, bestCombo: 5, mouldsCompleted: 36 },
  { displayName: 'Thabo N.', score: 34120, bestCombo: 5, mouldsCompleted: 34 },
  { displayName: 'Farhana I.', score: 30870, bestCombo: 4, mouldsCompleted: 32 },
  { displayName: 'Josh B.', score: 27540, bestCombo: 4, mouldsCompleted: 30 },
  { displayName: 'Lindiwe C.', score: 24310, bestCombo: 4, mouldsCompleted: 28 },
  { displayName: 'Werner H.', score: 21050, bestCombo: 3, mouldsCompleted: 26 },
];

/** Rounds trip through a Promise and a small delay so the loading state is real. */
export function fetchLeaderboard(limit = 50): Promise<LeaderboardRow[]> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const rows = MOCK_ROWS.slice(0, limit).map((row, i) => ({ ...row, rank: i + 1 }));
      resolve(rows);
    }, 220);
  });
}
