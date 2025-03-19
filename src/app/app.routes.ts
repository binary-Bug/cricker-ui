import { Routes } from '@angular/router';
import { IndexComponent } from './components/index/index.component';
import { RoomComponent } from './components/room/room.component';
import { LiveMatchDashboardComponent } from './components/live-match-dashboard/live-match-dashboard.component';
import { NewMatchDetailsComponent } from './components/new-match-details/new-match-details.component';
import { MatchDetailsComponent } from './components/match-details/match-details.component';
import { MatchListComponent } from './components/match-list/match-list.component';
import { PlayerListComponent } from './components/player-list/player-list.component';
import { PlayerDetailsComponent } from './components/player-details/player-details.component';

export const routes: Routes = [
  { path: '', component: IndexComponent },
  { path: 'room', component: RoomComponent },
  { path: 'live', component: LiveMatchDashboardComponent },
  { path: 'newMatchDetails', component: NewMatchDetailsComponent },
  { path: 'allMatches', component: MatchListComponent },
  { path: 'match-details', component: MatchDetailsComponent },
  { path: 'allPlayers', component: PlayerListComponent },
  { path: 'player-details', component: PlayerDetailsComponent },
];
