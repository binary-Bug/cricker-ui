import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatchService } from '../../services/match.service';
import { LiveMatchService } from '../../services/live-match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Router } from '@angular/router';
import { SaveMatchService } from '../../services/save-match.service';
import { PlayerService } from '../../services/player.service';
import { Subscription } from 'rxjs';
import { LoadMatchService } from '../../services/load-match.service';
import { MvpCalculatorService } from '../../services/mvp-calculator.service';
import { MatchMvpSummary } from '../../models/mvp.interface';

@Component({
  selector: 'match-complete-dialog',
  template: ` <h2 mat-dialog-title>Match Complete</h2>
    <mat-dialog-content>
      <p>{{ matchResult }}</p>
      <!--
        Man of the Match spotlight + top-5 list - only rendered once MVP
        points have been calculated (see ngOnInit). manOfTheMatch is only
        empty if, somehow, no players took part, which shouldn't happen for
        a completed match. This is a quick celebratory summary only - the
        full click-through calculation breakdown is only offered on the
        Match Info tab (match-details), not here. The Man of the Match is
        deliberately styled as the loudest, highest-contrast element here
        ("center of attraction"), with the top-5 list below it styled as
        clearly secondary/supporting detail.
      -->
      <div class="mom-spotlight" *ngIf="mvpSummary?.manOfTheMatch">
        <div class="mom-label">🏆 Man of the Match</div>
        <div class="mom-name">{{ mvpSummary?.manOfTheMatch }}</div>
        <div class="mom-points">{{ mvpSummary?.topFive?.[0]?.totalPoints }} pts</div>
      </div>
      <div class="mvp-secondary" *ngIf="mvpSummary?.manOfTheMatch">
        <div class="mvp-secondary-title">MVP Points - Top 5</div>
        <table class="mvp-table">
          <tr *ngFor="let player of mvpSummary?.topFive; let i = index">
            <td class="mvp-rank">{{ i + 1 }}</td>
            <td class="mvp-name">{{ player.name }}</td>
            <td class="mvp-points">{{ player.totalPoints }} pts</td>
          </tr>
        </table>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        [disabled]="IsMatchSaveComplete ? null : 'true'"
        mat-button
        color="primary"
        (click)="viewScorecard()"
      >
        View Scorecard
      </button>
      <button mat-button color="warn" (click)="exit()" cdkFocusInitial>
        Exit
      </button>
    </mat-dialog-actions>`,
  styles: [
    `
      .mom-spotlight {
        margin-top: 12px;
        padding: 14px 12px 16px 12px;
        background: linear-gradient(135deg, #fff8e1, #ffd54f);
        border: 1px solid #f5a623;
        border-radius: 6px;
        text-align: center;
      }
      .mom-label {
        font-size: 0.8em;
        font-weight: 700;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: #8a6100;
      }
      .mom-name {
        font-size: 1.5em;
        font-weight: 800;
        color: #6d4c00;
        margin: 4px 0 2px 0;
        line-height: 1.2;
      }
      .mom-points {
        font-size: 1em;
        font-weight: 600;
        color: #8a6100;
      }
      .mvp-secondary {
        margin-top: 10px;
        padding: 8px 10px;
        background: #fafafa;
        border-radius: 6px;
      }
      .mvp-secondary-title {
        font-size: 0.85em;
        font-weight: 500;
        color: #757575;
        text-align: center;
        margin-bottom: 4px;
      }
      .mvp-table {
        width: 100%;
        margin: 0;
        border: none;
        font-size: 0.9em;
      }
      .mvp-table tr,
      .mvp-table td {
        border: none;
        height: auto;
        padding: 3px 8px;
      }
      .mvp-rank {
        width: 10%;
        font-weight: bold;
        text-align: center;
      }
      .mvp-name {
        width: 60%;
        text-align: left;
      }
      .mvp-points {
        width: 30%;
        text-align: right;
      }
    `,
  ],
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
    CommonModule,
  ],
})
export class MatchCompleteDialog implements OnInit, OnDestroy {
  constructor(
    public dialogRef: MatDialogRef<MatchCompleteDialog>,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService,
    private eventHandlerService: EventHandlerService,
    private router: Router,
    private saveMatchService: SaveMatchService,
    private playerService: PlayerService,
    private loadMatchService: LoadMatchService,
    private mvpCalculatorService: MvpCalculatorService
  ) {
    dialogRef.disableClose;
  }

