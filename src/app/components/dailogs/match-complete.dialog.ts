import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatchService } from '../../services/match.service';
import { LiveMatchService } from '../../services/live-match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Router } from '@angular/router';
import { SaveMatchService } from '../../services/save-match.service';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';
import { LoadMatchService } from '../../services/load-match.service';

@Component({
  selector: 'match-complete-dialog',
  template: ` <h2 mat-dialog-title>Match Complete</h2>
    <mat-dialog-content>
      <p>{{ matchResult }}</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        [disabled]="IsMatchSaveComplete ? null : 'true'"
        mat-button
        color="primary"
        (click)="viewScorecard()"
      >
        View Scorecard
      </button>
      <button mat-button color="warn" (click)="exit()" cdkFocusInitial>
        Exit
      </button>
    </mat-dialog-actions>`,
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
  ],
})
export class MatchCompleteDialog implements OnInit, OnDestroy {
  constructor(
    public dialogRef: MatDialogRef<MatchCompleteDialog>,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService,
    private eventHandlerService: EventHandlerService,
    private router: Router,
    private saveMatchService: SaveMatchService,
    private playerService: PlayerService,
    private loadMatchService: LoadMatchService
  ) {
    dialogRef.disableClose;
  }

  matchResult: string = '';
  IsMatchSaveComplete: boolean = false;
  matchRefId: string = '';
  subscriptions: Subscription[] = [];

  ngOnInit(): void {
    this.saveMatchService.saveMatchData(this.checkMatchResult());

    let ele = document.getElementById('confetti');
    if (ele) {
      ele.style.zIndex = '1001';
      ele.style.display = 'block';
    }
    setTimeout(() => {
      let ele = document.getElementById('confetti');
      if (ele) {
        ele.style.zIndex = '-1';
        ele.style.display = 'none';
      }
    }, 2000);

    this.matchResult = this.checkMatchResult();

    this.subscriptions.push(
      this.eventHandlerService
        .MatchSaveCompleteEvent$()
        .subscribe(async (matchId) => {
          await this.playerService.savePlayerData(matchId, this.matchResult);
          this.matchRefId = matchId;
          this.IsMatchSaveComplete = true;
        })
    );
  }

  checkMatchResult(): string {
    if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .runsScored >
      this.matchService.teamData[this.matchService.currentRoles['ball']]
        .runsScored
    ) {
      return (
        this.matchService.teamData[this.matchService.currentRoles['bat']].name +
        ' wins by ' +
        (this.matchService.totalPlayers! -
          1 -
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .wicketsLost) +
        ' wicket(s)'
      );
    } else if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .runsScored <
      this.matchService.teamData[this.matchService.currentRoles['ball']]
        .runsScored
    ) {
      return (
        this.matchService.teamData[this.matchService.currentRoles['ball']]
          .name +
        ' wins by ' +
        (this.matchService.teamData[this.matchService.currentRoles['bat']]
          .requiredRuns! -
          1) +
        ' runs'
      );
    } else {
      return 'Match Tied';
    }
  }

  exit(): void {
    this.playerService.players = [];
    this.loadMatchService.matches = [];
    this.liveMatchService.exitMatch();
    this.dialogRef.close();
  }
  async viewScorecard(): Promise<void> {
    this.playerService.players = [];
    await this.loadMatchService.getAllMatches().then((matches) => {
      this.loadMatchService.matches = matches;
    });
    this.liveMatchService.exitMatch('');
    this.router.navigateByUrl('match-details?id=' + this.matchRefId);
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
