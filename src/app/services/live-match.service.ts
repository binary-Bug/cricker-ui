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

  striker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  nonStriker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  currentBowler: Bowler = {
    name: '',
    runs: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
  };

  currentBowlNumber: number = 0;
  previousBowlNumber: number = 0;
  totalBallsinCurrentOver: number = 6;
  currentOverNumber: number = 0;

  addRunToStriker(run: number): void {
    this.striker.balls += 1;
    if (run % 2 === 0) {
      this.striker.runs += run;
      this.updatePlayerData();
    } else {
      this.striker.runs += run;
      this.swapStriker();
    }
  }

  public swapStriker(): void {
    let temp: Batsmen = this.striker;
    this.striker = this.nonStriker;
    this.nonStriker = temp;
    this.eventHandler.NotifyBatsmenSwappedEvent();
    this.updatePlayerData();
  }

  updatePlayerData(): void {
    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber].striker =
      { ...this.striker };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].nonStriker = { ...this.nonStriker };

    this.matchService.teamData[
      this.matchService.currentRoles['bat']
    ].oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].currentBowler = { ...this.currentBowler };
  }

  updateBowlerData(run: number): void {
    this.currentBowler.runs += run;
    this.currentBowler.overs = +parseFloat(
      this.currentBowler.overs + 0.1 + ''
    ).toFixed(1);
    if (
      this.currentBowler.overs - Math.trunc(this.currentBowler.overs) ===
      0.6
    ) {
      this.currentBowler.overs = Math.trunc(this.currentBowler.overs) + 1;
    }
  }

  undo(): void {
    if (this.currentBowlNumber > 0 || this.currentOverNumber > 0) {
      this.currentBowlNumber -= 1;
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

      this.matchService.teamData[
        this.matchService.currentRoles['bat']
      ].oversPlayedData[this.currentOverNumber][this.currentBowlNumber] =
        new BALL_DATA();

      this.previousBowlNumber -= 1;

      if (this.currentBowlNumber === 0) {
        this.previousBowlNumber = 5;
        this.currentBowlNumber = 6;

        if (this.currentOverNumber > 0) {
          this.currentOverNumber -= 1;
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

      this.matchService.calculateCurrentRunRate();

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

      this.eventHandler.NotifyUndoEvent();
    }
  }

  updateBallNumber(): void {
    this.currentBowlNumber += 1;
    this.previousBowlNumber = this.currentBowlNumber - 1;
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
    this.matchService.calculateCurrentRunRate();
  }

  updateOverData(): void {
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

  updateBallDataRuns(run: string): void {
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
  }
}
