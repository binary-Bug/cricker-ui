import { Component, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { LiveMatchService } from '../../services/live-match.service';
import { ScoringComponent } from '../scoring/scoring.component';
@Component({
  selector: 'app-live-match-dashboard',
  standalone: true,
  imports: [MatTabsModule, ScoringComponent],
  templateUrl: './live-match-dashboard.component.html',
  styleUrl: './live-match-dashboard.component.css',
})
export class LiveMatchDashboardComponent {
  liveMatchService: LiveMatchService = inject(LiveMatchService);
}
