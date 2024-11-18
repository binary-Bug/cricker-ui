import {
  Component,
  ElementRef,
  inject,
  OnInit,
  ViewChild,
} from '@angular/core';
import { LiveMatchService } from '../../services/live-match.service';
import { MatTableModule } from '@angular/material/table';
import { CommonModule } from '@angular/common';
import { ScoringActionsComponent } from '../scoring-actions/scoring-actions.component';
import { MatButtonModule } from '@angular/material/button';
import { MatchService } from '../../services/match.service';

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
export class ScoringComponent implements OnInit {
  @ViewChild('overView') overView: ElementRef<HTMLDivElement> | undefined;
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  matchService: MatchService = inject(MatchService);
  displayedColumns: string[] = ['nameBat', 'runs', 'balls', 'S/R'];
  displayedColumnsBowler: string[] = [
    'nameBowl',
    'runs',
    'overs',
    'wickets',
    'eco',
  ];
  ELEMENT_DATA_BATSMEN: any[] = [
    {
      name: this.liveMatchService.striker.name,
      runs: this.liveMatchService.striker.runs,
      balls: this.liveMatchService.striker.balls,
    },
    {
      name: this.liveMatchService.nonStriker.name,
      runs: this.liveMatchService.nonStriker.runs,
      balls: this.liveMatchService.nonStriker.balls,
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

  ngOnInit(): void {
    this.calculateSR();
    this.calculateEco();
  }

  public calculateSR(): void {
    this.ELEMENT_DATA_BATSMEN.forEach((batsmen) => {
      batsmen['sr'] = (batsmen['runs'] / batsmen['balls']) * 100;
    });
  }
  public calculateEco(): void {
    this.ELEMENT_DATA_BOWLER.forEach((bowler) => {
      bowler['eco'] = bowler['runs'] / bowler['overs'];
    });
  }

  openStat(player: string): void {
    console.log(player);
  }
}
