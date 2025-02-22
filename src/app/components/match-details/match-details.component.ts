import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ScorecardComponent } from '../scorecard/scorecard.component';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-match-details',
  standalone: true,
  imports: [CommonModule, MatTabsModule, ScorecardComponent],
  templateUrl: './match-details.component.html',
  styleUrl: './match-details.component.css',
})
export class MatchDetailsComponent implements OnInit, OnDestroy {
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService
  ) {}
  private subscriptions: Subscription[] = [];
  public isMatchLoaded: boolean = false;

  ngOnInit(): void {
    this,
      this.subscriptions.push(
        this.eventHandlerService.MatchLoadCompleteEvent$().subscribe(() => {
          // match loaded
          this.isMatchLoaded = true;
        })
      );
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }
}
