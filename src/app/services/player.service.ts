import { inject, Injectable } from '@angular/core';
import { BestBowling, Player } from '../models/player.interface';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  Firestore,
  getDocs,
  orderBy,
  query,
} from '@angular/fire/firestore';
import { MatchService } from './match.service';
import { ModeService } from './mode.service';
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { Fielder } from '../models/fielder.interface';
import { UtilityService } from './utility.service';
import { MatchMvpSummary } from '../models/mvp.interface';
import { EventHandlerService } from './event-handler.service';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  players: Player[] = [];
  // Persists the stats page's selected stat type (overview/batting/bowling/
  // fielding/mvp) across StatsComponent recreation, e.g. when navigating to
  // player-details and back, so the selection isn't lost when the component
  // reconstructs.
  lastSelectedStatType: string = 'overview';

  firestore = inject(Firestore);
  matchService = inject(MatchService);
  modeService = inject(ModeService);
  utilityService = inject(UtilityService);
  private eventHandlerService = inject(EventHandlerService);
  // Shared in-flight request so concurrent callers before the first fetch
  // resolves await the same Firestore read instead of each slipping past
  // the `this.players.length > 0` check and firing their own duplicate
  // getDocs() call.
  private pendingGetAllPlayers: Promise<Player[]> | null = null;

  constructor() {
    // Once a match is saved, every player's stats doc may have changed
    // (matchesPlayed, runsScored, mvpPoints, etc. all get rewritten - see
    // savePlayerData()), so the cached roster is stale - clear it so the
    // next getAllPlayers() call re-fetches from Firestore instead of
    // serving outdated stats.
    this.eventHandlerService.MatchSaveCompleteEvent$().subscribe(() => {
      this.players = [];
    });
    // Switching between prod/test mode (dev-only "View All Test Players"
    // button) points getAllPlayers() at a different Firestore collection -
    // without this, the cache would keep serving whichever env's roster
    // was fetched first regardless of the new mode. See
    // ModeService.modeChanged$'s doc comment for why this is a no-op in
    // prod builds (mode never actually changes there).
    this.modeService.modeChanged$.subscribe(() => {
      this.players = [];
    });
  }

  async getAllPlayers(): Promise<Player[]> {
    if (this.players.length > 0) {
      return this.players;
    }
    if (this.pendingGetAllPlayers) {
      return this.pendingGetAllPlayers;
    }
    this.pendingGetAllPlayers = this.fetchAllPlayers().finally(() => {
      this.pendingGetAllPlayers = null;
    });
    return this.pendingGetAllPlayers;
  }

  private async fetchAllPlayers(): Promise<Player[]> {
    const collectionName =
      this.modeService.mode === 'prod' ? 'PlayerData' : 'Test_PlayerData';
    (
      await getDocs(
        query(
          collection(this.firestore, collectionName),
          orderBy('matchesPlayed', 'desc')
        )
      )
    ).docs.map((player) => {
      const playerObj = player.data() as Player;
      this.normalizePlayerNumericFields(playerObj);
      this.players.push(playerObj);
    });
    return this.players;
  }


  public getPlayer(playerName: string): Player | undefined {
    if (this.players.length > 0) {
      return this.players.find((player) => player.name === playerName);
    } else return undefined;
  }

  async savePlayerData(
    matchId: string,
    matchResult: string,
    mvpSummary: MatchMvpSummary
  ): Promise<void> {
    console.log('Saving Player Data');
    let winningTeamKey: string = matchResult.includes(
      this.matchService.teamData['team1'].name
    )
      ? 'team1'
      : 'team2';
    var parameter = [];
    parameter.push([this.matchService.teamData['team1'].Batsmens, 'team1']);
    parameter.push([this.matchService.teamData['team1'].Bowlers, 'team1']);
    parameter.push([this.matchService.teamData['team1'].Fielders, 'team1']);
    parameter.push([this.matchService.teamData['team2'].Batsmens, 'team2']);
    parameter.push([this.matchService.teamData['team2'].Bowlers, 'team2']);
    parameter.push([this.matchService.teamData['team2'].Fielders, 'team2']);
    this.updatePlayerStats(parameter, matchId, winningTeamKey);
    // Roll each player's MVP points for this match onto their career total,
    // and bump the Man of the Match's momCount - done after updatePlayerStats
    // so every player involved already has an up-to-date entry in
    // this.players (either an existing, mutated-in-place record, or a
    // freshly created one) to attach points to.
    this.applyMvpPointsToPlayers(mvpSummary, matchId);
    await this.deleteExistingPlayerData();
    await this.updatePlayerDataInFirebase();
    console.log('Player Data Saved Successfully');
  }

  /**
   * Adds each player's computed MVP points for this match onto their
   * lifetime Player.mvpPoints total, and increments the Man of the Match's
   * momCount. Uses mvpSummary.allPlayers (every player who took part), not
   * just the persisted top 5 - a player's career MVP total should reflect
   * every match they played, not only the ones where they made the top 5.
   */
  /**
   * Ensures every numeric/array field on a Player is a real number/array
   * before any arithmetic or `.push()` is done on it. Firestore docs
   * created before a given field existed simply don't have it (undefined),
   * and any doc that was already corrupted by the pre-fix
   * `undefined + x = NaN` MVP bug may still hold a stored NaN - both cases
   * must be reset here, since `??`/`||` fallbacks don't catch an
   * already-NaN value. This covers the entire numeric/array surface of
   * `Player` (not just mvpPoints/momCount) as precautionary hardening,
   * since every one of these fields predates the MVP feature and could in
   * principle hit the same class of bug.
   */
  private normalizePlayerNumericFields(player: Player): void {
    const numericFields: (keyof Player)[] = [
      'matchesPlayed',
      'won',
      'lost',
      'runsScored',
      'ballsPlayed',
      'fours',
      'sixes',
      'overs',
      'runsAgainst',
      'wickets',
      'maidens',
      'catches',
      'runOuts',
      'stumpOuts',
      'highestScore',
      'mvpPoints',
      'momCount',
      'bestMvpPoints',
    ];
    numericFields.forEach((field) => {
      const value = player[field];
      if (value === undefined || value === null || (typeof value === 'number' && isNaN(value))) {
        (player[field] as number) = 0;
      }
    });

    if (!player.matchIds) player.matchIds = [];
    if (!player.mvpPointsHistory) player.mvpPointsHistory = [];
    if (player.bestMvpMatchId === undefined || player.bestMvpMatchId === null) {
      player.bestMvpMatchId = '';
    }
    if (!player.bbi) player.bbi = { wickets: 0, runs: 0 };
    if (player.bbi.wickets === undefined || player.bbi.wickets === null || isNaN(player.bbi.wickets)) {
      player.bbi.wickets = 0;
    }
    if (player.bbi.runs === undefined || player.bbi.runs === null || isNaN(player.bbi.runs)) {
      player.bbi.runs = 0;
    }
  }

  /**
   * @param matchId The match this mvpSummary was computed for - recorded
   *   against a player's bestMvpMatchId only if this match becomes their new
   *   career-best, and appended to mvpPointsHistory either way so the
   *   trend sparkline has one entry per match played, in order.
   */
  applyMvpPointsToPlayers(mvpSummary: MatchMvpSummary, matchId: string): void {
    mvpSummary.allPlayers.forEach((breakdown) => {
      const playerObj = this.players.find(
        (ply) => ply.name.trim() === breakdown.name.trim()
      );
      if (playerObj) {
        // Existing players' Firestore docs may predate the MVP feature and
        // simply not have these fields yet (undefined), or may already be
        // corrupted to NaN from before this normalization existed - either
        // way, `undefined + x` / `NaN + x` both evaluate to NaN and would
        // permanently poison the player's career total. Normalize to 0 first
        // so every player accumulates correctly, not just newly created ones.
        this.normalizePlayerNumericFields(playerObj);
        playerObj.mvpPoints += breakdown.totalPoints;
        if (breakdown.name === mvpSummary.manOfTheMatch) {
          playerObj.momCount += 1;
        }

        playerObj.mvpPointsHistory.push(breakdown.totalPoints);
        if (breakdown.totalPoints > playerObj.bestMvpPoints) {
          playerObj.bestMvpPoints = breakdown.totalPoints;
          playerObj.bestMvpMatchId = matchId;
        }
      }
    });
  }

  updatePlayerStats(
    data: any[],
    matchId: string,
    winningTeamKey: string
  ): void {
    let playersPlayedList: Player[] = [];
    data.forEach((list) => {
      list[0].forEach((player: any) => {
        let playerObj = playersPlayedList.find((ply) => {
          return ply.name === player.name;
        });
        if (playerObj) {
          this.updateStats(playerObj, player);
        } else {
          let playerObj = this.players.find((ply) => {
            return ply.name.trim() === player.name.trim();
          });
          if (playerObj) {
            playerObj.matchesPlayed += 1;
            list[1] === winningTeamKey
              ? (playerObj.won += 1)
              : (playerObj.lost += 1);
            playerObj.matchIds.push(matchId);
            this.updateStats(playerObj, player);
            playersPlayedList.push(playerObj);
          } else {
            let playerSaveObj: Player = this.initializePlayerSaveObject(
              player.name
            );
            list[1] === winningTeamKey
              ? (playerSaveObj.won = playerSaveObj.won += 1)
              : (playerSaveObj.lost = playerSaveObj.lost += 1);
            playerSaveObj.matchIds.push(matchId);
            this.updateStats(playerSaveObj, player);
            this.players.push(playerSaveObj);
            playersPlayedList.push(playerSaveObj);
          }
        }
      });
    });
  }

  updateStats(playerSaveObj: Player, player: any): void {
    if (player.fours !== undefined && player.fours !== null)
      this.updateBatsmenStats(playerSaveObj, player as Batsmen);
    else if (player.wickets !== undefined && player.wickets !== null)
      this.updateBowlerStats(playerSaveObj, player as Bowler);
    else this.updateFielderStats(playerSaveObj, player as Fielder);
  }

  updateBatsmenStats(playerSaveObj: Player, playerData: Batsmen): void {
    playerSaveObj.runsScored += playerData.runs;
    playerSaveObj.ballsPlayed += playerData.balls;
    playerSaveObj.fours += playerData.fours;
    playerSaveObj.sixes += playerData.six;
    // Updating Player Highest Score
    if (
      playerSaveObj.highestScore !== undefined &&
      playerSaveObj.highestScore !== null &&
      playerData.runs > playerSaveObj.highestScore
    ) {
      playerSaveObj.highestScore = playerData.runs;
      playerSaveObj.isNotOutHS = playerData.status === 'Not Out';
    } else if (
      playerSaveObj.highestScore !== undefined &&
      playerSaveObj.highestScore !== null &&
      playerSaveObj.highestScore === playerData.runs
    ) {
      if (playerData.status === 'Not Out') {
        playerSaveObj.highestScore = playerData.runs;
        playerSaveObj.isNotOutHS = true;
      } else {
        playerSaveObj.highestScore = playerData.runs;
        playerSaveObj.isNotOutHS = playerSaveObj.isNotOutHS;
      }
    } else if (
      playerSaveObj.highestScore === undefined ||
      playerSaveObj.highestScore === null
    ) {
      playerSaveObj.highestScore = playerData.runs;
      playerSaveObj.isNotOutHS = playerData.status === 'Not Out';
    }
  }

  updateBowlerStats(playerSaveObj: Player, playerData: Bowler): void {
    //calculating best bowling data for bowler
    let bestBowlingData: BestBowling;
    if (playerSaveObj.bbi.wickets > playerData.wickets) {
      bestBowlingData = playerSaveObj.bbi;
    } else {
      if (playerData.wickets > playerSaveObj.bbi.wickets) {
        bestBowlingData = {
          wickets: playerData.wickets,
          runs: playerData.runs,
        };
      } else {
        if (playerSaveObj.bbi.runs < playerData.runs) {
          bestBowlingData = playerSaveObj.bbi;
        } else {
          bestBowlingData = {
            wickets: playerData.wickets,
            runs: playerData.runs,
          };
        }
      }
    }

    playerSaveObj.runsAgainst += playerData.runs;
    playerSaveObj.overs = this.utilityService.convertToOvers(
      this.utilityService.ballplayed(playerData.overs) +
        this.utilityService.ballplayed(playerSaveObj.overs)
    );
    playerSaveObj.wickets += playerData.wickets;
    playerSaveObj.maidens += playerData.maidens;
    playerSaveObj.bbi = bestBowlingData;
  }

  updateFielderStats(playerSaveObj: Player, playerData: Fielder): void {
    playerSaveObj.runOuts += playerData.runOuts;
    playerSaveObj.catches += playerData.catches;
    playerSaveObj.stumpOuts += playerData.stumpOuts;
  }

  initializePlayerSaveObject(playerName: string): Player {
    return {
      name: playerName,
      matchesPlayed: 1,
      won: 0,
      lost: 0,
      runsScored: 0,
      ballsPlayed: 0,
      fours: 0,
      sixes: 0,
      overs: 0,
      runsAgainst: 0,
      wickets: 0,
      maidens: 0,
      catches: 0,
      runOuts: 0,
      stumpOuts: 0,
      matchIds: [],
      bbi: { wickets: 0, runs: 0 },
      highestScore: 0,
      isNotOutHS: false,
      // MVP points/MoM count start at 0 for a brand new player - populated
      // going forward as they play matches (see applyMvpPointsToPlayers).
      mvpPoints: 0,
      momCount: 0,
      bestMvpPoints: 0,
      bestMvpMatchId: '',
      mvpPointsHistory: [],
    } as Player;
  }

  async deleteExistingPlayerData(): Promise<void> {
    if (this.modeService.mode === 'prod') {
      (await getDocs(query(collection(this.firestore, 'PlayerData')))).docs.map(
        async (player) =>
          await deleteDoc(doc(this.firestore, 'PlayerData/' + player.id))
      );
    } else {
      (
        await getDocs(query(collection(this.firestore, 'Test_PlayerData')))
      ).docs.map(
        async (player) =>
          await deleteDoc(doc(this.firestore, 'Test_PlayerData/' + player.id))
      );
    }
  }

  async updatePlayerDataInFirebase(): Promise<void> {
    if (this.modeService.mode === 'prod') {
      this.players.forEach(async (player) => {
        await addDoc(collection(this.firestore, 'PlayerData'), {
          ...player,
        });
      });
    } else {
      this.players.forEach(async (player) => {
        await addDoc(collection(this.firestore, 'Test_PlayerData'), {
          ...player,
        });
      });
    }
  }
}
