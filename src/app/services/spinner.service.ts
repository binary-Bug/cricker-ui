import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

/**
 * Global, reference-counted loading indicator. Multiple overlapping/chained
 * calls (e.g. a component that kicks off 2 awaited reads back to back, or
 * two components both awaiting the same in-flight request) each call
 * show()/hide() independently - the overlay only hides once every
 * outstanding show() has been matched by a hide(), so it can't be dismissed
 * early by whichever call happens to finish first.
 *
 * Deliberately NOT wired into every Firestore call in the app - only call
 * sites that gate a view's populated state (initial roster/list/detail
 * reads) should use this. Background writes (analytics-style "log this
 * visit" calls, post-match player-stat rewrites, live-scoring actions -
 * which don't hit Firestore at all today) must not show this loader, since
 * blocking the whole screen for those would be more disruptive than
 * helpful. See the "Global loading spinner" plan for the full call-site
 * list this was scoped against.
 */
@Injectable({
  providedIn: 'root',
})
export class SpinnerService {
  private count = 0;
  private readonly _isLoading$ = new BehaviorSubject<boolean>(false);
  readonly isLoading$ = this._isLoading$.asObservable();

  show(): void {
    this.count++;
    if (this.count === 1) {
      this._isLoading$.next(true);
    }
  }

  hide(): void {
    if (this.count === 0) return;
    this.count--;
    if (this.count === 0) {
      this._isLoading$.next(false);
    }
  }

  /**
   * Immediately hides the overlay regardless of how many outstanding
   * show() calls haven't been matched by a hide() yet - used by the
   * overlay's Cancel button so a user isn't stuck waiting on a slow/stuck
   * API call. The underlying awaited promise(s) aren't actually aborted
   * (the Firestore SDK calls this app uses don't support that) - they'll
   * still resolve in the background and call their own hide() as normal,
   * which is a harmless no-op once count is already 0. This is purely an
   * escape hatch for the UI, not a real request cancellation.
   */
  forceHide(): void {
    this.count = 0;
    this._isLoading$.next(false);
  }

  /**
   * Wraps a single awaited call with show()/hide(), including on error, so
   * call sites don't need their own try/finally boilerplate. Usage:
   * `const data = await this.spinnerService.wrap(someService.getThing());`
   */
  async wrap<T>(promise: Promise<T>): Promise<T> {
    this.show();
    try {
      return await promise;
    } finally {
      this.hide();
    }
  }
}
