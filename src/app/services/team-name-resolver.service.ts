import { Injectable } from '@angular/core';
import adjectivesData from '../data/team-name-adjectives.json';

export interface TeamNameAdjective {
  name: string;
  emoji: string;
}

/**
 * Auto-resolves a team's display name from its captain + a randomly picked
 * "sport adjective" (Warriors, Lions, etc. - see team-name-adjectives.json),
 * replacing the old free-text Team Name inputs on the New Match page.
 */
@Injectable({
  providedIn: 'root',
})
export class TeamNameResolverService {
  private readonly adjectives: TeamNameAdjective[] = adjectivesData;

  /** Two distinct random adjectives, one per team, so both teams in a match never match. */
  pickTwoDistinctAdjectives(): [TeamNameAdjective, TeamNameAdjective] {
    const first = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    let second = first;
    while (second === first) {
      second = this.adjectives[Math.floor(Math.random() * this.adjectives.length)];
    }
    return [first, second];
  }

  /** First token of a full name, e.g. "Virat Kohli" -> "Virat". */
  firstName(fullName: string | null | undefined): string {
    const parts = (fullName || '').trim().split(/\s+/).filter(Boolean);
    return parts[0] ?? '';
  }
}
