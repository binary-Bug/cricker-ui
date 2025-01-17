import { inject, Injectable } from '@angular/core';
import { MatchService } from './match.service';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { BALL_DATA } from '../models/ball_data.class';
import { EventHandlerService } from './event-handler.service';

@Injectable({
  providedIn: 'root',
})
export class LiveMatchService {
  constructor(private matchService: MatchService) {}

  eventHandler: EventHandlerService = inject(EventHandlerService);

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

  addRunToStriker(
    run: number,
    isNBChecked: boolean,
    isByesChecked: boolean,
    isLBChecked: boolean,
    isPenaltyRun: boolean
  ): void {
    if (isNBChecked) run -= 1;

    this.striker.balls += 1;

    if (run % 2 === 0) {
      if (isByesChecked || isLBChecked || isPenaltyRun) run = 0;
      this.striker.runs += run;
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

  updatePlayerData(overNumber: number = -1): void {
    let con = this.currentOverNumber;
    let cbn = this.currentBowlNumber;

    if (overNumber > -1) {
      con = overNumber;
      cbn = 5;
    }

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

  updateBowlerData(
    run: number,
    isWideChecked: boolean,
    isNBChecked: boolean,
    isByesChecked: boolean,
    isPenaltyRun: boolean,
    isWicketBall: boolean,
    wicketType: string | null
  ): void {
    if (!isByesChecked && !isPenaltyRun) this.currentBowler.runs += run;

    if (!isWideChecked && !isNBChecked) {
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

  undo(): void {
    if (this.currentBowlNumber > 0 || this.currentOverNumber > 0) {
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
        this.eventHandler.NotifyUpdateOverViewGridEvent(true);
        this.totalBallsinCurrentOver -= 1;
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber].pop();
        this.eventHandler.NotifyUpdateOverViewGridEvent(false);
      }

      let isWicketBall: boolean = false;
      if (
        this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayedData[this.currentOverNumber][this.currentBowlNumber]
          .class === 'wicket'
      ) {
        isWicketBall = true;
      }

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

      this.currentPatnership = {
        ...this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
          .currentPatnership,
      };

      if (isWicketBall) {
        this.matchService.undoPlayerReferenceForWicket(
          this.striker.name,
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayedData[this.currentOverNumber][this.previousBowlNumber]
            .striker.name
        );
      }

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

      this.matchService.updatePlayerReference(
        this.striker,
        this.nonStriker,
        this.currentBowler
      );

      this.eventHandler.NotifyUndoEvent();

      this.totalBallsinCurrentOver = 6;
      this.eventHandler.NotifyUpdateOverViewGridEvent(true);
      this.totalBallsinCurrentOver =
        this.matchService.teamData[
          this.matchService.currentRoles['bat']
        ].oversPlayedData[this.currentOverNumber].length;
      this.eventHandler.NotifyUpdateOverViewGridEvent(false);
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
        this.eventHandler.NotifyUpdateOverViewGridEvent(true);
        this.totalBallsinCurrentOver = 6;
        this.eventHandler.NotifyUpdateOverViewGridEvent(false);
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
      ].oversPlayedData[this.currentOverNumber][
        this.currentBowlNumber
      ].wicketsLost += 1;

      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].wicketsLost += 1;
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
    this.matchService.teamData[this.matchService.currentRoles['bat']].extras[
      type
    ] += run;

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
    if (oldBatsmenName === this.striker.name) {
      this.striker = {
        name: newBatsmenName,
        runs: 0,
        balls: 0,
        fours: 0,
        six: 0,
        status: 'Not Out',
      };
      this.matchService.addBatsmenToTeam(this.striker, oldBatsmenName);
    } else {
      this.nonStriker = {
        name: newBatsmenName,
        runs: 0,
        balls: 0,
        fours: 0,
        six: 0,
        status: 'Not Out',
      };
      this.matchService.addBatsmenToTeam(this.nonStriker, oldBatsmenName);
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

    this.eventHandler.NotifyRunAddedEvent();
    this.updatePlayerData(this.currentOverNumber);
  }

  handleEndInningsDialog(data: any): void {
    if (data.event === 'end') {
      console.log('end');
    }
    if (data.event === 'continue') {
      console.log(data);
      this.matchService.totalOvers = data.overs;
      if (
        this.matchService.totalPlayers &&
        data.players > this.matchService.totalPlayers
      ) {
        this.matchService.totalPlayers = data.players;
        console.log('new bat');
      } else this.matchService.totalPlayers = data.players;
    }
  }
}
