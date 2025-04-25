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
      this.router.navigateByUrl(
        'match-details?id=' + matchId + '&playerName=' + this.playerName
      );
    } else {
      this.router.navigateByUrl('match-details?id=' + matchId);
    }
  }

  back(): void {
    this.loadMatchService.matches = []; // Clear the matches array in the service
    if (this.isPlayerList) {
      this.router.navigateByUrl('allPlayers');
    } else {
      this.router.navigateByUrl('room');
    }
  }
}
