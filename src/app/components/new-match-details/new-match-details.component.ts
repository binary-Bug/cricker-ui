import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
  FormGroup,
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

  matchDetailsForm = new FormGroup({
    team1Name: new FormControl('', Validators.required),
    team2Name: new FormControl('', Validators.required),
    team1Captain: new FormControl('', Validators.required),
    team2Captain: new FormControl('', Validators.required),
    tossWinner: new FormControl('team1'),
    tossResult: new FormControl('bat'),
    totalPlayers: new FormControl(0, Validators.min(2)),
    totalOvers: new FormControl(0, Validators.min(1)),
    mode: new FormControl('test'),
  });

  options: string[] = [];
  filteredOptionsCap1!: string[];
  filteredOptionsCap2!: string[];
  subscriptions: Subscription[] = [];
  isProdEnv: boolean = environment.isProdEnv;

  ngOnInit(): void {
    this.matchDetailsForm
      .get('mode')
      ?.setValue(environment.isProdEnv ? 'prod' : 'test');
    this.matchService.matchMode = this.matchDetailsForm.get('mode')
      ?.value as string;

    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.matchDetailsForm.get('team1Captain')?.setValue('');
      this.matchDetailsForm.get('team2Captain')?.setValue('');
    });

    this.subscriptions.push(
      this.matchDetailsForm
        .get('team1Captain')
        ?.valueChanges.pipe(
          startWith(''),
          map((value) =>
            this.autoCompleteService._filter(value || '', this.options)
          )
        )
        .subscribe((list) => {
          this.filteredOptionsCap1 = list;
        }) as Subscription,

      this.matchDetailsForm
        .get('team2Captain')
        ?.valueChanges.pipe(
          startWith(''),
          map((value) =>
            this.autoCompleteService._filter(value || '', this.options)
          )
        )
        .subscribe((list) => {
          this.filteredOptionsCap2 = list;
        }) as Subscription,

      this.matchDetailsForm.get('mode')?.valueChanges.subscribe((value) => {
        this.matchService.matchMode = value;
        this.playerService.players = [];
        this.options = [];
        this.playerService.getAllPlayers().then((players) => {
          players.forEach((player) => {
            this.options.push(player.name);
          });
          this.matchDetailsForm.get('team1Captain')?.setValue('');
          this.matchDetailsForm.get('team2Captain')?.setValue('');
        });
      }) as Subscription
    );
  }

  public openCurrentPlayerDialog(): void {
    const dialogRef = this.dialog.open(OnFieldPlayerDetailsDialog, {
      data: { isAuto: false },
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.matchService.teamData['team1'].name = this.matchDetailsForm.get(
          'team1Name'
        )?.value as string;
        this.matchService.teamData['team1'].captain = (
          this.matchDetailsForm.get('team1Captain')?.value as string
        ).trim();
        this.matchService.teamData['team2'].name = this.matchDetailsForm.get(
          'team2Name'
        )?.value as string;
        this.matchService.teamData['team2'].captain = (
          this.matchDetailsForm.get('team2Captain')?.value as string
        ).trim();
        this.matchService.tossResult = this.matchDetailsForm.get('tossResult')
          ?.value as string;
        this.matchService.tossWinner = this.matchDetailsForm.get('tossWinner')
          ?.value as string;
        this.matchService.totalPlayers = this.matchDetailsForm.get(
          'totalPlayers'
        )?.value as number;
        this.matchService.totalOvers = this.matchDetailsForm.get('totalOvers')
          ?.value as number;
        this.matchService.matchMode = this.matchDetailsForm.get('mode')
          ?.value as string;
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
