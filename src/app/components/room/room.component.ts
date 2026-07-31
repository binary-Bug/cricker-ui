import { Component, inject } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AdminCodeDialog } from '../dailogs/admin-code.dialog';
import { LoadMatchService } from '../../services/load-match.service';
import { PlayerService } from '../../services/player.service';
import { ModeService } from '../../services/mode.service';
import { environment } from '../../../environments/environment';
import { CommonModule } from '@angular/common';
import { VersionService } from '../../services/version.service';
@Component({
  selector: 'app-room',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent {
  public isProdEnv: boolean = environment.isProdEnv;
  versionService = inject(VersionService);
  version: string = '';
  constructor(
    public dialog: MatDialog,
    private router: Router,
    private loadMatchService: LoadMatchService,
    private playerService: PlayerService,
    private modeService: ModeService
  ) {
    this.versionService.getVersion().subscribe((v) => (this.version = v));
    if (environment.isProdEnv) {
      // saving user session to firebase
      this.saveUserSession();
      // ModeService already defaults to 'prod' from environment.isProdEnv,
      // but set it explicitly here too in case a prior "test" mode selection
      // (e.g. from a previous session in the same tab) is still in memory.
      modeService.setMode('prod');
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
    this.modeService.setMode('prod');
    this.router.navigateByUrl('allMatches');
  }

  viewAllPlayers(): void {
    this.modeService.setMode('prod');
    this.router.navigateByUrl('allPlayers');
  }

  viewStats(): void {
    this.modeService.setMode('prod');
    this.router.navigateByUrl('stats');
  }

  viewAllTestMatches(): void {
    this.modeService.setMode('test');
    this.router.navigateByUrl('allMatches');
  }

  viewAllTestPlayers(): void {
    this.modeService.setMode('test');
    this.router.navigateByUrl('allPlayers');
  }

  viewTestStats(): void {
    this.modeService.setMode('test');
    this.router.navigateByUrl('stats');
  }

  public async UpdateProdPlayerData(): Promise<void> {
    await this.loadMatchService.UpdateProdPlayerData();
  }
}
