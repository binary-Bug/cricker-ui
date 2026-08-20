import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SpinnerOverlayComponent } from './components/spinner-overlay/spinner-overlay.component';
import { trigger, transition, query, style, animate } from '@angular/animations';

/**
 * Subtle rise-up entrance for whatever page the router just activated.
 * Fires on route PATH changes (e.g. allMatches -> match-details) - see
 * prepareRoute() below for the bound state value. Intentionally only
 * animates :enter (no :leave/absolute-position crossfade) to keep this a
 * low-risk, self-contained addition - the outgoing page just disappears
 * instantly like before, only the incoming one now animates in, which is
 * what was actually missing (routing felt like an abrupt "jump cut").
 *
 * Deliberately does NOT animate opacity. Every opacity-based version
 * tried here (fade from 0, fade from 0.5) necessarily has a real window
 * where the new page is invisible/translucent - with cached data now
 * rendering instantly, that window IS the "blank white page then it
 * renders" delay users kept reporting, no matter how short the duration.
 * Keeping content fully opaque the whole time removes that window
 * entirely while the translateY slide still gives a "seamless" motion
 * cue instead of an abrupt jump-cut.
 */
export const routeFadeAnimation = trigger('routeAnimations', [
  transition('* => *', [
    query(':enter', [style({ transform: 'translateY(10px)' })], {
      optional: true,
    }),
    query(
      ':enter',
      [animate('180ms ease-out', style({ transform: 'translateY(0)' }))],
      { optional: true }
    ),
  ]),
]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SpinnerOverlayComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  animations: [routeFadeAnimation],
})
export class AppComponent {
  // Bound to [@routeAnimations] on the wrapper around <router-outlet> -
  // returns the active route's path as the animation "state", so the
  // trigger's '* => *' transition fires whenever that path actually
  // changes (not on every navigation - e.g. re-querying match-details
  // with a different match id keeps the same path and correctly stays
  // silent, matching the spinner's cache-hit-is-instant behavior).
  prepareRoute(outlet: RouterOutlet): string | undefined {
    return outlet?.isActivated
      ? outlet.activatedRoute?.routeConfig?.path
      : undefined;
  }
}
