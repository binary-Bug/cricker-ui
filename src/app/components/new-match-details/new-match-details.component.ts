import { Component, OnInit } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { LiveMatchService } from '../../services/live-match.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-new-match-details',
  standalone: true,
  imports: [
    MatInputModule,
    MatFormFieldModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatButtonModule,
  ],
  templateUrl: './new-match-details.component.html',
  styleUrl: './new-match-details.component.css',
})
export class NewMatchDetailsComponent {
  constructor(
    public dialog: MatDialog,
    private router: Router,
    private liveMatchService: LiveMatchService
  ) {}
  team1Name: string = '';
  team2Name: string = '';
  team1Captain: string = '';
  team2Captain: string = '';
  tossWinner = new FormControl('team1');
  tossResult = new FormControl('bat');
  totalPlayers: number = 0;
  totalOvers: number = 0;

  openCurrentPlayerDialog(): void {
    const dialogRef = this.dialog.open(OnFieldPlayerDetailsDialog);

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.liveMatchService.team1.name = this.team1Name;
        this.liveMatchService.team2.name = this.team2Name;
        this.liveMatchService.team1.captain = this.team1Captain;
        this.liveMatchService.team2.captain = this.team2Captain;
        this.liveMatchService.tossWinner = this.tossWinner.value;
        this.liveMatchService.tossResult = this.tossResult.value;
        this.liveMatchService.totalPlayers = this.totalPlayers;
        this.liveMatchService.totalOvers = this.totalOvers;
        this.router.navigateByUrl('live');
      }
    });
  }
}

@Component({
  selector: 'on-field-player-detail-dialog',
  template: `<h2 mat-dialog-title>New Match</h2>
    <mat-dialog-content>
      <p>Enter on field Player details</p>
      <mat-form-field>
        <mat-label>Striker</mat-label>
        <input matInput [formControl]="striker" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Non-Striker</mat-label>
        <input matInput [formControl]="nonStriker" />
      </mat-form-field>
      <mat-form-field>
        <mat-label>Opening Bowler</mat-label>
        <input matInput [formControl]="currentBowler" />
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="onCancelClick()">Cancel</button>
      <button
        [disabled]="formValid ? null : 'true'"
        mat-button
        (click)="onOkClick()"
      >
        Done
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
export class OnFieldPlayerDetailsDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<OnFieldPlayerDetailsDialog>,
    private liveMatchService: LiveMatchService
  ) {}

  striker = new FormControl('', [Validators.required]);
  nonStriker = new FormControl('', [Validators.required]);
  currentBowler = new FormControl('', [Validators.required]);
  formValid: boolean = false;
  ngOnInit(): void {
    this.striker.statusChanges.subscribe(() => {
      this.updateFormStatus();
    });
    this.nonStriker.statusChanges.subscribe(() => {
      this.updateFormStatus();
    });
    this.currentBowler.statusChanges.subscribe(() => {
      this.updateFormStatus();
    });
  }

  updateFormStatus(): void {
    if (
      this.striker.value?.length &&
      this.striker.value?.length > 0 &&
      this.nonStriker.value?.length &&
      this.nonStriker.value?.length > 0 &&
      this.currentBowler.value?.length &&
      this.currentBowler.value?.length > 0
    ) {
      this.formValid = true;
    } else this.formValid = false;
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
    this.liveMatchService.striker.name = this.striker.value + '*';
    this.liveMatchService.nonStriker.name = this.nonStriker.value + '';
    this.liveMatchService.currentBowler.name = this.currentBowler.value + '';
    this.dialogRef.close('Done');
  }
}
