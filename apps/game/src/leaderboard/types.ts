/**
 * Shape of a leaderboard row, as the public view will eventually return it.
 *
 * Deliberately the same shape as the `public_leaderboard` view described in
 * artifacts/grill-me/PourLine-Grill-Me-5.md: only what is safe to put on a
 * screen a stranger can walk up to. No email, no phone, no full name — the
 * view this will one day query is structurally incapable of returning them,
 * and this type should stay just as narrow.
 */
export interface LeaderboardRow {
  rank: number;
  /** "First L." — first name plus last initial. Never a full name. */
  displayName: string;
  score: number;
  bestCombo: number;
  mouldsCompleted: number;
}
