import { Component } from '@angular/core';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

/**
 * Static "how do I score this" reference for the extras/wicket toggles on
 * the Live tab - opened via the help icon next to the scoring controls.
 */
@Component({
  selector: 'app-scoring-help-dialog',
  standalone: true,
  template: `
    <h1 mat-dialog-title>Scoring Guide</h1>
    <mat-dialog-content>
      <ul class="scoring-help-list">
        <li>
          <b>Wide</b> - illegal delivery too wide of the batsman; +1 run
          automatically, doesn't count as a ball.
        </li>
        <li>
          <b>No Ball (NB)</b> - illegal delivery (overstepping etc.); +1 run
          automatically, doesn't count as a ball, bat/extra runs still count.
        </li>
        <li><b>Leg Bye (LB)</b> - runs taken off the batsman's body/pads.</li>
        <li>
          <b>Bye</b> - runs taken without the ball touching bat or body at
          all.
        </li>
        <li>
          <b>Wicket</b> - tap when a batsman is dismissed, then tap the runs
          completed before the dismissal (usually Dot).
        </li>
      </ul>
      <p class="scoring-help-tip">
        Tip: tap an extra or Wicket first, then tap the runs scored on that
        same ball.
      </p>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button color="primary" (click)="dialogRef.close()">
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .scoring-help-list {
        padding-left: 20px;
        margin: 0 0 12px;
      }
      .scoring-help-list li {
        margin-bottom: 8px;
      }
      .scoring-help-tip {
        color: #4527a0;
        font-weight: 500;
        margin: 0;
      }
    `,
  ],
  imports: [CommonModule, MatButtonModule, MatDialogModule],
})
export class ScoringHelpDialog {
  constructor(public dialogRef: MatDialogRef<ScoringHelpDialog>) {}
}
