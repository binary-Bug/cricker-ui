import { Component, Inject, inject, OnInit } from '@angular/core';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { EventHandlerService } from '../../services/event-handler.service';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatChipListboxChange, MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { map, Observable, startWith } from 'rxjs';
import { AsyncPipe, CommonModule } from '@angular/common';
import { Bowler } from '../../models/bowler.interface';

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
  dialog: MatDialog = inject(MatDialog);

  isWideChecked: boolean = false;
  isNBChecked: boolean = false;
  isLBChecked: boolean = false;
  isByesChecked: boolean = false;
  isWicketChecked: boolean = false;
  wicketDialogRef!: MatDialogRef<WicketDialog>;

  addRun(run: string, color: string): void {
    this.liveMatchService.updateOverData();

    if (this.isWicketChecked) {
      this.wicketDialogRef = this.dialog.open(WicketDialog, {
        data: {
          isExtraChecked:
            this.isWideChecked || this.isNBChecked || this.isLBChecked,
          isByeChecked: this.isByesChecked || +run > 0,
        },
        maxWidth: '100vw',
        width: '100vw',
      });

      this.wicketDialogRef.afterClosed().subscribe((data) => {
        if (data) {
          this.checkForExtras_And_AddRun(
            run,
            color,
            true,
            data.wicketType,
            data.selectedBatsmen,
            data.newBatsmen
          );
          this.liveMatchService.resetCurrentPatnership();
          this.matchService.updateBatsmenStatus(
            data.selectedBatsmen,
            this.liveMatchService.currentBowler.name,
            data.wicketType,
            data.actionPlayer
          );
          this.liveMatchService.updateBatsmenEnd(
            data.newBatsmen,
            data.selectedEnd
          );
          this.checkForOverCompletion();
        } else {
          this.unCheckExtras();
        }
      });
    } else {
      this.checkForExtras_And_AddRun(run, color, false, null, null, null);
      this.checkForOverCompletion();
    }
  }

  checkForOverCompletion(): void {
    if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .oversPlayed -
        Math.trunc(
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .oversPlayed
        ) ===
      0
    ) {
      this.liveMatchService.swapStriker();
      let newBowlerDialog = this.dialog.open(NewBowlerDialog);
      newBowlerDialog.afterClosed().subscribe((data) => {
        let bi: number = -1;
        let bowlerData: Bowler | undefined = this.matchService.teamData[
          this.matchService.currentRoles['ball']
        ].Bowlers.find((bowler, index) => {
          if (bowler.name === data) {
            bi = index;
            return true;
          }
          return false;
        });
        if (bowlerData) {
          this.matchService.teamData[
            this.matchService.currentRoles['ball']
          ].currBowlerIndex = bi;
          this.liveMatchService.currentBowler = bowlerData;
          this.liveMatchService.bowlerRunsBeforeStart =
            this.liveMatchService.currentBowler.runs;
        } else {
          this.liveMatchService.currentBowler = {
            name: data,
            overs: 0,
            maidens: 0,
            runs: 0,
            wickets: 0,
            extras: { w: 0, nb: 0, lb: 0 },
          };
          this.matchService.addBowlerToTeam(
            this.liveMatchService.currentBowler
          );
          this.liveMatchService.bowlerRunsBeforeStart =
            this.liveMatchService.currentBowler.runs;
        }

        this.eventHandler.NotifyRunAddedEvent();
        this.liveMatchService.updatePlayerData(
          this.liveMatchService.currentOverNumber
        );
      });
    }
  }

  updateBallDataCSS(run: string, color: string): void {
    if (this.isWideChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + 'wd', 'extra');
      this.liveMatchService.addExtra('w', +run);
      this.liveMatchService.updateCurrentPatnership(+run, false);
    } else if (this.isLBChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + ' LB', 'run');
      this.liveMatchService.addExtra('lb', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isByesChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + ' B', 'run');
      this.liveMatchService.addExtra('b', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isNBChecked) {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run + 'nb', 'extra');
      this.liveMatchService.addExtra('nb', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else {
      if (!this.isWicketChecked)
        this.liveMatchService.updateBallDataCSS(run, color);
      this.liveMatchService.updateCurrentPatnership(+run);
    }

    let runLabel: string = run;
    if (+run === 0) runLabel = '';
    if (this.isWicketChecked)
      this.liveMatchService.updateBallDataCSS(runLabel + 'W', 'wicket');
  }

  checkForExtras_And_AddRun(
    run: string,
    color: string,
    isWicketBall: boolean,
    wicketType: string | null,
    selectedBatsmen: string | null,
    newBatsmen: string | null
  ): void {
    let isExtra: boolean = false;

    if (this.isWideChecked || this.isNBChecked) {
      run = +run + 1 + '';
      isExtra = true;
      this.eventHandler.NotifyUpdateOverViewGridEvent(true);
      this.liveMatchService.totalBallsinCurrentOver += 1;
      this.eventHandler.NotifyUpdateOverViewGridEvent(false);
      this.liveMatchService.addNewBalltoOversPlayedData();
    }

    this.updateBallDataCSS(run, color);

    this.liveMatchService.updateBallDataRuns(run, isExtra, isWicketBall);
    this.liveMatchService.updateBowlerData(
      +run,
      this.isWideChecked,
      this.isNBChecked,
      this.isByesChecked,
      isWicketBall,
      wicketType
    );

    if (!this.isWideChecked)
      this.liveMatchService.addRunToStriker(
        +run,
        this.isNBChecked,
        this.isByesChecked,
        this.isLBChecked
      );
    else {
      if ((+run - 1) % 2 !== 0) this.liveMatchService.swapStriker();
      this.liveMatchService.updatePlayerData();
    }

    if (isWicketBall) {
      this.liveMatchService.updateOnFieldBatsmen(
        selectedBatsmen + '',
        newBatsmen + ''
      );
      this.eventHandler.NotifyUpdateOnFieldBatsmenEvent();
      this.liveMatchService.updatePlayerData();
    }

    this.liveMatchService.updateBallNumber();

    if (!this.isWideChecked && !this.isNBChecked)
      this.liveMatchService.updateOversPlayed();

    this.matchService.calculateCurrentRunRate();
    this.eventHandler.NotifyRunAddedEvent();
    this.unCheckExtras();
  }

  unCheckExtras(): void {
    this.isWideChecked = false;
    this.isNBChecked = false;
    this.isLBChecked = false;
    this.isByesChecked = false;
    this.isWicketChecked = false;
  }
}

