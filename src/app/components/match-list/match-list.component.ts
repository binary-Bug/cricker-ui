import { Component, Input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LoadMatchService } from '../../services/load-match.service';
import { LoadMatchDTO } from '../../models/LoadMatchDTO.interface';
import { PlayerMvpBreakdown } from '../../models/mvp.interface';
import { MvpBreakdownDialog } from '../dailogs/mvp-breakdown.dialog';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-match-list',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    ReactiveFormsModule,
  ],
  templateUrl: './match-list.component.html',
  styleUrl: './match-list.component.css',
})
export class MatchListComponent implements OnInit {
  @Input('matchIds') matchIds: string[] | undefined = [];
  @Input('isPlayerList') isPlayerList: boolean = false;
  @Input('playerName') playerName: string | undefined = '';
  /**
   * The player's full-career MVP points, one entry per match, in the same
   * order as matchIds (see Player.mvpPointsHistory). Used as a fallback
   * source for the match-card badge's point total when the player wasn't
   * in that particular match's top 5 (so match.data.mvp.topFive has no
   * entry for them, but they still earned points that match).
   */
  @Input('mvpPointsHistory') mvpPointsHistory: number[] | undefined;
  // Where to navigate on back() when isPlayerList is true. Defaults to
  // 'allPlayers' to preserve existing behavior for any usage that doesn't
  // set it explicitly.
  @Input('backTarget') backTarget: string = 'allPlayers';

  public matchesList: LoadMatchDTO[] = [];
  // Client-side team-name search - standalone /allMatches usage only (see
  // *ngIf="!isPlayerList" on the search field in the template). No extra
  // Firestore reads: filters the already-fetched matchesList in memory,
  // same pattern as PlayerListComponent's search.
  public searchString = new FormControl('');

  constructor(
    public loadMatchService: LoadMatchService,
    public router: Router,
    private dialog: MatDialog
  ) {
    loadMatchService.getAllMatches().then((matches) => {
      this.matchesList = matches;
    });
  }

  ngOnInit(): void {
    this.loadMatchService.getAllMatches().then((matches) => {
      this.matchesList = matches;
      if (this.matchIds && this.matchIds?.length > 0) {
        this.matchesList = this.matchesList.filter((match) =>
          this.matchIds?.includes(match.id)
        );
      }
    });
  }

  /**
   * matchesList filtered by the current search term (team1/team2 name,
   * case-insensitive substring match). Returns the full list unchanged
   * when the search box is empty. Used by the template in place of
   * iterating matchesList directly.
   */
  get filteredMatches(): LoadMatchDTO[] {
    const term = (this.searchString.value || '').trim().toLowerCase();
    if (!term) return this.matchesList;
    return this.matchesList.filter((match) => {
      const team1: string = match.data?.['teamData']?.['team1']?.['name'] ?? '';
      const team2: string = match.data?.['teamData']?.['team2']?.['name'] ?? '';
      return (
        team1.toLowerCase().includes(term) || team2.toLowerCase().includes(term)
      );
    });
  }

  navigateToMatch(matchId: string): void {
    if (this.playerName && this.playerName.length > 0) {
      // Carry backTarget through as 'from' so match-details' exit() can
      // pass it back to player-details, preserving the original origin
      // (e.g. stats) instead of losing it and falling back to allPlayers.
      this.router.navigateByUrl(
        'match-details?id=' +
          matchId +
          '&playerName=' +
          this.playerName +
          '&from=' +
          this.backTarget
      );
    } else {
      this.router.navigateByUrl('match-details?id=' + matchId);
    }
  }

