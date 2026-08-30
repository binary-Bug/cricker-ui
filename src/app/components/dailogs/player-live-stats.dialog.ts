import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { UtilityService } from '../../services/utility.service';

export interface PlayerLiveStatsDialogData {
  type: 'batsman' | 'bowler';
  name: string;
  runs: number;
  balls?: number;
  fours?: number;
  six?: number;
  sr?: number;
  overs?: number;
  wickets?: number;
  eco?: number;
}

/**
 * Small centered "card" dialog showing a batsman's or the current bowler's
 * live-match stats - opened by tapping a row in the compact players-strip
 * on the Live tab, which otherwise no longer surfaces 4s/6s anywhere.
 */
@Component({
  selector: 'app-player-live-stats-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
  template: `
    <div class="player-stat-header">
      <div
        class="player-stat-avatar"
        [style.background]="utilityService.getAvatarColor(data.name)"
      >
        {{ utilityService.getInitials(data.name) }}
      </div>
      <div class="player-stat-name">{{ data.name }}</div>
    </div>
    <mat-dialog-content>
      <div class="player-stat-grid" *ngIf="data.type === 'batsman'">
        <div class="player-stat-tile">
          <span class="player-stat-value">{{ data.runs }}</span>
          <span class="player-stat-label">Runs</span>
        </div>
        <div class="player-stat-tile">
          <span class="player-stat-value">{{ data.balls }}</span>
          <span class="player-stat-label">Balls</span>
        </div>
        <div class="player-stat-tile">
          <span class="player-stat-value">{{ data.fours }}</span>
          <span class="player-stat-label">4s</span>
        </div>
        <div class="player-stat-tile">
          <span class="player-stat-value">{{ data.six }}</span>
          <span class="player-stat-label">6s</span>
        </div>
        <div class="player-stat-tile player-stat-tile-wide">
          <span class="player-stat-value">{{
            data.sr | number : '1.0-2'
          }}</span>
          <span class="player-stat-label">Strike Rate</span>
        </div>
      </div>
      <div class="player-stat-grid" *ngIf="data.type === 'bowler'">
        <div class="player-stat-tile">
          <span class="player-stat-value">{{
            data.overs | number : '1.1-1'
          }}</span>
          <span class="player-stat-label">Overs</span>
        </div>
        <div class="player-stat-tile">
          <span class="player-stat-value">{{ data.runs }}</span>
          <span class="player-stat-label">Runs</span>
        </div>
        <div class="player-stat-tile">
          <span class="player-stat-value">{{ data.wickets }}</span>
          <span class="player-stat-label">Wickets</span>
        </div>
        <div class="player-stat-tile">
          <span class="player-stat-value">{{
            data.eco | number : '1.1-2'
          }}</span>
          <span class="player-stat-label">Economy</span>
        </div>
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
      :host {
        display: block;
        text-align: center;
        padding: 4px 4px 0;
      }
      .player-stat-header {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
      }
      .player-stat-avatar {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 700;
        font-size: 1.2rem;
      }
      .player-stat-name {
        font-weight: 700;
        font-size: 1.05rem;
        color: #263238;
      }
      .player-stat-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 10px;
        padding: 4px 0 12px;
      }
      .player-stat-tile {
        background-color: #f5f3fa;
        border-radius: 10px;
        padding: 10px 8px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .player-stat-tile-wide {
        grid-column: span 2;
      }
      .player-stat-value {
        font-size: 1.2rem;
        font-weight: 700;
        color: #4527a0;
      }
      .player-stat-label {
        font-size: 0.72rem;
        color: #757575;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
    `,
  ],
})
export class PlayerLiveStatsDialog {
  constructor(
    public dialogRef: MatDialogRef<PlayerLiveStatsDialog>,
    @Inject(MAT_DIALOG_DATA) public data: PlayerLiveStatsDialogData,
    public utilityService: UtilityService
  ) {}
}
