import { Routes } from '@angular/router';
import { IndexComponent } from './components/index/index.component';
import { RoomComponent } from './components/room/room.component';
import { LiveMatchDashboardComponent } from './components/live-match-dashboard/live-match-dashboard.component';
import { NewMatchDetailsComponent } from './components/new-match-details/new-match-details.component';

export const routes: Routes = [
  { path: '', component: IndexComponent },
  { path: 'room', component: RoomComponent },
  { path: 'live', component: LiveMatchDashboardComponent },
  { path: 'newMatchDetails', component: NewMatchDetailsComponent },
];
