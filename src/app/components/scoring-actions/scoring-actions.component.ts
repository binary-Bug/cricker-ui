import { Component, ElementRef, HostListener, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { WicketDialog } from '../dailogs/wicket.dialog';
import { NewBowlerDialog } from '../dailogs/new-bowler.dialog';
import { RetireBatsmenDialog } from '../dailogs/retire-batsmen.dialog';
import { EndInningsDialog } from '../dailogs/end-innings.dialog';
import { PenaltyRunsDialog } from '../dailogs/penalty-runs.dialog';
import { MatchCompleteDialog } from '../dailogs/match-complete.dialog';
import { SaveMatchService } from '../../services/save-match.service';
import { ConfirmDialog } from '../dailogs/confirm.dialog';
import { ScoringHelpDialog } from '../dailogs/scoring-help.dialog';

@Component({
  selector: 'app-scoring-actions',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    MatSnackBarModule,
  ],
  templateUrl: './scoring-actions.component.html',
  styleUrl: './scoring-actions.component.css',
})
export class ScoringActionsComponent {
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  matchService: MatchService = inject(MatchService);
  dialog: MatDialog = inject(MatDialog);
  saveMatchService: SaveMatchService = inject(SaveMatchService);
  snackBar: MatSnackBar = inject(MatSnackBar);

  isWideChecked: boolean = false;
  isNBChecked: boolean = false;
  isLBChecked: boolean = false;
  isByesChecked: boolean = false;
  isPenaltyRun: boolean = false;
  isWicketChecked: boolean = false;
  wicketDialogRef!: MatDialogRef<WicketDialog>;

  // Whether the current penalty-run delivery should count as a ball bowled.
  // Defaults to true so the existing "penalty runs always count" behavior is
  // preserved unless the scorer explicitly unchecks it in PenaltyRunsDialog.
  isPenaltyBallCounted: boolean = true;

  // --- Spotlight tour: a persistent (never timer-dismissed) cue shown the
  // instant an extra/wicket toggle is switched on, dimming everything
  // except the extras row + run-button grid - both stay reachable so
  // mutual-exclusive combos (e.g. Wicket + Wide for a run-out taken while
  // running on a wide) can still be selected - until the scorer completes
  // the ball or taps Cancel. Replaces the old auto-dismissing coach-mark,
  // which could disappear before a first-time scorer had read it.
  @ViewChild('extrasRow', { static: true }) extrasRowRef!: ElementRef<HTMLDivElement>;
  @ViewChild('runGrid', { static: true }) runGridRef!: ElementRef<HTMLDivElement>;
  spotlightRect: { top: number; left: number; right: number; bottom: number } = {
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  };

  get tourActive(): boolean {
    return (
      this.isWideChecked ||
      this.isNBChecked ||
      this.isLBChecked ||
      this.isByesChecked ||
      this.isWicketChecked
    );
  }

  get tourMessage(): string {
    return this.isWicketChecked
      ? 'Wicket selected \u2014 tap the runs completed before the dismissal'
      : 'Now tap the runs scored on this ball';
  }

  get calloutBottom(): number {
    return Math.max(8, window.innerHeight - this.spotlightRect.top + 8);
  }

  get calloutLeft(): number {
    return Math.min(
      Math.max(8, this.spotlightRect.left),
      window.innerWidth - 268
    );
  }

  private updateSpotlightRect(): void {
    const extrasRect = this.extrasRowRef.nativeElement.getBoundingClientRect();
    const gridRect = this.runGridRef.nativeElement.getBoundingClientRect();
    this.spotlightRect = {
      top: Math.min(extrasRect.top, gridRect.top),
      left: Math.min(extrasRect.left, gridRect.left),
      right: Math.max(extrasRect.right, gridRect.right),
      bottom: Math.max(extrasRect.bottom, gridRect.bottom),
    };
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (this.tourActive) this.updateSpotlightRect();
  }

  /** Backs out of the tour without recording a ball - resets all toggles. */
  cancelTour(): void {
    this.unCheckExtras();
  }

