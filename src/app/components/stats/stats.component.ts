import { Component, OnInit, ViewChild } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { Player } from '../../models/player.interface';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { CommonModule } from '@angular/common';
import { UtilityService } from '../../services/utility.service';

interface StatType {
  value: string;
  label: string;
}

interface IPlayer extends Player {
  sr: number;
  eco: number;
}

@Component({
  selector: 'app-stats',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatButtonModule,
    MatSelectModule,
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

  selectedValue: string = 'batting';
  statTypes: StatType[] = [
    { value: 'batting', label: 'Batting' },
    { value: 'bowling', label: 'Bowling' },
    { value: 'fielding', label: 'Fielding' },
  ];

  battingnColumns: string[] = [
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
    'name',
    'matchesPlayed',
    'catches',
    'runOuts',
    'stumpOuts',
  ];

  displayedColumns: string[] = this.battingnColumns;
  dataSource: MatTableDataSource<IPlayer> = new MatTableDataSource(
    this.playersData
  );

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

  constructor(
    public playerService: PlayerService,
    public router: Router,
    private utilityService: UtilityService
  ) {
    playerService.getAllPlayers().then((players) => {
      this.playersData = players as any;

      this.calculateSR();
      this.calculateEco();
      this.dataSource = new MatTableDataSource(this.playersData);
      this.dataSource.sort = this.sort;
    });
  }

  ngOnInit(): void {
    // Restore the previously selected stat type (if any) so returning to
    // this page (e.g. from player-details) keeps the user's selection
    // instead of resetting to the 'batting' default.
    this.selectedValue = this.playerService.lastSelectedStatType;
    this.statTypeChanged();
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
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

  statTypeChanged(): void {
    this.playerService.lastSelectedStatType = this.selectedValue;
    if (this.selectedValue === 'batting') {
      this.displayedColumns = this.battingnColumns;
      this.sort?.sort({ id: 'runsScored', start: 'desc', disableClear: true });
    } else if (this.selectedValue === 'bowling') {
      this.displayedColumns = this.bowlingColumns;
      this.sort?.sort({ id: 'wickets', start: 'desc', disableClear: true });
    } else if (this.selectedValue === 'fielding') {
      this.displayedColumns = this.fieldingColumns;
      this.sort?.sort({ id: 'catches', start: 'desc', disableClear: true });
    }
  }

  assignActiveSort(): string {
    switch (this.selectedValue) {
      case 'batting':
        return 'runsScored';
      case 'bowling':
        return 'wickets';
      case 'fielding':
        return 'catches';
      default:
        return 'runsScored';
    }
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
}
