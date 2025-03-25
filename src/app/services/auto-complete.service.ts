import { Injectable } from '@angular/core';
import { MatchService } from './match.service';
import { Team } from '../models/team.interface';

@Injectable({
  providedIn: 'root',
})
export class AutoCompleteService {
  constructor(private matchService: MatchService) {}

  public _filter(
    value: string,
    options: string[],
    shouldExclude: boolean = false
  ): string[] {
    const filterValue = value.toLowerCase();
    if (shouldExclude) {
      return options.filter((option) => option.toLowerCase() !== filterValue);
    }
    return options.filter((option) =>
      option.toLowerCase().includes(filterValue)
    );
  }

  public populatePlayersArray(players: string[]): string[] {
    let teams: string[] = ['team1', 'team2'];
    const roles: string[] = ['Batsmens', 'Bowlers', 'Fielders'];
    teams.forEach((team) => {
      for (const role of roles) {
        (
          this.matchService.teamData[team][role as keyof Team] as Array<any>
        ).forEach((player) => {
          players = this._filter(player.name, players, true);
          players.push(player.name);
        });
      }
    });
    return players;
  }
}