  toggleWide(): void {
    this.isWideChecked = !this.isWideChecked;
    if (this.tourActive) this.updateSpotlightRect();
  }
  toggleNB(): void {
    this.isNBChecked = !this.isNBChecked;
    if (this.tourActive) this.updateSpotlightRect();
  }
  toggleLB(): void {
    this.isLBChecked = !this.isLBChecked;
    if (this.tourActive) this.updateSpotlightRect();
  }
  toggleByes(): void {
    this.isByesChecked = !this.isByesChecked;
    if (this.tourActive) this.updateSpotlightRect();
  }
  toggleWicket(): void {
    this.isWicketChecked = !this.isWicketChecked;
    if (this.tourActive) this.updateSpotlightRect();
  }

  openScoringHelp(): void {
    this.dialog.open(ScoringHelpDialog, { panelClass: 'app-dialog-panel' });
  }

  /**
   * Preview of the ball Undo would revert - drives the small badge on the
   * Undo button plus its tooltip. Reads the current over's previous ball,
   * or the previous over's last ball if we're at the start of an over.
   */
  get lastBallSummary(): { label: string; batsman: string } | null {
    const team =
      this.matchService.teamData[this.matchService.currentRoles['bat']];
    let overIdx = this.liveMatchService.currentOverNumber;
    let ballIdx = this.liveMatchService.currentBowlNumber - 1;
    if (ballIdx < 0) {
      overIdx -= 1;
      if (overIdx < 0 || !team.oversPlayedData[overIdx]) return null;
      ballIdx = team.oversPlayedData[overIdx].length - 1;
    }
    const ball = team.oversPlayedData[overIdx]?.[ballIdx];
    if (!ball || !ball.hasBeenBowled) return null;
    return { label: ball.label, batsman: ball.striker?.name || '' };
  }

  private toastLastBall(): void {
    const summary = this.lastBallSummary;
    if (!summary) return;
    this.snackBar.open(summary.label, undefined, { duration: 1300 });
  }

  // True whenever the current delivery should NOT consume a legal ball / advance
  // the over - either because it's a wide/no-ball (existing behavior), or because
  // it's a penalty run the scorer marked as "don't count this ball" (treated the
  // same way structurally: a new ball slot is pushed instead of advancing).
  get isBallUncounted(): boolean {
    return (
      this.isWideChecked ||
      this.isNBChecked ||
      (this.isPenaltyRun && !this.isPenaltyBallCounted)
    );
  }

  addRun(run: string, color: string): void {
    this.liveMatchService.updateOverData();

    if (this.isWicketChecked) {
      this.wicketDialogRef = this.dialog.open(WicketDialog, {
        data: {
          isExtraChecked:
            this.isWideChecked || this.isNBChecked || this.isLBChecked,
          isByeChecked: this.isByesChecked || +run > 0,
        },
        panelClass: 'on-field-player-dialog-panel',
      });

      this.wicketDialogRef.afterClosed().subscribe((data) => {
        if (data) {
          this.checkForExtras_And_AddRun(
            run,
            color,
            true,
            data.wicketType,
            data.selectedBatsmen,
            data.newBatsmen
          );
          this.liveMatchService.resetCurrentPatnership();
          this.matchService.updateBatsmenStatus(
            data.selectedBatsmen,
            this.liveMatchService.currentBowler.name,
            data.wicketType,
            data.actionPlayer
          );
          this.liveMatchService.updateBatsmenEnd(
            data.newBatsmen,
            data.selectedEnd
          );
          // Re-snapshot the wicket ball itself so its persisted striker/
          // nonStriker reflect the corrected end assignment above, not the
          // (possibly wrong) one baked in by checkForExtras_And_AddRun().
          // useLastBowledBall=true: checkForExtras_And_AddRun() already
          // advanced currentBowlNumber past this ball (even to an
          // out-of-range 6 when the dismissal fell on the over's last
          // ball), so target previousBowlNumber instead.
          this.liveMatchService.updatePlayerData(true);
          this.toastLastBall();
          if (
            this.matchService.teamData[this.matchService.currentRoles['bat']]
              .wicketsLost ===
            this.matchService.totalPlayers! - 1
          ) {
            if (!this.matchService.isSecondInning) {
              let endInningsDialog = this.dialog.open(EndInningsDialog, {
                panelClass: 'app-dialog-panel',
                data: { value: 'allOut' },
              });
              endInningsDialog.afterClosed().subscribe((data) => {
                this.liveMatchService.handleEndInningsDialog(data);
              });
            } else {
              //open match complete dialog
              this.dialog.open(MatchCompleteDialog);
              //this.saveMatchService.saveMatchData();
            }
          } else {
            if (!this.isBallUncounted) this.checkForOverCompletion();
          }
          this.unCheckExtras();
        } else {
          this.unCheckExtras();
        }
      });
    } else {
      this.checkForExtras_And_AddRun(run, color, false, null, null, null);
      this.toastLastBall();
      if (!this.isBallUncounted) this.checkForOverCompletion();
      else if (this.matchService.isSecondInning) {
        if (this.matchService.checkIfTargetChased()) {
          this.dialog.open(MatchCompleteDialog);
        }
      }
      this.unCheckExtras();
    }
  }

