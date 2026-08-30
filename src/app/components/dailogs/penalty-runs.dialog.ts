import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Component } from '@angular/core';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

@Component({
  selector: 'penalty-runs-dialog',
  template: `<app-dialog-icon-header
      icon="add_circle_outline"
      title="Penalty Runs"
      subtitle="Enter the runs awarded as a penalty"
    ></app-dialog-icon-header>
    <mat-dialog-content>
      <div class="penalty-stepper">
        <button
          mat-icon-button
          class="penalty-step-btn"
          (click)="decrement()"
        >
          <mat-icon>remove</mat-icon>
        </button>
        <div class="penalty-value">
          <span
            class="penalty-value-number"
            [class.negative]="(runs.value ?? 0) < 0"
            >{{ runs.value }}</span
          >
          <span class="penalty-value-label">runs</span>
        </div>
        <button mat-icon-button class="penalty-step-btn" (click)="increment()">
          <mat-icon>add</mat-icon>
        </button>
      </div>
      <p class="penalty-hint">
        {{
          (runs.value ?? 0) < 0
            ? 'Penalty against the batting team \u2014 runs will be deducted'
            : (runs.value ?? 0) > 0
            ? 'Awarded to the batting team'
            : 'Use + / \u2212 to award or deduct runs'
        }}
      </p>
      <div class="penalty-checkbox-card">
        <mat-checkbox [formControl]="countBall"
          >Count this ball (bowled towards the over)</mat-checkbox
        >
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button class="dlg-btn-secondary" (click)="onCancelClick()">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary"
        (click)="onOkClick()"
        cdkFocusInitial
      >
        Done
      </button>
    </mat-dialog-actions>`,
  styles: [
    `
      :host {
        display: block;
        text-align: center;
      }
      .penalty-stepper {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        margin: 4px 0 20px;
      }
      .penalty-step-btn.mat-mdc-icon-button {
        width: 44px;
        height: 44px;
        background-color: #ede7f6;
        color: #5e35b1;
      }
      .penalty-value {
        display: flex;
        flex-direction: column;
        align-items: center;
        min-width: 64px;
      }
      .penalty-value-number {
        font-size: 2rem;
        font-weight: 700;
        color: #4527a0;
        line-height: 1.1;
      }
      .penalty-value-number.negative {
        color: #c62828;
      }
      .penalty-value-label {
        font-size: 0.75rem;
        color: #757575;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .penalty-hint {
        font-size: 0.8rem;
        color: #757575;
        margin: 0 0 16px;
      }
      .penalty-checkbox-card {
        background: #fafafa;
        border-radius: 12px;
        padding: 12px 14px;
        text-align: left;
        margin-bottom: 4px;
      }
      mat-dialog-actions {
        gap: 12px;
        padding: 12px 16px 20px;
      }
    `,
  ],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatCheckboxModule,
    DialogIconHeaderComponent,
  ],
})
export class PenaltyRunsDialog {
  constructor(public dialogRef: MatDialogRef<PenaltyRunsDialog>) {}

  runs = new FormControl(0);
  // Defaults to true - preserves today's "penalty runs always count as a ball
  // bowled" behavior unless the scorer explicitly unchecks it.
  countBall = new FormControl(true);

  increment(): void {
    this.runs.setValue((this.runs.value ?? 0) + 1);
  }

  // No floor at 0 - a negative value represents a penalty charged against
  // the batting team (e.g. short run, unfair play), deducted from their
  // score, as opposed to a positive value awarded to them.
  decrement(): void {
    this.runs.setValue((this.runs.value ?? 0) - 1);
  }

  onOkClick(): void {
    this.dialogRef.close({ runs: this.runs.value, countBall: this.countBall.value });
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }
}
