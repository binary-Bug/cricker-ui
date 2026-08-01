import { Component, Inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';

/**
 * Small presentational dialog that explains the MVP points system to
 * users. It doesn't know anything about the scoring rules itself - the
 * caller (StatsComponent / MatchDetailsComponent) builds the section/line
 * text via MvpCalculatorService.describeRules() and passes it in as data,
 * so this dialog stays a simple, reusable "show me these sections" view.
 */
@Component({
  selector: 'app-mvp-help-dialog',
  standalone: true,
  template: `
    <h1 mat-dialog-title>How MVP Points Work</h1>
    <mat-dialog-content>
      <p>
        Every player who takes part in a match earns MVP points based on
        their batting, bowling and fielding performance. The top 5
        point-scorers are shown on the match's Match Info tab, and the
        #1 ranked player is named Man of the Match.
      </p>
      <div *ngFor="let group of data.sections" class="mvp-help-section">
        <h3>{{ group.section }}</h3>
        <ul>
          <li *ngFor="let line of group.lines">{{ line }}</li>
        </ul>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button color="primary" (click)="dialogRef.close()">
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .mvp-help-section h3 {
        margin-bottom: 4px;
      }
      .mvp-help-section ul {
        margin-top: 0;
        padding-left: 20px;
      }
    `,
  ],
  imports: [CommonModule, MatButtonModule, MatDialogModule],
})
export class MvpHelpDialog {
  constructor(
    public dialogRef: MatDialogRef<MvpHelpDialog>,
    @Inject(MAT_DIALOG_DATA)
    public data: { sections: { section: string; lines: string[] }[] }
  ) {}
}