  checkForOverCompletion(): void {
    if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .oversPlayed -
        Math.trunc(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ) ===
      0
    ) {
      if (
        Math.trunc(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ) === this.matchService.totalOvers
      ) {
        if (!this.matchService.isSecondInning) {
          let endInningsDialog = this.dialog.open(EndInningsDialog, {
            panelClass: 'app-dialog-panel',
            data: { value: 'oversCompleted' },
          });

          endInningsDialog.afterClosed().subscribe((data) => {
            this.liveMatchService.handleEndInningsDialog(data);
          });
        } else {
          this.dialog.open(MatchCompleteDialog);
          //this.saveMatchService.saveMatchData();
          // match complete dialog
        }
      } else {
        this.liveMatchService.swapStriker();
        // check for target chased
        if (this.matchService.checkIfTargetChased()) {
          this.dialog.open(MatchCompleteDialog);
          //this.saveMatchService.saveMatchData();
        } else {
          this.eventHandler.NotifyOverCompleteEvent();
          let newBowlerDialog = this.dialog.open(NewBowlerDialog, {
            data: { isAuto: true },
            panelClass: 'app-dialog-panel',
          });
          newBowlerDialog.afterClosed().subscribe((data: string) => {
            if (data && data.length > 0)
              this.liveMatchService.updateOnFieldBowler(data);
          });
        }
      }
    } else {
      // check for target chased
      if (this.matchService.checkIfTargetChased()) {
        this.dialog.open(MatchCompleteDialog);
        //this.saveMatchService.saveMatchData();
      }
    }
  }

  changeBowler(): void {
    let newBowlerDialog = this.dialog.open(NewBowlerDialog, {
      data: { isAuto: false },
      panelClass: 'app-dialog-panel',
    });
    newBowlerDialog.afterClosed().subscribe((data: string) => {
      if (data && data.length > 0)
        this.liveMatchService.updateOnFieldBowler(data);
      this.liveMatchService.updateBolwerDataInOversPlayed();
    });
  }

  updateBallDataCSS(run: string, color: string): void {
    if (this.isWideChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + 'wd', 'extra');
      this.liveMatchService.addExtra('w', +run);
      this.liveMatchService.updateCurrentPatnership(+run, false);
    } else if (this.isLBChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + ' LB', 'run');
      this.liveMatchService.addExtra('lb', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isPenaltyRun && !this.isPenaltyBallCounted) {
      // Uncounted penalty run - distinct "PR" label so it's visually
      // distinguishable from a counted penalty/bye ("B") on the over view.
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + ' PR', 'run');
      this.liveMatchService.addExtra('b', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isByesChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + ' B', 'run');
      this.liveMatchService.addExtra('b', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isNBChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + 'nb', 'extra');
      this.liveMatchService.addExtra('nb', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run, color);
      this.liveMatchService.updateCurrentPatnership(+run);
    }

    let runLabel: string = run;
    if (+run === 0) runLabel = '';
    if (this.isWicketChecked)
      this.liveMatchService.updateBallDataCSS(runLabel + 'W', 'wicket');
  }

  checkForExtras_And_AddRun(
    run: string,
    color: string,
    isWicketBall: boolean,
    wicketType: string | null,
    selectedBatsmen: string | null,
    newBatsmen: string | null
  ): void {
    let isExtra: boolean = false;

    // The mandatory "+1 run" is exclusive to wide/no-ball. Pushing a new ball
    // slot (instead of advancing the current one) applies to wide, no-ball, AND
    // an uncounted penalty run - all three don't consume a legal delivery.
    if (this.isWideChecked || this.isNBChecked) {
      run = +run + 1 + '';
      isExtra = true;
    } else if (this.isBallUncounted) {
      isExtra = true;
    }
    if (this.isBallUncounted) {
      this.liveMatchService.totalBallsinCurrentOver += 1;
      this.liveMatchService.addNewBalltoOversPlayedData();
    }

    this.updateBallDataCSS(run, color);

    this.liveMatchService.updateBallDataRuns(run, isExtra, isWicketBall);
    this.liveMatchService.updateBowlerData(
      +run,
      this.isWideChecked,
      this.isNBChecked,
      this.isByesChecked,
      this.isPenaltyRun,
      isWicketBall,
      wicketType,
      this.isBallUncounted
    );

    if (!this.isWideChecked)
      this.liveMatchService.addRunToStriker(
        +run,
        this.isNBChecked,
        this.isByesChecked,
        this.isLBChecked,
        this.isPenaltyRun,
        !this.isBallUncounted
      );
    else {
      if ((+run - 1) % 2 !== 0) this.liveMatchService.swapStriker();
      this.liveMatchService.updatePlayerData();
    }

    if (isWicketBall) {
      this.liveMatchService.updateOnFieldBatsmen(
        selectedBatsmen + '',
        newBatsmen + ''
      );
      this.eventHandler.NotifyUpdateOnFieldBatsmenEvent();
      this.liveMatchService.updatePlayerData();
    }

    this.liveMatchService.updateBallNumber();

    if (!this.isBallUncounted) this.liveMatchService.updateOversPlayed();

    this.matchService.calculateCurrentRunRate();
    if (this.matchService.isSecondInning)
      this.matchService.calculateSecondInningsTeamValues();
    this.eventHandler.NotifyRunAddedEvent();
  }

  unCheckExtras(): void {
    this.isWideChecked = false;
    this.isNBChecked = false;
    this.isLBChecked = false;
    this.isByesChecked = false;
    this.isWicketChecked = false;
  }

  retireBatsmen(): void {
    let dialogRef = this.dialog.open(RetireBatsmenDialog, {
      panelClass: 'app-dialog-panel',
    });
    dialogRef.afterClosed().subscribe((data) => {
      if (data) {
        this.liveMatchService.updateOnFieldBatsmen(data.old, data.new);
        this.eventHandler.NotifyRunAddedEvent();
        this.matchService.updateBatsmenStatus(data.old, '', 'Retire', '');
        this.liveMatchService.updateBatsmenData();
      }
    });
  }

  endInnings(): void {
    let endInningsDialog = this.dialog.open(EndInningsDialog, {
      panelClass: 'app-dialog-panel',
    });

    endInningsDialog.afterClosed().subscribe((data) => {
      this.liveMatchService.handleEndInningsDialog(data);
    });
  }

  penaltyRuns(): void {
    let dialogRef = this.dialog.open(PenaltyRunsDialog, {
      panelClass: 'app-dialog-panel',
    });
    dialogRef.afterClosed().subscribe((data) => {
      if (data) {
        this.isPenaltyRun = true;
        this.isByesChecked = true;
        this.isPenaltyBallCounted = data.countBall;
        this.addRun(data.runs as string, 'run');
        this.isPenaltyRun = false;
        this.isByesChecked = false;
        this.isPenaltyBallCounted = true;
      }
    });
  }

  exitMatch(): void {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'app-dialog-panel',
      data: {
        title: 'Exit Match',
        message:
          'Are you sure you want to exit the match? All unsaved progress will be lost.',
        icon: 'logout',
        variant: 'warn',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.liveMatchService.exitMatch();
      }
    });
  }
}
