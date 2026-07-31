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
  /**
   * Wall-clock time this ball was bowled. Stamped once in
   * LiveMatchService.updateBallDataRuns() - the single place every delivery
   * gets finalized.
   *
   * This is a TRANSIENT, in-memory-only field. MatchService reads it to
   * derive the 4 innings/match timestamps shown in Match Info (first/last
   * ball of each innings) purely by scanning oversPlayedData, instead of
   * tracking those 4 values imperatively. That makes the derived values
   * automatically correct after an Undo (LiveMatchService.undo() already
   * pops/resets BALL_DATA entries, so re-scanning the array "just works"
   * without any undo-specific timestamp-rollback logic).
   *
   * It is intentionally stripped out before a match is persisted to
   * Firestore (see SaveMatchService.prepareOversPlayedObj) so ball-by-ball
   * data isn't bloated with a field that's only a means to compute the 4
   * summary timestamps - those 4 values are saved as flat fields instead.
   */
  timestamp?: Date;
  striker: Batsmen = {
    name: '',
    runs: 0,
    balls: 0,
    fours: 0,
    six: 0,
    status: 'Not Out',
  };
  nonStriker: Batsmen = {
    name: '',
    runs: 0,
    balls: 0,
    fours: 0,
    six: 0,
    status: 'Not Out',
  };
  currentBowler: Bowler = {
    name: '',
    runs: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
    extras: { w: 0, nb: 0, lb: 0 },
  };
}
