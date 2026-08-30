import { Component } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

/**
 * Static "how do I score this" reference for the extras/wicket toggles on
 * the Live tab - opened via the help icon next to the scoring controls.
 * Rule chip colors mirror the live extras/wicket chips in
 * scoring-actions.component.css for a cohesive cross-reference.
 */
@Component({
  selector: 'app-scoring-help-dialog',
  standalone: true,
  template: `
    <app-dialog-icon-header
      icon="menu_book"
      title="Scoring Guide"
      subtitle="Quick reference for extras and wicket scoring"
    ></app-dialog-icon-header>
    <mat-dialog-content class="scoring-help-content">
      <div class="rule-row">
        <span class="rule-chip chip-wide">Wide</span>
        <p>
          Illegal delivery too wide of the batsman; +1 run automatically,
          doesn't count as a ball.
        </p>
      </div>
      <div class="rule-row">
        <span class="rule-chip chip-nb">NB</span>
        <p>
          No Ball - illegal delivery (overstepping etc.); +1 run
          automatically, doesn't count as a ball, bat/extra runs still count.
        </p>
      </div>
      <div class="rule-row">
        <span class="rule-chip chip-lb">LB</span>
        <p>Leg Bye - runs taken off the batsman's body/pads.</p>
      </div>
      <div class="rule-row">
        <span class="rule-chip chip-bye">Bye</span>
        <p>Runs taken without the ball touching bat or body at all.</p>
      </div>
      <div class="rule-row">
        <span class="rule-chip chip-wicket">Out</span>
        <p>
          Wicket - tap when a batsman is dismissed, then tap the runs
          completed before the dismissal (usually Dot).
        </p>
      </div>
      <p class="scoring-help-tip">
        Tip: tap an extra or Wicket first, then tap the runs scored on that
        same ball.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions class="scoring-help-actions">
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary"
        (click)="dialogRef.close()"
        cdkFocusInitial
      >
        Got it
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      .scoring-help-content {
        padding-top: 0 !important;
      }
      .rule-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        margin-bottom: 12px;
      }
      .rule-row p {
        margin: 2px 0 0;
        color: #424242;
        line-height: 1.35;
      }
      .rule-chip {
        flex-shrink: 0;
        min-width: 44px;
        box-sizing: border-box;
        padding: 4px 6px;
        border-radius: 8px;
        text-align: center;
        font-size: 0.72rem;
        font-weight: 700;
        color: #fff;
        text-transform: uppercase;
      }
      .chip-wide {
        background-color: #ff9800;
      }
      .chip-nb {
        background-color: #f4511e;
      }
      .chip-lb {
        background-color: #00897b;
      }
      .chip-bye {
        background-color: #1e88e5;
      }
      .chip-wicket {
        background-color: #d80c0c;
      }
      .scoring-help-tip {
        color: #4527a0;
        font-weight: 500;
        margin: 16px 0 0;
      }
      .scoring-help-actions.mat-mdc-dialog-actions {
        padding: 8px 24px 20px;
      }
      .scoring-help-actions .dlg-btn-primary {
        width: 100%;
      }
    `,
  ],
  imports: [
    CommonModule,
    MatButtonModule,
    MatDialogModule,
    DialogIconHeaderComponent,
  ],
})
export class ScoringHelpDialog {
  constructor(public dialogRef: MatDialogRef<ScoringHelpDialog>) {}
}

