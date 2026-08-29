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
import { MatchMvpSummary } from '../models/mvp.interface';
import { RecentlyViewedService } from './recently-viewed.service';
import { logger } from '../utils/logger';
import { SpinnerService } from './spinner.service';

/**
 * Decoded view-model snapshot of everything loadMatch() assigns onto
 * MatchService for one match - cached (max 5, LRU) keyed by matchId so
 * re-visiting an already-viewed match's details skips re-deriving this
 * from the matches list (see recentMatchViewCache below).
 */
interface MatchViewSnapshot {
  tossWinner: string | null;
  tossResult: string | null;
  matchResult: string | null;
  totalPlayers: number | null;
  totalOvers: number | null;
  matchDate: string | null;
  team1: Team;
  team2: Team;
  mvpSummary: MatchMvpSummary | undefined;
  loadedInningsOneFirstBallTime: Date | null;
  loadedInningsOneLastBallTime: Date | null;
  loadedInningsTwoFirstBallTime: Date | null;
  loadedInningsTwoLastBallTime: Date | null;
}

/** How many recently-viewed matches' decoded state to keep cached. */
const MAX_RECENT_MATCH_VIEWS = 5;

@Injectable({
  providedIn: 'root',
})
export class LoadMatchService {
  constructor(
    public matchService: MatchService,
    private modeService: ModeService,
    private eventHandlerService: EventHandlerService,
    private playerService: PlayerService,
    private mvpCalculatorService: MvpCalculatorService,
    private recentlyViewedService: RecentlyViewedService,
    private spinnerService: SpinnerService,
  ) {
    // A newly saved match adds a new document to the matches collection
    // and its snapshot-cached view (if any, from re-viewing it while it
    // was still in progress) may be stale - clear both so the next
    // getAllMatches()/loadMatch() re-fetches fresh data.
    this.eventHandlerService.MatchSaveCompleteEvent$().subscribe(() => {
      this.matches = [];
      this.recentMatchViewCache.clear();
    });
    // Switching between prod/test mode (dev-only "View All Test Matches"
    // buttons) points getAllMatches()/loadMatch() at a different
    // Firestore collection - without this, the cache would keep serving
    // whichever env's data was fetched first regardless of the new mode.
    // See ModeService.modeChanged$'s doc comment for why this is a no-op
    // in prod builds (mode never actually changes there).
    this.modeService.modeChanged$.subscribe(() => {
      this.matches = [];
      this.recentMatchViewCache.clear();
    });
  }
  firestore = inject(Firestore);

  matches: LoadMatchDTO[] = [];
  // Shared in-flight request so concurrent callers (e.g. a component's
  // constructor AND its ngOnInit both calling getAllMatches() before the
  // first fetch resolves) await the same Firestore read instead of each
  // firing their own duplicate getDocs() call.
  private pendingGetAllMatches: Promise<LoadMatchDTO[]> | null = null;
  // Insertion-order Map used as a simple LRU (max MAX_RECENT_MATCH_VIEWS) -
  // re-set an existing key to bump it to "most recent".
  private recentMatchViewCache = new Map<string, MatchViewSnapshot>();

  async getAllMatches(): Promise<LoadMatchDTO[]> {
    if (this.matches.length > 0) {
      return this.matches;
    }
    if (this.pendingGetAllMatches) {
      return this.pendingGetAllMatches;
    }
    this.pendingGetAllMatches = this.fetchAllMatches().finally(() => {
      this.pendingGetAllMatches = null;
    });
    return this.pendingGetAllMatches;
  }

  private async fetchAllMatches(): Promise<LoadMatchDTO[]> {
    const collectionName =
      this.modeService.mode === 'prod' ? 'MatchData' : 'Test_MatchData';
    const matchesObj: LoadMatchDTO[] = [];
    (
      await getDocs(
        query(
          collection(this.firestore, collectionName),
          orderBy('FireBaseDate', 'desc'),
        ),
      )
    ).docs.map((m) => {
      matchesObj.push({ id: m.id, data: m.data() });
    });
    // Bug fix: this used to only ever populate a LOCAL matchesObj and
    // never assign it to this.matches, so the length-check cache above
    // never actually took effect - every call refetched the whole
    // collection. Assigning here is what makes the cache real.
    this.matches = matchesObj;
    return this.matches;
  }

  async loadMatch(matchId: string): Promise<void> {
    // Force at least one microtask hop before doing ANYTHING below - a
    // cache hit (see recentMatchViewCache) has no real `await` in its
    // branch, so without this, calling code like ScorecardComponent's
    // `await loadMatchService.loadMatch(...)` (invoked from ngOnInit
    // while MatchDetailsComponent's parent view is still mid-change-
    // detection) would run NotifyMatchLoadCompleteEvent() synchronously
    // in the SAME digest that already read isMatchLoaded as false,
    // flipping it to true before Angular's dev-mode checkNoChanges
    // re-verification pass - triggering NG0100
    // (ExpressionChangedAfterItHasBeenCheckedError) and visibly stalling
    // the route transition. Yielding here keeps cache hits and real
    // Firestore reads timing-equivalent from every caller's perspective.
    await Promise.resolve();

    const cached = this.recentMatchViewCache.get(matchId);
    if (cached) {
      // Bump to most-recently-used and apply directly - skips re-fetching
      // getAllMatches() and re-deriving mvp/timestamp fields entirely, and
      // deliberately does NOT go through the spinner - it's instant.
      this.recentMatchViewCache.delete(matchId);
      this.recentMatchViewCache.set(matchId, cached);
      this.matchService.matchNotFound = false;
      this.applySnapshotToMatchService(cached);
      this.mapOversPlayedData();
      this.matchService.setCurrentRoles();
      this.recentlyViewedService.recordMatch(matchId);
      this.eventHandlerService.NotifyMatchLoadCompleteEvent();
      return;
    }

    // Not cached yet for this match - this is the genuine cold path (a
    // Firestore read the first time, or just an uncached derivation if
    // getAllMatches() itself is already warm), so it's the one wrapped in
    // the global spinner.
    await this.spinnerService.wrap(this.loadMatchCold(matchId));
  }

