import { Component, Input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { LoadMatchService } from '../../services/load-match.service';
import { LoadMatchDTO } from '../../models/LoadMatchDTO.interface';
import { PlayerMvpBreakdown } from '../../models/mvp.interface';
import { MvpBreakdownDialog } from '../dailogs/mvp-breakdown.dialog';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-match-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
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
