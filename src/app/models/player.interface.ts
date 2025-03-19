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
}
