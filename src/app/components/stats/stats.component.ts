import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { FormsModule, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTable, MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { Player } from '../../models/player.interface';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { UtilityService } from '../../services/utility.service';
import { MatDialog } from '@angular/material/dialog';
import { MvpCalculatorService } from '../../services/mvp-calculator.service';
import { MvpHelpDialog } from '../dailogs/mvp-help.dialog';
import { SpinnerService } from '../../services/spinner.service';

interface StatType {
  value: string;
  label: string;
  icon: string;
}

/** One "Sort by" chip offered above the table for the current category - drives the same MatSort the column headers use. */
interface SortOption {
  id: string;
  label: string;
}

/** One "Leaders" spotlight card - the top player for a single headline metric, respecting the min-matches filter. */
interface LeaderCard {
  label: string;
  icon: string;
  accent: 'role' | 'won' | 'mom';
  player: IPlayer | null;
  value: string;
}

interface IPlayer extends Player {
  sr: number;
  eco: number;
  /** mvpPoints / matchesPlayed, computed at runtime (see calculateAvgMvpPoints) - not persisted, since it's trivially derived from two fields already on the player doc. */
  avgMvpPoints: number;
  /** won / (won + lost) as a percentage, computed at runtime (see calculateWinPercent) - 0 for players with no decided matches yet. */
  winPercent: number;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatInputModule,
    MatTableModule,
    MatSortModule,
    MatIconModule,
  ],
  templateUrl: './stats.component.html',
  styleUrl: './stats.component.css',
})
export class StatsComponent implements OnInit {
  public playersData: IPlayer[] = [];

  selectedValue: string = 'overview';
  statTypes: StatType[] = [
    { value: 'overview', label: 'Overview', icon: 'leaderboard' },
    { value: 'batting', label: 'Batting', icon: 'sports_cricket' },
    { value: 'bowling', label: 'Bowling', icon: 'sports_baseball' },
    { value: 'fielding', label: 'Fielding', icon: 'front_hand' },
    { value: 'mvp', label: 'MVP', icon: 'military_tech' },
  ];

  /**
   * Overview columns surface Player fields that were tracked in Firestore
   * but never actually shown anywhere on this page before (won/lost/
   * winPercent, bestMvpPoints) - see /memories/session/plan.md.
   */
  overviewColumns: string[] = [
    'rank',
    'name',
    'matchesPlayed',
    'won',
    'lost',
    'winPercent',
    'mvpPoints',
    'momCount',
    'bestMvpPoints',
  ];

  battingnColumns: string[] = [
    'rank',
    'name',
    'matchesPlayed',
    'runsScored',
    'highestScore',
    'sr',
    'fours',
    'sixes',
    'ballsPlayed',
  ];

  bowlingColumns: string[] = [
    'rank',
    'name',
    'matchesPlayed',
    'wickets',
    'overs',
    'eco',
    'bbi',
    'maidens',
    'runsAgainst',
  ];

  fieldingColumns: string[] = [
    'rank',
    'name',
    'matchesPlayed',
    'catches',
    'runOuts',
    'stumpOuts',
  ];

  /**
   * Leaderboard columns for the MVP stat type - lifetime totals, not per-match.
   * avgMvpPoints is listed right after matchesPlayed (before the raw
   * mvpPoints total) since it's the default/highest-priority sort for this
   * stat type - see statTypeChanged().
   */
  mvpColumns: string[] = [
    'rank',
    'name',
    'matchesPlayed',
    'avgMvpPoints',
    'mvpPoints',
    'momCount',
  ];

  displayedColumns: string[] = this.overviewColumns;
  dataSource: MatTableDataSource<IPlayer> = new MatTableDataSource(
    this.playersData
  );

