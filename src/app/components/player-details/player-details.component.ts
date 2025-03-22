import { Component, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { PlayerService } from '../../services/player.service';
import { Player } from '../../models/player.interface';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { CommonModule } from '@angular/common';
import { UtilityService } from '../../services/utility.service';

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
  selectedStatOption: string = 'batting';
  overviewStats: { label: string; value: any }[] = [];
  batsmenStats: { label: string; value: any }[] = [];
  extendedBattingStats: { label: string; value: any }[] = [];
  bowlerStats: { label: string; value: any }[] = [];
  extendedBowlingStats: { label: string; value: any }[] = [];
  fielderStats: { label: string; value: any }[] = [];

  constructor(
    private route: ActivatedRoute,
    private playerService: PlayerService,
    public router: Router,
    private utilityService: UtilityService
  ) {}
  async ngOnInit(): Promise<void> {
    this.route.queryParams.subscribe(async (qp) => {
      this.currentPlayer = (await this.playerService.getAllPlayers()).find(
        (player) => {
          return player.name === qp['name'];
        }
      );
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

    this.overviewStats = [
      { label: 'Matches Played', value: this.currentPlayer?.matchesPlayed },
      { label: 'Matches Won', value: this.currentPlayer?.won },
      { label: 'Matches Lost', value: this.currentPlayer?.lost },
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
}
