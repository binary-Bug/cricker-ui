import {
  AfterContentChecked,
  Component,
  Input,
  OnChanges,
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
export class ScorecardComponent implements OnChanges, AfterContentChecked {
  constructor(
    public matchService: MatchService,
    public liveMatchService: LiveMatchService
  ) {}

  @Input('isActive') isActive!: boolean;
  @ViewChild('FIBatsmenTable') FIBatsmenTable!: MatTable<Batsmen>;
  @ViewChild('FIBowlerTable') FIBowlerTable!: MatTable<Bowler>;
  @ViewChild('SIBatsmenTable') SIBatsmenTable!: MatTable<Batsmen>;
  @ViewChild('SIBowlerTable') SIBowlerTable!: MatTable<Bowler>;

  _isActive: boolean = false;
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
    'runs',
    'overs',
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

  ngOnChanges(changes: SimpleChanges): void {
    this._isActive = changes['isActive'].currentValue;
  }
  ngAfterContentChecked(): void {
    if (this._isActive) this.renderTableData();
  }
}
