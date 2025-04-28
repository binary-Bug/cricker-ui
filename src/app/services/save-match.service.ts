import { inject, Injectable } from '@angular/core';
import { Team } from '../models/team.interface';
import { addDoc, collection, Firestore } from '@angular/fire/firestore';
import { MatchService } from './match.service';
import { BALL_DATA } from '../models/ball_data.class';
import { EventHandlerService } from './event-handler.service';
import { LoadMatchService } from './load-match.service';

@Injectable({
  providedIn: 'root',
})
export class SaveMatchService {
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService,
    private loadMatchService: LoadMatchService
  ) {}

  firestore = inject(Firestore);

  public async saveMatchData(matchResult: string): Promise<void> {
    const date = new Date();
    const dateWithoutTime = date.toLocaleDateString();
    let teamDataDTO = this.prepareTeamDataObject();
    if (this.matchService.matchMode === 'prod') {
      await addDoc(collection(this.firestore, 'MatchData'), {
        tossWinner: this.matchService.tossWinner,
        tossResult: this.matchService.tossResult,
        totalOvers: this.matchService.totalOvers,
        totalPlayers: this.matchService.totalPlayers,
        MatchResult: matchResult,
        MatchDate: dateWithoutTime,
        FireBaseDate: date,
        teamData: teamDataDTO,
      }).then(async (matchRef) => {
        this.eventHandlerService.NotifyMatchSaveCompleteEvent(matchRef.id);
      });
    } else {
      await addDoc(collection(this.firestore, 'Test_MatchData'), {
        tossWinner: this.matchService.tossWinner,
        tossResult: this.matchService.tossResult,
        totalOvers: this.matchService.totalOvers,
        totalPlayers: this.matchService.totalPlayers,
        MatchResult: matchResult,
        MatchDate: dateWithoutTime,
        FireBaseDate: date,
        teamData: teamDataDTO,
      }).then(async (matchRef) => {
        this.eventHandlerService.NotifyMatchSaveCompleteEvent(matchRef.id);
      });
    }
  }

  private prepareTeamDataObject(): any {
    this.filterIncorrectBatsmenData();
    this.filterIncorrectBowlersData();
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
    return teamObj;
  }

  private prepareOversPlayedObj(team: Team, teamObj: any, key: string) {
    let overDTO: { [key: number]: BALL_DATA }[] = [];
    team.oversPlayedData.forEach((over) => {
      let ballDataObj: { [key: number]: BALL_DATA } = {};
      over.forEach((ball, index) => {
        ballDataObj[index] = JSON.parse(JSON.stringify(ball));
      });
      overDTO.push(ballDataObj);
    });
    teamObj[key]['oversPlayedData'] = overDTO;
  }

  filterIncorrectBatsmenData(): void {
    this.matchService.teamData['team1'].Batsmens = this.matchService.teamData[
      'team1'
    ].Batsmens.filter((batsman) => batsman.runs > 0 && batsman.balls > 0);

    this.matchService.teamData['team2'].Batsmens = this.matchService.teamData[
      'team2'
    ].Batsmens.filter((batsman) => batsman.runs > 0 && batsman.balls > 0);
  }

  filterIncorrectBowlersData(): void {
    this.matchService.teamData['team1'].Bowlers = this.matchService.teamData[
      'team1'
    ].Bowlers.filter((bowler) => bowler.runs > 0 && bowler.overs > 0);

    this.matchService.teamData['team2'].Bowlers = this.matchService.teamData[
      'team2'
    ].Bowlers.filter((bowler) => bowler.runs > 0 && bowler.overs > 0);
  }
}
