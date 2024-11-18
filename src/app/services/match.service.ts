import { Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { BALL_DATA } from '../models/ball_data.class';

const OVER_DATA: BALL_DATA[] = [
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
export class MatchService {
  constructor() {}

  tossWinner: string | null = null;
  tossResult: string | null = null;
  totalPlayers: number | null = null;
  totalOvers: number | null = null;

  team1: Team = {
    name: '',
    captain: '',
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [OVER_DATA],
  };

  team2: Team = {
    name: '',
    captain: '',
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [OVER_DATA],
  };

  isSecondInning = false;
  calculateCurrentRunRate() {
    if (this.isSecondInning) {
      this.team2.runRate =
        (this.team2.runsScored / this.ballplayed(this.team2.oversPlayed)) * 6;
    } else {
      this.team1.runRate =
        (this.team1.runsScored / this.ballplayed(this.team1.oversPlayed)) * 6;
    }
  }

  ballplayed(oversPlayed: number): number {
    let ballsInOver =
      +parseFloat(oversPlayed - Math.trunc(oversPlayed) + '').toFixed(1) * 10;
    let completedOversBalls = Math.trunc(oversPlayed) * 6;
    return completedOversBalls + ballsInOver;
  }
}
