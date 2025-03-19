import { Component, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerService } from '../../services/player.service';
import { Player } from '../../models/player.interface';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-player-details',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
  ],
  templateUrl: './player-details.component.html',
  styleUrl: './player-details.component.css',
})
export class PlayerDetailsComponent implements OnInit {
  currentPlayer: Player | undefined;
  overviewStats: { label: string; value: any }[] = [];
  batsmenStats: { label: string; value: any }[] = [];
  bowlerStats: { label: string; value: any }[] = [];
  fielderStats: { label: string; value: any }[] = [];

  constructor(
    private route: ActivatedRoute,
    private playerService: PlayerService,
    public router: Router
  ) {}
  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(async (qp) => {
      this.currentPlayer = (await this.playerService.getAllPlayers()).find(
        (player) => {
          return player.name === qp['name'];
        }
      );
      this.initializeStatsArray();
    });
  }

  initializeStatsArray(): void {
    this.overviewStats = [
      { label: 'Matches Played', value: this.currentPlayer?.matchesPlayed },
      { label: 'Matches Won', value: this.currentPlayer?.won },
      { label: 'Matches Lost', value: this.currentPlayer?.lost },
    ];

    this.batsmenStats = [
      { label: 'Runs Scored', value: this.currentPlayer?.runsScored },
      { label: 'Balls Played', value: this.currentPlayer?.ballsPlayed },
      { label: 'Fours', value: this.currentPlayer?.fours },
      { label: 'Sixes', value: this.currentPlayer?.sixes },
    ];

    this.bowlerStats = [
      { label: 'Overs', value: this.currentPlayer?.overs },
      { label: 'Runs Given', value: this.currentPlayer?.runsAgainst },
      { label: 'Wickets', value: this.currentPlayer?.wickets },
      { label: 'Maidens', value: this.currentPlayer?.maidens },
    ];

    this.fielderStats = [
      { label: 'Catches', value: this.currentPlayer?.catches },
      { label: 'Run Outs', value: this.currentPlayer?.runOuts },
      { label: 'Stump Outs', value: this.currentPlayer?.stumpOuts },
    ];
  }
}
