import { Component, inject } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
@Component({
  selector: 'app-scoring-actions',
  standalone: true,
  imports: [MatGridListModule, MatButtonModule, MatCheckboxModule],
  templateUrl: './scoring-actions.component.html',
  styleUrl: './scoring-actions.component.css',
})
export class ScoringActionsComponent {
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  matchService: MatchService = inject(MatchService);
  addRun(run: string, color: string): void {
    this.liveMatchService.updateOverData();
    this.liveMatchService.updateBallDataCSS(run, color);
    this.liveMatchService.updateBallDataRuns(run);
    this.liveMatchService.updateBallNumber();
    this.liveMatchService.addRunToStriker(+run);
    this.liveMatchService.updateBowlerData(+run);
    this.eventHandler.NotifyRunAddedEvent();
  }
}
