import { Component, inject } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
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

@Component({
  selector: 'app-scoring-actions',
  standalone: true,
  imports: [FormsModule, MatGridListModule, MatButtonModule, MatCheckboxModule],
  templateUrl: './scoring-actions.component.html',
  styleUrl: './scoring-actions.component.css',
})
export class ScoringActionsComponent {
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  matchService: MatchService = inject(MatchService);
  dialog: MatDialog = inject(MatDialog);
  saveMatchService: SaveMatchService = inject(SaveMatchService);

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
        maxWidth: '100vw',
        width: '100vw',
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
          if (
            this.matchService.teamData[this.matchService.currentRoles['bat']]
              .wicketsLost ===
            this.matchService.totalPlayers! - 1
          ) {
            if (!this.matchService.isSecondInning) {
              let endInningsDialog = this.dialog.open(EndInningsDialog, {
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
    let dialogRef = this.dialog.open(RetireBatsmenDialog);
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
    let endInningsDialog = this.dialog.open(EndInningsDialog);

    endInningsDialog.afterClosed().subscribe((data) => {
      this.liveMatchService.handleEndInningsDialog(data);
    });
  }

  penaltyRuns(): void {
    let dialogRef = this.dialog.open(PenaltyRunsDialog);
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
      width: '300px',
      data: {
        title: 'Exit Match',
        message:
          'Are you sure you want to exit the match? All unsaved progress will be lost.',
      },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.liveMatchService.exitMatch();
      }
    });
  }
}
