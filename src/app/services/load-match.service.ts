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
import { ModeService } from './mode.service';
import { Team } from '../models/team.interface';
import { EventHandlerService } from './event-handler.service';
import { PlayerService } from './player.service';

@Injectable({
  providedIn: 'root',
})
export class LoadMatchService {
  constructor(
    public matchService: MatchService,
    private modeService: ModeService,
    private eventHandlerService: EventHandlerService,
    private playerService: PlayerService
  ) {}
  firestore = inject(Firestore);

  matches: LoadMatchDTO[] = [];

  async getAllMatches(): Promise<LoadMatchDTO[]> {
    if (this.matches.length === 0) {
      if (this.modeService.mode === 'prod') {
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

    // If the id isn't present in the collection ModeService currently points
    // at (e.g. a stale/bad link, or a deleted match), surface that instead of
    // silently wiping teamData with undefined values further down - see
    // matchService.matchNotFound doc comment for how the UI reacts to this.
    this.matchService.matchNotFound = !matchToLoad;
    if (!matchToLoad) {
      return;
    }

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

    // Historical matches don't carry per-ball timestamps (they're stripped
    // before saving - see SaveMatchService.prepareOversPlayedObj), so the 4
    // innings-timestamp getters on MatchService can't derive their values
    // from oversPlayedData here. Instead, read the 4 flat fields saved on
    // the match document directly and flip isMatchLoadedFromHistory so
    // those getters fall back to these loaded values instead of scanning
    // (now timestamp-less) ball data.
    this.matchService.isMatchLoadedFromHistory = true;
    this.matchService.loadedInningsOneFirstBallTime = this.toDateOrNull(
      matchToLoad?.data['InningsOneFirstBallTime']
    );
    this.matchService.loadedInningsOneLastBallTime = this.toDateOrNull(
      matchToLoad?.data['InningsOneLastBallTime']
    );
    this.matchService.loadedInningsTwoFirstBallTime = this.toDateOrNull(
      matchToLoad?.data['InningsTwoFirstBallTime']
    );
    this.matchService.loadedInningsTwoLastBallTime = this.toDateOrNull(
      matchToLoad?.data['InningsTwoLastBallTime']
    );

    this.mapOversPlayedData();
    this.matchService.setCurrentRoles();
    //console.log('load completed for {' + matchId + '} from service');
    this.eventHandlerService.NotifyMatchLoadCompleteEvent();
  }

  /**
   * Firestore returns Timestamp fields (not JS Date) when a document is
   * read back. Older matches saved before this feature also won't have
   * these fields at all. This normalizes both cases to a plain Date | null
   * so match-details can safely call toLocaleTimeString() on the result.
   */
  private toDateOrNull(value: any): Date | null {
    if (!value) return null;
    return typeof value.toDate === 'function' ? value.toDate() : value;
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
    this.modeService.setMode('prod');
    await this.playerService.deleteExistingPlayerData();
    console.log('Starting... Updating Player Data for prod');
    this.getAllMatches().then(async (matches) => {
      for (const match of matches) {
        this.modeService.setMode('prod');
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
