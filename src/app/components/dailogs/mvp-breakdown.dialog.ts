import { Component, Inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { MvpLineItem, PlayerMvpBreakdown } from '../../models/mvp.interface';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

/**
 * Shows exactly how one player's MVP total for a match was worked out -
 * a per-discipline (batting/bowling/fielding/bonus) list of line items
 * (e.g. "Runs Scored: 42 runs x 1 pt = 42 pts"), so the single headline
 * number on the match-details top-5 list isn't a "black box". Opened by
 * clicking a row in that list - see MatchDetailsComponent.openMvpBreakdown.
 *
 * Purely presentational: all the numbers/text here were already computed
 * and stored on the PlayerMvpBreakdown object by MvpCalculatorService at
 * match-save time (see mvp.interface.ts's doc comment on why the
 * breakdown is stored rather than recalculated on the fly).
 */
@Component({
  selector: 'app-mvp-breakdown-dialog',
  standalone: true,
  template: `
    <ng-template #lineItemTemplate let-item>
      <div class="line-item">
        <div class="line-item-row">
          <span class="line-item-label">
            {{ item.label }}
            <!--
              Threshold explain toggle - only shown for line items whose
              trigger is a match-specific computed threshold (Milestone
              Bonus, Wicket Haul Bonus), mirroring the top-5 list's chevron
              affordance pattern so it's discoverable/tappable on mobile
              too, not just a hover-only desktop cue. Uses a plain small
              mat-icon (not mat-icon-button) so it sits inline with the
              text at the right size, instead of the button's much larger
              circular touch target throwing off the row's alignment.
            -->
            <mat-icon
              *ngIf="item.thresholdExplanation"
              class="explain-toggle"
              title="How was this threshold calculated?"
              (click)="toggleExplanation(item)"
              >{{ isExpanded(item) ? 'expand_more' : 'chevron_right' }}</mat-icon
            >
          </span>
          <span [class.negative]="item.points < 0"
            >{{ item.points >= 0 ? '+' : '' }}{{ item.points }}</span
          >
        </div>
        <div class="line-item-detail">{{ item.detail }}</div>
        <div
          class="line-item-explanation"
          *ngIf="item.thresholdExplanation && isExpanded(item)"
        >
          {{ item.thresholdExplanation }}
        </div>
      </div>
    </ng-template>

    <app-dialog-icon-header
      icon="military_tech"
      [title]="data.player.name"
      subtitle="MVP Points Breakdown"
    ></app-dialog-icon-header>
    <mat-dialog-content>
      <div class="total-row">Total: {{ data.player.totalPoints }} pts</div>
      <div
        class="mom-gap-row"
        *ngIf="data.momName && data.player.name !== data.momName"
      >
        🏆 {{ (data.momPoints ?? 0) - data.player.totalPoints }} pts behind
        {{ data.momName }} (Man of the Match)
      </div>

      <div class="section" *ngIf="data.player.battingBreakdown.length">
        <h3>Batting - {{ data.player.battingPoints }} pts</h3>
        <ng-container *ngFor="let item of data.player.battingBreakdown">
          <ng-container
            *ngTemplateOutlet="lineItemTemplate; context: { $implicit: item }"
          ></ng-container>
        </ng-container>
      </div>

      <div class="section" *ngIf="data.player.bowlingBreakdown.length">
        <h3>Bowling - {{ data.player.bowlingPoints }} pts</h3>
        <ng-container *ngFor="let item of data.player.bowlingBreakdown">
          <ng-container
            *ngTemplateOutlet="lineItemTemplate; context: { $implicit: item }"
          ></ng-container>
        </ng-container>
      </div>

      <div class="section" *ngIf="data.player.fieldingBreakdown.length">
        <h3>Fielding - {{ data.player.fieldingPoints }} pts</h3>
        <ng-container *ngFor="let item of data.player.fieldingBreakdown">
          <ng-container
            *ngTemplateOutlet="lineItemTemplate; context: { $implicit: item }"
          ></ng-container>
        </ng-container>
      </div>

      <div class="section" *ngIf="data.player.bonusBreakdown.length">
        <h3>Bonus - {{ data.player.bonusPoints }} pts</h3>
        <ng-container *ngFor="let item of data.player.bonusBreakdown">
          <ng-container
            *ngTemplateOutlet="lineItemTemplate; context: { $implicit: item }"
          ></ng-container>
        </ng-container>
      </div>

      <div class="grand-total-row">
        {{ data.player.battingPoints }} (batting) + {{ data.player.bowlingPoints }} (bowling) +
        {{ data.player.fieldingPoints }} (fielding) + {{ data.player.bonusPoints }} (bonus) =
        <strong>{{ data.player.totalPoints }} pts</strong>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="mvp-breakdown-actions">
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary"
        (click)="dialogRef.close()"
        cdkFocusInitial
      >
        Close
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
      }
      /* This dialog's title is a player's name, not a generic dialog
         heading - overriding the shared header's default purple with an
         amber "trophy" tone (matching the military_tech icon + the
         mom-gap-row chip below) so it reads as a spotlighted achievement
         rather than looking identical to every other dialog's chrome. */
      :host ::ng-deep .dlg-icon-badge {
        background-color: #fff3d6;
      }
      :host ::ng-deep .dlg-icon {
        color: #b8860b;
      }
      :host ::ng-deep .dlg-title {
        color: #a66a00;
      }
      .total-row {
        font-size: 1.3em;
        font-weight: 700;
        text-align: center;
        margin-bottom: 10px;
        color: #212121;
      }
      .mom-gap-row {
        font-size: 0.85em;
        font-weight: 500;
        text-align: center;
        color: #8a6100;
        background: #fff8e1;
        border-radius: 8px;
        padding: 6px 10px;
        margin: -4px 0 12px 0;
      }
      .section {
        background: #fafafa;
        border-radius: 12px;
        padding: 10px 12px;
        margin-bottom: 12px;
      }
      .section h3 {
        margin: 0 0 6px;
        font-size: 0.78rem;
        font-weight: 700;
        color: #757575;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .line-item {
        padding: 3px 0;
      }
      .line-item-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-weight: 500;
      }
      .line-item-label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .explain-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        height: 18px;
        width: 18px;
        line-height: 18px;
        padding: 4px;
        box-sizing: content-box;
        border-radius: 50%;
        color: #9575cd;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .explain-toggle:hover,
      .explain-toggle:active {
        background: #f0e9fb;
      }
      .line-item-row .negative {
        color: #c62828;
      }
      .line-item-detail {
        font-size: 0.8em;
        color: #666;
      }
      .line-item-explanation {
        font-size: 0.8em;
        color: #673ab7;
        background: #f3effa;
        border-radius: 4px;
        padding: 4px 8px;
        margin-top: 3px;
      }
      .grand-total-row {
        margin-top: 12px;
        padding-top: 8px;
        border-top: 1px solid #ddd;
        font-size: 0.85em;
        text-align: center;
        color: #757575;
      }
      .grand-total-row strong {
        color: #212121;
      }
      .mvp-breakdown-actions.mat-mdc-dialog-actions {
        padding: 8px 24px 20px;
      }
      .mvp-breakdown-actions .dlg-btn-primary {
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
export class MvpBreakdownDialog {
  constructor(
    public dialogRef: MatDialogRef<MvpBreakdownDialog>,
    @Inject(MAT_DIALOG_DATA)
    public data: { player: PlayerMvpBreakdown; momName?: string; momPoints?: number }
  ) {}

  /** Which line items currently have their threshold explanation expanded - toggled per item via the chevron button. */
  private expandedItems = new Set<MvpLineItem>();

  toggleExplanation(item: MvpLineItem): void {
    if (this.expandedItems.has(item)) {
      this.expandedItems.delete(item);
    } else {
      this.expandedItems.add(item);
    }
  }

  isExpanded(item: MvpLineItem): boolean {
    return this.expandedItems.has(item);
  }
}