  /**
   * True if `teamName` was the winning team in this match, so the
   * template can highlight it (green/bold) and mute the other team -
   * a more meaningful visual differentiation than an arbitrary per-team
   * color, and lets the winner be spotted at a glance without reading
   * the smaller result badge text. There's no dedicated "winner" field
   * on the match doc, but MatchResult is always written in the fixed
   * format "{TeamName} wins by N runs/wicket(s)" (see
   * MatchCompleteDialog.checkMatchResult) or "Match Tied" - so a simple
   * startsWith check is reliable without needing new stored data.
   */
  isWinningTeam(match: LoadMatchDTO, teamName: string): boolean {
    const result: string = match.data?.['MatchResult'] ?? '';
    return !!teamName && result.trim().startsWith(teamName.trim());
  }

  /**
   * True if this player was Man of the Match for the given match - read
   * straight off match.data.mvp.manOfTheMatch at runtime, no backfill
   * needed. SaveMatchService has persisted this field on every match
   * since the MVP feature launched; matches saved before that (if any)
   * simply have no "mvp" field at all, so this safely returns false for
   * them - the same graceful fallback already relied on everywhere else
   * "mvp" is read (e.g. match-details hiding its MoM banner).
   */
  isPlayerMomForMatch(match: LoadMatchDTO): boolean {
    if (!this.playerName) return false;
    const manOfTheMatch: string | undefined =
      match.data?.['mvp']?.['manOfTheMatch'];
    return !!manOfTheMatch && manOfTheMatch.trim() === this.playerName.trim();
  }


  back(): void {
    this.loadMatchService.matches = []; // Clear the matches array in the service
    if (this.isPlayerList) {
      this.router.navigateByUrl(this.backTarget);
    } else {
      this.router.navigateByUrl('room');
    }
  }

  /**
   * This player's full MVP breakdown for the given match, if they were
   * ranked in that match's top 5 (the only players a match doc stores a
   * per-category breakdown for - see mvp.interface.ts). Returns undefined
   * (no badge shown) for matches where the player wasn't top-5 - we
   * deliberately don't fall back to just a total-points number in that
   * case, since there'd be nothing for the breakdown dialog to show.
   */
  getPlayerMvpBreakdown(match: LoadMatchDTO): PlayerMvpBreakdown | undefined {
    if (!this.playerName) return undefined;
    const topFive: PlayerMvpBreakdown[] | undefined =
      match.data?.['mvp']?.['topFive'];
    return topFive?.find(
      (breakdown) => breakdown.name.trim() === this.playerName!.trim()
    );
  }

  /**
   * This player's total MVP points for the given match, whether or not
   * they made that match's top 5. Prefers the full breakdown's total
   * (topFive) when available, and falls back to looking the match up by
   * index in matchIds/mvpPointsHistory (parallel arrays - see
   * Player.mvpPointsHistory) otherwise. Returns undefined only if we have
   * no data at all for this match (e.g. matchIds/mvpPointsHistory weren't
   * provided), in which case no badge is shown.
   */
  getPlayerMvpPoints(match: LoadMatchDTO): number | undefined {
    const breakdown = this.getPlayerMvpBreakdown(match);
    if (breakdown) return breakdown.totalPoints;
    if (!this.matchIds || !this.mvpPointsHistory) return undefined;
    const index = this.matchIds.indexOf(match.id);
    if (index === -1 || index >= this.mvpPointsHistory.length) {
      return undefined;
    }
    return this.mvpPointsHistory[index];
  }

  /**
   * Opens the same MvpBreakdownDialog used on match-details' top-5 list
   * (see MatchDetailsComponent.openPlayerMvpBreakdown) so tapping this
   * player's badge on their "Matches Played" card shows an identical,
   * consistent breakdown.
   */
  openPlayerMvpBreakdown(match: LoadMatchDTO): void {
    const breakdown = this.getPlayerMvpBreakdown(match);
    if (!breakdown) return;
    const topFive: PlayerMvpBreakdown[] | undefined =
      match.data?.['mvp']?.['topFive'];
    this.dialog.open(MvpBreakdownDialog, {
      data: {
        player: breakdown,
        momName: match.data?.['mvp']?.['manOfTheMatch'],
        momPoints: topFive?.[0]?.totalPoints,
      },
    });
  }
}
