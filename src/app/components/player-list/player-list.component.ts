import { Component } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { CommonModule } from '@angular/common';
import { Player } from '../../models/player.interface';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AutoCompleteService } from '../../services/auto-complete.service';
import { UtilityService } from '../../services/utility.service';
import { SpinnerService } from '../../services/spinner.service';

/** Sort keys offered by the sort toggle on the All Players page. */
type PlayerSortKey = 'matchesPlayed' | 'mvpPoints' | 'momCount' | 'name';

/**
 * Everything a player-card needs to render, computed ONCE per
 * list/search/sort change rather than re-derived by calling
 * utilityService.getAvatarColor()/getInitials() directly from the
 * template - those ran on every Angular change-detection cycle for
 * every card, which is real, avoidable main-thread work unrelated to
 * whether the player's name has actually changed.
 */
interface PlayerCardViewModel {
  player: Player;
  avatarColor: string;
  initials: string;
}

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './player-list.component.html',
  styleUrl: './player-list.component.css',
})
export class PlayerListComponent {
  /** Precomputed cards for the template - see updateList(). */
  public cards: PlayerCardViewModel[] = [];
  searchString = new FormControl('');
  sortBy = new FormControl<PlayerSortKey>('matchesPlayed');

  constructor(
    public playerService: PlayerService,
    public router: Router,
    public utilityService: UtilityService,
    private autoCompleteService: AutoCompleteService,
    private spinnerService: SpinnerService
  ) {
    this.updateList();
    this.searchString.valueChanges.subscribe(() => this.updateList());
    this.sortBy.valueChanges.subscribe(() => this.updateList());
  }

  navigateToPlayerDetails(playerName: string): void {
    this.router.navigateByUrl(
      'player-details?name=' + playerName + '&from=allPlayers'
    );
  }

  /**
   * Rebuilds playerList from the (already-cached) full player set by
   * applying the current search term and sort key. Both the search box
   * and the sort toggle call this - neither triggers a Firestore
   * refetch since PlayerService.getAllPlayers() serves from its
   * in-memory cache once populated. Only the genuine first (cold) fetch
   * is wrapped in the global spinner - subsequent calls from search/sort
   * changes resolve from cache and must not flash the overlay.
   */
  private updateList(): void {
    const isColdFetch = this.playerService.players.length === 0;
    const fetch = this.playerService.getAllPlayers();
    const tracked = isColdFetch ? this.spinnerService.wrap(fetch) : fetch;
    tracked.then((players) => {
      const term = (this.searchString.value ?? '').trim();
      const filteredNames = this.autoCompleteService._filter(
        term,
        players.map((player) => player.name)
      );
      const filtered = filteredNames.map(
        (name) => this.playerService.getPlayer(name)
      ) as Player[];
      this.cards = this.sortPlayers(filtered).map((player) => ({
        player,
        avatarColor: this.utilityService.getAvatarColor(player.name),
        initials: this.utilityService.getInitials(player.name),
      }));
    });
  }

  trackByPlayerName(_index: number, card: PlayerCardViewModel): string {
    return card.player.name;
  }

  private sortPlayers(players: Player[]): Player[] {
    const key = this.sortBy.value ?? 'matchesPlayed';
    const sorted = [...players];
    switch (key) {
      case 'mvpPoints':
        sorted.sort((a, b) => b.mvpPoints - a.mvpPoints);
        break;
      case 'momCount':
        sorted.sort((a, b) => b.momCount - a.momCount);
        break;
      case 'name':
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      default:
        sorted.sort((a, b) => b.matchesPlayed - a.matchesPlayed);
    }
    return sorted;
  }
}