  /** "Sort by" chips shown above the table, per selected category - see applySort(). */
  sortOptionsByCategory: Record<string, SortOption[]> = {
    overview: [
      { id: 'winPercent', label: 'Win %' },
      { id: 'mvpPoints', label: 'MVP Points' },
      { id: 'momCount', label: 'MoM' },
      { id: 'matchesPlayed', label: 'Matches' },
    ],
    batting: [
      { id: 'runsScored', label: 'Runs' },
      { id: 'sr', label: 'S/R' },
      { id: 'highestScore', label: 'H/S' },
    ],
    bowling: [
      { id: 'wickets', label: 'Wickets' },
      { id: 'eco', label: 'Economy' },
    ],
    fielding: [
      { id: 'catches', label: 'Catches' },
      { id: 'runOuts', label: 'Run Outs' },
      { id: 'stumpOuts', label: 'Stumpings' },
    ],
    mvp: [
      { id: 'avgMvpPoints', label: 'Avg MVP' },
      { id: 'mvpPoints', label: 'MVP Points' },
      { id: 'momCount', label: 'MoM' },
    ],
  };

  get sortOptions(): SortOption[] {
    return this.sortOptionsByCategory[this.selectedValue] ?? [];
  }

  /** Quick-glance top performers, always shown regardless of the selected category - see computeLeaders(). */
  leaders: LeaderCard[] = [];
  /** Resets to expanded every page load - no persistence, keeps this simple. */
  leadersCollapsed = false;
  /** CSS-only fullscreen+rotate overlay for the table - see toggleTableFullscreen(). */
  isTableFullscreen = false;

  searchTerm = new FormControl('');
  /** Chip toggle: 0 = "All", otherwise a minimum matchesPlayed threshold - keeps rate stats (S/R, Economy, Win %) from being skewed by 1-match samples. */
  minMatches = new FormControl<number>(0);
  minMatchesOptions = [
    { value: 0, label: 'All' },
    { value: 3, label: '3+' },
    { value: 5, label: '5+' },
    { value: 10, label: '10+' },
  ];

  // static: true because the <table matSort> is not behind any *ngIf/*ngFor,
  // so it's safe to resolve this before ngOnInit. This matters because
  // PlayerService caches players after the first fetch - on a cached load
  // (e.g. navigating stats -> player-details -> back to stats) the
  // getAllPlayers() promise below resolves almost instantly, which could
  // otherwise race ahead of the default (non-static) ViewChild resolution
  // (normally populated in ngAfterViewInit), leaving dataSource.sort
  // assigned as undefined and silently falling back to unsorted (raw
  // Firestore-order) data.
  @ViewChild(MatSort, { static: true }) sort!: MatSort;
  @ViewChild(MatTable) matTableRef!: MatTable<IPlayer>;
  @ViewChild('tableScroll') tableScrollEl!: ElementRef<HTMLDivElement>;

  constructor(
    public playerService: PlayerService,
    public router: Router,
    public utilityService: UtilityService,
    private mvpCalculatorService: MvpCalculatorService,
    private dialog: MatDialog,
    private spinnerService: SpinnerService
  ) {
    // Only wrap the genuine cold fetch in the global spinner - if the
    // roster is already cached (e.g. /allPlayers was visited first this
    // session), this resolves instantly and must not flash the overlay.
    const isColdFetch = this.playerService.players.length === 0;
    const fetch = playerService.getAllPlayers();
    const tracked = isColdFetch ? this.spinnerService.wrap(fetch) : fetch;
    tracked.then((players) => {
      this.playersData = players as any;

      this.calculateSR();
      this.calculateEco();
      this.calculateAvgMvpPoints();
      this.calculateWinPercent();
      this.dataSource = new MatTableDataSource(this.playersData);
      this.dataSource.sort = this.sort;
      this.applyFilters();
      this.computeLeaders();
      this.refreshTableLayout();
    });

    this.searchTerm.valueChanges.subscribe(() => this.applyFilters());
    this.minMatches.valueChanges.subscribe(() => {
      this.applyFilters();
      this.computeLeaders();
    });
  }

  ngOnInit(): void {
    // Restore the previously selected stat type (if any) so returning to
    // this page (e.g. from player-details) keeps the user's selection
    // instead of resetting to the 'overview' default.
    this.selectedValue = this.playerService.lastSelectedStatType;
    this.statTypeChanged();
  }

