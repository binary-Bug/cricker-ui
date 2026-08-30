import { inject, Injectable } from '@angular/core';
import { MatchService } from './match.service';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { BALL_DATA } from '../models/ball_data.class';
import { EventHandlerService } from './event-handler.service';
import { NewBowlerDialog } from '../components/dailogs/new-bowler.dialog';
import { MatDialog } from '@angular/material/dialog';
import { NewBatsmenDialog } from '../components/dailogs/new-batsmen.dialog';
import { map } from 'rxjs';
import { OnFieldPlayerDetailsDialog } from '../components/dailogs/on-field-player-detail.dialog';
import { Router } from '@angular/router';
import { MatchCompleteDialog } from '../components/dailogs/match-complete.dialog';

@Injectable({
  providedIn: 'root',
})
export class LiveMatchService {
  constructor(private matchService: MatchService) {}

  eventHandler: EventHandlerService = inject(EventHandlerService);
  dialog: MatDialog = inject(MatDialog);
  router: Router = inject(Router);

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

  currentBowlNumber: number = 0;
  previousBowlNumber: number = 0;
  totalBallsinCurrentOver: number = 6;
  currentOverNumber: number = 0;
  bowlerRunsBeforeStart: number = 0;
  currentPatnership: { runs: number; balls: number } = { runs: 0, balls: 0 };

  // Restore-point for undo() crossing back over an over boundary, kept
  // separate from oversPlayedData so the completed over's own last ball
  // keeps recording what actually happened on that ball (see
  // updateOnFieldBowler()/handleEndInningsDialog()). In-memory only - never
  // persisted, never rehydrated from Firestore on reload.
  private overStartSnapshots = new Map<
    number,
    { striker: Batsmen; nonStriker: Batsmen; currentBowler: Bowler }
  >();

  private snapshotOverStart(overNumber: number): void {
    this.overStartSnapshots.set(overNumber, {
      striker: { ...this.striker },
      nonStriker: { ...this.nonStriker },
      currentBowler: {
        ...this.currentBowler,
        extras: { ...this.currentBowler.extras },
      },
    });
  }

  addRunToStriker(
    run: number,
    isNBChecked: boolean,
    isByesChecked: boolean,
    isLBChecked: boolean,
    isPenaltyRun: boolean,
    // Whether this delivery counts as a ball faced by the striker. Defaults to
    // true for all existing call patterns; only an uncounted penalty run (the
    // scorer unchecked "Count this ball") passes false, mirroring how a wide
    // never counts as a ball faced either.
    countsAsBallFaced: boolean = true
  ): void {
    if (isNBChecked) run -= 1;

    if (countsAsBallFaced) this.striker.balls += 1;

    if (run % 2 === 0) {
      if (isByesChecked || isLBChecked || isPenaltyRun) run = 0;
      this.striker.runs += run;
      this.striker.strikeRate = (this.striker.runs / this.striker.balls) * 100;
      switch (run) {
        case 4:
          this.striker.fours += 1;
          break;
        case 6:
          this.striker.six += 1;
          break;
      }
      this.updatePlayerData();
    } else {
      if (isByesChecked || isLBChecked || isPenaltyRun) run = 0;
      this.striker.runs += run;
      this.striker.strikeRate = (this.striker.runs / this.striker.balls) * 100;
      if (!isPenaltyRun) this.swapStriker();
      this.updatePlayerData();
    }
  }

  public swapStriker(): void {
    let temp: Batsmen = this.striker;
    this.striker = this.nonStriker;
    this.nonStriker = temp;
    this.eventHandler.NotifyBatsmenSwappedEvent();
  }

