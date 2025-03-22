import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UtilityService {
  constructor() {}

  ballplayed(oversPlayed: number): number {
    if (oversPlayed === 0) return 0;
    let ballsInOver =
      +parseFloat(oversPlayed - Math.trunc(oversPlayed) + '').toFixed(1) * 10;
    let completedOversBalls = Math.trunc(oversPlayed) * 6;
    return completedOversBalls + ballsInOver;
  }

  oversLeft(ballsLeft: number): number {
    if (ballsLeft === 0) return 0;
    let completedOvers = Math.trunc(ballsLeft / 6);
    let ballsLeftInOver = ballsLeft - completedOvers * 6;
    let multiplyConstant = +parseFloat(10 / 6 + '').toFixed(1);
    ballsLeftInOver = Math.ceil(ballsLeftInOver * multiplyConstant);
    return +(completedOvers + '.' + ballsLeftInOver);
  }

  convertToOvers(balls: number): number {
    if (balls === 0) return 0;
    let completedOvers = Math.trunc(balls / 6);
    let ballsLeftInOver = balls - completedOvers * 6;
    return +(completedOvers + '.' + ballsLeftInOver);
  }
}
