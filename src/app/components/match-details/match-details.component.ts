import {
  AfterViewChecked,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { ScorecardComponent } from '../scorecard/scorecard.component';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LiveMatchService } from '../../services/live-match.service';
import { PlayerService } from '../../services/player.service';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import html2canvas from 'html2canvas';
import { MvpCalculatorService } from '../../services/mvp-calculator.service';
import { MvpHelpDialog } from '../dailogs/mvp-help.dialog';
import { MvpBreakdownDialog } from '../dailogs/mvp-breakdown.dialog';
import { PlayerMvpBreakdown } from '../../models/mvp.interface';
import { LoadMatchService } from '../../services/load-match.service';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-match-details',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatExpansionModule,
    ScorecardComponent,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
  ],
  templateUrl: './match-details.component.html',
  styleUrl: './match-details.component.css',
})
export class MatchDetailsComponent
  implements OnInit, OnDestroy, AfterViewChecked
{
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService,
    public liveMatchService: LiveMatchService,
    private route: ActivatedRoute,
    private playerService: PlayerService,
    private mvpCalculatorService: MvpCalculatorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private loadMatchService: LoadMatchService,
  ) {}
  private subscriptions: Subscription[] = [];
  public isMatchLoaded: boolean = false;
  public playerName: string = '';
  // Origin to restore on player-details when exiting back to it (e.g.
  // 'stats'). Whitelisted the same way player-details itself does - only
  // known values are honored, defaulting to allPlayers otherwise.
  public playerDetailsBackTarget: string = 'allPlayers';
  /** Offscreen shareable card rendered to a PNG via html2canvas - see shareMomCard(). */
  @ViewChild('shareCard') shareCardRef: ElementRef<HTMLDivElement> | undefined;
  /** True while the share card image is being generated - disables the Share button so a slow render/tap-happy user can't kick off multiple overlapping shares. */
  public isGeneratingShareCard: boolean = false;
  /**
   * Pre-rendered share card image, captured as soon as #shareCard first
   * becomes available (see ngAfterViewChecked/prerenderShareCard) rather
   * than on-demand inside shareMomCard(). This closes the async gap
   * between the user's tap and the navigator.share() call - html2canvas
   * can take a noticeable moment, and some Android WebView-based wrapper
   * apps (e.g. Median/GoNative hybrid shells used to publish this site as
   * an APK) only honor a Web Share API call made almost synchronously
   * within the click's user-activation window, silently rejecting it (or
   * not exposing navigator.share at all) once an await has intervened -
   * even though the same page works fine in a real mobile browser tab.
   */
  private cachedShareBlob: Blob | null = null;
  private hasAttemptedSharePrerender = false;

  ngOnInit(): void {
    this.route.url.subscribe((url) => {
      if (url[0].path === 'match-details') {
        this.route.queryParams.subscribe(async (qp) => {
          this.playerName = qp['playerName'];
          this.playerDetailsBackTarget =
            qp['from'] === 'stats' ? 'stats' : 'allPlayers';
          // Triggering the actual match load here (rather than leaving it
          // to ScorecardComponent, which used to be the only thing that
          // called this) decouples Match Info's data from the Score Card
          // tab's construction - see scorecard.component.ts's matching
          // comment. This is safe unguarded (no extra route-path check
          // needed) since MatchDetailsComponent is only ever instantiated
          // on the 'match-details' route itself.
          await this.loadMatchService.loadMatch(qp['id']);

          // Log match view
          logger
            .trackEvent('match_details_viewed', {
              matchId: qp['id'],
              playerName: this.playerName,
              fromPage: this.playerDetailsBackTarget,
            })
            .catch((err) => console.error('Failed to log match view:', err));
        });
      }
    });
    this.subscriptions.push(
      this.eventHandlerService.MatchLoadCompleteEvent$().subscribe(() => {
        // match loaded
        this.isMatchLoaded = true;
        // Log match loaded event
        logger
          .trackEvent('match_details_loaded', {
            timestamp: new Date().toISOString(),
          })
          .catch((err) => console.error('Failed to log match loaded:', err));
        // this.playerService.savePlayerData(
        //   'WItAdDq3YCJmKM1YlhaJ',
        //   this.matchService.matchResult as string
        // );
      }),
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }

  /**
   * Fires on every change-detection pass, but only actually does anything
   * once: the first time #shareCard exists in the DOM (it's behind
   * `*ngIf="mvpSummary?.manOfTheMatch"`, so it isn't there yet on the very
   * first check while the match is still loading). At that point we
   * pre-render its PNG in the background, well before the user ever taps
   * Share - see cachedShareBlob's doc comment for why this timing matters.
   */
  ngAfterViewChecked(): void {
    if (!this.hasAttemptedSharePrerender && this.shareCardRef) {
      this.hasAttemptedSharePrerender = true;
      // html2canvas synchronously rasterizes the whole #shareCard DOM
      // subtree, which can block the main thread for a real chunk of
      // time. #shareCard appears the instant match data loads - i.e. in
      // the SAME tick as the rest of match-details' content when that
      // data comes from cache (see LoadMatchService's recentMatchViewCache)
      // - so calling this synchronously here would block the browser from
      // ever painting the match details the user just navigated to,
      // making the route transition look stuck. Deferring one macrotask
      // lets the browser paint what's already rendered first, then run
      // this "nice to have ahead of time" work in the background.
      setTimeout(() => this.prerenderShareCard(), 0);
    }
  }

  private async prerenderShareCard(): Promise<void> {
    if (!this.shareCardRef) return;
    try {
      const canvas = await html2canvas(this.shareCardRef.nativeElement, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      this.cachedShareBlob = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png'),
      );
    } catch {
      // Non-fatal - shareMomCard() falls back to rendering it live on
      // demand if the pre-render didn't succeed for any reason.
      this.cachedShareBlob = null;
    }
  }

  /**
   * Opens the "how are MVP points calculated?" help dialog, using the
   * actual loaded weights so the explanation is always accurate even if an
   * admin has tuned the numbers in Firestore (MvpConfig collection). Passes
   * this match's totalOvers so milestone/haul thresholds are described as
   * concrete numbers for this specific match's format.
   */
  openMvpHelp(): void {
    this.mvpCalculatorService.loadWeights().then((weights) => {
      this.dialog.open(MvpHelpDialog, {
        data: {
          sections: this.mvpCalculatorService.describeRules(
            weights,
            this.matchService.totalOvers ?? undefined,
          ),
        },
      });
    });
  }

  /**
   * Opens the per-player MVP calculation breakdown dialog - only wired up
   * on the match-details top-5 list (not the match-complete banner, which
   * is just a quick celebratory summary), so users can drill into exactly
   * how a player's total was worked out (runs/wickets/catches points,
   * bonuses, penalties, etc.) instead of only seeing the final number.
   */
  openPlayerMvpBreakdown(player: PlayerMvpBreakdown): void {
    const momName = this.matchService.mvpSummary?.manOfTheMatch;
    const momPoints = this.matchService.mvpSummary?.topFive?.[0]?.totalPoints;
    this.dialog.open(MvpBreakdownDialog, {
      data: { player, momName, momPoints },
    });
  }

  /**
   * Returns the Median/GoNative JavaScript Bridge object if this page is
   * currently running inside a Median-built (or legacy GoNative) Android/iOS
   * WebView wrapper app, or undefined in a normal browser tab. The bridge is
   * injected onto `window.median` (or `window.gonative` for apps that
   * predate the Median.co rebrand) only at runtime inside their app shell -
   * see https://docs.median.co/docs/javascript-bridge.
   */
  private getWebViewBridge():
    | {
        share?: { sharePage?: (opts: { url?: string; text?: string }) => void };
      }
    | undefined {
    const win = window as any;
    return win.median ?? win.gonative;
  }

  /**
   * Renders the offscreen #shareCard template into a PNG (via html2canvas)
   * and shares/copies/downloads it, in this priority order:
   *   0. Median/GoNative JS Bridge (`median.share.sharePage()`) - used only
   *      when this page is running inside a Median-built Android/iOS
   *      wrapper app (see getWebViewBridge). These WebView shells often
   *      don't expose (or reliably honor) the standard `navigator.share()`
   *      Web Share API, but Median's own bridge opens the real native share
   *      sheet directly, bypassing that limitation entirely. It can only
   *      share a URL + text (not our generated PNG file - Median's
   *      file/image share commands require the file to already be hosted
   *      at a public URL, which our client-rendered canvas never is), so
   *      recipients get a link back to this match instead of the image.
   *   1. Web Share API with a file attachment (`navigator.share`) - the
   *      primary path on mobile browsers (Android Chrome, iOS Safari) and
   *      several desktop browsers (Chromium/Safari) - opens the OS's
   *      native share sheet, which lists WhatsApp (and any other
   *      image-capable app) automatically if installed. We don't and can't
   *      target WhatsApp directly from a webpage - the OS populates that
   *      list, not our code.
   *   2. Clipboard image copy (`navigator.clipboard.write`) - a desktop
   *      fallback (Chrome/Edge/Safari) for browsers without Web Share
   *      support (notably Firefox), so the user can paste the image
   *      straight into WhatsApp Web/Desktop or any chat app themselves.
   *   3. Plain image download - the universal last-resort fallback that
   *      works in every browser.
   */
  async shareMomCard(): Promise<void> {
    if (!this.shareCardRef || this.isGeneratingShareCard) return;

    const momName = this.matchService.mvpSummary?.manOfTheMatch || 'MVP';

    // Checked first and synchronously (no await before it) so it fires
    // within the click's user-activation window, and before any
    // html2canvas work - we don't need the rendered image for this path.
    const bridge = this.getWebViewBridge();
    if (bridge?.share?.sharePage) {
      bridge.share.sharePage({
        url: window.location.href,
        text: `\ud83c\udfc6 ${momName} - Man of the Match!`,
      });
      return;
    }

    this.isGeneratingShareCard = true;
    try {
      // Prefer the pre-rendered image (see cachedShareBlob) so
      // navigator.share() below fires as close to the tap as possible. Only
      // fall back to rendering it live here (the old behavior) if the
      // pre-render hasn't happened/succeeded yet - e.g. a very fast tap
      // right as the match finished loading.
      const blob: Blob | null =
        this.cachedShareBlob ??
        (await (async () => {
          const canvas = await html2canvas(this.shareCardRef!.nativeElement, {
            backgroundColor: '#ffffff',
            scale: 2,
            logging: false,
          });
          return new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/png'),
          );
        })());
      if (!blob) {
        this.snackBar.open('Could not generate the share image.', 'Dismiss', {
          duration: 4000,
        });
        return;
      }

      const fileName = `${momName}-man-of-the-match.png`.replace(/\s+/g, '-');
      const file = new File([blob], fileName, { type: 'image/png' });
      const shareData = {
        files: [file],
        title: 'Man of the Match',
        text: `\ud83c\udfc6 ${momName} - Man of the Match!`,
      };

      const nav = navigator as Navigator & {
        canShare?: (data?: any) => boolean;
        share?: (data?: any) => Promise<void>;
      };
      if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
        await nav.share(shareData);
        return;
      }

      const ClipboardItemCtor = (window as any).ClipboardItem;
      if (navigator.clipboard && ClipboardItemCtor) {
        try {
          await navigator.clipboard.write([
            new ClipboardItemCtor({ 'image/png': blob }),
          ]);
          this.snackBar.open(
            'Image copied - paste it into WhatsApp Web or any chat app.',
            'Dismiss',
            { duration: 5000 },
          );
          return;
        } catch {
          // Clipboard write can still fail (e.g. permissions) - fall through
          // to the universal download fallback below.
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
      this.snackBar.open('Image downloaded.', 'Dismiss', { duration: 4000 });
    } catch (err) {
      this.snackBar.open('Could not share the MVP card.', 'Dismiss', {
        duration: 4000,
      });
    } finally {
      this.isGeneratingShareCard = false;
    }
  }

  /** Plain-text match summary for shareMatchInfo(): teams, date/start time,
   * overs, result, Man of the Match (if any) - the page URL is deliberately
   * NOT appended here; the bridge/Web Share API attach it themselves via
   * their own `url` field (see shareMatchInfo()), so embedding it in this
   * text too would make it show up twice in the shared message. Only the
   * clipboard fallback (which has no separate url slot) appends it, via
   * the `includeUrl` flag. */
  private buildMatchShareText(includeUrl: boolean): string {
    const team1 = this.matchService.teamData['team1'];
    const team2 = this.matchService.teamData['team2'];
    const dateTime = this.matchService.inningsOneFirstBallTime
      ? `${this.formatMatchDate(this.matchService.matchDate)} \u00b7 Start Time: ${this.formatTime(this.matchService.inningsOneFirstBallTime)}`
      : this.formatMatchDate(this.matchService.matchDate);
    const momName = this.matchService.mvpSummary?.manOfTheMatch;

    const lines = [
      `\ud83c\udfcf ${team1?.name} vs ${team2?.name}`,
      `\ud83d\udcc5 ${dateTime}`,
      `Overs: ${this.matchService.totalOvers}`,
      '',
      `${this.matchService.matchResult}`,
    ];
    if (momName) {
      lines.push('', `\ud83c\udfc6 Man of the Match: ${momName}`);
    }
    if (includeUrl) {
      lines.push(
        '',
        '\ud83d\udcca View Complete Scorecard:',
        window.location.href,
      );
    }
    return lines.join('\n');
  }

  /**
   * Shares a plain-text match summary + link (see buildMatchShareText()),
   * using the same priority order as shareMomCard() above:
   *   0. Median/GoNative JS Bridge - used only inside the Median-built
   *      wrapper app, where navigator.share is often unavailable/unreliable.
   *   1. Web Share API (navigator.share) - the primary mobile-browser path.
   *   2. Clipboard copy - universal fallback for desktop browsers without
   *      Web Share support.
   */
  async shareMatchInfo(): Promise<void> {
    const text = this.buildMatchShareText(false);
    const url = window.location.href;

    const bridge = this.getWebViewBridge();
    if (bridge?.share?.sharePage) {
      bridge.share.sharePage({ text, url });
      return;
    }

    const nav = navigator as Navigator & {
      share?: (data?: any) => Promise<void>;
    };
    if (nav.share) {
      try {
        await nav.share({ title: 'Match Summary', text, url });
        return;
      } catch {
        // User cancelled, or share isn't actually usable here - fall
        // through to the clipboard copy below.
      }
    }

    try {
      // Clipboard has no separate url field, so the link needs to be part
      // of the copied text here (unlike the bridge/Web Share paths above).
      await navigator.clipboard.writeText(this.buildMatchShareText(true));
      this.snackBar.open('Match summary copied to clipboard.', 'Dismiss', {
        duration: 4000,
      });
    } catch {
      this.snackBar.open('Could not share match info.', 'Dismiss', {
        duration: 4000,
      });
    }
  }

  /**
   * True if `teamKey` ('team1'/'team2') is the winning team, so the
   * template can show a small non-color checkmark cue next to their name
   * (see match-list's identical UX pattern - the green result badge is
   * already the single color-coded "who won" signal, so this deliberately
   * doesn't recolor the team name/score too). Compares runsScored
   * directly rather than string-parsing matchService.matchResult - more
   * robust since match-details has direct numeric team data available
   * (unlike match-list, which only has the loaded DTO's data map) - and
   * correctly returns false for both teams on a tie.
   */
  isWinningTeam(teamKey: 'team1' | 'team2'): boolean {
    const other: 'team1' | 'team2' = teamKey === 'team1' ? 'team2' : 'team1';
    const teamData = this.matchService.teamData;
    if (!teamData?.[teamKey] || !teamData?.[other]) return false;
    return teamData[teamKey].runsScored > teamData[other].runsScored;
  }

  /**
   * matchService.matchDate is persisted as a plain locale date STRING
   * (date.toLocaleDateString(), e.g. "8/1/2026" - see SaveMatchService),
   * not a Date object, so it can't be formatted with toLocaleDateString's
   * options directly. Re-parsing it here is purely a display concern -
   * the stored field itself is untouched - and gives a more human-
   * readable "Aug 1, 2026" instead of the terser "8/1/2026".
   */
  formatMatchDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) return dateStr;
    return parsed.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  /** Drops the seconds Date.toLocaleTimeString() shows by default (e.g.
   * "3:42:44 AM" -> "3:42 AM"), which is unnecessary precision for a
   * human reading when a ball was bowled. */
  formatTime(date: Date | null | undefined): string {
    if (!date) return 'N/A';
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  exit() {
    if (this.playerName && this.playerName.length > 0) {
      this.liveMatchService.exitMatch(
        'player-details?name=' +
          this.playerName +
          '&from=' +
          this.playerDetailsBackTarget,
      );
    } else this.liveMatchService.exitMatch('allMatches');
  }
}
