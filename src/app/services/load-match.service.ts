import { inject, Injectable, OnInit } from '@angular/core';
import {
  collection,
  DocumentData,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  query,
} from '@angular/fire/firestore';
import { LoadMatchDTO } from '../models/LoadMatchDTO.interface';
import { MatchService } from './match.service';
import { Team } from '../models/team.interface';

@Injectable({
  providedIn: 'root',
})
export class LoadMatchService {
  constructor(public matchService: MatchService) {
    this.Init();
  }
  firestore = inject(Firestore);

  matches: LoadMatchDTO[] = [];

  Init(): void {
    this.getAllMatches().then((matches) => {
      this.matches = matches;
    });
  }

  async getAllMatches(): Promise<LoadMatchDTO[]> {
    if (this.matches.length === 0) {
      let matchesObj: LoadMatchDTO[] = [];
      (await getDocs(query(collection(this.firestore, 'MatchData')))).docs.map(
        (m) => {
          matchesObj.push({ id: m.id, data: m.data() });
        }
      );
      return new Promise<LoadMatchDTO[]>((resolve) => {
        resolve(matchesObj);
      });
    } else {
      return new Promise<LoadMatchDTO[]>((resolve) => {
        resolve(this.matches);
      });
    }
  }

  async loadMatch(matchId: string): Promise<void> {
    let matches = await this.getAllMatches();
    let matchToLoad = matches.find((match) => {
      return match['id'] === matchId;
    });
    this.matchService.tossWinner = matchToLoad?.data['tossWinner'];
    this.matchService.tossResult = matchToLoad?.data['tossResult'];
    this.matchService.matchResult = matchToLoad?.data['MatchResult'];
    this.matchService.totalPlayers = matchToLoad?.data['totalPlayers'];
    this.matchService.totalOvers = matchToLoad?.data['totalOvers'];
    this.matchService.matchDate = matchToLoad?.data['MatchDate'];
    this.matchService.teamData['team1'] = matchToLoad?.data['teamData'][
      'team1'
    ] as unknown as Team;
    this.matchService.teamData['team2'] = matchToLoad?.data['teamData'][
      'team2'
    ] as unknown as Team;
    this.mapOversPlayedData();
    this.matchService.setCurrentRoles();
    console.log('load complete from service');
  }

  public async getMatchData(matchRef: DocumentReference) {
    return (await getDoc(matchRef)).data();
  }

  public async addMatch(matchRef: DocumentReference) {
    const matchData = await this.getMatchData(matchRef);
    let matchObj: LoadMatchDTO = {
      id: matchRef.id,
      data: matchData as DocumentData,
    };
    this.matches.push(matchObj);
  }

  public mapOversPlayedData(): void {
    let oversPlayedDataTeam1 =
      this.matchService.teamData['team1'].oversPlayedData;
    this.matchService.teamData['team1'].oversPlayedData = [];
    oversPlayedDataTeam1.forEach((over, index) => {
      this.matchService.teamData['team1'].oversPlayedData.push([]);
      Object.values(over).forEach((ball_data) => {
        this.matchService.teamData['team1'].oversPlayedData[index].push(
          ball_data
        );
      });
    });

    let oversPlayedDataTeam2 =
      this.matchService.teamData['team2'].oversPlayedData;
    this.matchService.teamData['team2'].oversPlayedData = [];
    oversPlayedDataTeam2.forEach((over, index) => {
      this.matchService.teamData['team2'].oversPlayedData.push([]);
      Object.values(over).forEach((ball_data) => {
        this.matchService.teamData['team2'].oversPlayedData[index].push(
          ball_data
        );
      });
    });
  }
}
