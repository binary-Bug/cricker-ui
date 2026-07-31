import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatExpansionModule } from '@angular/material/expansion';
import { ScorecardComponent } from '../scorecard/scorecard.component';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { LiveMatchService } from '../../services/live-match.service';
import { PlayerService } from '../../services/player.service';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-match-details',
  standalone: true,
  imports: [
    CommonModule,
    MatTabsModule,
    MatExpansionModule,
    ScorecardComponent,
    MatButtonModule,
  ],
  templateUrl: './match-details.component.html',
  styleUrl: './match-details.component.css',
})
export class MatchDetailsComponent implements OnInit, OnDestroy {
  constructor(
    public matchService: MatchService,
    private eventHandlerService: EventHandlerService,
    public liveMatchService: LiveMatchService,
    private route: ActivatedRoute,
    private playerService: PlayerService
  ) {}
  private subscriptions: Subscription[] = [];
  public isMatchLoaded: boolean = false;
  public playerName: string = '';
  // Origin to restore on player-details when exiting back to it (e.g.
  // 'stats'). Whitelisted the same way player-details itself does - only
  // known values are honored, defaulting to allPlayers otherwise.
  public playerDetailsBackTarget: string = 'allPlayers';

  ngOnInit(): void {
    this.route.url.subscribe((url) => {
      if (url[0].path === 'match-details') {
        this.route.queryParams.subscribe(async (qp) => {
          this.playerName = qp['playerName'];
          this.playerDetailsBackTarget =
            qp['from'] === 'stats' ? 'stats' : 'allPlayers';
        });
      }
    });
    this.subscriptions.push(
      this.eventHandlerService.MatchLoadCompleteEvent$().subscribe(() => {
        // match loaded
        this.isMatchLoaded = true;
        // this.playerService.savePlayerData(
        //   'WItAdDq3YCJmKM1YlhaJ',
        //   this.matchService.matchResult as string
        // );
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

  exit() {
    if (this.playerName && this.playerName.length > 0) {
      this.liveMatchService.exitMatch(
        'player-details?name=' +
          this.playerName +
          '&from=' +
          this.playerDetailsBackTarget
      );
    } else this.liveMatchService.exitMatch('allMatches');
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
