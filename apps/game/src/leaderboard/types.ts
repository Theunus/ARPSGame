/** One public leaderboard row — nothing that could identify a player. */
export interface LeaderboardRow {
  rank: number;
  /** "First L." — first name plus last initial. Never a full name. */
  displayName: string;
  score: number;
  bestCombo: number;
  mouldsCompleted: number;
}