  matchResult: string = '';
  IsMatchSaveComplete: boolean = false;
  matchRefId: string = '';
  subscriptions: Subscription[] = [];
  /** MVP points/Man of the Match result for this match - computed in ngOnInit before saving, and rendered as the banner above. */
  mvpSummary: MatchMvpSummary | undefined = undefined;

  async ngOnInit(): Promise<void> {
    this.matchResult = this.checkMatchResult();

    // Compute MVP points/Man of the Match BEFORE saving so the result can
    // be persisted with the match document (see SaveMatchService) and
    // handed to PlayerService to roll onto each player's career totals.
    const weights = await this.mvpCalculatorService.loadWeights();
    this.mvpSummary = this.mvpCalculatorService.calculateMatchMvp(
      this.matchService.teamData['team1'],
      this.matchService.teamData['team2'],
      this.getWinningTeamKey(),
      this.getTossWinnerKey(),
      weights,
      this.matchService.totalOvers ?? 0
    );
    // Keep MatchService's copy in sync too, so match-details can render the
    // Match Info tab's MoM banner immediately if the user clicks
    // "View Scorecard", without needing a fresh Firestore round trip.
    this.matchService.mvpSummary = this.mvpSummary;

    this.saveMatchService.saveMatchData(this.matchResult, this.mvpSummary);

    let ele = document.getElementById('confetti');
    if (ele) {
      ele.style.zIndex = '1001';
      ele.style.display = 'block';
    }
    setTimeout(() => {
      let ele = document.getElementById('confetti');
      if (ele) {
        ele.style.zIndex = '-1';
        ele.style.display = 'none';
      }
    }, 2000);

    this.subscriptions.push(
      this.eventHandlerService
        .MatchSaveCompleteEvent$()
        .subscribe(async (matchId) => {
          await this.playerService.savePlayerData(
            matchId,
            this.matchResult,
            this.mvpSummary!
          );
          this.matchRefId = matchId;
          this.IsMatchSaveComplete = true;
        })
    );
  }

  /**
   * Which team won, for the MVP winning-team tie-break rule - undefined for
   * a tie (matches checkMatchResult()'s own tie handling below), so ties
   * simply don't grant anyone that tie-break advantage rather than being
   * treated as an error.
   */
  private getWinningTeamKey(): 'team1' | 'team2' | undefined {
    const battingTeamKey = this.matchService.currentRoles['bat'] as
      | 'team1'
      | 'team2';
    const bowlingTeamKey = this.matchService.currentRoles['ball'] as
      | 'team1'
      | 'team2';
    const battingRuns = this.matchService.teamData[battingTeamKey].runsScored;
    const bowlingRuns = this.matchService.teamData[bowlingTeamKey].runsScored;
    if (battingRuns === bowlingRuns) return undefined;
    return battingRuns > bowlingRuns ? battingTeamKey : bowlingTeamKey;
  }

  /**
   * Which team's captain gets the extra toss-winning-captain MVP bonus -
   * undefined if the toss result wasn't recorded (shouldn't normally
   * happen for a match played through to completion).
   */
  private getTossWinnerKey(): 'team1' | 'team2' | undefined {
    return this.matchService.tossWinner === 'team1' ||
      this.matchService.tossWinner === 'team2'
      ? this.matchService.tossWinner
      : undefined;
  }

  checkMatchResult(): string {
    if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .runsScored >
      this.matchService.teamData[this.matchService.currentRoles['ball']]
        .runsScored
    ) {
      return (
        this.matchService.teamData[this.matchService.currentRoles['bat']].name +
        ' wins by ' +
        (this.matchService.totalPlayers! -
          1 -
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .wicketsLost) +
        ' wicket(s)'
      );
    } else if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .runsScored <
      this.matchService.teamData[this.matchService.currentRoles['ball']]
        .runsScored
    ) {
      return (
        this.matchService.teamData[this.matchService.currentRoles['ball']]
          .name +
        ' wins by ' +
        (this.matchService.teamData[this.matchService.currentRoles['bat']]
          .requiredRuns! -
          1) +
        ' runs'
      );
    } else {
      return 'Match Tied';
    }
  }

  exit(): void {
    this.playerService.players = [];
    this.loadMatchService.matches = [];
    this.liveMatchService.exitMatch();
    this.dialogRef.close();
  }
  async viewScorecard(): Promise<void> {
    this.playerService.players = [];
    await this.loadMatchService.getAllMatches().then((matches) => {
      this.loadMatchService.matches = matches;
    });
    this.liveMatchService.exitMatch('');
    this.router.navigateByUrl('match-details?id=' + this.matchRefId);
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
  }
}
