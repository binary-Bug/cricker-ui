import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class RoomService {
  currentRoom: any = {};
  constructor() {}
}
