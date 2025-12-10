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

  /**
   * When no options match the current term and the term is non-empty, return a synthetic
   * "Add Player - {term}" option encoded with a prefix for easy detection in selection handlers.
   * Otherwise return the filtered options unchanged.
   */
  public withAddPlayerOption(term: string, filtered: string[]): string[] {
    const clean = (term || '').trim();
    if (clean.length === 0) {
      return filtered;
    }
    // If an exact match already exists, don't show add option
    const hasExact = filtered.some(
      (o) => o.trim().toLowerCase() === clean.toLowerCase()
    );
    if (!hasExact && filtered.length === 0) {
      return [this.encodeAddPlayer(clean)];
    }
    return filtered;
  }

  /** Prefix used to mark synthetic add-player options */
  private readonly ADD_PREFIX = '__ADD_PLAYER__:';

  public encodeAddPlayer(name: string): string {
    return this.ADD_PREFIX + name;
  }

  public isAddPlayerOption(option: string): boolean {
    return (option || '').startsWith(this.ADD_PREFIX);
  }

  public decodeAddPlayer(option: string): string {
    return (option || '').replace(this.ADD_PREFIX, '');
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
