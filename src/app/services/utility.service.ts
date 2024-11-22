import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilityService {
  constructor() {}

  ballplayed(oversPlayed: number): number {
    let ballsInOver =
      +parseFloat(oversPlayed - Math.trunc(oversPlayed) + '').toFixed(1) * 10;
    let completedOversBalls = Math.trunc(oversPlayed) * 6;
    return completedOversBalls + ballsInOver;
  }
}
