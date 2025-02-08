import { inject, Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import {
  addDoc,
  collection,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  query,
} from '@angular/fire/firestore';
import { MatchService } from './match.service';
import { BALL_DATA } from '../models/ball_data.class';

@Injectable({
  providedIn: 'root',
})
export class SaveMatchService {
  constructor(public matchService: MatchService) {}
  firestore = inject(Firestore);
  public async saveMatchData(): Promise<void> {
    let teamDataDTO = this.prepareTeamDataObject();
    await addDoc(collection(this.firestore, 'MatchData'), {
      tossWiner: this.matchService.tossWinner,
      tossResult: this.matchService.tossResult,
      totalOvers: this.matchService.totalOvers,
      ttoalPlayers: this.matchService.totalPlayers,
      teamData: teamDataDTO,
    }).then(async (matchRef) => {
      const data = await this.getMatchData(matchRef);
      //console.log(data?.['teamData']['team1']['oversPlayedData'][0]);
      for (let key in data?.['teamData']['team1']['oversPlayedData'][0] as {
        [key: number]: BALL_DATA;
      }) {
        //console.log(data?.['teamData']['team1']['oversPlayedData'][0][key]);
      }
    });
  }

  public async getMatchData(matchRef: DocumentReference) {
    return (await getDoc(matchRef)).data();
  }

  private prepareTeamDataObject(): any {
    let teamObj = JSON.parse(JSON.stringify(this.matchService.teamData));

    this.prepareOversPlayedObj(
      this.matchService.teamData['team1'],
      teamObj,
      'team1'
    );
    this.prepareOversPlayedObj(
      this.matchService.teamData['team2'],
      teamObj,
      'team2'
    );
    //console.log(teamObj);
    return teamObj;
  }

  private prepareOversPlayedObj(team: Team, teamObj: any, key: string) {
    let ballDataObj: { [key: number]: BALL_DATA } = {};
    let overDTO: { [key: number]: BALL_DATA }[] = [];
    team.oversPlayedData.forEach((over) => {
      over.forEach((ball, index) => {
        ballDataObj[index] = JSON.parse(JSON.stringify(ball));
      });
      overDTO.push(ballDataObj);
    });
    teamObj[key]['oversPlayedData'] = overDTO;
    // for (key in ballDataObj) {
    //   console.log(ballDataObj[key]);
    // }
  }
}