  private async loadMatchCold(matchId: string): Promise<void> {
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
      logger.error('Match not found', { matchId }).catch(() => {});
      return;
    }

    try {
      this.matchService.tossWinner = matchToLoad?.data['tossWinner'];
      this.matchService.tossResult = matchToLoad?.data['tossResult'];
      this.matchService.matchResult = matchToLoad?.data['MatchResult'];
      this.matchService.totalPlayers = matchToLoad?.data['totalPlayers'];
      this.matchService.totalOvers = matchToLoad?.data['totalOvers'];
      this.matchService.matchDate = matchToLoad?.data['MatchDate'];

      const teamData = matchToLoad?.data['teamData'];
      if (!teamData) {
        logger.warn('Team data missing in match', { matchId }).catch(() => {});
      }

      this.matchService.teamData['team1'] = teamData?.[
        'team1'
      ] as unknown as Team;
      this.matchService.teamData['team2'] = teamData?.[
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
        matchToLoad?.data['InningsOneFirstBallTime'],
      );
      this.matchService.loadedInningsOneLastBallTime = this.toDateOrNull(
        matchToLoad?.data['InningsOneLastBallTime'],
      );
      this.matchService.loadedInningsTwoFirstBallTime = this.toDateOrNull(
        matchToLoad?.data['InningsTwoFirstBallTime'],
      );
      this.matchService.loadedInningsTwoLastBallTime = this.toDateOrNull(
        matchToLoad?.data['InningsTwoLastBallTime'],
      );

      this.cacheMatchView(matchId);
      this.mapOversPlayedData();
      this.matchService.setCurrentRoles();
      this.recentlyViewedService.recordMatch(matchId);
      //console.log('load completed for {' + matchId + '} from service');
      this.eventHandlerService.NotifyMatchLoadCompleteEvent();
    } catch (error: any) {
      logger
        .error('Error loading match', { matchId, error: error?.message })
        .catch(() => {});
      this.matchService.matchNotFound = true;
    }
  }

  /** Snapshots the fields loadMatch() just derived onto MatchService, for recentMatchViewCache. */
  private cacheMatchView(matchId: string): void {
    const snapshot: MatchViewSnapshot = {
      tossWinner: this.matchService.tossWinner,
      tossResult: this.matchService.tossResult,
      matchResult: this.matchService.matchResult,
      totalPlayers: this.matchService.totalPlayers,
      totalOvers: this.matchService.totalOvers,
      matchDate: this.matchService.matchDate,
      team1: this.matchService.teamData['team1'],
      team2: this.matchService.teamData['team2'],
      mvpSummary: this.matchService.mvpSummary,
      loadedInningsOneFirstBallTime:
        this.matchService.loadedInningsOneFirstBallTime,
      loadedInningsOneLastBallTime:
        this.matchService.loadedInningsOneLastBallTime,
      loadedInningsTwoFirstBallTime:
        this.matchService.loadedInningsTwoFirstBallTime,
      loadedInningsTwoLastBallTime:
        this.matchService.loadedInningsTwoLastBallTime,
    };
    this.recentMatchViewCache.set(matchId, snapshot);
    if (this.recentMatchViewCache.size > MAX_RECENT_MATCH_VIEWS) {
      const oldestKey = this.recentMatchViewCache.keys().next().value;
      if (oldestKey !== undefined) {
        this.recentMatchViewCache.delete(oldestKey);
      }
    }
  }

  /** Reapplies a cached MatchViewSnapshot onto MatchService (cache-hit path of loadMatch()). */
  private applySnapshotToMatchService(snapshot: MatchViewSnapshot): void {
    this.matchService.tossWinner = snapshot.tossWinner;
    this.matchService.tossResult = snapshot.tossResult;
    this.matchService.matchResult = snapshot.matchResult;
    this.matchService.totalPlayers = snapshot.totalPlayers;
    this.matchService.totalOvers = snapshot.totalOvers;
    this.matchService.matchDate = snapshot.matchDate;
    this.matchService.teamData['team1'] = snapshot.team1;
    this.matchService.teamData['team2'] = snapshot.team2;
    this.matchService.mvpSummary = snapshot.mvpSummary;
    this.matchService.isMatchLoadedFromHistory = true;
    this.matchService.loadedInningsOneFirstBallTime =
      snapshot.loadedInningsOneFirstBallTime;
    this.matchService.loadedInningsOneLastBallTime =
      snapshot.loadedInningsOneLastBallTime;
    this.matchService.loadedInningsTwoFirstBallTime =
      snapshot.loadedInningsTwoFirstBallTime;
    this.matchService.loadedInningsTwoLastBallTime =
      snapshot.loadedInningsTwoLastBallTime;
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
          ball_data,
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
          ball_data,
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
        // Uses loadMatchCold() directly (bypassing the public loadMatch())
        // - this admin backfill loop replays every historical match
        // sequentially, and routing each one through the spinner would
        // just flicker show/hide once per match instead of giving useful
        // feedback; this is a background bulk operation, not a
        // user-facing gating read (see plan's spinner-wiring exclusions).
        await this.loadMatchCold(match.id);
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
          this.matchService.totalOvers ?? 0,
        );

        await this.playerService.savePlayerData(
          match.id,
          this.matchService.matchResult as string,
          mvpSummary,
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