export interface DialogData {
  isExtraChecked: boolean;
  isByeChecked: boolean;
}

@Component({
  selector: 'wicket-dialog',
  template: `
    <h1 mat-dialog-title>Wicket Details</h1>

    <mat-dialog-content>
      <div class="grid place-items-center">
        <mat-radio-group [(ngModel)]="selectedBatsmen" style="width: 100%;">
          <div class="flex justify-between">
            <div>
              <mat-radio-button
                color="primary"
                [value]="liveMatchService.striker.name"
                >{{ liveMatchService.striker.name }}</mat-radio-button
              >
            </div>
            <div>
              <mat-radio-button
                color="primary"
                [value]="liveMatchService.nonStriker.name"
                >{{ liveMatchService.nonStriker.name }}</mat-radio-button
              >
            </div>
          </div>
        </mat-radio-group>
      </div>

      <mat-divider></mat-divider>

      <div class="mt-4 grid place-items-center">
        <mat-chip-listbox (change)="onWicketOptionSelected($event)">
          <div class="grid grid-cols-3 justify-items-center">
            @for (chip of availableWicketOptions; track chip) {
            <div style="width: 120px;">
              <mat-chip-option color="warn">{{ chip.name }}</mat-chip-option>
            </div>
            }
          </div>
        </mat-chip-listbox>
      </div>

      <div *ngIf="currentWicketOption" class="mt-4 grid place-items-center">
        <form class="example-form">
          <mat-form-field
            *ngIf="
              currentWicketOption === 'Caught' ||
              currentWicketOption === 'Stumped' ||
              currentWicketOption === 'Run-out'
            "
            class="example-full-width"
          >
            <mat-label>{{ label }}</mat-label>
            <input
              type="text"
              placeholder="Select Player"
              matInput
              [formControl]="actionPlayer"
              [matAutocomplete]="auto"
            />
            <mat-autocomplete #auto="matAutocomplete">
              @for (option of filteredOptions | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
          <mat-divider></mat-divider>
          <mat-form-field
            *ngIf="currentWicketOption === 'Run-out'"
            class="example-full-width"
          >
            <mat-label>Run out At</mat-label>
            <mat-select [(value)]="selectedEnd">
              <mat-option value="striker">Striker</mat-option>
              <mat-option value="nonStriker">Non-Striker</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-divider></mat-divider>
          <mat-form-field class="example-full-width">
            <mat-label>New Batsmen</mat-label>
            <input
              type="text"
              placeholder="Select Player"
              matInput
              [formControl]="newBatsmen"
              [matAutocomplete]="auto"
            />
            <mat-autocomplete #auto="matAutocomplete">
              @for (option of filteredOptionsNewBatsmen | async; track option) {
              <mat-option [value]="option">{{ option }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        </form>
      </div>
    </mat-dialog-content>

    <mat-dialog-actions>
      <button mat-button (click)="onCancelClick()">Cancel</button>
      <button
        mat-button
        [disabled]="isInvalid ? 'true' : null"
        color="primary"
        (click)="onOkClick()"
      >
        Done
      </button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    MatChipsModule,
    MatRadioModule,
    MatDividerModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    AsyncPipe,
  ],
})
export class WicketDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<WicketDialog>,
    public liveMatchService: LiveMatchService,
    @Inject(MAT_DIALOG_DATA) public data: DialogData
  ) {
    dialogRef.disableClose = true;
  }

  availableWicketOptions: { name: string }[] = [
    { name: 'Bowled' },
    { name: 'LBW' },
    { name: 'Caught' },
    { name: 'Stumped' },
    { name: 'Run-out' },
  ];

  actionPlayer = new FormControl('', Validators.required);
  newBatsmen = new FormControl('', Validators.required);
  options: string[] = ['Choli', 'Dhobhi', 'Brohit'];
  filteredOptions!: Observable<string[]>;
  filteredOptionsNewBatsmen!: Observable<string[]>;
  label: string = '';
  isInvalid: boolean = true;

  currentWicketOption: string = '';
  selectedBatsmen: string = '';
  selectedEnd: string = '';

  ngOnInit() {
    if (this.data.isExtraChecked) {
      this.availableWicketOptions = [{ name: 'Stumped' }, { name: 'Run-out' }];
    } else if (this.data.isByeChecked) {
      this.availableWicketOptions = [{ name: 'Run-out' }];
    }

    this.filteredOptions = this.actionPlayer.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || ''))
    );

    this.actionPlayer.valueChanges.subscribe((value) => {
      if (
        this.currentWicketOption === 'Caught' ||
        this.currentWicketOption === 'Stumped' ||
        this.currentWicketOption === 'Run-out'
      ) {
        if (this.newBatsmen.value && this.newBatsmen.value?.length > 3) {
          if (value && value.length > 3) this.isInvalid = false;
          else this.isInvalid = true;
        } else {
          this.isInvalid = true;
        }
      }
    });

    this.filteredOptionsNewBatsmen = this.newBatsmen.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || ''))
    );

    this.newBatsmen.valueChanges.subscribe((value) => {
      if (
        this.currentWicketOption === 'Caught' ||
        this.currentWicketOption === 'Stumped' ||
        this.currentWicketOption === 'Run-out'
      ) {
        if (this.actionPlayer.value && this.actionPlayer.value?.length > 3) {
          if (value && value.length > 3) this.isInvalid = false;
          else this.isInvalid = true;
        } else {
          this.isInvalid = true;
        }
      } else {
        if (value && value.length > 3) this.isInvalid = false;
        else this.isInvalid = true;
      }
    });
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.options.filter((option) =>
      option.toLowerCase().includes(filterValue)
    );
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
    this.dialogRef.close({
      action: 'Done',
      selectedBatsmen: this.selectedBatsmen,
      wicketType: this.currentWicketOption,
      newBatsmen: this.newBatsmen.value,
      actionPlayer: this.actionPlayer.value,
      selectedEnd: this.selectedEnd,
    });
  }

  onWicketOptionSelected(selectedChip: MatChipListboxChange) {
    this.currentWicketOption = selectedChip.value;
    switch (this.currentWicketOption) {
      case 'Caught':
        this.label = 'Caught By';
        this.isInvalid = true;
        break;
      case 'Stumped':
        this.label = 'Stumped By';
        this.isInvalid = true;
        break;
      case 'Run-out':
        this.label = 'Run out By';
        this.isInvalid = true;
        break;
    }
  }
}

@Component({
  selector: 'new-bowler-dialog',
  template: `<h2 mat-dialog-title>Select Bowler</h2>
    <mat-dialog-content>
      <mat-form-field class="example-full-width">
        <mat-label>New Bowler</mat-label>
        <input
          type="text"
          placeholder="Select Player"
          matInput
          [formControl]="newBowler"
          [matAutocomplete]="auto"
        />
        <mat-autocomplete #auto="matAutocomplete">
          @for (option of filteredOptions | async; track option) {
          <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="onCancelClick()">Cancel</button>
      <button mat-button color="primary" (click)="onOkClick()" cdkFocusInitial>
        Done
      </button>
    </mat-dialog-actions>`,
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatAutocompleteModule,
    AsyncPipe,
  ],
})
export class NewBowlerDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<NewBowlerDialog>,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService
  ) {
    dialogRef.disableClose = true;
  }

  options: string[] = [];
  filteredOptions!: Observable<string[]>;

  newBowler = new FormControl('', Validators.required);

  ngOnInit(): void {
    this.filteredOptions = this.newBowler.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || ''))
    );

    this.options.push(
      ...this.matchService.teamData[
        this.matchService.currentRoles['ball']
      ].Bowlers.map((bowler) => {
        return bowler.name === this.liveMatchService.currentBowler.name
          ? ''
          : bowler.name;
      })
    );

    this.options = this.options.filter((option) => option.length > 1);
  }

  onOkClick(): void {
    this.dialogRef.close(this.newBowler.value);
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();

    return this.options.filter((option) =>
      option.toLowerCase().includes(filterValue)
    );
  }
}
