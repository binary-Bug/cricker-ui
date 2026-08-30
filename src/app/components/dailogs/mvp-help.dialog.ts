import { Component, Inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

/** Icon + accent color per MVP section, purely presentational. */
const SECTION_STYLE: Record<string, { icon: string; color: string }> = {
  Batting: { icon: 'sports_cricket', color: '#5e35b1' },
  Bowling: { icon: 'sports_baseball', color: '#1e88e5' },
  Fielding: { icon: 'sports_handball', color: '#00897b' },
  Bonuses: { icon: 'stars', color: '#ff9800' },
};
const DEFAULT_SECTION_STYLE = { icon: 'info', color: '#5e35b1' };

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
    <app-dialog-icon-header
      icon="emoji_events"
      title="How MVP Points Work"
      subtitle="Every player earns points for batting, bowling and fielding. The top 5 point-scorers appear on the Match Info tab, and #1 is named Man of the Match."
    ></app-dialog-icon-header>
    <mat-dialog-content class="mvp-help-content">
      <div *ngFor="let group of data.sections" class="mvp-help-section">
        <div class="mvp-help-section-title">
          <mat-icon
            class="mvp-help-section-icon"
            [style.color]="sectionStyle(group.section).color"
          >
            {{ sectionStyle(group.section).icon }}
          </mat-icon>
          <h3>{{ group.section }}</h3>
        </div>
        <ul>
          <li *ngFor="let line of group.lines">{{ line }}</li>
        </ul>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="mvp-help-actions">
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
      .mvp-help-content {
        padding-top: 0 !important;
      }
      .mvp-help-section {
        margin-bottom: 16px;
      }
      .mvp-help-section-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .mvp-help-section-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }
      .mvp-help-section-title h3 {
        margin: 0;
        color: #424242;
      }
      .mvp-help-section ul {
        margin: 4px 0 0;
        padding-left: 20px;
      }
      .mvp-help-section li {
        margin-bottom: 4px;
        color: #424242;
      }
      .mvp-help-actions.mat-mdc-dialog-actions {
        padding: 8px 24px 20px;
      }
      .mvp-help-actions .dlg-btn-primary {
        width: 100%;
      }
    `,
  ],
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    DialogIconHeaderComponent,
  ],
})
export class MvpHelpDialog {
  constructor(
    public dialogRef: MatDialogRef<MvpHelpDialog>,
    @Inject(MAT_DIALOG_DATA)
    public data: { sections: { section: string; lines: string[] }[] }
  ) {}

  sectionStyle(section: string): { icon: string; color: string } {
    return SECTION_STYLE[section] ?? DEFAULT_SECTION_STYLE;
  }
}

