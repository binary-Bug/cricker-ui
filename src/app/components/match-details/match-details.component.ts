import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { ScorecardComponent } from '../scorecard/scorecard.component';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LiveMatchService } from '../../services/live-match.service';

@Component({
  selector: 'app-match-details',
  standalone: true,
  imports: [CommonModule, MatTabsModule, ScorecardComponent, MatButtonModule],
  templateUrl: './match-details.component.html',
  styleUrl: './match-details.component.css',
})
export class MatchDetailsComponent implements OnInit, OnDestroy {
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService,
    public liveMatchService: LiveMatchService
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

  toggleTab(event: any): void {
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
