import { Component, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { LiveMatchService } from '../../services/live-match.service';
import { ScoringComponent } from '../scoring/scoring.component';
import { ScorecardComponent } from '../scorecard/scorecard.component';
@Component({
  selector: 'app-live-match-dashboard',
  standalone: true,
  imports: [MatTabsModule, ScoringComponent, ScorecardComponent],
  templateUrl: './live-match-dashboard.component.html',
  styleUrl: './live-match-dashboard.component.css',
})
export class LiveMatchDashboardComponent {
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  isScorecardTabActive: boolean = false;
  toggleTab(event: any): void {
    if (event.index === 1) this.isScorecardTabActive = true;
    else this.isScorecardTabActive = false;
    this.handleOnToggleEvent(event.index);
  }
  handleOnToggleEvent(index: number): void {
    if (index === 1) {
      setTimeout(() => {
        let ele = document.getElementById('mat-tab-content-scorecard');
        if (ele) {
          ele.style.display = 'initial';
        }
        let ele2 = document.getElementById('scorecardSpinner');
        if (ele2) {
          ele2.style.display = 'none';
        }
      }, 500);
    } else {
      let ele = document.getElementById('mat-tab-content-scorecard');
      if (ele) {
        ele.style.display = 'none';
      }
      let ele2 = document.getElementById('scorecardSpinner');
      if (ele2) {
        ele2.style.display = 'block';
      }
    }
  }
}
