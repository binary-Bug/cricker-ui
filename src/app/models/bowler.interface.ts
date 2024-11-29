export interface Bowler {
  name: string;
  runs: number;
  overs: number;
  maidens: number;
  wickets: number;
  extras: { [key: string]: number };
}
