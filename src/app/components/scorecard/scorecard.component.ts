import {
  AfterContentChecked,
  Component,
  Input,
  OnChanges,
  OnDestroy,
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
import { EventHandlerService } from '../../services/event-handler.service';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Subscription } from 'rxjs';

import { Pipe, PipeTransform } from '@angular/core';
import { BALL_DATA } from '../../models/ball_data.class';
import { PartnershipService } from '../../services/partnership.service';
import { InningsBreakdown } from '../../models/partnership.interface';
@Pipe({
  name: 'CalculateTotalRunsInOver',
  standalone: true,
  pure: false,
})
export class CalculateTotalRunsInOver implements PipeTransform {
  public static previousOverRuns: number = 0;
  transform(over: BALL_DATA[], index: number): number {
    if (index === 0) CalculateTotalRunsInOver.previousOverRuns = 0;

    let value = over.filter((ball) => ball.hasBeenBowled)[
      over.filter((ball) => ball.hasBeenBowled).length - 1
    ]?.currentRuns;

    if (value === undefined || value === null || value === 0) {
      CalculateTotalRunsInOver.previousOverRuns = 0;
      return 0;
    }
    let returnVal = value - CalculateTotalRunsInOver.previousOverRuns;
    CalculateTotalRunsInOver.previousOverRuns = value;
    return returnVal;
  }
}

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
    CalculateTotalRunsInOver,
  ],
  templateUrl: './scorecard.component.html',
  styleUrl: './scorecard.component.css',
})
export class ScorecardComponent
  implements OnInit, OnChanges, AfterContentChecked, OnDestroy
{
  constructor(
    public matchService: MatchService,
    public liveMatchService: LiveMatchService,
    private eventHandlerService: EventHandlerService,
    private partnershipService: PartnershipService
  ) {}
  private subscriptions: Subscription[] = [];

  @Input('isActive') isActive!: boolean;
  @ViewChild('FIBatsmenTable') FIBatsmenTable!: MatTable<Batsmen>;
  @ViewChild('FIBowlerTable') FIBowlerTable!: MatTable<Bowler>;
  @ViewChild('SIBatsmenTable') SIBatsmenTable!: MatTable<Batsmen>;
  @ViewChild('SIBowlerTable') SIBowlerTable!: MatTable<Bowler>;

  _isActive: boolean = false;
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

  /**
   * Fall of Wickets + Partnerships breakdown for one team's innings, fully
   * derived from ball-by-ball data (see PartnershipService) - works the
   * same whether this is a live in-progress innings or a historical match
   * loaded from Firestore. Recomputed on every call (cheap - an innings is
   * at most a couple hundred balls), so it stays correct across Undo.
   */
  inningsBreakdown(teamKey: string): InningsBreakdown {
    return this.partnershipService.getInningsBreakdown(
      this.matchService.teamData[teamKey]
    );
  }

  /** Formats a 1-based wicket number as an ordinal, e.g. 1 -> "1st", 2 -> "2nd". */
  ordinal(n: number): string {
    const suffixes: { [key: string]: string } = {
      one: 'st',
      two: 'nd',
      few: 'rd',
    };
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return n + 'th';
    switch (n % 10) {
      case 1:
        return n + suffixes['one'];
      case 2:
        return n + suffixes['two'];
      case 3:
        return n + suffixes['few'];
      default:
        return n + 'th';
    }
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
    // Match data loading itself is now triggered by MatchDetailsComponent
    // (the always-eagerly-created parent), not here - this component may
    // be constructed lazily (see the Score Card tab's matTabContent in
    // match-details.component.html) well after that load has already
    // finished, or well before it via the 'live' route's own flow, so it
    // just reacts: populate immediately from whatever's already on
    // MatchService, then again whenever a load completes.
    this.populateDataFromMatchService();
    this.subscriptions.push(
      this.eventHandlerService.MatchLoadCompleteEvent$().subscribe(() => {
        this.populateDataFromMatchService();
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => sub.unsubscribe());
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
