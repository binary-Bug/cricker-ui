import { Injectable } from '@angular/core';

/**
 * Fixed color palette used to render a player's initials avatar.
 * getAvatarColor() hashes the player's name into this palette so the same
 * player always gets the same color everywhere the avatar appears (All
 * Players list, Player Details header, etc.).
 */
const AVATAR_PALETTE = [
  '#5e35b1',
  '#1e88e5',
  '#00897b',
  '#43a047',
  '#fb8c00',
  '#e53935',
  '#8e24aa',
  '#3949ab',
  '#00acc1',
  '#6d4c41',
];

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

  /** Deterministic 1-2 letter initials for a player's avatar. */
  getInitials(name: string): string {
    const parts = (name || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (
      parts[0].charAt(0) + parts[parts.length - 1].charAt(0)
    ).toUpperCase();
  }

  /** Deterministic avatar background color hashed from the player's name. */
  getAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % AVATAR_PALETTE.length;
    return AVATAR_PALETTE[index];
  }
}
