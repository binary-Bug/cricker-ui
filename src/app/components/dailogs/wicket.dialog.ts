import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule, MatChipListboxChange } from '@angular/material/chips';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { Observable, startWith, map } from 'rxjs';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';

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
          <mat-form-field
            *ngIf="
              this.matchService.teamData[this.matchService.currentRoles['bat']]
                .wicketsLost !==
              this.matchService.totalPlayers! - 2
            "
            class="example-full-width"
          >
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
  public data: DialogData;
  constructor(
    public dialogRef: MatDialogRef<WicketDialog>,
    public liveMatchService: LiveMatchService,
    public matchService: MatchService
  ) {
    dialogRef.disableClose = true;
    this.data = inject<DialogData>(MAT_DIALOG_DATA);
  }

  availableWicketOptions: { name: string }[] = [
    { name: 'Bowled' },
    { name: 'LBW' },
    { name: 'Caught' },
    { name: 'Stumped' },
    { name: 'Run-out' },
    { name: 'Hit-Wicket' },
  ];

  actionPlayer = new FormControl('', Validators.required);
  newBatsmen = new FormControl('none', Validators.required);
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
      this.availableWicketOptions = [
        { name: 'Stumped' },
        { name: 'Run-out' },
        { name: 'Hit-Wicket' },
      ];
    } else if (this.data.isByeChecked) {
      this.availableWicketOptions = [{ name: 'Run-out' }];
    }

    if (
      this.matchService.teamData[this.matchService.currentRoles['bat']]
        .wicketsLost ===
      this.matchService.totalPlayers! - 2
    ) {
      this.isInvalid = false;
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
      default:
        if (
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .wicketsLost ===
          this.matchService.totalPlayers! - 2
        ) {
          this.isInvalid = false;
        }
        break;
    }
  }
}
