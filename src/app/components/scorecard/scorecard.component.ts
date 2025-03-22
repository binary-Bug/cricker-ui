import {
  AfterContentChecked,
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchService } from '../../services/match.service';
import { MatTable, MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { Batsmen } from '../../models/batsmen.interface';
import { Bowler } from '../../models/bowler.interface';
import { MatAccordion, MatExpansionModule } from '@angular/material/expansion';
import { MatTabsModule } from '@angular/material/tabs';
import { LiveMatchService } from '../../services/live-match.service';
import { ActivatedRoute } from '@angular/router';
import { LoadMatchService } from '../../services/load-match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-scorecard',
  standalone: true,
  imports: [
    CommonModule,
    MatTableModule,
    MatButtonModule,
    MatAccordion,
    MatExpansionModule,
    MatTabsModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './scorecard.component.html',
  styleUrl: './scorecard.component.css',
})
export class ScorecardComponent
  implements OnInit, OnChanges, AfterContentChecked
{
  constructor(
    public matchService: MatchService,
    public liveMatchService: LiveMatchService,
    private route: ActivatedRoute,
    private loadMatchService: LoadMatchService,
    private eventHandlerService: EventHandlerService
  ) {}

  @Input('isActive') isActive!: boolean;
  @ViewChild('FIBatsmenTable') FIBatsmenTable!: MatTable<Batsmen>;
  @ViewChild('FIBowlerTable') FIBowlerTable!: MatTable<Bowler>;
  @ViewChild('SIBatsmenTable') SIBatsmenTable!: MatTable<Batsmen>;
  @ViewChild('SIBowlerTable') SIBowlerTable!: MatTable<Bowler>;

  _isActive: boolean = false;
  isLoad: boolean = false;
  isOversPanelExpanded: boolean = false;
  FIBattingTeamKey: string = this.matchService.currentRoles['bat'];
  SIBattingTeamKey: string = this.matchService.currentRoles['ball'];
  fiDataSourceBatsmen =
    this.matchService.teamData[this.FIBattingTeamKey].Batsmens;
  fiDataSourceBowler =
    this.matchService.teamData[this.SIBattingTeamKey].Bowlers;
  siDataSourceBatsmen =
    this.matchService.teamData[this.SIBattingTeamKey].Batsmens;
  siDataSourceBowler =
    this.matchService.teamData[this.FIBattingTeamKey].Bowlers;

  displayedColumns: string[] = ['nameBat', 'runs', 'balls', 'S/R', '4s', '6s'];
  displayedColumnsBowler: string[] = [
    'nameBowl',
    'overs',
    'runs',
    'wickets',
    'eco',
  ];

  openStat(player: string): void {
    console.log(player);
  }

  renderTableData(): void {
    this.FIBatsmenTable!.renderRows();
    this.FIBowlerTable!.renderRows();
    this.SIBatsmenTable!.renderRows();
    this.SIBowlerTable!.renderRows();
  }

  populateDataFromMatchService(): void {
    this.FIBattingTeamKey = this.matchService.currentRoles['bat'];
    this.SIBattingTeamKey = this.matchService.currentRoles['ball'];

    this.fiDataSourceBatsmen =
      this.matchService.teamData[this.FIBattingTeamKey].Batsmens;
    this.fiDataSourceBowler =
      this.matchService.teamData[this.SIBattingTeamKey].Bowlers;
    this.siDataSourceBatsmen =
      this.matchService.teamData[this.SIBattingTeamKey].Batsmens;
    this.siDataSourceBowler =
      this.matchService.teamData[this.FIBattingTeamKey].Bowlers;
  }

  async ngOnInit(): Promise<void> {
    this.route.url.subscribe((url) => {
      if (url[0].path === 'match-details') {
        this.route.queryParams.subscribe(async (qp) => {
          this.isLoad = true;
          console.log('loading');
          await this.loadMatchService.loadMatch(qp['id']);
          console.log('loaded');
          this.populateDataFromMatchService();
        });
      }
    });
    this.populateDataFromMatchService();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this._isActive = changes['isActive'].currentValue;
  }
  ngAfterContentChecked(): void {
    if (this._isActive) this.renderTableData();
  }
  toggleTab(event: any): void {
    this.handleOnToggleEvent(event.index);
  }

  oversPanelHeaderClicked(isOversPanel: boolean): void {
    if (isOversPanel) {
      this.isOversPanelExpanded = !this.isOversPanelExpanded;
      if (this.isOversPanelExpanded) {
        setTimeout(() => {
          let ot1 = document.getElementById('mat-tab-content-over-team1');
          if (ot1) {
            ot1.style.display = 'grid';
          }

          let ot1spinner = document.getElementById('oversTab1Spinner');
          if (ot1spinner) {
            ot1spinner.style.display = 'none';
          }

          let ot2 = document.getElementById('mat-tab-content-over-team2');
          if (ot2) {
            ot2.style.display = 'grid';
          }

          let ot2spinner = document.getElementById('oversTab2Spinner');
          if (ot2spinner) {
            ot2spinner.style.display = 'none';
          }
        }, 600);
      } else {
        let ot1 = document.getElementById('mat-tab-content-over-team1');
        if (ot1) {
          ot1.style.display = 'none';
        }
        let ot1spinner = document.getElementById('oversTab1Spinner');
        if (ot1spinner) {
          ot1spinner.style.display = 'block';
        }

        let ot2 = document.getElementById('mat-tab-content-over-team2');
        if (ot2) {
          ot2.style.display = 'none';
        }
        let ot2spinner = document.getElementById('oversTab2Spinner');
        if (ot2spinner) {
          ot2spinner.style.display = 'block';
        }
      }
    } else {
      if (this.isOversPanelExpanded) {
        this.isOversPanelExpanded = false;
        let ot1 = document.getElementById('mat-tab-content-over-team1');
        if (ot1) {
          ot1.style.display = 'none';
        }
        let ot1spinner = document.getElementById('oversTab1Spinner');
        if (ot1spinner) {
          ot1spinner.style.display = 'block';
        }

        let ot2 = document.getElementById('mat-tab-content-over-team2');
        if (ot2) {
          ot2.style.display = 'none';
        }
        let ot2spinner = document.getElementById('oversTab2Spinner');
        if (ot2spinner) {
          ot2spinner.style.display = 'block';
        }
      }
    }
  }

  handleOnToggleEvent(index: number): void {
    if (index === 1) {
      let ot1 = document.getElementById('mat-tab-content-over-team1');
      if (ot1) {
        ot1.style.display = 'none';
      }
      let ot1spinner = document.getElementById('oversTab1Spinner');
      if (ot1spinner) {
        ot1spinner.style.display = 'block';
      }
      setTimeout(() => {
        let ot2 = document.getElementById('mat-tab-content-over-team2');
        if (ot2) {
          ot2.style.display = 'grid';
        }

        let ot2spinner = document.getElementById('oversTab2Spinner');
        if (ot2spinner) {
          ot2spinner.style.display = 'none';
        }
      }, 600);
    } else {
      let ot2 = document.getElementById('mat-tab-content-over-team2');
      if (ot2) {
        ot2.style.display = 'none';
      }
      let ot2spinner = document.getElementById('oversTab2Spinner');
      if (ot2spinner) {
        ot2spinner.style.display = 'block';
      }
      setTimeout(() => {
        let ot1 = document.getElementById('mat-tab-content-over-team1');
        if (ot1) {
          ot1.style.display = 'grid';
        }

        let ot1spinner = document.getElementById('oversTab1Spinner');
        if (ot1spinner) {
          ot1spinner.style.display = 'none';
        }
      }, 600);
    }
  }
}
