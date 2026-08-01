import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { LiveMatchService } from '../../services/live-match.service';
import { MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { ScoringActionsComponent } from '../scoring-actions/scoring-actions.component';
import { MatButtonModule } from '@angular/material/button';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { UtilityService } from '../../services/utility.service';
import { PartnershipService } from '../../services/partnership.service';
import { InningsBreakdown } from '../../models/partnership.interface';

@Component({
  selector: 'app-scoring',
  standalone: true,
  imports: [
    MatTableModule,
    CommonModule,
    ScoringActionsComponent,
    MatButtonModule,
    MatExpansionModule,
  ],
  templateUrl: './scoring.component.html',
  styleUrl: './scoring.component.css',
})
export class ScoringComponent implements OnInit, OnDestroy {
  private changeDetector: ChangeDetectorRef = inject(ChangeDetectorRef);
  @ViewChild('overView') overView: ElementRef<HTMLDivElement> | undefined;
  trackByIndex = (index: number) => index;
  subscriptions: Subscription[] = [];
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  utilityService: UtilityService = inject(UtilityService);
  matchService: MatchService = inject(MatchService);
  partnershipService: PartnershipService = inject(PartnershipService);
  displayedColumns: string[] = ['nameBat', 'runs', 'balls', 'S/R', '4s', '6s'];
  displayedColumnsBowler: string[] = [
    'nameBowl',
    'runs',
    'overs',
    'wickets',
    'eco',
  ];
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

  dataSourceBatsmen = this.ELEMENT_DATA_BATSMEN;
  dataSourceBowler = this.ELEMENT_DATA_BOWLER;

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

  openStat(player: string): void {
    console.log(player);
  }

  /**
   * Fall of Wickets + Partnerships breakdown for the currently batting team,
   * fully derived from ball-by-ball data (see PartnershipService/
   * scorecard.component.ts, which uses the same method) - recomputed on
   * every read so it updates ball-by-ball automatically and stays correct
   * across Undo.
   */
  get currentInningsBreakdown(): InningsBreakdown {
    return this.partnershipService.getInningsBreakdown(
      this.matchService.teamData[this.matchService.currentRoles['bat']]
    );
  }

  /** Formats a 1-based wicket number as an ordinal, e.g. 1 -> "1st", 2 -> "2nd". */
  ordinal(n: number): string {
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + 'th';
    switch (n % 10) {
      case 1:
        return n + 'st';
      case 2:
        return n + 'nd';
      case 3:
        return n + 'rd';
      default:
        return n + 'th';
    }
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
