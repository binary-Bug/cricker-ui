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
          this.eventHandlerService.NotifyMatchLoadCompleteEvent();
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
}
