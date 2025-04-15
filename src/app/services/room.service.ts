import { inject, Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  DocumentData,
  Firestore,
  getDocs,
  query,
  updateDoc,
  where,
} from '@angular/fire/firestore';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  firestore = inject(Firestore);
  router = inject(Router);

  currentRoom: any = null;
  constructor() {}

  async getRooms() {
    return (await getDocs(query(collection(this.firestore, 'room')))).docs.map(
      (rooms) => rooms.data()
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

  async saveUserInfo(ip: any) {
    let docRef: any = null;
    let docData: DocumentData | null = null;
    (
      await getDocs(
        query(
          collection(this.firestore, 'UserInfo'),
          where('ipAddress', '==', ip)
        )
      )
    ).docs.map((user) => {
      docRef = user.ref;
      docData = user.data();
    });
    if (docRef === null) {
      await addDoc(collection(this.firestore, 'UserInfo'), {
        ipAddress: ip,
        count: 1,
      });
    } else {
      let count: number = docData?.['count'] ? docData?.['count'] : 0;
      await updateDoc(docRef, {
        count: count + 1,
      });
    }
  }
}
