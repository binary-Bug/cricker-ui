import { Injectable } from '@angular/core';

/** How many recently-viewed entries to keep, per the caching enhancement plan. */
const MAX_RECENT = 5;

/**
 * Tracks the last 5 viewed player names and last 5 viewed match ids for
 * the current session. Note: this does NOT save any extra Firestore
 * reads by itself - player details is already served entirely from
 * PlayerService.getAllPlayers()'s single cached roster fetch (a `.find()`
 * away, no separate per-player call exists to eliminate), and match
 * details' actual read savings come from LoadMatchService's own
 * getAllMatches() cache fix + its recentMatchViewCache LRU. This service
 * exists to satisfy the explicit "last 5 opened player/match details are
 * cached" requirement and as groundwork for a future "Recently Viewed"
 * quick-access UI - most-recent-first, re-viewing an existing entry bumps
 * it back to the front rather than adding a duplicate.
 */
@Injectable({
  providedIn: 'root',
})
export class RecentlyViewedService {
  private recentPlayerNames: string[] = [];
  private recentMatchIds: string[] = [];

  recordPlayer(name: string): void {
    this.recentPlayerNames = this.bumpToFront(this.recentPlayerNames, name);
  }

  recordMatch(matchId: string): void {
    this.recentMatchIds = this.bumpToFront(this.recentMatchIds, matchId);
  }

  getRecentPlayers(): string[] {
    return [...this.recentPlayerNames];
  }

  getRecentMatchIds(): string[] {
    return [...this.recentMatchIds];
  }

  private bumpToFront(list: string[], value: string): string[] {
    if (!value) return list;
    const withoutValue = list.filter((existing) => existing !== value);
    withoutValue.unshift(value);
    return withoutValue.slice(0, MAX_RECENT);
  }
}
