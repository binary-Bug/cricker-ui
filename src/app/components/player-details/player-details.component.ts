import { Component, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerService } from '../../services/player.service';
import { Player } from '../../models/player.interface';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { UtilityService } from '../../services/utility.service';
import { MatchListComponent } from '../match-list/match-list.component';
import { SpinnerService } from '../../services/spinner.service';
import { RecentlyViewedService } from '../../services/recently-viewed.service';
import { logger } from '../../utils/logger';

@Component({
  selector: 'app-player-details',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatchListComponent,
  ],
  templateUrl: './player-details.component.html',
  styleUrl: './player-details.component.css',
})
export class PlayerDetailsComponent implements OnInit {
  currentPlayer: Player | undefined;
  selectedStatOption: string = 'batting';
  // Where the back button (and the nested match-list's back button) should
  // navigate to. Defaults to 'allPlayers' for backward compatibility with
  // direct/bookmarked links that don't set a 'from' param. Only whitelisted
  // values are honored - we never navigate to an arbitrary query-param value.
  backTarget: string = 'allPlayers';
  overviewStats: { label: string; value: any; accent: string }[] = [];
  batsmenStats: { label: string; value: any }[] = [];
  extendedBattingStats: { label: string; value: any }[] = [];
  bowlerStats: { label: string; value: any }[] = [];
  extendedBowlingStats: { label: string; value: any }[] = [];
  fielderStats: { label: string; value: any }[] = [];

