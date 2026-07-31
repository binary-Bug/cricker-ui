import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

/**
 * Single source of truth for whether the app is currently working against
 * "prod" (real matches - MatchData/PlayerData collections) or "test" data
 * (Test_MatchData/Test_PlayerData collections).
 *
 * WHY THIS SERVICE EXISTS:
 * Previously this value lived as `MatchService.matchMode`, a mutable field
 * that defaulted to `null` and was only ever explicitly set by RoomComponent
 * (the home page) or NewMatchDetailsComponent. That worked fine for normal
 * in-app navigation (Room always runs first, setting the mode before the
 * user goes anywhere else), but it broke for:
 *   - a direct/shared link straight into a route like `/match-details?id=...`
 *   - a browser refresh while already on such a route
 * In both cases the app cold-boots directly into that route, RoomComponent's
 * constructor never runs, and `matchMode` stayed `null`. `LoadMatchService`
 * treated anything other than `'prod'` as `'test'`, so it queried the WRONG
 * Firestore collection, failed to find the match, and ended up wiping
 * `MatchService.teamData` to `undefined` - crashing the Match Info tab with
 * a null-reference error.
 *
 * By initializing `_mode` directly from the build-time `environment.isProdEnv`
 * flag at construction (rather than defaulting to `null` and waiting for some
 * component to set it), this service is correct immediately no matter which
 * route the app boots into - fixing the cold-boot/direct-link/refresh bug at
 * its root, with zero dependency on navigation order.
 *
 * `setMode()` remains freely callable: Room's "View All Test Matches/Players/
 * Stats" buttons and NewMatchDetailsComponent's mode picker (when creating a
 * new match) are legitimate explicit user overrides of the environment-based
 * default, and continue to work exactly as before.
 */
@Injectable({
  providedIn: 'root',
})
export class ModeService {
  private _mode: 'prod' | 'test' = environment.isProdEnv ? 'prod' : 'test';

  get mode(): 'prod' | 'test' {
    return this._mode;
  }

  setMode(mode: 'prod' | 'test'): void {
    this._mode = mode;
  }
}
