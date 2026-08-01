import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
export class MatchDetailsComponent implements OnInit, OnDestroy {
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService,
    public liveMatchService: LiveMatchService,
    private route: ActivatedRoute,
    private playerService: PlayerService,
    private mvpCalculatorService: MvpCalculatorService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
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

  ngOnInit(): void {
    this.route.url.subscribe((url) => {
      if (url[0].path === 'match-details') {
        this.route.queryParams.subscribe(async (qp) => {
          this.playerName = qp['playerName'];
          this.playerDetailsBackTarget =
            qp['from'] === 'stats' ? 'stats' : 'allPlayers';
        });
      }
    });
    this.subscriptions.push(
      this.eventHandlerService.MatchLoadCompleteEvent$().subscribe(() => {
        // match loaded
        this.isMatchLoaded = true;
        // this.playerService.savePlayerData(
        //   'WItAdDq3YCJmKM1YlhaJ',
        //   this.matchService.matchResult as string
        // );
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
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
            this.matchService.totalOvers ?? undefined
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
   * Renders the offscreen #shareCard template into a PNG (via html2canvas)
   * and shares/copies/downloads it, in this priority order:
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
    this.isGeneratingShareCard = true;
    try {
      const canvas = await html2canvas(this.shareCardRef.nativeElement, {
        backgroundColor: '#ffffff',
        scale: 2,
      });
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) {
        this.snackBar.open('Could not generate the share image.', 'Dismiss', {
          duration: 4000,
        });
        return;
      }

      const momName = this.matchService.mvpSummary?.manOfTheMatch || 'MVP';
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
            { duration: 5000 }
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

  toggleTab(event: any): void {
    this.handleOnToggleEvent(event.index);
  }

  exit() {
    if (this.playerName && this.playerName.length > 0) {
      this.liveMatchService.exitMatch(
        'player-details?name=' +
          this.playerName +
          '&from=' +
          this.playerDetailsBackTarget
      );
    } else this.liveMatchService.exitMatch('allMatches');
  }

  handleOnToggleEvent(index: number): void {
    if (index === 1) {
      setTimeout(() => {
        let ele = document.getElementById('mat-tab-content-scorecard');
        if (ele) {
          ele.style.display = 'initial';
        }
        let ele2 = document.getElementById('scorecardSpinner');
        if (ele2) {
          ele2.style.display = 'none';
        }
      }, 500);
    } else {
      let ele = document.getElementById('mat-tab-content-scorecard');
      if (ele) {
        ele.style.display = 'none';
      }
      let ele2 = document.getElementById('scorecardSpinner');
      if (ele2) {
        ele2.style.display = 'block';
      }
    }
  }
}