  /**
   * @param useLastBowledBall When true, snapshots into the ball that was
   * just bowled (previousBowlNumber) instead of the upcoming one
   * (currentBowlNumber). Needed for callers that run *after*
   * updateBallNumber() has already advanced the counters (e.g.
   * re-snapshotting a wicket ball once the dismissal's batsman-end
   * correction is known) - using currentBowlNumber there would index past
   * the over's last valid ball slot when the dismissal fell on ball 6.
   */
  updatePlayerData(useLastBowledBall: boolean = false): void {
    let con = this.currentOverNumber;
    let cbn = useLastBowledBall
      ? this.previousBowlNumber
      : this.currentBowlNumber;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][cbn].striker = { ...this.striker };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][cbn].nonStriker = { ...this.nonStriker };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][cbn].currentBowler = { ...this.currentBowler };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][cbn].currentBowler.extras = {
      ...this.currentBowler.extras,
    };
  }

  updateBatsmenData(): void {
    let con = this.currentOverNumber;
    let pbn = this.previousBowlNumber;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][pbn].striker = { ...this.striker };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][pbn].nonStriker = { ...this.nonStriker };
  }

  updateBolwerDataInOversPlayed(): void {
    let con = this.currentOverNumber;
    let pbn = this.previousBowlNumber;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[con][pbn].currentBowler = { ...this.currentBowler };
  }

  updateBowlerData(
    run: number,
    isWideChecked: boolean,
    isNBChecked: boolean,
    isByesChecked: boolean,
    isPenaltyRun: boolean,
    isWicketBall: boolean,
    wicketType: string | null,
    // True when the delivery shouldn't be credited towards the bowler's overs
    // (wide/no-ball already excluded via the two params above; this also
    // covers an uncounted penalty run - "Count this ball" unchecked).
    isBallUncounted: boolean = false
  ): void {
    if (!isByesChecked && !isPenaltyRun) this.currentBowler.runs += run;

    if (!isWideChecked && !isNBChecked && !isBallUncounted) {
      this.currentBowler.overs = +parseFloat(
        this.currentBowler.overs + 0.1 + ''
      ).toFixed(1);
    }

    if (
      isWicketBall &&
      wicketType &&
      wicketType !== 'Run-out' &&
      wicketType !== 'Hit-Wicket'
    ) {
      this.currentBowler.wickets += 1;
    }

    if (
      +parseFloat(
        this.currentBowler.overs - Math.trunc(this.currentBowler.overs) + ''
      ).toFixed(1) === 0.6
    ) {
      this.currentBowler.overs = Math.trunc(this.currentBowler.overs) + 1;
      if (this.currentBowler.runs - this.bowlerRunsBeforeStart === 0)
        this.currentBowler.maidens += 1;
    }
  }

  // NOTE: Innings/match ball timestamps (first/last ball of each innings)
  // are intentionally NOT managed here. MatchService derives those 4 values
  // by scanning BALL_DATA.timestamp across oversPlayedData on demand, so
  // once undo() below pops/resets the relevant BALL_DATA entries, the
  // derived timestamps automatically reflect the corrected state - no
  // undo-specific timestamp rollback logic is needed.
  undo(): void {
    if (this.currentBowlNumber > 0 || this.currentOverNumber > 0) {
      // The over being undone out of - needed after currentOverNumber gets
      // decremented below, to look up its start-of-over snapshot.
      const overBeingUndoneFrom = this.currentOverNumber;
      let crossedOverBoundary = false;

      this.currentBowlNumber -= 1;
      if (
        !this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayedData[this.currentOverNumber][this.currentBowlNumber]
          .isExtra
      ) {
        if (
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed -
            Math.trunc(
              this.matchService.teamData[this.matchService.currentRoles['bat']]
                .oversPlayed
            ) ===
          0
        ) {
          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayed =
            Math.trunc(
              this.matchService.teamData[this.matchService.currentRoles['bat']]
                .oversPlayed
            ) -
            1 +
            0.6;
        }

        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayed -= 0.1;
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayed = +parseFloat(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed + ''
        ).toFixed(1);
      } else {
        //this.eventHandler.NotifyUpdateOverViewGridEvent(true);
        this.totalBallsinCurrentOver -= 1;
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber].pop();
        //this.eventHandler.NotifyUpdateOverViewGridEvent(false);
      }

      let isWicketBall: boolean = false;
      if (
        this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayedData[this.currentOverNumber][this.currentBowlNumber]
          .class === 'wicket'
      ) {
        isWicketBall = true;
      }

      let wasBatsmenRetired: boolean = false;

      //storing striker, non striker and bowler name temporarily to display it in ui before the first ball is bowled after undo
      let tempStrikerName: string = '';
      let tempNonStikerName: string = '';
      let tempBowlerName: string = '';
      if (this.currentBowlNumber === 0 && this.currentOverNumber === 0) {
        tempStrikerName =
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .Batsmens[0].name;
        tempNonStikerName =
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .Batsmens[1].name;
        tempBowlerName =
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.currentBowlNumber]
            .currentBowler.name;
      }

      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber] =
        new BALL_DATA();

      this.previousBowlNumber -= 1;

      if (this.currentBowlNumber === 0) {
        this.currentBowlNumber =
          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData[this.currentOverNumber].length;

        if (this.currentOverNumber > 0) {
          this.currentOverNumber -= 1;
          crossedOverBoundary = true;
          this.previousBowlNumber =
            this.matchService.teamData[this.matchService.currentRoles['bat']]
              .oversPlayedData[this.currentOverNumber].length - 1;

          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData.pop();
        } else {
          this.previousBowlNumber = 0;
          this.currentBowlNumber = 0;

          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber] =
            new BALL_DATA();

          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData[this.currentOverNumber][
            this.currentBowlNumber
          ].striker.name = tempStrikerName;
          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData[this.currentOverNumber][
            this.currentBowlNumber
          ].nonStriker.name = tempNonStikerName;
          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData[this.currentOverNumber][
            this.currentBowlNumber
          ].currentBowler.name = tempBowlerName;
        }
      }

      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].runsScored =
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].currentRuns;

      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].wicketsLost =
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].wicketsLost;

      this.matchService.teamData[this.matchService.currentRoles['bat']].extras =
        {
          ...this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
            .extras,
        };

      this.matchService.calculateCurrentRunRate();
      if (this.matchService.isSecondInning)
        this.matchService.calculateSecondInningsTeamValues();

      this.currentPatnership = {
        ...this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
          .currentPatnership,
      };

      wasBatsmenRetired = this.CheckIfBatsmenWasRetired();

      if (isWicketBall || wasBatsmenRetired) {
        let batsmens: { batsmenToReplace: string; batsmenToRefer: string } =
          this.determineBatsmensForUndo();

        if (isWicketBall) {
          // batsmenToRefer is the dismissed batsman being restored to the
          // crease - read their still-set dismissal status (e.g. "c X b Y")
          // before undoBatsmenPlayerReferenceForWicket below resets it, so
          // any catch/stumping/run-out credit given to a fielder can be
          // reverted too.
          const dismissedBatsman = this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].Batsmens.find(
            (b) => b.name.toLowerCase() === batsmens.batsmenToRefer
          );
          if (dismissedBatsman) {
            this.matchService.undoFielderStatsForWicket(
              dismissedBatsman.status
            );
          }
        }

        this.matchService.undoBatsmenPlayerReferenceForWicket(
          batsmens.batsmenToReplace,
          batsmens.batsmenToRefer
        );
      }

      const overStartSnapshot = crossedOverBoundary
        ? this.overStartSnapshots.get(overBeingUndoneFrom)
        : undefined;

      if (overStartSnapshot) {
        this.striker = { ...overStartSnapshot.striker };
        this.nonStriker = { ...overStartSnapshot.nonStriker };
        this.currentBowler = {
          ...overStartSnapshot.currentBowler,
          extras: { ...overStartSnapshot.currentBowler.extras },
        };
      } else {
        this.striker = {
          ...this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
            .striker,
        };

        this.nonStriker = {
          ...this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
            .nonStriker,
        };

        this.currentBowler = {
          ...this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
            .currentBowler,
        };

        this.currentBowler.extras = {
          ...this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
            .currentBowler.extras,
        };
      }

      this.matchService.updatePlayerReference(
        this.striker,
        this.nonStriker,
        this.currentBowler
      );

      this.eventHandler.NotifyUndoEvent();

      //this.totalBallsinCurrentOver = 6;
      //this.eventHandler.NotifyUpdateOverViewGridEvent(true);
      this.totalBallsinCurrentOver =
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber].length;
      //this.eventHandler.NotifyUpdateOverViewGridEvent(false);
    }
  }

  updateOversPlayed(): void {
    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayed += 0.1;
    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayed = +parseFloat(
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .oversPlayed + ''
    ).toFixed(1);
    let val = +parseFloat(
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .oversPlayed -
        Math.trunc(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ) +
        ''
    ).toFixed(1);
    if (val >= 0.6) {
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayed =
        Math.trunc(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ) + 1;
    }
  }

  updateBallNumber(): void {
    this.currentBowlNumber += 1;
    this.previousBowlNumber = this.currentBowlNumber - 1;
  }

  updateOverData(): void {
    // This method checks if the exisiting over has completed and if true add a new over data array in match service team data
    if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .oversPlayed -
        Math.trunc(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ) ===
      0
    ) {
      if (
        this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayedData[this.currentOverNumber][
          this.totalBallsinCurrentOver - 1
        ].class !== 'none'
      ) {
        if (
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed !== 0
        )
          this.currentOverNumber += 1;
        if (this.currentOverNumber !== 0) {
          let overData = [
            new BALL_DATA(),
            new BALL_DATA(),
            new BALL_DATA(),
            new BALL_DATA(),
            new BALL_DATA(),
            new BALL_DATA(),
          ];
          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData.push(overData);
          this.currentBowlNumber = 0;
          this.previousBowlNumber = 0;
          //this.eventHandler.NotifyUpdateOverViewGridEvent(true);
          this.totalBallsinCurrentOver = 6;
          //this.eventHandler.NotifyUpdateOverViewGridEvent(false);
        }
      }
    }
  }

  updateBallDataCSS(run: string, color: string): void {
    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].hasBeenBowled = true;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber].class =
      color;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber].label =
      run;
  }

  updateBallDataRuns(
    run: string,
    isExtra: boolean,
    isWicketBall: boolean
  ): void {
    // Stamp the wall-clock time this ball was finalized. This method is the
    // single choke point hit exactly once per delivery (run/wicket/extra),
    // called from ScoringActionsComponent.checkForExtras_And_AddRun(), which
    // makes it the right place to record "when this ball happened". See
    // BALL_DATA.timestamp for why this is derived rather than tracked
    // imperatively (undo-safety) and why it isn't persisted at ball level.
    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].timestamp = new Date();

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].currentRuns =
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .runsScored + +run;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].runsScored += +run;

    // adding wicket if wicket option is selected
    if (isWicketBall) {
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].wicketsLost += 1;

      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][
        this.currentBowlNumber
      ].wicketsLost =
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].wicketsLost;
    } else {
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][
        this.currentBowlNumber
      ].wicketsLost =
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].wicketsLost;
    }

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber].isExtra =
      isExtra;

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber].extras = {
      ...this.matchService.teamData[this.matchService.currentRoles['bat']]
        .extras,
    };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].currentPatnership = { ...this.currentPatnership };
  }

  addNewBalltoOversPlayedData(): void {
    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber].push(new BALL_DATA());
  }

  addExtra(type: string, run: number) {
    if (type !== 'nb')
      this.matchService.teamData[this.matchService.currentRoles['bat']].extras[
        type
      ] += run;
    else
      this.matchService.teamData[this.matchService.currentRoles['bat']].extras[
        type
      ] += 1;

    if (type !== 'b') this.currentBowler.extras[type] += run;
  }

  updateCurrentPatnership(runs: number, updateBalls: boolean = true): void {
    this.currentPatnership.runs += runs;
    if (updateBalls) this.currentPatnership.balls += 1;
  }

  resetCurrentPatnership(): void {
    this.currentPatnership.runs = 0;
    this.currentPatnership.balls = 0;
  }

  updateOnFieldBatsmen(oldBatsmenName: string, newBatsmenName: string): void {
    let bi: number = -1;
    let batsmenData: Batsmen | undefined = this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].Batsmens.find((batsmen, index) => {
      if (batsmen.name === newBatsmenName) {
        bi = index;
        return true;
      }
      return false;
    });
    if (oldBatsmenName === this.striker.name) {
      if (batsmenData) {
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].strikerIndex = bi;
        this.striker = batsmenData;
        this.striker.status = 'Not Out';
      } else {
        this.striker = {
          name: newBatsmenName,
          runs: 0,
          balls: 0,
          fours: 0,
          six: 0,
          status: 'Not Out',
        };
        if (newBatsmenName !== 'none')
          this.matchService.addBatsmenToTeam(this.striker, oldBatsmenName);
      }
    } else {
      if (batsmenData) {
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].nonStrikerIndex = bi;
        this.nonStriker = batsmenData;
        this.nonStriker.status = 'Not Out';
      } else {
        this.nonStriker = {
          name: newBatsmenName,
          runs: 0,
          balls: 0,
          fours: 0,
          six: 0,
          status: 'Not Out',
        };
        if (newBatsmenName !== 'none')
          this.matchService.addBatsmenToTeam(this.nonStriker, oldBatsmenName);
      }
    }
  }

  updateBatsmenEnd(newBatsmenName: string, selectedEnd: string): void {
    if (selectedEnd === 'nonStriker') {
      if (newBatsmenName === this.nonStriker.name) return;
      else this.swapStriker();
    } else {
      if (newBatsmenName === this.striker.name) return;
      else this.swapStriker();
    }
  }

  updateOnFieldBowler(data: any): void {
    let bi: number = -1;
    let bowlerData: Bowler | undefined = this.matchService.teamData[
      this.matchService.currentRoles['ball']
    ].Bowlers.find((bowler, index) => {
      if (bowler.name === data) {
        bi = index;
        return true;
      }
      return false;
    });
    if (bowlerData) {
      this.matchService.teamData[
        this.matchService.currentRoles['ball']
      ].currBowlerIndex = bi;
      this.currentBowler = bowlerData;
      this.bowlerRunsBeforeStart = this.currentBowler.runs;
    } else {
      this.currentBowler = {
        name: data,
        overs: 0,
        maidens: 0,
        runs: 0,
        wickets: 0,
        extras: { w: 0, nb: 0, lb: 0 },
      };
      this.matchService.addBowlerToTeam(this.currentBowler);
      this.bowlerRunsBeforeStart = this.currentBowler.runs;
    }

    this.eventHandler.NotifyUpdateOnFieldBowlerEvent();
    // Snapshot the state the NEXT over is starting with, for undo() - do not
    // write it onto the just-completed over's own last ball (that would
    // overwrite its real, already-bowled outcome).
    this.snapshotOverStart(this.currentOverNumber + 1);
  }

  pipeDialogs(): void {
    this.eventHandler.NotifyOverCompleteEvent();
    this.dialog
      .open(NewBatsmenDialog, {
        data: { isAuto: true },
        panelClass: 'app-dialog-panel',
      })
      .afterClosed()
      .pipe(
        map((batsmenName) => {
          this.updateOnFieldBatsmen('none', batsmenName);
          this.eventHandler.NotifyUpdateOnFieldBatsmenEvent();
          return this.dialog
            .open(NewBowlerDialog, {
              data: { isAuto: true },
              panelClass: 'app-dialog-panel',
            })
            .afterClosed();
        })
      )
      .subscribe((NewBowlerObs$) => {
        NewBowlerObs$.subscribe((bowler) => {
          this.updateOnFieldBowler(bowler);
        });
      });
  }

  handleEndInningsDialog(data: any): void {
    if (data.event === 'end' && this.matchService.isSecondInning) {
      this.dialog.open(MatchCompleteDialog);
    }
    if (data.event === 'end' && !this.matchService.isSecondInning) {
      if (data.isAuto === false) {
        if (data.overs) this.matchService.totalOvers = data.overs;
        if (data.players) this.matchService.totalPlayers = data.players;
      }
      this.matchService.isSecondInning = true;
      this.matchService.setCurrentRoles();
      this.resetServiceData();
      this.matchService.calculateSecondInningsTeamValues();
      this.dialog
        .open(OnFieldPlayerDetailsDialog, {
          data: { isAuto: true },
          panelClass: 'on-field-player-dialog-panel',
        })
        .afterClosed()
        .subscribe(() => {
          this.matchService.addBatsmenToTeam(this.striker, null);
          this.matchService.addBatsmenToTeam(this.nonStriker, null);
          this.matchService.addBowlerToTeam(this.currentBowler);
          this.eventHandler.NotifyUpdateOnFieldBatsmenEvent();
          this.eventHandler.NotifyUpdateOnFieldBowlerEvent();
          this.eventHandler.OverCompleteEvent$();
          this.snapshotOverStart(this.currentOverNumber);
        });
    }
    if (data.event === 'continue' && data.isAuto === true) {
      if (
        this.matchService.totalPlayers &&
        data.players > this.matchService.totalPlayers &&
        this.matchService.totalOvers &&
        data.overs > this.matchService.totalOvers
      ) {
        this.swapStriker();
        this.matchService.totalOvers = data.overs;
        this.matchService.totalPlayers = data.players;
        this.pipeDialogs();
      } else if (
        this.matchService.totalPlayers &&
        data.players > this.matchService.totalPlayers
      ) {
        this.matchService.totalPlayers = data.players;
        if (
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed -
            Math.trunc(
              this.matchService.teamData[this.matchService.currentRoles['bat']]
                .oversPlayed
            ) ===
          0
        ) {
          this.swapStriker();
          // pipe dialogs
          this.pipeDialogs();
        } else {
          let newBatsmenDialog = this.dialog.open(NewBatsmenDialog, {
            data: { isAuto: true },
            panelClass: 'app-dialog-panel',
          });
          newBatsmenDialog.afterClosed().subscribe((data: string) => {
            if (data && data.length > 0) {
              this.updateOnFieldBatsmen('none', data);
              this.eventHandler.NotifyUpdateOnFieldBatsmenEvent();
              this.updatePlayerData();
            }
          });
        }
      } else if (
        this.matchService.totalOvers &&
        data.overs > this.matchService.totalOvers
      ) {
        this.swapStriker();
        this.matchService.totalOvers = data.overs;
        this.eventHandler.NotifyOverCompleteEvent();
        let newBowlerDialog = this.dialog.open(NewBowlerDialog, {
          data: { isAuto: true },
          panelClass: 'app-dialog-panel',
        });
        newBowlerDialog.afterClosed().subscribe((data: string) => {
          if (data && data.length > 0) this.updateOnFieldBowler(data);
        });
      }
    }
    if (data.event === 'continue' && data.isAuto === false) {
      this.matchService.totalOvers = data.overs;
      this.matchService.totalPlayers = data.players;
    }
    if (this.matchService.isSecondInning)
      this.matchService.calculateSecondInningsTeamValues();
  }

  public CheckIfBatsmenWasRetired(): boolean {
    if (
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][
        this.previousBowlNumber
      ].striker.name.toLowerCase() === this.striker.name.toLowerCase() ||
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][
        this.previousBowlNumber
      ].nonStriker.name.toLowerCase() === this.striker.name.toLowerCase()
    ) {
      if (
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].striker.name.toLowerCase() === this.nonStriker.name.toLowerCase() ||
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].nonStriker.name.toLowerCase() === this.nonStriker.name.toLowerCase()
      )
        return false;
      else return true;
    } else return true;
  }

  public determineBatsmensForUndo(): {
    batsmenToReplace: string;
    batsmenToRefer: string;
  } {
    let response: { batsmenToReplace: string; batsmenToRefer: string } = {
      batsmenToRefer: '',
      batsmenToReplace: '',
    };

    if (
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][
        this.previousBowlNumber
      ].striker.name.toLowerCase() === this.striker.name.toLowerCase() ||
      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][
        this.previousBowlNumber
      ].nonStriker.name.toLowerCase() === this.striker.name.toLowerCase()
    ) {
      if (
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].striker.name.toLowerCase() === this.nonStriker.name.toLowerCase() ||
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].nonStriker.name.toLowerCase() === this.nonStriker.name.toLowerCase()
      ) {
        // not likely to happen since isWicketBall or WasRetired is True
      } else {
        response.batsmenToReplace = this.nonStriker.name.toLowerCase();
        response.batsmenToRefer =
          this.striker.name.toLowerCase() ===
          this.matchService.teamData[
            this.matchService.currentRoles['bat']
          ].oversPlayedData[this.currentOverNumber][
            this.previousBowlNumber
          ].striker.name.toLowerCase()
            ? this.matchService.teamData[
                this.matchService.currentRoles['bat']
              ].oversPlayedData[this.currentOverNumber][
                this.previousBowlNumber
              ].nonStriker.name.toLowerCase()
            : this.matchService.teamData[
                this.matchService.currentRoles['bat']
              ].oversPlayedData[this.currentOverNumber][
                this.previousBowlNumber
              ].striker.name.toLowerCase();
      }
    } else {
      response.batsmenToReplace = this.striker.name.toLowerCase();
      response.batsmenToRefer =
        this.nonStriker.name.toLowerCase() ===
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber][
          this.previousBowlNumber
        ].striker.name.toLowerCase()
          ? this.matchService.teamData[
              this.matchService.currentRoles['bat']
            ].oversPlayedData[this.currentOverNumber][
              this.previousBowlNumber
            ].nonStriker.name.toLowerCase()
          : this.matchService.teamData[
              this.matchService.currentRoles['bat']
            ].oversPlayedData[this.currentOverNumber][
              this.previousBowlNumber
            ].striker.name.toLowerCase();
    }

    return response;
  }

  resetServiceData(): void {
    this.overStartSnapshots.clear();
    this.striker = {
      name: '',
      runs: 0,
      balls: 0,
      fours: 0,
      six: 0,
      status: 'Not Out',
    };
    this.nonStriker = {
      name: '',
      runs: 0,
      balls: 0,
      fours: 0,
      six: 0,
      status: 'Not Out',
    };
    this.currentBowler = {
      name: '',
      runs: 0,
      overs: 0,
      maidens: 0,
      wickets: 0,
      extras: { w: 0, nb: 0, lb: 0 },
    };

    this.currentBowlNumber = 0;
    this.previousBowlNumber = 0;
    this.totalBallsinCurrentOver = 6;
    this.currentOverNumber = 0;
    this.bowlerRunsBeforeStart = 0;
    this.currentPatnership = { runs: 0, balls: 0 };
  }

  public exitMatch(navigateTo: string = 'room'): void {
    this.resetServiceData();
    this.matchService.resetServiceData();
    if (navigateTo.length > 0) this.router.navigateByUrl(navigateTo);
  }
}
