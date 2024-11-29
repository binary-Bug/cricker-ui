import { inject, Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { BALL_DATA } from '../models/ball_data.class';
import { UtilityService } from './utility.service';

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
  utilityService: UtilityService = inject(UtilityService);
  tossWinner: string | null = null;
  tossResult: string | null = null;
  totalPlayers: number | null = null;
  totalOvers: number | null = null;
  isSecondInning = false;

  team1Data: Team = {
    name: '',
    captain: '',
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [OVER_DATA],
    extras: { w: 0, nb: 0, lb: 0, b: 0 },
  };

  team2Data: Team = {
    name: '',
    captain: '',
    runsScored: 0,
    oversPlayed: 0,
    wicketsLost: 0,
    runRate: 0,
    oversPlayedData: [OVER_DATA],
    extras: { w: 0, nb: 0, lb: 0, b: 0 },
  };

  teamData: { [key: string]: Team } = {
    team1: this.team1Data,
    team2: this.team2Data,
  };
  currentRoles: { [key: string]: string } = { bat: 'team1', ball: 'team2' };

  setCurrentRoles(): void {
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

  calculateCurrentRunRate() {
    if (this.isSecondInning) {
      this.teamData['team2'].runRate =
        (this.teamData['team2'].runsScored /
          this.utilityService.ballplayed(this.teamData['team2'].oversPlayed)) *
        6;
    } else {
      this.teamData['team1'].runRate =
        (this.teamData['team1'].runsScored /
          this.utilityService.ballplayed(this.teamData['team1'].oversPlayed)) *
        6;
    }
  }
}
