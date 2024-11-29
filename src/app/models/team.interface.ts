import { BALL_DATA } from './ball_data.class';

export interface Team {
  name: string;
  captain: string;
  runsScored: number;
  oversPlayed: number;
  wicketsLost: number;
  runRate: number;
  oversPlayedData: BALL_DATA[][];
  extras: { [key: string]: number };
}
