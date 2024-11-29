import { Component, inject, OnInit } from '@angular/core';
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
import {
  MatDialog,
  MatDialogActions,
  MatDialogContent,
  MatDialogRef,
  MatDialogTitle,
} from '@angular/material/dialog';
import { map, Observable, startWith } from 'rxjs';
import { AsyncPipe, CommonModule } from '@angular/common';

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

  addRun(run: string, color: string): void {
    if (this.isWicketChecked)
      this.dialog.open(WicketDialog, {
        maxWidth: '100vw',
        width: '100vw',
      });
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
    else this.liveMatchService.updatePlayerData();

    this.liveMatchService.updateBallNumber();

    if (!this.isWideChecked && !this.isNBChecked)
      this.liveMatchService.updateOversPlayed();

    this.matchService.calculateCurrentRunRate();
    this.eventHandler.NotifyRunAddedEvent();
    this.unCheckExtras();
  }

  updateBallDataCSS(run: string, color: string): void {
    if (this.isWideChecked) {
      this.liveMatchService.updateBallDataCSS(run + 'wd', 'extra');
      this.liveMatchService.addExtra('w', +run);
      this.liveMatchService.updateCurrentPatnership(+run, false);
    } else if (this.isLBChecked) {
      this.liveMatchService.updateBallDataCSS(run + ' LB', 'run');
      this.liveMatchService.addExtra('lb', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isByesChecked) {
      this.liveMatchService.updateBallDataCSS(run + ' B', 'run');
      this.liveMatchService.addExtra('b', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else if (this.isNBChecked) {
      this.liveMatchService.updateBallDataCSS(run + 'nb', 'extra');
      this.liveMatchService.addExtra('nb', +run);
      this.liveMatchService.updateCurrentPatnership(+run);
    } else {
      this.liveMatchService.updateBallDataCSS(run, color);
      this.liveMatchService.updateCurrentPatnership(+run);
    }
  }

  unCheckExtras(): void {
    this.isWideChecked = false;
    this.isNBChecked = false;
    this.isLBChecked = false;
    this.isByesChecked = false;
    this.isWicketChecked = false;
  }
}

@Component({
  selector: 'wicket-dialog',
  template: `
    <h1 mat-dialog-title>Wicket Details</h1>

    <mat-dialog-content>
      <div class="grid place-items-center">
        <mat-radio-group style="width: 100%;">
          <div class="flex justify-between">
            <div>
              <mat-radio-button color="primary" value="1">{{
                liveMatchService.striker.name
              }}</mat-radio-button>
            </div>
            <div>
              <mat-radio-button color="primary" value="2">{{
                liveMatchService.nonStriker.name
              }}</mat-radio-button>
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
    AsyncPipe,
  ],
})
export class WicketDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<WicketDialog>,
    public liveMatchService: LiveMatchService
  ) {}

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

  ngOnInit() {
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
    this.dialogRef.close('Done');
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