  /**
   * Rebuilds dataSource.data from the full roster by applying BOTH the
   * search term and the min-matches threshold together. MatTableDataSource's
   * built-in `.filter` only supports a single filter string, which can't
   * express two independent constraints - so both are applied here instead
   * and the result is assigned directly to `.data` (sort stays attached and
   * re-applies automatically).
   */
  applyFilters(): void {
    const term = (this.searchTerm.value ?? '').trim().toLowerCase();
    const min = this.minMatches.value ?? 0;
    this.dataSource.data = this.playersData.filter(
      (player) =>
        player.matchesPlayed >= min &&
        player.name.toLowerCase().includes(term)
    );
    this.refreshTableLayout();
  }

  calculateSR(): void {
    this.playersData.forEach((player) => {
      if (player.ballsPlayed > 0) {
        player.sr = (player.runsScored / player.ballsPlayed) * 100;
      } else {
        player.sr = 0;
      }
    });
  }

  calculateEco(): void {
    this.playersData.forEach((player) => {
      if (player.overs > -1) {
        player.eco =
          (player.runsAgainst / this.utilityService.ballplayed(player.overs)) *
          6;
      } else {
        player.eco = 0;
      }
    });
  }

  /** mvpPoints / matchesPlayed - guards against divide-by-zero for players with no matches yet. */
  calculateAvgMvpPoints(): void {
    this.playersData.forEach((player) => {
      player.avgMvpPoints = player.matchesPlayed
        ? (player.mvpPoints ?? 0) / player.matchesPlayed
        : 0;
    });
  }

  /** won / (won + lost) as a percentage - guards against divide-by-zero for players with no decided (win/loss) matches yet, e.g. all ties or no matches played. */
  calculateWinPercent(): void {
    this.playersData.forEach((player) => {
      const decided = (player.won ?? 0) + (player.lost ?? 0);
      player.winPercent = decided ? ((player.won ?? 0) / decided) * 100 : 0;
    });
  }

  /**
   * Top player for each headline metric (Most Runs/Wickets/Best Win %/Most
   * MoM), computed once here rather than in the template so it isn't
   * re-derived on every change-detection cycle. Only considers players
   * meeting the current min-matches threshold, same as the table below.
   */
  computeLeaders(): void {
    const min = this.minMatches.value ?? 0;
    const pool = this.playersData.filter((p) => p.matchesPlayed >= min);
    const topBy = (metric: (p: IPlayer) => number): IPlayer | null =>
      pool.reduce<IPlayer | null>(
        (best, p) => (!best || metric(p) > metric(best) ? p : best),
        null
      );

    const mostRuns = topBy((p) => p.runsScored);
    const mostWickets = topBy((p) => p.wickets);
    const bestWinPercent = topBy((p) => p.winPercent);
    const mostMom = topBy((p) => p.momCount);

    this.leaders = [
      {
        label: 'Most Runs',
        icon: 'sports_cricket',
        accent: 'role',
        player: mostRuns,
        value: mostRuns ? `${mostRuns.runsScored}` : '-',
      },
      {
        label: 'Most Wickets',
        icon: 'sports_baseball',
        accent: 'role',
        player: mostWickets,
        value: mostWickets ? `${mostWickets.wickets}` : '-',
      },
      {
        label: 'Best Win %',
        icon: 'emoji_events',
        accent: 'won',
        player: bestWinPercent,
        value: bestWinPercent ? `${bestWinPercent.winPercent.toFixed(0)}%` : '-',
      },
      {
        label: 'Most MoM',
        icon: 'military_tech',
        accent: 'mom',
        player: mostMom,
        value: mostMom ? `${mostMom.momCount}` : '-',
      },
    ];
  }

  statTypeChanged(): void {
    this.playerService.lastSelectedStatType = this.selectedValue;
    if (this.selectedValue === 'overview') {
      this.applyDefaultSort('winPercent');
    } else if (this.selectedValue === 'batting') {
      this.applyDefaultSort('runsScored');
    } else if (this.selectedValue === 'bowling') {
      this.applyDefaultSort('wickets');
    } else if (this.selectedValue === 'fielding') {
      this.applyDefaultSort('catches');
    } else if (this.selectedValue === 'mvp') {
      // Default/highest-priority sort is avgMvpPoints (not the raw lifetime
      // total), but users can still manually re-sort by mvpPoints or momCount.
      this.applyDefaultSort('avgMvpPoints');
    }
    this.refreshTableLayout();
  }

