import { inject, Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { BALL_DATA } from '../models/ball_data.class';
import { UtilityService } from './utility.service';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { Fielder } from '../models/fielder.interface';
import { MatchMvpSummary } from '../models/mvp.interface';

@Injectable({
  providedIn: 'root',
})
export class MatchService {
  constructor() {}
  utilityService: UtilityService = inject(UtilityService);
  tossWinner: string | null = null;
  tossResult: string | null = null;
  matchResult: string | null = null;
  matchDate: string | null = null;
  totalPlayers: number | null = null;
  totalOvers: number | null = null;
  isSecondInning: boolean = false;

  /**
   * True when LoadMatchService looked for a requested match id and couldn't
   * find it in the expected Firestore collection (bad/stale id, deleted
   * match, etc.). match-details.component.html uses this to show a friendly
   * "not found" message instead of crashing when trying to render data that
   * was never actually loaded.
   */
  matchNotFound: boolean = false;

  /**
   * MVP points/Man of the Match result for this match, computed once by
   * MvpCalculatorService right when the match ends (see MatchCompleteDialog)
   * or loaded back from Firestore for a historical match (see
   * LoadMatchService.loadMatch). Undefined until either of those happens -
   * match-details.component.html only renders the MoM banner/top-5 list
   * once this is populated.
   */
  mvpSummary: MatchMvpSummary | undefined = undefined;

  /**
   * Set true by LoadMatchService once a historical match has been loaded
   * from Firestore. Historical matches don't carry per-ball timestamps
   * (they're stripped before saving - see SaveMatchService), so the 4
   * innings/match timestamp getters below can't derive their values from
   * oversPlayedData in that case. When this flag is true, the getters
   * return the flat values loaded directly from Firestore instead
   * (loadedInningsOneFirstBallTime etc.); when false (live match in
   * progress), the getters derive fresh values from oversPlayedData on
   * every read, which keeps them automatically correct across Undo.
   */
  isMatchLoadedFromHistory: boolean = false;
  loadedInningsOneFirstBallTime: Date | null = null;
  loadedInningsOneLastBallTime: Date | null = null;
  loadedInningsTwoFirstBallTime: Date | null = null;
  loadedInningsTwoLastBallTime: Date | null = null;
  team1Data: Team = {
    name: '',
    captain: '',
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [
      [
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
      ],
    ],
    extras: { w: 0, nb: 0, lb: 0, b: 0 },
    Batsmens: [],
    Bowlers: [],
    Fielders: [],
    strikerIndex: 0,
    nonStrikerIndex: 1,
    currBowlerIndex: 0,
  };

  team2Data: Team = {
    name: '',
    captain: '',
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [
      [
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
        new BALL_DATA(),
      ],
    ],
    extras: { w: 0, nb: 0, lb: 0, b: 0 },
    Batsmens: [],
    Bowlers: [],
    Fielders: [],
    strikerIndex: 0,
    nonStrikerIndex: 1,
    currBowlerIndex: 0,
  };

  teamData: { [key: string]: Team } = {
    team1: this.team1Data,
    team2: this.team2Data,
  };
  currentRoles: { [key: string]: string } = { bat: 'team1', ball: 'team2' };

  addBatsmenToTeam(batsmen: Batsmen, oldBatsmenName: string | null): void {
    this.teamData[this.currentRoles['bat']].Batsmens.push(batsmen);
    let indexOfNewBatsmen = this.teamData[
      this.currentRoles['bat']
    ].Batsmens.findIndex(
      (bts) => bts.name.toLowerCase() === batsmen.name.toLowerCase()
    );

    let si = this.teamData[this.currentRoles['bat']].strikerIndex;
    let nsi = this.teamData[this.currentRoles['bat']].nonStrikerIndex;

    if (oldBatsmenName) {
      if (
        this.teamData[this.currentRoles['bat']].Batsmens[si].name ===
        oldBatsmenName
      ) {
        this.teamData[this.currentRoles['bat']].strikerIndex =
          indexOfNewBatsmen;
        //si > nsi ? si + 1 : nsi + 1;
      } else {
        this.teamData[this.currentRoles['bat']].nonStrikerIndex =
          indexOfNewBatsmen;
        //si > nsi ? si + 1 : nsi + 1;
      }
    }
  }

  addBowlerToTeam(bowler: Bowler): void {
    this.teamData[this.currentRoles['ball']].Bowlers.push(bowler);
    this.teamData[this.currentRoles['ball']].currBowlerIndex = this.teamData[
      this.currentRoles['ball']
    ].Bowlers.findIndex((bwl) => {
      return bwl.name === bowler.name;
    });
  }

  addOrUpdateFielderToTeam(
    fielder: Fielder | undefined,
    name: string,
    cCount: number,
    sCount: number,
    roCount: number
  ): void {
    if (
      fielder &&
      this.teamData[this.currentRoles['ball']].Fielders.includes(fielder)
    ) {
      this.teamData[this.currentRoles['ball']].Fielders[
        this.teamData[this.currentRoles['ball']].Fielders.findIndex(
          (player) => {
            return player.name === fielder.name;
          }
        )
      ] = {
        name: fielder.name,
        catches: fielder.catches + cCount,
        stumpOuts: fielder.stumpOuts + sCount,
        runOuts: fielder.runOuts + roCount,
      };
    } else {
      let fielderToAdd: Fielder = {
        name: name,
        catches: cCount,
        stumpOuts: sCount,
        runOuts: roCount,
      };
      this.teamData[this.currentRoles['ball']].Fielders.push(fielderToAdd);
    }
  }

  updatePlayerReference(
    striker: Batsmen,
    nonStriker: Batsmen,
    bowler: Bowler
  ): void {
    let si = this.teamData[this.currentRoles['bat']].strikerIndex;
    let nsi = this.teamData[this.currentRoles['bat']].nonStrikerIndex;

    if (
      this.teamData[this.currentRoles['bat']].Batsmens[si].name === striker.name
    ) {
      this.teamData[this.currentRoles['bat']].Batsmens[si] = striker;
      this.teamData[this.currentRoles['bat']].Batsmens[nsi] = nonStriker;
    } else {
      this.teamData[this.currentRoles['bat']].Batsmens[si] = nonStriker;
      this.teamData[this.currentRoles['bat']].Batsmens[nsi] = striker;
    }

    this.teamData[this.currentRoles['ball']].currBowlerIndex = this.teamData[
      this.currentRoles['ball']
    ].Bowlers.findIndex((localBowler) => {
      return localBowler.name === bowler.name;
    });
    this.teamData[this.currentRoles['ball']].Bowlers[
      this.teamData[this.currentRoles['ball']].currBowlerIndex
    ] = bowler;
  }

  undoBatsmenPlayerReferenceForWicket(
    batsmenToReplace: string,
    batsmenToRefer: string
  ) {
    let si = this.teamData[this.currentRoles['bat']].strikerIndex;
    let nsi = this.teamData[this.currentRoles['bat']].nonStrikerIndex;

    if (
      this.teamData[this.currentRoles['bat']].Batsmens[
        si
      ].name.toLowerCase() === batsmenToReplace
    ) {
      this.teamData[this.currentRoles['bat']].strikerIndex = this.teamData[
        this.currentRoles['bat']
      ].Batsmens.findIndex((batsmen) => {
        return batsmen.name.toLowerCase() === batsmenToRefer;
      });
    } else {
      this.teamData[this.currentRoles['bat']].nonStrikerIndex = this.teamData[
        this.currentRoles['bat']
      ].Batsmens.findIndex((batsmen) => {
        return batsmen.name.toLowerCase() === batsmenToRefer;
      });
    }

    // remove the new bastmen who has been undoed from the batsmens list
    let indexOfTheBatsmenToRemove = this.teamData[
      this.currentRoles['bat']
    ].Batsmens.findIndex(
      (batsmen) => batsmen.name.toLowerCase() === batsmenToReplace
    );
    if (
      indexOfTheBatsmenToRemove + 1 ===
        this.teamData[this.currentRoles['bat']].Batsmens.length &&
      this.teamData[this.currentRoles['bat']].Batsmens[
        indexOfTheBatsmenToRemove
      ].runs === 0 &&
      this.teamData[this.currentRoles['bat']].Batsmens[
        indexOfTheBatsmenToRemove
      ].balls === 0
    )
      this.teamData[this.currentRoles['bat']].Batsmens.splice(
        indexOfTheBatsmenToRemove,
        1
      );
    else {
      this.teamData[this.currentRoles['bat']].Batsmens[
        indexOfTheBatsmenToRemove
      ].status = 'Retired';
    }
  }

  updateBatsmenStatus(
    batsmenName: string,
    bowlerName: string,
    wicketType: string,
    actionPlayer: string
  ): void {
    let index = this.teamData[this.currentRoles['bat']].Batsmens.findIndex(
      (batsmen) => {
        return batsmen.name === batsmenName;
      }
    );

    switch (wicketType) {
      case 'Hit-Wicket': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'Hit-Wicket';
        break;
      }
      case 'Bowled': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'b ' + bowlerName;
        break;
      }
      case 'LBW': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'lbw ' + bowlerName;
        break;
      }
      case 'Retire': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'retired';
        break;
      }
      case 'Caught': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'c ' + actionPlayer + ' b ' + bowlerName;
        this.addOrUpdateFielderToTeam(
          this.teamData[this.currentRoles['ball']].Fielders.find((player) => {
            return player.name === actionPlayer;
          }),
          actionPlayer,
          1,
          0,
          0
        );
        break;
      }
      case 'Stumped': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'st ✝' + actionPlayer + ' b ' + bowlerName;
        this.addOrUpdateFielderToTeam(
          this.teamData[this.currentRoles['ball']].Fielders.find((player) => {
            return player.name === actionPlayer;
          }),
          actionPlayer,
          0,
          1,
          0
        );
        break;
      }
      case 'Run-out': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'runout (' + actionPlayer + ')';
        this.addOrUpdateFielderToTeam(
          this.teamData[this.currentRoles['ball']].Fielders.find((player) => {
            return player.name === actionPlayer;
          }),
          actionPlayer,
          0,
          0,
          1
        );
        break;
      }
    }
  }

  public setCurrentRoles(): void {
    if (!this.isSecondInning) {
      if (this.tossWinner === 'team1') {
        if (this.tossResult === 'bat') {
          this.currentRoles = { bat: 'team1', ball: 'team2' };
        } else {
          this.currentRoles = { bat: 'team2', ball: 'team1' };
        }
      } else {
        if (this.tossResult === 'bat') {
          this.currentRoles = { bat: 'team2', ball: 'team1' };
        } else {
          this.currentRoles = { bat: 'team1', ball: 'team2' };
        }
      }
    } else {
      if (this.currentRoles['bat'] === 'team1') {
        this.currentRoles['bat'] = 'team2';
        this.currentRoles['ball'] = 'team1';
      } else {
        this.currentRoles['bat'] = 'team1';
        this.currentRoles['ball'] = 'team2';
      }
    }
  }

  calculateCurrentRunRate(): void {
    this.teamData[this.currentRoles['bat']].runRate =
      (this.teamData[this.currentRoles['bat']].runsScored /
        this.utilityService.ballplayed(
          this.teamData[this.currentRoles['bat']].oversPlayed
        )) *
      6;
  }

  calculateSecondInningsTeamValues(): void {
    // calculating target runs
    this.teamData[this.currentRoles['bat']].targetRuns =
      this.teamData[this.currentRoles['ball']].runsScored + 1;

    // calculating required runs
    this.teamData[this.currentRoles['bat']].requiredRuns =
      this.teamData[this.currentRoles['bat']].targetRuns! -
      this.teamData[this.currentRoles['bat']].runsScored;

    // calculate balls left
    this.teamData[this.currentRoles['bat']].ballsLeft =
      this.totalOvers! * 6 -
      this.utilityService.ballplayed(
        this.teamData[this.currentRoles['bat']].oversPlayed
      );

    //assign totalBalls if ballsLeft is null
    if (this.teamData[this.currentRoles['bat']].ballsLeft === null)
      this.teamData[this.currentRoles['bat']].ballsLeft = this.totalOvers! * 6;
    // calculate required run rate
    this.teamData[this.currentRoles['bat']].requiredRunRate = +parseFloat(
      this.teamData[this.currentRoles['bat']].requiredRuns! /
        this.utilityService.oversLeft(
          this.teamData[this.currentRoles['bat']].ballsLeft!
        ) +
        ''
    ).toFixed(1);
  }

  checkIfTargetChased(): boolean {
    if (
      this.teamData[this.currentRoles['bat']].runsScored >=
      this.teamData[this.currentRoles['bat']].targetRuns!
    ) {
      this.teamData[this.currentRoles['bat']].requiredRuns = 0;
      this.teamData[this.currentRoles['bat']].requiredRunRate = 0;
      return true;
    } else return false;
  }

  resetServiceData(): void {
    this.tossWinner = null;
    this.tossResult = null;
    this.totalPlayers = null;
    this.totalOvers = null;
    this.isSecondInning = false;
    this.matchNotFound = false;
    this.mvpSummary = undefined;

    // Clear the "loaded from history" timestamp fallback/flag so a fresh
    // live match derives its innings timestamps from oversPlayedData again
    // instead of reusing values leftover from a previously loaded match.
    this.isMatchLoadedFromHistory = false;
    this.loadedInningsOneFirstBallTime = null;
    this.loadedInningsOneLastBallTime = null;
    this.loadedInningsTwoFirstBallTime = null;
    this.loadedInningsTwoLastBallTime = null;

    this.team1Data = {
      name: '',
      captain: '',
      runsScored: 0,
      oversPlayed: 0,
      wicketsLost: 0,
      runRate: 0,
      oversPlayedData: [
        [
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
        ],
      ],
      extras: { w: 0, nb: 0, lb: 0, b: 0 },
      Batsmens: [],
      Bowlers: [],
      Fielders: [],
      strikerIndex: 0,
      nonStrikerIndex: 1,
      currBowlerIndex: 0,
    };

    this.team2Data = {
      name: '',
      captain: '',
      runsScored: 0,
      oversPlayed: 0,
      wicketsLost: 0,
      runRate: 0,
      oversPlayedData: [
        [
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
          new BALL_DATA(),
        ],
      ],
      extras: { w: 0, nb: 0, lb: 0, b: 0 },
      Batsmens: [],
      Bowlers: [],
      Fielders: [],
      strikerIndex: 0,
      nonStrikerIndex: 1,
      currBowlerIndex: 0,
    };

    this.teamData = {
      team1: this.team1Data,
      team2: this.team2Data,
    };
    this.currentRoles = { bat: 'team1', ball: 'team2' };
  }

  // ---------------------------------------------------------------------
  // Innings/match ball timestamps
  //
  // We only ever expose 4 values: first/last ball of innings 1 and
  // first/last ball of innings 2 (innings-1-first-ball also doubles as
  // "match start time" - see match-details UI, which labels it as such
  // rather than tracking a separate, always-identical field).
  //
  // For a LIVE match these are DERIVED on every read by scanning
  // BALL_DATA.timestamp values already stamped onto oversPlayedData
  // (see LiveMatchService.updateBallDataRuns). We deliberately avoid
  // imperatively tracking "first ball"/"last ball" fields that get
  // set-once/overwritten as balls are bowled, because that approach goes
  // stale the moment a ball is undone (Undo pops/resets BALL_DATA entries,
  // but wouldn't know how to roll back a separately-tracked field). Since
  // undo() already mutates oversPlayedData correctly, deriving from it means
  // undo is handled correctly for free, with no changes needed inside the
  // undo() method itself.
  //
  // For a match LOADED from Firestore history, per-ball timestamps aren't
  // available (they're stripped before saving to avoid bloating every ball
  // record - see SaveMatchService.prepareOversPlayedObj), so we fall back to
  // the 4 flat values LoadMatchService populated directly from the saved
  // document.
  // ---------------------------------------------------------------------

  /** Team key that batted in innings 1, derived from current roles - no extra state needed. */
  private get inningsOneBattingTeamKey(): string {
    return this.isSecondInning
      ? this.currentRoles['ball']
      : this.currentRoles['bat'];
  }

  /** Team key batting in innings 2, or null if innings 2 hasn't started yet. */
  private get inningsTwoBattingTeamKey(): string | null {
    return this.isSecondInning ? this.currentRoles['bat'] : null;
  }

  /**
   * Scans a team's oversPlayedData in bowled order and returns the
   * timestamp of the first ball that has one (i.e. has actually been
   * bowled), or null if no ball has been bowled yet for that team.
   */
  private findFirstBallTimestamp(teamKey: string | null): Date | null {
    if (!teamKey) return null;
    for (const over of this.teamData[teamKey].oversPlayedData) {
      for (const ball of over) {
        if (ball.timestamp) return ball.timestamp ?? null;
      }
    }
    return null;
  }

  /**
   * Scans a team's oversPlayedData in reverse and returns the timestamp of
   * the most recently bowled ball, or null if no ball has been bowled yet.
   * Scanning in reverse (rather than caching "the last ball added") is what
   * makes this correct after an Undo: once undo() pops/resets the trailing
   * BALL_DATA entries, this scan simply finds the new, correct last ball.
   */
  private findLastBallTimestamp(teamKey: string | null): Date | null {
    if (!teamKey) return null;
    const overs = this.teamData[teamKey].oversPlayedData;
    for (let overIdx = overs.length - 1; overIdx >= 0; overIdx--) {
      const over = overs[overIdx];
      for (let ballIdx = over.length - 1; ballIdx >= 0; ballIdx--) {
        if (over[ballIdx].timestamp) return over[ballIdx].timestamp ?? null;
      }
    }
    return null;
  }

  /** First ball of innings 1 - also displayed as "Match Start" in the UI (they're the same moment). */
  get inningsOneFirstBallTime(): Date | null {
    if (this.isMatchLoadedFromHistory)
      return this.loadedInningsOneFirstBallTime;
    return this.findFirstBallTimestamp(this.inningsOneBattingTeamKey);
  }

  /** Last ball bowled so far in innings 1 (becomes final once innings 2 starts). */
  get inningsOneLastBallTime(): Date | null {
    if (this.isMatchLoadedFromHistory)
      return this.loadedInningsOneLastBallTime;
    return this.findLastBallTimestamp(this.inningsOneBattingTeamKey);
  }

  /** First ball of innings 2 - also the "innings 2 start time". Null until innings 2 begins. */
  get inningsTwoFirstBallTime(): Date | null {
    if (this.isMatchLoadedFromHistory)
      return this.loadedInningsTwoFirstBallTime;
    return this.findFirstBallTimestamp(this.inningsTwoBattingTeamKey);
  }

  /** Last ball bowled so far in innings 2 - also the "match end time" once the match completes. */
  get inningsTwoLastBallTime(): Date | null {
    if (this.isMatchLoadedFromHistory)
      return this.loadedInningsTwoLastBallTime;
    return this.findLastBallTimestamp(this.inningsTwoBattingTeamKey);
  }
}
