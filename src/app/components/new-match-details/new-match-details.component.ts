import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatchService } from '../../services/match.service';
import { OnFieldPlayerDetailsDialog } from '../dailogs/on-field-player-detail.dialog';
import { LiveMatchService } from '../../services/live-match.service';
import { PlayerService } from '../../services/player.service';
import { map, Observable, startWith, Subscription } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { AutoCompleteService } from '../../services/auto-complete.service';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-new-match-details',
  standalone: true,
  imports: [
    MatInputModule,
    MatFormFieldModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatButtonModule,
    MatAutocompleteModule,
  ],
  templateUrl: './new-match-details.component.html',
  styleUrl: './new-match-details.component.css',
})
export class NewMatchDetailsComponent implements OnInit, OnDestroy {
  constructor(
    public dialog: MatDialog,
    private router: Router,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService
  ) {}

  team1Name: string = '';
  team2Name: string = '';
  team1Captain = new FormControl('', Validators.required);
  team2Captain = new FormControl('', Validators.required);
  tossWinner = new FormControl('team1');
  tossResult = new FormControl('bat');
  totalPlayers: number = 0;
  totalOvers: number = 0;
  mode = new FormControl('test');
  options: string[] = [];
  filteredOptionsCap1!: string[];
  filteredOptionsCap2!: string[];
  subscriptions: Subscription[] = [];
  isProdEnv: boolean = environment.isProdEnv;

  ngOnInit(): void {
    this.mode.setValue(environment.isProdEnv ? 'prod' : 'test');
    this.matchService.matchMode = this.mode.value;

    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.team1Captain.setValue('');
      this.team2Captain.setValue('');
    });

    this.subscriptions.push(
      this.team1Captain.valueChanges
        .pipe(
          startWith(''),
          map((value) =>
            this.autoCompleteService._filter(value || '', this.options)
          )
        )
        .subscribe((list) => {
          this.filteredOptionsCap1 = list;
        }),

      this.team2Captain.valueChanges
        .pipe(
          startWith(''),
          map((value) =>
            this.autoCompleteService._filter(value || '', this.options)
          )
        )
        .subscribe((list) => {
          this.filteredOptionsCap2 = list;
        }),

      this.mode.valueChanges.subscribe((value) => {
        this.matchService.matchMode = value;
        this.playerService.players = [];
        this.options = [];
        this.playerService.getAllPlayers().then((players) => {
          players.forEach((player) => {
            this.options.push(player.name);
          });
          this.team1Captain.setValue('');
          this.team2Captain.setValue('');
        });
      })
    );
  }

  public openCurrentPlayerDialog(): void {
    const dialogRef = this.dialog.open(OnFieldPlayerDetailsDialog, {
      data: { isAuto: false },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.matchService.teamData['team1'].name = this.team1Name;
        this.matchService.teamData['team1'].captain = (
          this.team1Captain.value as string
        ).trim();
        this.matchService.teamData['team2'].name = this.team2Name;
        this.matchService.teamData['team2'].captain = (
          this.team2Captain.value as string
        ).trim();
        this.matchService.tossResult = this.tossResult.value;
        this.matchService.tossWinner = this.tossWinner.value;
        this.matchService.totalPlayers = this.totalPlayers;
        this.matchService.totalOvers = this.totalOvers;
        this.matchService.matchMode = this.mode.value;
        this.matchService.setCurrentRoles();
        this.matchService.addBatsmenToTeam(this.liveMatchService.striker, null);
        this.matchService.addBatsmenToTeam(
          this.liveMatchService.nonStriker,
          null
        );
        this.matchService.addBowlerToTeam(this.liveMatchService.currentBowler);
        this.router.navigateByUrl('live');
      }
    });
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach((sub) => {
      sub.unsubscribe();
    });
  }
}
