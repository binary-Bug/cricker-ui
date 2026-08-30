import {
  AfterContentChecked,
  Component,
  HostListener,
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
import { MatIconModule } from '@angular/material/icon';
import {
  CdkOverlayOrigin,
  ConnectionPositionPair,
  OverlayModule,
} from '@angular/cdk/overlay';
import { LiveMatchService } from '../../services/live-match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';

import { Pipe, PipeTransform } from '@angular/core';
import { BALL_DATA } from '../../models/ball_data.class';
import { Fielder } from '../../models/fielder.interface';
import { PartnershipService } from '../../services/partnership.service';
import { InningsBreakdown } from '../../models/partnership.interface';
@Pipe({
  name: 'CalculateTotalRunsInOver',
  standalone: true,
  pure: false,
})
export class CalculateTotalRunsInOver implements PipeTransform {
  /**
   * Cumulative match runs as of the last bowled ball at or before
   * `overIndex` (carrying forward through overs with no balls bowled yet).
   * Looking this up directly (rather than the old static-accumulator
   * approach) makes the calculation independent of call order, which is
   * required now that overs can render latest-first and/or only a subset
   * at a time (see ScorecardComponent.getVisibleOvers).
   */
  private cumulativeRunsThrough(overs: BALL_DATA[][], overIndex: number): number {
    for (let i = overIndex; i >= 0; i--) {
      const over = overs[i];
      for (let b = over.length - 1; b >= 0; b--) {
        if (over[b].hasBeenBowled) return over[b].currentRuns ?? 0;
      }
    }
    return 0;
  }

  transform(overs: BALL_DATA[][], index: number): number {
    const current = this.cumulativeRunsThrough(overs, index);
    const previous = index === 0 ? 0 : this.cumulativeRunsThrough(overs, index - 1);
    return current - previous;
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
    MatIconModule,
    OverlayModule,
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

  /**
   * Which innings pill tab is showing. `null` means "follow the match"
   * (mirrors the old accordion's `[expanded]="!isSecondInning"` behavior,
   * so the tab auto-switches to Innings 2 the moment live play reaches it)
   * - once the user manually picks a tab, their choice sticks instead of
   * being fought back to the live innings on the next change-detection.
   */
  private manualInningsSelection: boolean | null = null;
  get showSecondInnings(): boolean {
    return this.manualInningsSelection ?? this.matchService.isSecondInning;
  }
  selectInningsTab(isSecondInnings: boolean): void {
    this.manualInningsSelection = isSecondInnings;
  }

  /** The team currently shown in the sticky mini score header. */
  get currentBattingTeamName(): string {
    const teamKey = this.showSecondInnings
      ? this.SIBattingTeamKey
      : this.FIBattingTeamKey;
    return this.matchService.teamData[teamKey]?.name ?? '';
  }

  /** Touch-friendly fallback for the sticky header's truncated team name -
   * desktop hover already gets the full name via the native `title` tooltip. */
  teamNameTooltipOpen = false;
  toggleTeamNameTooltip(event: Event): void {
    event.stopPropagation();
    this.teamNameTooltipOpen = !this.teamNameTooltipOpen;
  }

  @HostListener('document:click')
  closeTeamNameTooltip(): void {
    this.teamNameTooltipOpen = false;
  }

  /** Lets the batting/bowling tables be tucked away so Overs/Partnerships
   * are reachable without scrolling past both innings' tables. */
  inningsTableCollapsed = false;
  toggleInningsTableCollapsed(): void {
    this.inningsTableCollapsed = !this.inningsTableCollapsed;
  }

  /** Color-codes a batsman's strike rate; no color until they've faced a ball. */
  strikeRateClass(balls: number, strikeRate: number | undefined): string {
    if (!balls) return '';
    const sr = strikeRate ?? 0;
    if (sr >= 130) return 'stat-great';
    if (sr >= 100) return 'stat-decent';
    return 'stat-bad';
  }

  /** Color-codes a bowler's economy; no color until they've bowled a ball. */
  economyClass(overs: number, economy: number | undefined): string {
    if (!overs) return '';
    const eco = economy ?? 0;
    if (eco < 6) return 'stat-great';
    if (eco <= 8) return 'stat-decent';
    return 'stat-bad';
  }

  /** True once at least one innings has real batting data to show, so the
   * loading placeholder can be swapped for actual content. */
  get hasScorecardData(): boolean {
    return (
      (this.matchService.teamData[this.FIBattingTeamKey]?.Batsmens?.length ??
        0) > 0 ||
      (this.matchService.teamData[this.SIBattingTeamKey]?.Batsmens?.length ??
        0) > 0
    );
  }

  /** How many of the most recent overs render eagerly before "Show earlier
   * overs" is needed - keeps a long innings' Overs tab light on first open. */
  readonly oversEagerCount = 3;
  fiShowAllOvers = false;
  siShowAllOvers = false;

  /** Latest-first (optionally capped) view of one team's overs for the Overs tab. */
  getVisibleOvers(
    teamKey: string,
    showAll: boolean
  ): { over: BALL_DATA[]; index: number }[] {
    const overs = this.matchService.teamData[teamKey].oversPlayedData;
    const indexed = overs.map((over, index) => ({ over, index })).reverse();
    return showAll ? indexed : indexed.slice(0, this.oversEagerCount);
  }

  hasHiddenOvers(teamKey: string, showAll: boolean): boolean {
    return (
      !showAll &&
      this.matchService.teamData[teamKey].oversPlayedData.length >
        this.oversEagerCount
    );
  }

  /** Keeps over rows/ball buttons stable across change detection so the
   * ball-tap popover's origin element isn't destroyed out from under it. */
  trackByOverIndex(_index: number, entry: { index: number }): number {
    return entry.index;
  }

  /** The ball currently shown in the tap-to-inspect popover, if any.
   * `onStrike`/`nonStrike`/`bowler`/`runs`/`wicketsLost`/`partnership` are all
   * as they stood BEFORE this ball was bowled - `ball.striker`/
   * `ball.nonStriker`/`ball.currentBowler`/`ball.currentRuns`/
   * `ball.wicketsLost`/`ball.currentPatnership` instead store those values
   * AFTER the delivery. */
  selectedBall: {
    ball: BALL_DATA;
    overIndex: number;
    ballIndex: number;
    onStrike: Batsmen;
    nonStrike: Batsmen;
    bowler: Bowler;
    runs: number;
    wicketsLost: number;
    partnership: { runs: number; balls: number };
  } | null = null;
  selectedBallOrigin: CdkOverlayOrigin | null = null;
  /** Ordered fallbacks so the popover stays anchored to the tapped ball even
   * near the left/right edges of the screen, instead of the CDK "push"
   * fallback shoving it far away when a centered position doesn't fit. */
  readonly ballPopoverPositions: ConnectionPositionPair[] = [
    { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 },
    { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -6 },
    { originX: 'end', originY: 'top', overlayX: 'end', overlayY: 'bottom', offsetY: -6 },
    { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 6 },
    { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 6 },
    { originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 6 },
  ];

  /** Walks backwards from (overIndex, ballIndex) to the previous bowled ball
   * in this innings and returns the pre-ball state for the tapped ball -
   * i.e. the batting pair, score and partnership as they stood right before
   * it was bowled. Strikers require an extra swap when crossing an over
   * boundary, since ends always rotate once more regardless of the last
   * ball's runs (see ScoringActionsComponent.checkForOverCompletion's
   * unconditional swapStriker() call, which isn't itself written into any
   * ball snapshot) - runs/wickets/partnership need no such adjustment, they
   * carry over as-is. Falls back to zeroed score/partnership and the
   * innings' original opening pair (Batsmens[0]/[1], added in strike/
   * non-strike order before the first ball is ever bowled - see
   * NewMatchDetailsComponent.openCurrentPlayerDialog() and
   * LiveMatchService.handleEndInningsDialog()) when it's the very first
   * bowled ball of the innings, since the tapped ball's own striker/
   * nonStriker fields store the POST-ball pair, not the pre-ball one. */
  private getPreBallBatsmen(
    teamKey: string,
    overIndex: number,
    ballIndex: number
  ): {
    onStrike: Batsmen;
    nonStrike: Batsmen;
    runs: number;
    wicketsLost: number;
    partnership: { runs: number; balls: number };
  } {
    const overs = this.matchService.teamData[teamKey].oversPlayedData;
    for (let oi = overIndex; oi >= 0; oi--) {
      const over = overs[oi];
      const startBi = oi === overIndex ? ballIndex - 1 : over.length - 1;
      for (let bi = startBi; bi >= 0; bi--) {
        if (over[bi].hasBeenBowled) {
          const crossedOverBoundary = oi !== overIndex;
          const strikers = crossedOverBoundary
            ? { onStrike: over[bi].nonStriker, nonStrike: over[bi].striker }
            : { onStrike: over[bi].striker, nonStrike: over[bi].nonStriker };
          return {
            ...strikers,
            runs: over[bi].currentRuns,
            wicketsLost: over[bi].wicketsLost,
            partnership: { ...over[bi].currentPatnership },
          };
        }
      }
    }
    const openers = this.matchService.teamData[teamKey].Batsmens;
    return {
      onStrike: { name: openers[0].name, runs: 0, balls: 0, fours: 0, six: 0, status: 'Not Out' },
      nonStrike: { name: openers[1].name, runs: 0, balls: 0, fours: 0, six: 0, status: 'Not Out' },
      runs: 0,
      wicketsLost: 0,
      partnership: { runs: 0, balls: 0 },
    };
  }

  /** Walks backwards from (overIndex, ballIndex) for the bowler's pre-ball
   * figures. Within the same over the bowler doesn't change, so the previous
   * ball's post-ball `currentBowler` snapshot is already the correct
   * pre-current-ball figure. For the first ball of an over, that same
   * bowler may have last bowled several overs earlier (or never before), so
   * this searches backwards across all earlier overs for that bowler's most
   * recent bowled ball, matched by name. */
  private getPreBallBowler(
    teamKey: string,
    overIndex: number,
    ballIndex: number
  ): Bowler {
    const overs = this.matchService.teamData[teamKey].oversPlayedData;
    const bowlerName = overs[overIndex][ballIndex].currentBowler.name;

    for (let bi = ballIndex - 1; bi >= 0; bi--) {
      if (overs[overIndex][bi].hasBeenBowled) {
        const bowler = overs[overIndex][bi].currentBowler;
        return { ...bowler, extras: { ...bowler.extras } };
      }
    }

    for (let oi = overIndex - 1; oi >= 0; oi--) {
      const over = overs[oi];
      for (let bi = over.length - 1; bi >= 0; bi--) {
        if (over[bi].hasBeenBowled && over[bi].currentBowler.name === bowlerName) {
          const bowler = over[bi].currentBowler;
          return { ...bowler, extras: { ...bowler.extras } };
        }
      }
    }

    return {
      name: bowlerName,
      runs: 0,
      overs: 0,
      maidens: 0,
      wickets: 0,
      extras: { w: 0, nb: 0, lb: 0 },
    };
  }

  openBallDetail(
    origin: CdkOverlayOrigin,
    ball: BALL_DATA,
    overIndex: number,
    ballIndex: number,
    teamKey: string
  ): void {
    if (!ball.hasBeenBowled) return;
    if (this.selectedBall?.ball === ball) {
      this.closeBallDetail();
      return;
    }
    this.selectedBallOrigin = origin;
    this.selectedBall = {
      ball,
      overIndex,
      ballIndex,
      ...this.getPreBallBatsmen(teamKey, overIndex, ballIndex),
      bowler: this.getPreBallBowler(teamKey, overIndex, ballIndex),
    };
  }

  closeBallDetail(): void {
    this.selectedBall = null;
    this.selectedBallOrigin = null;
  }

  /** Human-readable outcome line for the ball-detail popover. */
  ballOutcomeText(ball: BALL_DATA): string {
    const label = (ball.label || '').trim();
    if (ball.class === 'four') return 'FOUR';
    if (ball.class === 'six') return 'SIX';
    if (ball.class === 'wicket') return 'WICKET';
    if (ball.class === 'dot') return 'Dot ball';
    if (label.endsWith('wd')) return `Wide + ${label.replace('wd', '') || '0'} run(s)`;
    if (label.endsWith('nb')) return `No ball + ${label.replace('nb', '') || '0'} run(s)`;
    if (label.endsWith(' LB')) return `${label.replace(' LB', '')} leg bye(s)`;
    if (label.endsWith(' PR')) return `${label.replace(' PR', '')} penalty run(s)`;
    if (label.endsWith(' B')) return `${label.replace(' B', '')} bye(s)`;
    return label ? `${label} run(s)` : '-';
  }

  /** Fielders with at least one catch/run-out/stumping, for the fielding strip. */
  getActiveFielders(teamKey: string): Fielder[] {
    return (this.matchService.teamData[teamKey]?.Fielders ?? []).filter(
      (f) => f.catches || f.runOuts || f.stumpOuts
    );
  }

  /** Total 4s/6s hit in an innings, summed from the batsmen table. */
  boundaryCounts(teamKey: string): { fours: number; sixes: number } {
    const batsmen = this.matchService.teamData[teamKey]?.Batsmens ?? [];
    return batsmen.reduce(
      (totals, b) => {
        totals.fours += b.fours ?? 0;
        totals.sixes += b.six ?? 0;
        return totals;
      },
      { fours: 0, sixes: 0 }
    );
  }

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
    // Only the active innings pill tab's tables actually exist in the DOM
    // (the other pair is *ngIf-removed, not just hidden), so this must be
    // null-safe rather than assuming all 4 ViewChilds are always present.
    this.FIBatsmenTable?.renderRows();
    this.FIBowlerTable?.renderRows();
    this.SIBatsmenTable?.renderRows();
    this.SIBowlerTable?.renderRows();
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
}
