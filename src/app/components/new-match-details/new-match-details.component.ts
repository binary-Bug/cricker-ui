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
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatchService } from '../../services/match.service';
import { ModeService } from '../../services/mode.service';
import { OnFieldPlayerDetailsDialog } from '../dailogs/on-field-player-detail.dialog';
import { LiveMatchService } from '../../services/live-match.service';
import { PlayerService } from '../../services/player.service';
import { UtilityService } from '../../services/utility.service';
import { map, Observable, startWith, Subscription } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { AutoCompleteService } from '../../services/auto-complete.service';
import {
  TeamNameAdjective,
  TeamNameResolverService,
} from '../../services/team-name-resolver.service';
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
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
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
    private modeService: ModeService,
    private liveMatchService: LiveMatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService,
    private teamNameResolverService: TeamNameResolverService,
    public utilityService: UtilityService
  ) {}

  matchDetailsForm = new FormGroup({
    team1Captain: new FormControl('', Validators.required),
    team2Captain: new FormControl('', Validators.required),
    tossWinner: new FormControl('team1'),
    tossResult: new FormControl('bat'),
    totalPlayers: new FormControl(0, [Validators.required, Validators.min(2)]),
    totalOvers: new FormControl(0, [Validators.required, Validators.min(1)]),
    mode: new FormControl('test'),
  });

  options: string[] = [];
  filteredOptionsCap1!: string[];
  filteredOptionsCap2!: string[];
  subscriptions: Subscription[] = [];
  isProdEnv: boolean = environment.isProdEnv;

  // Picked once per page load (see ngOnInit) and never re-rolled, so a
  // team's adjective stays fixed no matter how many times its captain changes.
  team1Adjective!: TeamNameAdjective;
  team2Adjective!: TeamNameAdjective;

  ngOnInit(): void {
    [this.team1Adjective, this.team2Adjective] =
      this.teamNameResolverService.pickTwoDistinctAdjectives();

    this.matchDetailsForm
      .get('mode')
      ?.setValue(environment.isProdEnv ? 'prod' : 'test');
    this.modeService.setMode(
      this.matchDetailsForm.get('mode')?.value as 'prod' | 'test'
    );

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
          map((value) => {
            const term = (value || '') + '';
            const base = this.autoCompleteService._filter(term, this.options);
            return this.autoCompleteService.withAddPlayerOption(term, base);
          })
        )
        .subscribe((list) => {
          this.filteredOptionsCap1 = list;
        }) as Subscription,

      this.matchDetailsForm
        .get('team2Captain')
        ?.valueChanges.pipe(
          startWith(''),
          map((value) => {
            const term = (value || '') + '';
            const base = this.autoCompleteService._filter(term, this.options);
            return this.autoCompleteService.withAddPlayerOption(term, base);
          })
        )
        .subscribe((list) => {
          this.filteredOptionsCap2 = list;
        }) as Subscription,

      this.matchDetailsForm.get('mode')?.valueChanges.subscribe((value) => {
        this.modeService.setMode(value as 'prod' | 'test');
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
      panelClass: 'on-field-player-dialog-panel',
    });

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.matchService.teamData['team1'].name = this.resolvedTeam1Name;
        this.matchService.teamData['team1'].captain = (
          this.matchDetailsForm.get('team1Captain')?.value as string
        ).trim();
        this.matchService.teamData['team2'].name = this.resolvedTeam2Name;
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
        this.modeService.setMode(
          this.matchDetailsForm.get('mode')?.value as 'prod' | 'test'
        );
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

  goBack(): void {
    this.router.navigateByUrl('room');
  }

  onCap1Selected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.matchDetailsForm.get('team1Captain')?.setValue(name);
    }
  }
  onCap2Selected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.matchDetailsForm.get('team2Captain')?.setValue(name);
    }
  }

  /** "<Captain first name> <Adjective>", e.g. "Virat Warriors" - falls back to
   * "Team 1"/"Team 2" until a captain has been picked. */
  get resolvedTeam1Name(): string {
    const first = this.teamNameResolverService.firstName(
      this.matchDetailsForm.get('team1Captain')?.value
    );
    return `${first || 'Team 1'} ${this.team1Adjective.name}`;
  }
  get resolvedTeam2Name(): string {
    const first = this.teamNameResolverService.firstName(
      this.matchDetailsForm.get('team2Captain')?.value
    );
    return `${first || 'Team 2'} ${this.team2Adjective.name}`;
  }

  get team1AdjectiveEmoji(): string {
    return this.team1Adjective.emoji;
  }
  get team2AdjectiveEmoji(): string {
    return this.team2Adjective.emoji;
  }

  /** Raw captain field values as plain strings (never null/undefined) - for
   * template use with UtilityService's avatar helpers, which require a
   * definite string. */
  get team1CaptainValue(): string {
    return (this.matchDetailsForm.get('team1Captain')?.value as string) || '';
  }
  get team2CaptainValue(): string {
    return (this.matchDetailsForm.get('team2Captain')?.value as string) || '';
  }

  /** True once both captains are chosen (non-empty) and resolve to the same name. */
  get sameCaptainSelected(): boolean {
    const cap1 = ((this.matchDetailsForm.get('team1Captain')?.value as string) || '')
      .trim()
      .toLowerCase();
    const cap2 = ((this.matchDetailsForm.get('team2Captain')?.value as string) || '')
      .trim()
      .toLowerCase();
    return !!cap1 && !!cap2 && cap1 === cap2;
  }

  /** Both captains chosen - gates when the new resolved-name viewer box appears. */
  get bothCaptainsSelected(): boolean {
    return (
      !!(this.matchDetailsForm.get('team1Captain')?.value as string || '').trim() &&
      !!(this.matchDetailsForm.get('team2Captain')?.value as string || '').trim()
    );
  }
}
