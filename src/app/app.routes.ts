import { Routes } from '@angular/router';
import { RoomComponent } from './components/room/room.component';
import { LiveMatchDashboardComponent } from './components/live-match-dashboard/live-match-dashboard.component';
import { NewMatchDetailsComponent } from './components/new-match-details/new-match-details.component';
import { MatchDetailsComponent } from './components/match-details/match-details.component';
import { MatchListComponent } from './components/match-list/match-list.component';
import { PlayerListComponent } from './components/player-list/player-list.component';
import { PlayerDetailsComponent } from './components/player-details/player-details.component';
import { canDeactivateLiveGuard } from './guards/live.guard';
import { StatsComponent } from './components/stats/stats.component';

export const routes: Routes = [
  //{ path: '', component: IndexComponent },
  { path: '', component: RoomComponent },
  { path: 'room', component: RoomComponent },
  {
    path: 'live',
    component: LiveMatchDashboardComponent,
    canDeactivate: [canDeactivateLiveGuard],
  },
  {
    path: 'newMatchDetails',
    component: NewMatchDetailsComponent,
    canDeactivate: [canDeactivateLiveGuard],
  },
  { path: 'allMatches', component: MatchListComponent },
  { path: 'match-details', component: MatchDetailsComponent },
  { path: 'allPlayers', component: PlayerListComponent },
  { path: 'player-details', component: PlayerDetailsComponent },
  { path: 'stats', component: StatsComponent },
];
