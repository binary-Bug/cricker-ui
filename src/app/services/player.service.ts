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
import { Batsmen } from '../models/batsmen.interface';
import { Bowler } from '../models/bowler.interface';
import { Fielder } from '../models/fielder.interface';
import { UtilityService } from './utility.service';

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  players: Player[] = [];

  firestore = inject(Firestore);
  matchService = inject(MatchService);
  utilityService = inject(UtilityService);

  async getAllPlayers(): Promise<Player[]> {
    if (this.players.length > 0)
      return new Promise<Player[]>((resolve) => {
        resolve(this.players);
      });
    else {
      if (this.matchService.matchMode === 'prod') {
        (
          await getDocs(
            query(
              collection(this.firestore, 'PlayerData'),
              orderBy('matchesPlayed', 'desc')
            )
          )
        ).docs.map((player) => this.players.push(player.data() as Player));
        return new Promise<Player[]>((resolve) => {
          resolve(this.players);
        });
      } else {
        (
          await getDocs(
            query(
              collection(this.firestore, 'Test_PlayerData'),
              orderBy('matchesPlayed', 'desc')
            )
          )
        ).docs.map((player) => this.players.push(player.data() as Player));
        return new Promise<Player[]>((resolve) => {
          resolve(this.players);
        });
      }
    }
  }

  public getPlayer(playerName: string): Player | undefined {
    if (this.players.length > 0) {
      return this.players.find((player) => player.name === playerName);
    } else return undefined;
  }

  async savePlayerData(matchId: string, matchResult: string): Promise<void> {
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
    await this.deleteExistingPlayerData();
    await this.updatePlayerDataInFirebase();
    console.log('Player Data Saved Successfully');
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
    } as Player;
  }

  async deleteExistingPlayerData(): Promise<void> {
    if (this.matchService.matchMode === 'prod') {
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
    if (this.matchService.matchMode === 'prod') {
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
