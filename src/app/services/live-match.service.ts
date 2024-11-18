import { Injectable } from '@angular/core';
import { MatchService } from './match.service';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { BALL_DATA } from '../models/ball_data.class';

const OVER_DATA = [
  new BALL_DATA(),
  new BALL_DATA(),
  new BALL_DATA(),
  new BALL_DATA(),
  new BALL_DATA(),
  new BALL_DATA(),
];

@Injectable({
  providedIn: 'root',
})
export class LiveMatchService {
  constructor(private matchService: MatchService) {}

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

  undo(): void {
    if (!this.matchService.isSecondInning) {
      if (this.currentBowlNumber > 0 || this.currentOverNumber > 0) {
        this.currentBowlNumber -= 1;
        if (
          this.matchService.team1.oversPlayed -
            Math.trunc(this.matchService.team1.oversPlayed) ===
          0
        ) {
          this.matchService.team1.oversPlayed =
            Math.trunc(this.matchService.team1.oversPlayed) - 1 + 0.6;
        }
        this.matchService.team1.oversPlayed -= 0.1;
        this.matchService.team1.oversPlayed = +parseFloat(
          this.matchService.team1.oversPlayed + ''
        ).toFixed(1);

        this.matchService.team1.oversPlayedData[this.currentOverNumber][
          this.currentBowlNumber
        ] = new BALL_DATA();

        this.previousBowlNumber -= 1;

        if (this.currentBowlNumber === 0) {
          this.previousBowlNumber = 5;
          this.currentBowlNumber = 6;

          if (this.currentOverNumber > 0) {
            this.currentOverNumber -= 1;
            this.matchService.team1.oversPlayedData.pop();
          } else {
            this.previousBowlNumber = 0;
            this.currentBowlNumber = 0;
            this.matchService.team1.oversPlayedData[this.currentOverNumber][
              this.currentBowlNumber
            ] = new BALL_DATA();
          }
        }

        this.matchService.team1.runsScored =
          this.matchService.team1.oversPlayedData[this.currentOverNumber][
            this.previousBowlNumber
          ].currentRuns;

        this.matchService.team1.wicketsLost =
          this.matchService.team1.oversPlayedData[this.currentOverNumber][
            this.previousBowlNumber
          ].wicketsLost;

        this.matchService.calculateCurrentRunRate();
      }
    } else {
      // second innings logic
    }
  }

  updateBallNumber(): void {
    if (!this.matchService.isSecondInning) {
      this.currentBowlNumber += 1;
      this.previousBowlNumber = this.currentBowlNumber - 1;
      this.matchService.team1.oversPlayed += 0.1;
      this.matchService.team1.oversPlayed = +parseFloat(
        this.matchService.team1.oversPlayed + ''
      ).toFixed(1);
      let val = +parseFloat(
        this.matchService.team1.oversPlayed -
          Math.trunc(this.matchService.team1.oversPlayed) +
          ''
      ).toFixed(1);
      if (val >= 0.6) {
        this.matchService.team1.oversPlayed =
          Math.trunc(this.matchService.team1.oversPlayed) + 1;
      }
      this.matchService.calculateCurrentRunRate();
    }
  }

  updateOverData(): void {
    if (!this.matchService.isSecondInning) {
      if (
        this.matchService.team1.oversPlayed -
          Math.trunc(this.matchService.team1.oversPlayed) ===
        0
      ) {
        if (this.matchService.team1.oversPlayed !== 0)
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
          this.matchService.team1.oversPlayedData.push(overData);
          this.currentBowlNumber = 0;
          this.previousBowlNumber = 0;
        }
      }
    } else {
      // second innings logic
    }
  }

  updateBallDataCSS(run: string, color: string): void {
    if (!this.matchService.isSecondInning) {
      this.matchService.team1.oversPlayedData[this.currentOverNumber][
        this.currentBowlNumber
      ].hasBeenBowled = true;
      this.matchService.team1.oversPlayedData[this.currentOverNumber][
        this.currentBowlNumber
      ].class = color;
      this.matchService.team1.oversPlayedData[this.currentOverNumber][
        this.currentBowlNumber
      ].label = run;
    } else {
      // second innings logic
    }
  }

  updateBallDataRuns(run: string): void {
    this.matchService.team1.oversPlayedData[this.currentOverNumber][
      this.currentBowlNumber
    ].currentRuns = this.matchService.team1.runsScored + +run;
    this.matchService.team1.runsScored += +run;
  }
}
