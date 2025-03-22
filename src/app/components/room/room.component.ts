import { Component, inject } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AdminCodeDialog } from '../dailogs/admin-code.dialog';
import { LoadMatchService } from '../../services/load-match.service';
import { PlayerService } from '../../services/player.service';
import { MatchService } from '../../services/match.service';
@Component({
  selector: 'app-room',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent {
  constructor(
    public dialog: MatDialog,
    private router: Router,
    private loadMatchService: LoadMatchService,
    private playerService: PlayerService,
    private matchService: MatchService
  ) {}
  roomService = inject(RoomService);
  openCodeDialog(): void {
    const dialogRef = this.dialog.open(AdminCodeDialog);

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.router.navigateByUrl('newMatchDetails');
      }
    });
  }
  exit(): void {
    this.roomService.currentRoom = null;
    this.loadMatchService.matches = [];
    this.playerService.players = [];
    this.router.navigateByUrl('');
  }

  viewAllMatches(): void {
    this.matchService.matchMode = 'prod';
    this.router.navigateByUrl('allMatches');
  }

  viewAllPlayers(): void {
    this.matchService.matchMode = 'prod';
    this.router.navigateByUrl('allPlayers');
  }

  viewAllTestMatches(): void {
    this.matchService.matchMode = 'test';
    this.router.navigateByUrl('allMatches');
  }

  viewAllTestPlayers(): void {
    this.matchService.matchMode = 'test';
    this.router.navigateByUrl('allPlayers');
  }

  public async UpdateProdPlayerData(): Promise<void> {
    await this.loadMatchService.UpdateProdPlayerData();
  }
}
