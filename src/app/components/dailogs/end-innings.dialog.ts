import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

@Component({
  selector: 'end-innings-dialog',
  template: `
    <app-dialog-icon-header
      icon="flag"
      [title]="
        matchService.isSecondInning ? 'End Innings 2?' : 'End Innings 1?'
      "
      [subtitle]="subtitleText"
    ></app-dialog-icon-header>
    <mat-dialog-content>
      <div class="field-group">
        <span class="field-label">Reason *</span>
        <mat-radio-group
          [disabled]="isAuto"
          (ngModelChange)="onTypeChange($event)"
          [(ngModel)]="selectedType"
          class="type-options"
        >
          <mat-radio-button color="primary" class="type-option" value="allOut">
            <mat-icon class="type-option-icon">sports_cricket</mat-icon>
            <div class="type-option-label">All Out</div>
          </mat-radio-button>
          <mat-radio-button
            color="primary"
            class="type-option"
            value="oversCompleted"
          >
            <mat-icon class="type-option-icon">timer</mat-icon>
            <div class="type-option-label">Overs Completed</div>
          </mat-radio-button>
        </mat-radio-group>
      </div>
      <div class="field-group">
        <span class="field-label">Overs</span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input
            type="number"
            placeholder="Overs"
            matInput
            [formControl]="totalOvers"
          />
        </mat-form-field>
        <span class="field-hint"
          >Change this if the innings should end after a different number of
          overs.</span
        >
      </div>
      <div class="field-group">
        <span class="field-label">Players</span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input
            type="number"
            placeholder="Players"
            matInput
            [formControl]="totalPlayers"
          />
        </mat-form-field>
        <span class="field-hint"
          >Change this if the total number of players has changed.</span
        >
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="end-innings-actions">
      <button
        mat-stroked-button
        class="dlg-btn-secondary"
        [disabled]="!canContinue"
        (click)="onContinueClick()"
      >
        Continue Innings
      </button>
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary"
        (click)="onOkClick()"
        cdkFocusInitial
      >
        End Innings
      </button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatRadioModule,
    MatIconModule,
    DialogIconHeaderComponent,
  ],
  styles: [
    `
      :host {
        display: block;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 16px;
      }
      .field-group .mat-mdc-form-field {
        width: 100%;
      }
      .field-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #757575;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .field-hint {
        font-size: 0.78rem;
        color: #5e35b1;
        font-style: italic;
      }
      .type-options {
        display: flex;
        gap: 12px;
      }
      .type-options .type-option {
        flex: 1 1 0;
      }
      .type-options .type-option ::ng-deep .mdc-form-field {
        width: 100%;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .type-options .type-option ::ng-deep .mdc-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
        padding: 0;
      }
      .type-option {
        display: block;
        background: #fafafa;
        border-radius: 12px;
        padding: 10px;
        text-align: center;
      }
      .type-option-icon {
        display: block;
        margin: 0 auto 4px;
        color: #5e35b1;
      }
      .type-option-label {
        font-weight: 600;
        font-size: 0.9em;
        color: #4527a0;
      }
      .end-innings-actions.mat-mdc-dialog-actions {
        display: flex;
        gap: 10px;
        padding: 12px 24px 20px;
      }
      @media (max-width: 340px) {
        .end-innings-actions.mat-mdc-dialog-actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }
      }
    `,
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
    if (this.data !== null) {
      this.canContinue = false;
      this.isAuto = true;
      this.selectedType = this.data.value;
    }
  }

  totalOvers = new FormControl(this.matchService.totalOvers);
  totalPlayers = new FormControl(this.matchService.totalPlayers);

  selectedType: string = '';

  canContinue: boolean = true;
  isAuto: boolean = false;

  get subtitleText(): string {
    if (this.isAuto && this.selectedType === 'allOut')
      return 'All players are out';
    if (this.isAuto && this.selectedType === 'oversCompleted')
      return 'All overs have been bowled';
    return 'Choose how this innings ends';
  }

  ngOnInit(): void {
    this.totalOvers.valueChanges.subscribe((val) => {
      if (val === this.matchService.totalOvers && this.isAuto)
        this.canContinue = false;
      else this.canContinue = true;
    });

    this.totalPlayers.valueChanges.subscribe((val) => {
      if (val === this.matchService.totalPlayers && this.isAuto)
        this.canContinue = false;
      else this.canContinue = true;
    });

    if (this.isAuto && this.selectedType) {
      if (
        this.selectedType === 'allOut' &&
        this.matchService.teamData[this.matchService.currentRoles['bat']]
          .oversPlayed < this.matchService.totalOvers!
      ) {
        this.totalOvers.disable();
      } else if (this.selectedType === 'oversCompleted') {
        this.totalPlayers.disable();
      }
    }
  }

  onOkClick(): void {
    if (this.selectedType === 'oversCompleted')
      this.dialogRef.close({
        event: 'end',
        isAuto: this.isAuto,
        overs: Math.ceil(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ),
        players: null,
      });
    else
      this.dialogRef.close({
        event: 'end',
        isAuto: this.isAuto,
        overs: null,
        players:
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .wicketsLost + 1,
      });
  }
  onContinueClick(): void {
    this.dialogRef.close({
      event: 'continue',
      isAuto: this.isAuto,
      overs: this.totalOvers.value,
      players: this.totalPlayers.value,
    });
  }

  onTypeChange(data: any): void {
    if (this.isAuto === false && data !== null) {
      this.totalPlayers.disable();
      this.totalOvers.disable();
    }
  }
}
