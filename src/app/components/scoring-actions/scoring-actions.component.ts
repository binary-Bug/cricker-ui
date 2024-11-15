import { Component, inject } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { LiveMatchService } from '../../services/live-match.service';
@Component({
  selector: 'app-scoring-actions',
  standalone: true,
  imports: [MatGridListModule, MatButtonModule, MatCheckboxModule],
  templateUrl: './scoring-actions.component.html',
  styleUrl: './scoring-actions.component.css',
})
export class ScoringActionsComponent {
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  addRun(run: string, color: string): void {
    this.liveMatchService.overData[
      this.liveMatchService.currentBowlNumber
    ].hasBeenBowled = true;
    this.liveMatchService.overData[
      this.liveMatchService.currentBowlNumber
    ].class = color;
    this.liveMatchService.overData[
      this.liveMatchService.currentBowlNumber
    ].label = run;
    this.liveMatchService.currentBowlNumber += 1;
  }
}
