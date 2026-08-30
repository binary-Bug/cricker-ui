import {
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { LiveMatchService } from '../../services/live-match.service';
import { CommonModule } from '@angular/common';
import { ScoringActionsComponent } from '../scoring-actions/scoring-actions.component';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { UtilityService } from '../../services/utility.service';
import { PlayerLiveStatsDialog } from '../dailogs/player-live-stats.dialog';
import { CalculateTotalRunsInOver } from '../scorecard/scorecard.component';

@Component({
  selector: 'app-scoring',
  standalone: true,
  imports: [
    CommonModule,
    ScoringActionsComponent,
    MatButtonModule,
    MatTooltipModule,
    CalculateTotalRunsInOver,
  ],
  templateUrl: './scoring.component.html',
  styleUrl: './scoring.component.css',
})
export class ScoringComponent implements OnInit, OnDestroy {
  private changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  trackByIndex = (index: number) => index;
  subscriptions: Subscription[] = [];
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  utilityService: UtilityService = inject(UtilityService);
  matchService: MatchService = inject(MatchService);
  dialog: MatDialog = inject(MatDialog);
  ELEMENT_DATA_BATSMEN: any[] = [
    {
      name: this.liveMatchService.striker.name + '*',
      runs: this.liveMatchService.striker.runs,
      balls: this.liveMatchService.striker.balls,
      fours: this.liveMatchService.striker.fours,
      six: this.liveMatchService.striker.six,
    },
    {
      name: this.liveMatchService.nonStriker.name,
      runs: this.liveMatchService.nonStriker.runs,
      balls: this.liveMatchService.nonStriker.balls,
      fours: this.liveMatchService.nonStriker.fours,
      six: this.liveMatchService.nonStriker.six,
    },
  ];
  ELEMENT_DATA_BOWLER: any[] = [
    {
      name: this.liveMatchService.currentBowler.name,
      overs: this.liveMatchService.currentBowler.overs,
      wickets: this.liveMatchService.currentBowler.wickets,
      runs: this.liveMatchService.currentBowler.runs,
    },
  ];

  overCompleted: boolean = false;

  ngOnInit(): void {
    this.calculateSR();
    this.calculateEco();
    this.subscriptions.push(
      this.eventHandler.RunAddedEvent$().subscribe(() => {
        this.reAssignBatsmenData();
        this.calculateSR();
        this.reAssignBowlerData();
        this.calculateEco();
        this.overCompleted = false;
      }),

      this.eventHandler.BatsmenSwapEvent$().subscribe(() => {
        this.reAssignBatsmenData(true);
      }),

      this.eventHandler.UpdateOnFieldBatsmenEvent$().subscribe(() => {
        this.reAssignBatsmenData();
        this.calculateSR();
      }), // updating on-field batsmen name with new batsmen when a wicket falls

      this.eventHandler.UpdateOnFieldBowlerEvent$().subscribe(() => {
        this.reAssignBowlerData();
        this.calculateEco();
      }),

      this.eventHandler.OverCompleteEvent$().subscribe(() => {
        this.overCompleted = true;
        this.changeDetector.detectChanges();
      })
    );
  }

  public calculateSR(): void {
    this.ELEMENT_DATA_BATSMEN.forEach((batsmen) => {
      batsmen['sr'] = (batsmen['runs'] / batsmen['balls']) * 100;
    });
    this.liveMatchService.striker.strikeRate = this.ELEMENT_DATA_BATSMEN[0].sr;
    this.liveMatchService.nonStriker.strikeRate =
      this.ELEMENT_DATA_BATSMEN[1].sr;
  }
  public calculateEco(): void {
    this.ELEMENT_DATA_BOWLER.forEach((bowler) => {
      bowler['eco'] =
        (bowler['runs'] / this.utilityService.ballplayed(bowler['overs'])) * 6;
    });
    this.liveMatchService.currentBowler.economy =
      this.ELEMENT_DATA_BOWLER[0].eco;
  }

  openStat(playerData: any, type: 'batsman' | 'bowler'): void {
    this.dialog.open(PlayerLiveStatsDialog, {
      data: { type, ...playerData },
      maxWidth: '360px',
      width: '90vw',
    });
  }

  /** Index of the most-recently-bowled ball in an over, for the over-strip's "latest" ring. */
  lastBowledIndex(overData: any[]): number {
    if (!overData) return -1;
    for (let i = overData.length - 1; i >= 0; i--) {
      if (overData[i]?.hasBeenBowled) return i;
    }
    return -1;
  }

  /** Runs-scored-vs-target percentage for the chase progress bar (2nd innings only), clamped to 100. */
  get chaseProgressPct(): number {
    const team =
      this.matchService.teamData[this.matchService.currentRoles['bat']];
    if (!team.targetRuns) return 0;
    return Math.min(100, (team.runsScored / team.targetRuns) * 100);
  }

  reAssignBatsmenData(isSwap: boolean = false) {
    this.ELEMENT_DATA_BATSMEN[0].runs = this.liveMatchService.striker.runs;
    this.ELEMENT_DATA_BATSMEN[0].balls = this.liveMatchService.striker.balls;
    this.ELEMENT_DATA_BATSMEN[0].name =
      this.liveMatchService.striker.name + '*';
    this.ELEMENT_DATA_BATSMEN[0].fours = this.liveMatchService.striker.fours;
    this.ELEMENT_DATA_BATSMEN[0].six = this.liveMatchService.striker.six;
    this.ELEMENT_DATA_BATSMEN[1].runs = this.liveMatchService.nonStriker.runs;
    this.ELEMENT_DATA_BATSMEN[1].balls = this.liveMatchService.nonStriker.balls;
    this.ELEMENT_DATA_BATSMEN[1].name = this.liveMatchService.nonStriker.name;
    this.ELEMENT_DATA_BATSMEN[1].fours = this.liveMatchService.nonStriker.fours;
    this.ELEMENT_DATA_BATSMEN[1].six = this.liveMatchService.nonStriker.six;
    if (isSwap) {
      this.swapSR();
    }
  }

  swapSR(): void {
    let temp: number = this.ELEMENT_DATA_BATSMEN[0].sr;
    this.ELEMENT_DATA_BATSMEN[0].sr = this.ELEMENT_DATA_BATSMEN[1].sr;
    this.ELEMENT_DATA_BATSMEN[1].sr = temp;
  }

  reAssignBowlerData() {
    this.ELEMENT_DATA_BOWLER[0].name = this.liveMatchService.currentBowler.name;
    this.ELEMENT_DATA_BOWLER[0].overs =
      this.liveMatchService.currentBowler.overs;
    this.ELEMENT_DATA_BOWLER[0].runs = this.liveMatchService.currentBowler.runs;
    this.ELEMENT_DATA_BOWLER[0].wickets =
      this.liveMatchService.currentBowler.wickets;
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }
}
