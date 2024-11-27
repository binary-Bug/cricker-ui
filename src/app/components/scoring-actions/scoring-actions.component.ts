import { Component, inject } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { FormsModule } from '@angular/forms';
@Component({
  selector: 'app-scoring-actions',
  standalone: true,
  imports: [FormsModule, MatGridListModule, MatButtonModule, MatCheckboxModule],
  templateUrl: './scoring-actions.component.html',
  styleUrl: './scoring-actions.component.css',
})
export class ScoringActionsComponent {
  eventHandler: EventHandlerService = inject(EventHandlerService);
  liveMatchService: LiveMatchService = inject(LiveMatchService);
  matchService: MatchService = inject(MatchService);

  isWideChecked: boolean = false;
  isNBChecked: boolean = false;
  isLBChecked: boolean = false;
  isByesChecked: boolean = false;
  isWicketChecked: boolean = false;

  addRun(run: string, color: string): void {
    let isExtra: boolean = false;
    this.liveMatchService.updateOverData();

    if (this.isWideChecked || this.isNBChecked) {
      run = +run + 1 + '';
      isExtra = true;
      this.eventHandler.NotifyUpdateOverViewGridEvent(true);
      this.liveMatchService.totalBallsinCurrentOver += 1;
      this.eventHandler.NotifyUpdateOverViewGridEvent(false);
      this.liveMatchService.addNewBalltoOversPlayedData();
    }

    this.updateBallDataCSS(run, color);

    this.liveMatchService.updateBallDataRuns(run, isExtra);
    this.liveMatchService.updateBowlerData(
      +run,
      this.isWideChecked,
      this.isNBChecked,
      this.isByesChecked
    );

    if (!this.isWideChecked)
      this.liveMatchService.addRunToStriker(
        +run,
        this.isNBChecked,
        this.isByesChecked,
        this.isLBChecked
      );

    this.liveMatchService.updateBallNumber();

    if (!this.isWideChecked && !this.isNBChecked)
      this.liveMatchService.updateOversPlayed();

    this.matchService.calculateCurrentRunRate();
    this.eventHandler.NotifyRunAddedEvent();
    this.unCheckExtras();
  }

  updateBallDataCSS(run: string, color: string): void {
    if (this.isWideChecked) {
      this.liveMatchService.updateBallDataCSS(run + 'wd', 'wide');
    } else if (this.isLBChecked) {
      this.liveMatchService.updateBallDataCSS(run + ' LB', 'run');
    } else if (this.isByesChecked) {
      this.liveMatchService.updateBallDataCSS(run + ' B', 'run');
    } else if (this.isNBChecked) {
      this.liveMatchService.updateBallDataCSS(run + 'nb', 'noBall');
    } else this.liveMatchService.updateBallDataCSS(run, color);
  }

  unCheckExtras(): void {
    this.isWideChecked = false;
    this.isNBChecked = false;
    this.isLBChecked = false;
    this.isByesChecked = false;
    this.isWicketChecked = false;
  }
}
