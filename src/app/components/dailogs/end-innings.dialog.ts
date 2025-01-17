import { AsyncPipe } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { Observable, startWith, map } from 'rxjs';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';

@Component({
  selector: 'end-innings-dialog',
  template: `<h2 mat-dialog-title>
      {{ matchService.isSecondInning ? 'End Innings 2 ?' : 'End Innings 1 ?' }}
    </h2>
    <mat-dialog-content>
      <div class="grid place-items-center">
        <mat-radio-group
          [disabled]="isAuto"
          [(ngModel)]="selectedType"
          style="width: 100%;"
        >
          <div class="flex justify-between">
            <div>
              <mat-radio-button color="primary" value="allOut"
                >All Out</mat-radio-button
              >
            </div>
            <div>
              <mat-radio-button color="primary" value="oversCompleted"
                >Overs Completed</mat-radio-button
              >
            </div>
          </div>
        </mat-radio-group>
      </div>
      <mat-divider></mat-divider>
      <br />
      <div class="grid place-items-center">
        <mat-form-field>
          <mat-label>Do you want to add more overs?</mat-label>
          <input type="number" matInput [formControl]="totalOvers" />
        </mat-form-field>
        <mat-form-field>
          <mat-label>Do you want to add more players?</mat-label>
          <input type="number" matInput [formControl]="totalPlayers" />
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        mat-button
        [disabled]="canContinue ? null : 'true'"
        (click)="onContinueClick()"
      >
        Continue Innings
      </button>
      <button mat-button color="primary" (click)="onOkClick()" cdkFocusInitial>
        End Innings
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
    MatAutocompleteModule,
    MatRadioModule,
    MatDividerModule,
  ],
})
export class EndInningsDialog implements OnInit {
  data: any;
  constructor(
    public dialogRef: MatDialogRef<EndInningsDialog>,
    public matchService: MatchService,
    public liveMatchService: LiveMatchService
  ) {
    dialogRef.disableClose = true;
    this.data = inject<any>(MAT_DIALOG_DATA);
    this.selectedType = this.data?.value;
    if (this.data !== null) {
      this.canContinue = false;
      this.isAuto = true;
    }
  }

  totalOvers = new FormControl(this.matchService.totalOvers);
  totalPlayers = new FormControl(this.matchService.totalPlayers);

  selectedType: string = '';

  canContinue: boolean = true;
  isAuto: boolean = false;

  ngOnInit(): void {
    this.totalOvers.valueChanges.subscribe((val) => {
      if (val === this.matchService.totalOvers) this.canContinue = false;
      else this.canContinue = true;
    });

    this.totalPlayers.valueChanges.subscribe((val) => {
      if (val === this.matchService.totalPlayers) this.canContinue = false;
      else this.canContinue = true;
    });
  }

  onOkClick(): void {
    this.dialogRef.close({ event: 'end' });
  }
  onContinueClick(): void {
    this.dialogRef.close({
      event: 'continue',
      overs: this.totalOvers.value,
      players: this.totalPlayers.value,
    });
  }
}
