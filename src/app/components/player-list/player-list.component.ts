import { Component } from '@angular/core';
import { PlayerService } from '../../services/player.service';
import { CommonModule } from '@angular/common';
import { Player } from '../../models/player.interface';
import { MatCardModule } from '@angular/material/card';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { map } from 'rxjs';
import { AutoCompleteService } from '../../services/auto-complete.service';

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './player-list.component.html',
  styleUrl: './player-list.component.css',
})
export class PlayerListComponent {
  public playerList!: Promise<Player[]>;
  searchString = new FormControl('');
  constructor(
    public playerService: PlayerService,
    public router: Router,
    private autoCompleteService: AutoCompleteService
  ) {
    this.playerList = playerService.getAllPlayers();
    this.searchString.valueChanges
      .pipe(
        map((value) => {
          return playerService.getAllPlayers().then((players) =>
            autoCompleteService._filter(
              value as string,
              players.map((player) => player.name)
            )
          );
        })
      )
      .subscribe((promise) => {
        this.playerList = promise.then(
          (list) =>
            list.map((playerName) =>
              playerService.getPlayer(playerName)
            ) as Player[]
        );
      });
  }
}
