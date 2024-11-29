import { Batsmen } from './batsmen.interface';
import { Bowler } from './bowler.interface';

export class BALL_DATA {
  class: string = 'none';
  label: string = '-';
  hasBeenBowled: boolean = false;
  isExtra: boolean = false;
  currentRuns: number = 0;
  wicketsLost: number = 0;
  extras: { [key: string]: number } = { w: 0, nb: 0, lb: 0, b: 0 };
  currentPatnership: { runs: number; balls: number } = { runs: 0, balls: 0 };
  striker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  nonStriker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  currentBowler: Bowler = {
    name: '',
    runs: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
    extras: { w: 0, nb: 0, lb: 0 },
  };
}
