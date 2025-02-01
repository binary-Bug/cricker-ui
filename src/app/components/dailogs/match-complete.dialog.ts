import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Component, OnInit } from '@angular/core';
import { MatchService } from '../../services/match.service';
import { LiveMatchService } from '../../services/live-match.service';

@Component({
  selector: 'match-complete-dialog',
  template: ` <h2 mat-dialog-title>Match Complete</h2>
    <mat-dialog-content>
      <p>{{ matchResult }}</p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button color="primary" (click)="viewScorecard()">
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
export class MatchCompleteDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<MatchCompleteDialog>,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService
  ) {
    dialogRef.disableClose;
  }

  matchResult: string = '';

  ngOnInit(): void {
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
    this.liveMatchService.exitMatch();
    this.dialogRef.close();
  }
  viewScorecard(): void {
    this.dialogRef.close();
  }
}
