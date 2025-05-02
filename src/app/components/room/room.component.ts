import { Component, inject } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AdminCodeDialog } from '../dailogs/admin-code.dialog';
import { LoadMatchService } from '../../services/load-match.service';
import { PlayerService } from '../../services/player.service';
import { MatchService } from '../../services/match.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent {
  public isProdEnv: boolean = environment.isProdEnv;

  constructor(
    public dialog: MatDialog,
    private router: Router,
    private loadMatchService: LoadMatchService,
    private playerService: PlayerService,
    private matchService: MatchService
  ) {
    if (environment.isProdEnv) {
      // saving user session to firebase
      this.saveUserSession();
      matchService.matchMode = 'prod';
    }
  }
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

  saveUserSession() {
    try {
      fetch('https://api.ipify.org?format=json').then((response) => {
        response.json().then((json) => {
          console.log(json.ip);
          this.roomService.saveUserInfo(json.ip);
        });
      });
    } catch (error) {
      console.error('Error fetching IP address:', error);
    }
  }

  viewAllMatches(): void {
    this.matchService.matchMode = 'prod';
    this.router.navigateByUrl('allMatches');
  }

  viewAllPlayers(): void {
    this.matchService.matchMode = 'prod';
    this.router.navigateByUrl('allPlayers');
  }

  viewStats(): void {
    this.matchService.matchMode = 'prod';
    this.router.navigateByUrl('stats');
  }

  viewAllTestMatches(): void {
    this.matchService.matchMode = 'test';
    this.router.navigateByUrl('allMatches');
  }

  viewAllTestPlayers(): void {
    this.matchService.matchMode = 'test';
    this.router.navigateByUrl('allPlayers');
  }

  viewTestStats(): void {
    this.matchService.matchMode = 'test';
    this.router.navigateByUrl('stats');
  }

  public async UpdateProdPlayerData(): Promise<void> {
    await this.loadMatchService.UpdateProdPlayerData();
  }
}