  /** Applies a sort AND moves that column next to Name - shared by the per-category default (statTypeChanged) and the "Sort by" chips (applySort), so both stay consistent. */
  private applyDefaultSort(id: string): void {
    this.sort?.sort({ id, start: 'desc', disableClear: true });
    this.reorderColumnsForSort(id);
  }

  assignActiveSort(): string {
    switch (this.selectedValue) {
      case 'overview':
        return 'winPercent';
      case 'batting':
        return 'runsScored';
      case 'bowling':
        return 'wickets';
      case 'fielding':
        return 'catches';
      case 'mvp':
        return 'avgMvpPoints';
      default:
        return 'runsScored';
    }
  }

  /** Drives the "Sort by" chips - reuses the same MatSort the column headers already use, so both controls stay in sync. Also moves this column next to Name (column-header taps sort but deliberately don't reorder). */
  applySort(id: string): void {
    this.applyDefaultSort(id);
    this.refreshTableLayout();
  }

  private baseColumnsForCategory(): string[] {
    switch (this.selectedValue) {
      case 'overview':
        return this.overviewColumns;
      case 'batting':
        return this.battingnColumns;
      case 'bowling':
        return this.bowlingColumns;
      case 'fielding':
        return this.fieldingColumns;
      case 'mvp':
        return this.mvpColumns;
      default:
        return this.overviewColumns;
    }
  }

  /** Moves the actively-sorted stat to right after Name so it's visible without scrolling. */
  private reorderColumnsForSort(sortId: string): void {
    const base = this.baseColumnsForCategory();
    const rest = base.filter(
      (col) => col !== 'rank' && col !== 'name' && col !== sortId
    );
    this.displayedColumns = ['rank', 'name', sortId, ...rest];
  }

  /**
   * CDK caches measured pixel offsets for stacked sticky columns (rank, name);
   * those go stale whenever data/columns change (e.g. differing rank/name
   * widths between filters), which looks like broken/misaligned stickiness.
   * Forces a recompute and snaps the scroll position back to the start.
   */
  private refreshTableLayout(): void {
    if (this.tableScrollEl) {
      this.tableScrollEl.nativeElement.scrollLeft = 0;
    }
    setTimeout(() => this.matTableRef?.updateStickyColumnStyles());
  }

  /** Pure CSS overlay+rotate trick, not the native Fullscreen API - requestFullscreen() isn't supported for arbitrary elements on iOS Safari/most iOS WebViews (incl. Median.co). */
  toggleTableFullscreen(): void {
    this.isTableFullscreen = !this.isTableFullscreen;
    document.body.style.overflow = this.isTableFullscreen ? 'hidden' : '';
    this.refreshTableLayout();
  }

  /** Gold/silver/bronze medal for the top 3 rows of the CURRENT sorted/filtered table, '' otherwise. */
  rankIcon(index: number): string {
    return ['🥇', '🥈', '🥉'][index] ?? '';
  }

  sortData(data: any): void {
    //console.log(data);
  }

  goToPlayer(data: any): void {
    // Tag the navigation with 'from=stats' so player-details' back button
    // (and its nested "Matches Played" tab) can return here instead of
    // defaulting to allPlayers.
    this.router.navigateByUrl('player-details?name=' + data.name + '&from=stats');
  }

  /**
   * Opens the "how are MVP points calculated?" help dialog. Called with no
   * specific match in view (this is the general Stats page), so
   * describeRules() falls back to describing the scaling formulas in words
   * rather than resolving them to one match's concrete numbers.
   */
  openMvpHelp(): void {
    this.mvpCalculatorService.loadWeights().then((weights) => {
      this.dialog.open(MvpHelpDialog, {
        data: { sections: this.mvpCalculatorService.describeRules(weights) },
      });
    });
  }
}