  constructor(
    private route: ActivatedRoute,
    private playerService: PlayerService,
    public router: Router,
    public utilityService: UtilityService,
    private spinnerService: SpinnerService,
    private recentlyViewedService: RecentlyViewedService,
  ) {}
  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(async (qp) => {
      this.backTarget = qp['from'] === 'stats' ? 'stats' : 'allPlayers';
      // Only wrap the global spinner around a genuine cold fetch - once
      // the roster is cached (this or any other page having loaded it
      // this session), navigating between different players' detail
      // pages resolves instantly and must not flash the overlay.
      const isColdFetch = this.playerService.players.length === 0;
      const fetch = this.playerService.getAllPlayers();
      const tracked = isColdFetch ? this.spinnerService.wrap(fetch) : fetch;
      this.currentPlayer = (await tracked).find((player) => {
        return player.name === qp['name'];
      });
      if (this.currentPlayer) {
        this.recentlyViewedService.recordPlayer(this.currentPlayer.name);
        // Log player details viewed
        logger
          .trackEvent('player_details_viewed', {
            playerName: this.currentPlayer.name,
            fromPage: this.backTarget,
            playerStatsAvailable: {
              runsScored: this.currentPlayer.runsScored || 0,
              wickets: this.currentPlayer.wickets || 0,
              matchesPlayed: this.currentPlayer.matchesPlayed || 0,
            },
          })
          .catch((err) => console.error('Failed to log player view:', err));
      }
      this.initializeStatsArray();
      this.selectedStatOption =
        this.currentPlayer?.runsScored &&
        this.currentPlayer.runsScored >
          this.utilityService.ballplayed(this.currentPlayer?.overs)
          ? 'batting'
          : 'bowling';
    });
  }

  initializeStatsArray(): void {
    let runsScored: number = this.currentPlayer?.runsScored
      ? this.currentPlayer?.runsScored
      : 0;
    let ballplayed: number = this.currentPlayer?.ballsPlayed
      ? this.currentPlayer.ballsPlayed
      : 1;
    let matchesPlayed: number = this.currentPlayer?.matchesPlayed
      ? this.currentPlayer.matchesPlayed
      : 0;

    // accent drives each overview tile's color (see .stat-tile-* variants
    // in player-details.component.css) - reuses the same color language
    // established by the MVP/MoM badges elsewhere in the app (blue = MVP,
    // gold = Man of the Match), plus green/muted-red for win/loss record.
    this.overviewStats = [
      {
        label: 'Matches Played',
        value: this.currentPlayer?.matchesPlayed,
        accent: 'neutral',
      },
      { label: 'Matches Won', value: this.currentPlayer?.won, accent: 'won' },
      {
        label: 'Matches Lost',
        value: this.currentPlayer?.lost,
        accent: 'lost',
      },
      {
        label: 'MVP Points',
        value: this.currentPlayer?.mvpPoints ?? 0,
        accent: 'mvp',
      },
      {
        label: 'Man of the Match',
        value: this.currentPlayer?.momCount ?? 0,
        accent: 'mom',
      },
      {
        label: 'Avg MVP Points',
        value: matchesPlayed
          ? ((this.currentPlayer?.mvpPoints ?? 0) / matchesPlayed).toFixed(1)
          : '0.0',
        accent: 'mvp',
      },
    ];

    this.batsmenStats = [
      { label: 'Runs Scored', value: this.currentPlayer?.runsScored },
      { label: 'Balls Played', value: this.currentPlayer?.ballsPlayed },
      { label: 'Highest Score', value: this.currentPlayer?.highestScore },
      { label: 'Strike Rate', value: (runsScored / ballplayed) * 100 },
    ];

    this.extendedBattingStats = [
      { label: 'Fours', value: this.currentPlayer?.fours },
      { label: 'Sixes', value: this.currentPlayer?.sixes },
      { label: 'Average', value: runsScored / matchesPlayed },
    ];

    let runsAgainst: number = this.currentPlayer?.runsAgainst
      ? this.currentPlayer?.runsAgainst
      : 0;
    let oversBowled: number = this.currentPlayer?.overs
      ? this.currentPlayer?.overs
      : 1;
    let wicketsTaken: number = this.currentPlayer?.wickets
      ? this.currentPlayer.wickets
      : 0;

    this.bowlerStats = [
      { label: 'Overs', value: this.currentPlayer?.overs },
      { label: 'Wickets', value: this.currentPlayer?.wickets },
      {
        label: 'Economy',
        value: (runsAgainst / this.utilityService.ballplayed(oversBowled)) * 6,
      },
      {
        label: 'BBI',
        value:
          this.currentPlayer?.bbi.wickets && this.currentPlayer?.bbi.wickets > 0
            ? this.currentPlayer?.bbi.wickets +
              '/' +
              this.currentPlayer?.bbi.runs
            : '-/-',
      },
    ];

    this.extendedBowlingStats = [
      { label: 'Runs Given', value: this.currentPlayer?.runsAgainst },
      { label: 'Maidens', value: this.currentPlayer?.maidens },
      {
        label: 'Average',
        value: this.utilityService.ballplayed(oversBowled) / wicketsTaken,
      },
    ];

    this.fielderStats = [
      { label: 'Catches', value: this.currentPlayer?.catches },
      { label: 'Run Outs', value: this.currentPlayer?.runOuts },
      { label: 'Stump Outs', value: this.currentPlayer?.stumpOuts },
    ];
  }

  /**
   * How many of the most recent matches the MVP trend sparkline shows -
   * capped at 10 so the chart stays readable for players with long
   * careers, but never more than the player actually has history for (so
   * the header text reads correctly for newer players with < 10 matches).
   */
  get mvpTrendMatchCount(): number {
    return Math.min(10, this.currentPlayer?.mvpPointsHistory?.length ?? 0);
  }

  /**
   * Per-point (x, y, value) coordinates for the MVP trend sparkline -
   * `viewBox`-based (not fixed pixel dimensions) so it scales cleanly to
   * any container width, phone through desktop, unlike a canvas/fixed-size
   * chart would. Returns [] when there's fewer than 2 matches of history,
   * since a trend line needs at least 2 points. Only plots the most recent
   * `mvpTrendMatchCount` matches (see above) rather than the player's
   * entire career, so the chart doesn't get cramped/unreadable over time.
   * Reserves headroom at the top of the viewBox (topPadding) so each
   * point's value label can be drawn above it without getting clipped,
   * even for the highest peak.
   */
  get mvpSparklineData(): { x: number; y: number; value: number }[] {
    const history = (this.currentPlayer?.mvpPointsHistory ?? []).slice(-10);
    if (history.length < 2) return [];
    const width = 300;
    const height = 80;
    const sidePadding = 14;
    const bottomPadding = 6;
    const topPadding = 22;
    const max = Math.max(...history, 0);
    const min = Math.min(...history, 0);
    const range = max - min || 1;
    const stepX = (width - sidePadding * 2) / (history.length - 1);
    return history.map((value, i) => {
      const x = sidePadding + i * stepX;
      const y =
        height -
        bottomPadding -
        ((value - min) / range) * (height - bottomPadding - topPadding);
      return { x: +x.toFixed(1), y: +y.toFixed(1), value };
    });
  }

  /** `points` attribute for the sparkline's connecting polyline - derived from mvpSparklineData so the line and the per-point labels/markers always line up exactly. */
  get mvpSparklinePoints(): string {
    return this.mvpSparklineData.map((p) => `${p.x},${p.y}`).join(' ');
  }
}
