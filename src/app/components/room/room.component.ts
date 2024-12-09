import { Component, inject } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog
} from '@angular/material/dialog';
import { Router } from '@angular/router';
import { AdminCodeDialog } from '../dailogs/admin-code.dialog';
@Component({
  selector: 'app-room',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent {
  constructor(public dialog: MatDialog, private router: Router) {}
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
    this.router.navigateByUrl('');
  }
}
