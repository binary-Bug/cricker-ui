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

  isWideChecked: boolean = false;
  isNBChecked: boolean = false;
  isLBChecked: boolean = false;
  isByesChecked: boolean = false;
  isWicketChecked: boolean = false;
  wicketDialogRef!: MatDialogRef<WicketDialog>;

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
            this.dialog.open(EndInningsDialog, { data: { value: 'allOut' } });
          } else this.checkForOverCompletion();
        } else {
          this.unCheckExtras();
        }
      });
    } else {
      this.checkForExtras_And_AddRun(run, color, false, null, null, null);
      this.checkForOverCompletion();
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
        this.dialog.open(EndInningsDialog, {
          data: { value: 'oversCompleted' },
        });
      } else {
        this.liveMatchService.swapStriker();
        let newBowlerDialog = this.dialog.open(NewBowlerDialog);
        newBowlerDialog.afterClosed().subscribe((data) => {
          this.liveMatchService.updateOnFieldBowler(data);
        });
      }
    }
  }

  changeBowler(): void {
    let newBowlerDialog = this.dialog.open(NewBowlerDialog);
    newBowlerDialog.afterClosed().subscribe((data) => {
      this.liveMatchService.updateOnFieldBowler(data);
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

    if (this.isWideChecked || this.isNBChecked) {
      run = +run + 1 + '';
      isExtra = true;
      this.eventHandler.NotifyUpdateOverViewGridEvent(true);
      this.liveMatchService.totalBallsinCurrentOver += 1;
      this.eventHandler.NotifyUpdateOverViewGridEvent(false);
      this.liveMatchService.addNewBalltoOversPlayedData();
    }

    this.updateBallDataCSS(run, color);

    this.liveMatchService.updateBallDataRuns(run, isExtra, isWicketBall);
    this.liveMatchService.updateBowlerData(
      +run,
      this.isWideChecked,
      this.isNBChecked,
      this.isByesChecked,
      isWicketBall,
      wicketType
    );

    if (!this.isWideChecked)
      this.liveMatchService.addRunToStriker(
        +run,
        this.isNBChecked,
        this.isByesChecked,
        this.isLBChecked
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

    if (!this.isWideChecked && !this.isNBChecked)
      this.liveMatchService.updateOversPlayed();

    this.matchService.calculateCurrentRunRate();
    this.eventHandler.NotifyRunAddedEvent();
    this.unCheckExtras();
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
      }
    });
  }

  endInnings(): void {
    this.dialog.open(EndInningsDialog);
  }

  penaltyRuns(): void {
    let dialogRef = this.dialog.open(PenaltyRunsDialog);
    dialogRef.afterClosed().subscribe((data) => {
      if (data) {
        this.isByesChecked = true;
        this.addRun(data as string, 'run');
        this.isByesChecked = false;
      }
      console.log(data);
    });
  }
}
