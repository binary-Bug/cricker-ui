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
import { MvpCalculatorService } from './mvp-calculator.service';

@Injectable({
  providedIn: 'root',
})
export class LoadMatchService {
  constructor(
    public matchService: MatchService,
    private modeService: ModeService,
    private eventHandlerService: EventHandlerService,
    private playerService: PlayerService,
    private mvpCalculatorService: MvpCalculatorService
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

    // Older matches saved before this feature existed won't have an "mvp"
    // field at all - fall back to undefined so match-details simply hides
    // the MoM banner/top-5 list for those, instead of crashing.
    this.matchService.mvpSummary = matchToLoad?.data['mvp']
      ? {
          topFive: matchToLoad.data['mvp']['topFive'] ?? [],
          manOfTheMatch: matchToLoad.data['mvp']['manOfTheMatch'] ?? '',
          allPlayers: [],
        }
      : undefined;

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
      // getAllMatches() returns matches newest-first (FireBaseDate desc -
      // the order the match-browsing UI wants), but this loop rebuilds
      // every player's stats from scratch via savePlayerData(), which
      // appends onto Player.mvpPointsHistory in whatever order matches are
      // replayed here (see PlayerService.applyMvpPointsToPlayers). Replaying
      // newest-first would leave that history - and the player-details MVP
      // trend sparkline that reads it - in reverse-chronological order, so
      // reverse to oldest-first here before replaying.
      const chronologicalMatches = [...matches].reverse();
      for (const match of chronologicalMatches) {
        this.modeService.setMode('prod');
        await this.loadMatch(match.id);
        console.log(match.id + ' - match loaded in loop');
        console.log('loading players data from firebase');
        await this.playerService.getAllPlayers();
        console.log('players loaded from firebase');
        console.log('starting ... calling save player data');

        // This backfill loop rebuilds every player's aggregate stats doc
        // from scratch by replaying ALL historical matches, so we also
        // recompute MVP points fresh here for each one (rather than relying
        // on matchService.mvpSummary, which is only populated from a
        // match's persisted "mvp" field and would be undefined for matches
        // saved before this feature existed) - this way every player's
        // lifetime mvpPoints/momCount total gets correctly backfilled too.
        const weights = await this.mvpCalculatorService.loadWeights();
        const mvpSummary = this.mvpCalculatorService.calculateMatchMvp(
          this.matchService.teamData['team1'],
          this.matchService.teamData['team2'],
          this.getWinningTeamKeyForLoadedMatch(),
          this.getTossWinnerKeyForLoadedMatch(),
          weights,
          this.matchService.totalOvers ?? 0
        );

        await this.playerService.savePlayerData(
          match.id,
          this.matchService.matchResult as string,
          mvpSummary
        );
        console.log(match.id + ' - player data updated in loop');
        this.matchService.resetServiceData();
        this.playerService.players = [];
      }
    });
  }

  /**
   * Works out which team won a match that's already been loaded into
   * MatchService (teamData/currentRoles populated), for the MVP
   * winning-team tie-break rule - undefined for a tie, same convention as
   * MatchCompleteDialog.getWinningTeamKey(). Needed here because backfilled
   * historical matches don't go through MatchCompleteDialog at all.
   */
  private getWinningTeamKeyForLoadedMatch(): 'team1' | 'team2' | undefined {
    const team1Runs = this.matchService.teamData['team1'].runsScored;
    const team2Runs = this.matchService.teamData['team2'].runsScored;
    if (team1Runs === team2Runs) return undefined;
    return team1Runs > team2Runs ? 'team1' : 'team2';
  }

  /**
   * Which team won the toss for a match that's already been loaded into
   * MatchService, for the MVP toss-winning-captain bonus - undefined for
   * older matches saved before toss tracking existed (safely no-ops the
   * bonus for them, same as calculateMatchMvp's own doc comment explains).
   */
  private getTossWinnerKeyForLoadedMatch(): 'team1' | 'team2' | undefined {
    return this.matchService.tossWinner === 'team1' ||
      this.matchService.tossWinner === 'team2'
      ? this.matchService.tossWinner
      : undefined;
  }
}
