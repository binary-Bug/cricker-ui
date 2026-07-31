import { Component, Input, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LoadMatchService } from '../../services/load-match.service';
import { LoadMatchDTO } from '../../models/LoadMatchDTO.interface';
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
  // Where to navigate on back() when isPlayerList is true. Defaults to
  // 'allPlayers' to preserve existing behavior for any usage that doesn't
  // set it explicitly.
  @Input('backTarget') backTarget: string = 'allPlayers';

  public matchesList: LoadMatchDTO[] = [];
  constructor(
    public loadMatchService: LoadMatchService,
    public router: Router
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

  back(): void {
    this.loadMatchService.matches = []; // Clear the matches array in the service
    if (this.isPlayerList) {
      this.router.navigateByUrl(this.backTarget);
    } else {
      this.router.navigateByUrl('room');
    }
  }
}
