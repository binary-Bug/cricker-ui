import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  Firestore,
  getDocs,
  query,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  firestore = inject(Firestore);
  router = inject(Router);

  currentRoom: any = {};
  constructor() {}

  async getRooms() {
    return (await getDocs(query(collection(this.firestore, 'room')))).docs.map(
      (robots) => robots.data()
    );
  }

  async createRoom(id: number, code: string) {
    await addDoc(collection(this.firestore, 'room'), {
      roomId: id,
      adminCode: code,
    });
    this.currentRoom = {
      roomId: id,
      adminCode: code,
    };
    this.router.navigateByUrl('room');
  }
}
