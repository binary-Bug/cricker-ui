import { inject, Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { BALL_DATA } from '../models/ball_data.class';
import { UtilityService } from './utility.service';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { Fielder } from '../models/fielder.interface';

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
    oversPlayedData: [OVER_DATA],
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

    let si = this.teamData[this.currentRoles['bat']].strikerIndex;
    let nsi = this.teamData[this.currentRoles['bat']].nonStrikerIndex;

    if (oldBatsmenName) {
      if (
        this.teamData[this.currentRoles['bat']].Batsmens[si].name ===
        oldBatsmenName
      ) {
        this.teamData[this.currentRoles['bat']].strikerIndex =
          si > nsi ? si + 1 : nsi + 1;
      } else {
        this.teamData[this.currentRoles['bat']].nonStrikerIndex =
          si > nsi ? si + 1 : nsi + 1;
      }
    }
  }

  addBowlerToTeam(bowler: Bowler): void {
    this.teamData[this.currentRoles['ball']].Bowlers.push(bowler);
  }

  addFielderToTeam(fielder: Fielder): void {
    this.teamData[this.currentRoles['ball']].Fielders.push(fielder);
  }

  updatePlayerReference(
    striker: Batsmen,
    nonStriker: Batsmen,
    bowler: Bowler
  ): void {
    let si = this.teamData[this.currentRoles['bat']].strikerIndex;
    let nsi = this.teamData[this.currentRoles['bat']].nonStrikerIndex;
    let bi = this.teamData[this.currentRoles['ball']].currBowlerIndex;

    if (
      this.teamData[this.currentRoles['bat']].Batsmens[si].name === striker.name
    ) {
      this.teamData[this.currentRoles['bat']].Batsmens[si] = striker;
      this.teamData[this.currentRoles['bat']].Batsmens[nsi] = nonStriker;
    } else {
      this.teamData[this.currentRoles['bat']].Batsmens[si] = nonStriker;
      this.teamData[this.currentRoles['bat']].Batsmens[nsi] = striker;
    }

    this.teamData[this.currentRoles['ball']].Bowlers[bi] = bowler;
  }

  undoPlayerReferenceForWicket(
    batsmenToReplace: string,
    batsmenToRefer: string
  ) {
    let si = this.teamData[this.currentRoles['bat']].strikerIndex;
    let nsi = this.teamData[this.currentRoles['bat']].nonStrikerIndex;

    if (
      this.teamData[this.currentRoles['bat']].Batsmens[si].name ===
      batsmenToReplace
    ) {
      this.teamData[this.currentRoles['bat']].strikerIndex = this.teamData[
        this.currentRoles['bat']
      ].Batsmens.findIndex((batsmen) => {
        return batsmen.name === batsmenToRefer;
      });
    } else {
      this.teamData[this.currentRoles['bat']].nonStrikerIndex = this.teamData[
        this.currentRoles['bat']
      ].Batsmens.findIndex((batsmen) => {
        return batsmen.name === batsmenToRefer;
      });
    }

    this.teamData[this.currentRoles['bat']].Batsmens = this.teamData[
      this.currentRoles['bat']
    ].Batsmens.filter((batsmen) => {
      return batsmen.name !== batsmenToReplace;
    });
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
      case 'Caught': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'c ' + actionPlayer + ' b ' + bowlerName;
        break;
      }
      case 'Stumped': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'st ✝' + actionPlayer + ' b ' + bowlerName;
        break;
      }
      case 'Run-out': {
        this.teamData[this.currentRoles['bat']].Batsmens[index].status =
          'runout (' + actionPlayer + ')';
        break;
      }
    }
  }

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
