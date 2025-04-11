import { inject, Injectable, OnInit } from '@angular/core';
import {
  collection,
  DocumentData,
  DocumentReference,
  Firestore,
  getDoc,
  getDocs,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { LoadMatchDTO } from '../models/LoadMatchDTO.interface';
import { MatchService } from './match.service';
import { Team } from '../models/team.interface';
import { EventHandlerService } from './event-handler.service';
import { PlayerService } from './player.service';

@Injectable({
  providedIn: 'root',
})
export class LoadMatchService {
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService,
    private playerService: PlayerService
  ) {}
  firestore = inject(Firestore);

  matches: LoadMatchDTO[] = [];

  async getAllMatches(): Promise<LoadMatchDTO[]> {
    if (this.matches.length === 0) {
      if (this.matchService.matchMode === 'prod') {
        let matchesObj: LoadMatchDTO[] = [];
        (
          await getDocs(
            query(
              collection(this.firestore, 'MatchData'),
              orderBy('FireBaseDate', 'desc')
            )
          )
        ).docs.map((m) => {
          matchesObj.push({ id: m.id, data: m.data() });
        });
        return new Promise<LoadMatchDTO[]>((resolve) => {
          resolve(matchesObj);
        });
      } else {
        let matchesObj: LoadMatchDTO[] = [];
        (
          await getDocs(
            query(
              collection(this.firestore, 'Test_MatchData'),
              orderBy('FireBaseDate', 'desc')
            )
          )
        ).docs.map((m) => {
          matchesObj.push({ id: m.id, data: m.data() });
        });
        return new Promise<LoadMatchDTO[]>((resolve) => {
          resolve(matchesObj);
        });
      }
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
    //console.log('load completed for {' + matchId + '} from service');
    this.eventHandlerService.NotifyMatchLoadCompleteEvent();
  }

  public async getMatchData(matchRef: DocumentReference) {
    return (await getDoc(matchRef)).data();
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

  public async UpdateProdPlayerData(): Promise<void> {
    this.matchService.matchMode = 'prod';
    await this.playerService.deleteExistingPlayerData();
    console.log('Starting... Updating Player Data for prod');
    this.getAllMatches().then(async (matches) => {
      for (const match of matches) {
        this.matchService.matchMode = 'prod';
        await this.loadMatch(match.id);
        console.log(match.id + ' - match loaded in loop');
        console.log('loading players data from firebase');
        await this.playerService.getAllPlayers();
        console.log('players loaded from firebase');
        console.log('starting ... calling save player data');
        await this.playerService.savePlayerData(
          match.id,
          this.matchService.matchResult as string
        );
        console.log(match.id + ' - player data updated in loop');
        this.matchService.resetServiceData();
        this.playerService.players = [];
      }
    });
  }
}
