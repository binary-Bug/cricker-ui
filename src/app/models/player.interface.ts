export interface Player {
  name: string;
  matchesPlayed: number;
  won: number;
  lost: number;
  runsScored: number;
  ballsPlayed: number;
  fours: number;
  sixes: number;
  overs: number;
  runsAgainst: number;
  wickets: number;
  maidens: number;
  catches: number;
  runOuts: number;
  stumpOuts: number;
  matchIds: string[];
  bbi: BestBowling;
  highestScore: number;
  isNotOutHS: boolean;
  /** Lifetime sum of MVP points earned across every match played (not just matches where this player made the top 5) - see MvpCalculatorService/PlayerService.applyMvpPointsToPlayers. */
  mvpPoints: number;
  /** Number of times this player has been named Man of the Match (i.e. ranked #1 for MVP points) across their career. */
  momCount: number;
  /** This player's single highest MVP points total in any one match, across their career. */
  bestMvpPoints: number;
  /** The matchId (see matchIds) of the match where bestMvpPoints was earned - '' if the player hasn't played a match yet. Used to link to that match from player-details. */
  bestMvpMatchId: string;
  /** MVP points earned in each match, in the same order as matchIds (one entry per match) - powers the MVP trend sparkline on player-details. */
  mvpPointsHistory: number[];
}

export interface BestBowling {
  wickets: number;
  runs: number;
}
