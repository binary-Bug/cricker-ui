import { BALL_DATA } from './ball_data.class';
import { Batsmen } from './batsmen.interface';
import { Bowler } from './bowler.interface';
import { Fielder } from './fielder.interface';

export interface Team {
  name: string;
  captain: string;
  runsScored: number;
  oversPlayed: number;
  wicketsLost: number;
  runRate: number;
  oversPlayedData: BALL_DATA[][];
  extras: { [key: string]: number };
  Batsmens: Batsmen[];
  Bowlers: Bowler[];
  Fielders: Fielder[];
  strikerIndex: number;
  nonStrikerIndex: number;
  currBowlerIndex: number;
}
