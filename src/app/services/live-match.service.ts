import { Injectable, OnInit } from '@angular/core';

interface Batsmen {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  six: number;
}

interface Bowler {
  name: string;
  runs: number;
  overs: number;
  maidens: number;
  wickets: number;
}

interface Team {
  name: string;
  captain: string;
}

interface BallData {
  class: string;
  label: string;
  hasBeenBowled: boolean;
}

const OVER_DATA = [
  {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
  },
  {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
  },
  {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
  },
  {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
  },
  {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
  },
  {
    class: 'none',
    label: '-',
    hasBeenBowled: false,
  },
];

@Injectable({
  providedIn: 'root',
})
export class LiveMatchService {
  constructor() {}

  striker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  nonStriker: Batsmen = { name: '', runs: 0, balls: 0, fours: 0, six: 0 };
  currentBowler: Bowler = {
    name: '',
    runs: 0,
    overs: 0,
    maidens: 0,
    wickets: 0,
  };
  team1: Team = { name: '', captain: '' };
  team2: Team = { name: '', captain: '' };
  tossWinner: string | null = null;
  tossResult: string | null = null;
  totalPlayers: number | null = null;
  totalOvers: number | null = null;
  runsScored: number = 0;
  wicketsLost: number = 0;
  completedOvers: number = 0;
  overData: BallData[] = OVER_DATA;
  currentBowlNumber: number = 0;
}
