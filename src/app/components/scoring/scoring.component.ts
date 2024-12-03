import {
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
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { UtilityService } from '../../services/utility.service';

@Component({
  selector: 'app-scoring',
  standalone: true,
  imports: [
    MatTableModule,
    CommonModule,
    ScoringActionsComponent,
    MatButtonModule,
  ],
  templateUrl: './scoring.component.html',
  styleUrl: './scoring.component.css',
})
export class ScoringComponent implements OnInit, OnDestroy {
  @ViewChild('overView') overView: ElementRef<HTMLDivElement> | undefined;
  subscriptions: Subscription[] = [];
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  utilityService: UtilityService = inject(UtilityService);
  matchService: MatchService = inject(MatchService);
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

  overCompleted: boolean = true;

  ngOnInit(): void {
    this.calculateSR();
    this.calculateEco();
    this.subscriptions.push(
      this.eventHandler.RunAddedEvent$().subscribe(() => {
        this.reAssignBatsmenData();
        this.calculateSR();
        this.reAssignBowlerData();
        this.calculateEco();

        if (
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed -
            Math.trunc(
              this.matchService.teamData[this.matchService.currentRoles['bat']]
                .oversPlayed
            ) ===
          0
        ) {
          this.overCompleted = true;
        } else {
          this.overCompleted = false;
        }
      }),

      this.eventHandler.BatsmenSwapEvent$().subscribe(() => {
        this.reAssignBatsmenData(true);
      }),

      this.eventHandler.UpdateOnFieldBatsmenEvent$().subscribe(() => {
        this.reAssignBatsmenData();
        this.calculateSR();
      }), // updating on-field batsmen name with new batsmen when a wicket falls

      this.eventHandler
        .UpdateOverViewGridEvent$()
        .subscribe((isRemove: boolean) => {
          if (isRemove) {
            this.overView?.nativeElement.classList.remove(
              'grid-cols-' + this.liveMatchService.totalBallsinCurrentOver
            );
          } else {
            this.overView?.nativeElement.classList.add(
              'grid-cols-' + this.liveMatchService.totalBallsinCurrentOver
            );
          }
        })
    );
  }

  public calculateSR(): void {
    this.ELEMENT_DATA_BATSMEN.forEach((batsmen) => {
      batsmen['sr'] = (batsmen['runs'] / batsmen['balls']) * 100;
    });
  }
  public calculateEco(): void {
    this.ELEMENT_DATA_BOWLER.forEach((bowler) => {
      bowler['eco'] =
        (bowler['runs'] / this.utilityService.ballplayed(bowler['overs'])) * 6;
    });
  }

  openStat(player: string): void {
    console.log(player);
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
