import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RoomService } from '../../services/room.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-index',
  standalone: true,
  imports: [
    MatButtonModule,
    CommonModule,
    MatInputModule,
    FormsModule,
    MatIconModule,
    ReactiveFormsModule,
  ],
  templateUrl: './index.component.html',
  styleUrl: './index.component.css',
})
export class IndexComponent implements OnInit {
  roomService = inject(RoomService);
  router = inject(Router);
  isCreateRoomClicked: boolean = false;
  isJoinRoomClicked: boolean = false;
  id: number = 0;
  hide = true;
  code: string = '';
  roomId = new FormControl('', [Validators.required]);

  ngOnInit() {
    this.roomService.getRooms().then((val) => {
      this.id = val.length + 1;
    });
  }

  toggleCreateRoom() {
    this.isCreateRoomClicked = !this.isCreateRoomClicked;
    this.roomService.getRooms().then((val) => {
      this.id = val.length + 1;
    });
  }

  toggleJoinRoom() {
    this.isJoinRoomClicked = !this.isJoinRoomClicked;
  }

  async createRoom() {
    this.roomService.createRoom(this.id, this.code);
  }

  joinRoom() {
    this.roomService.getRooms().then((rooms) => {
      var room = rooms.find((room) => {
        return room['roomId'] === this.roomId.value;
      });
      if (room) {
        this.roomService.currentRoom = room;
        this.router.navigateByUrl('room');
      } else {
        this.roomId.setErrors({ error: true });
      }
    });
  }
}
