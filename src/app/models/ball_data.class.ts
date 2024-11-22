import { Batsmen } from './batsmen.interface';
import { Bowler } from './bowler.interface';

export class BALL_DATA {
  class: string = 'none';
  label: string = '-';
  hasBeenBowled: boolean = false;
  isSwapped: boolean = false;
  currentRuns: number = 0;
  wicketsLost: number = 0;
  striker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  nonStriker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  currentBowler: Bowler = {
    name: '',
    runs: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
  };
}
