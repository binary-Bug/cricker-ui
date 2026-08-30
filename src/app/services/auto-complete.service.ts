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
    // Trim so a stray leading/trailing space doesn't make an existing player
    // look like a non-match (which would otherwise offer a duplicate "Add Player").
    const filterValue = (value || '').trim().toLowerCase();
    if (shouldExclude) {
      return options.filter((option) => option.toLowerCase() !== filterValue);
    }
    return options.filter((option) =>
      option.toLowerCase().includes(filterValue)
    );
  }

  /**
   * Appends a synthetic "Add Player - {term}" option (encoded for easy detection in
   * selection handlers) to the end of the filtered list whenever the typed term has
   * no exact match, so users can add a new player without losing sight of similarly
   * named existing players (e.g. typing "Jo" still shows "John" before the add option).
   * Returns the filtered options unchanged if an exact match already exists.
   */
  public withAddPlayerOption(term: string, filtered: string[]): string[] {
    const clean = (term || '').trim();
    if (clean.length === 0) {
      return filtered;
    }
    const hasExact = filtered.some(
      (o) => o.trim().toLowerCase() === clean.toLowerCase()
    );
    if (hasExact) {
      return filtered;
    }
    return [...filtered, this.encodeAddPlayer(clean)];
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

  /** Whether a filtered option list contains the synthetic add-player entry. */
  public hasAddPlayerOption(options: string[] | null | undefined): boolean {
    return (options || []).some((o) => this.isAddPlayerOption(o));
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
