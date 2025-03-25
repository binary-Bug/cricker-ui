import { Component, inject, OnInit } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { map, Observable, startWith } from 'rxjs';
import { PlayerService } from '../../services/player.service';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { CommonModule } from '@angular/common';
import { AutoCompleteService } from '../../services/auto-complete.service';

@Component({
  selector: 'on-field-player-detail-dialog',
  template: `<h2 mat-dialog-title>
      {{ data.isAuto ? '2nd Innings Details' : 'New Match' }}
    </h2>
    <mat-dialog-content>
      <p>Enter on field Player details</p>
      <mat-form-field class="example-full-width">
        <mat-label>Striker</mat-label>
        <input
          type="text"
          placeholder="Select Player"
          matInput
          [formControl]="striker"
          [matAutocomplete]="auto1"
        />
        <mat-autocomplete
          #auto1="matAutocomplete"
          (optionSelected)="
            filteredOptionsStriker = autoCompleteService._filter('', options)
          "
        >
          @for (option of filteredOptionsStriker; track option) {
          <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
      <mat-form-field class="example-full-width">
        <mat-label>Non Striker</mat-label>
        <input
          type="text"
          placeholder="Select Player"
          matInput
          [formControl]="nonStriker"
          [matAutocomplete]="auto2"
        />
        <mat-autocomplete
          #auto2="matAutocomplete"
          (optionSelected)="
            filteredOptionsNonStriker = autoCompleteService._filter('', options)
          "
        >
          @for (option of filteredOptionsNonStriker; track option) {
          <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
      <mat-form-field class="example-full-width">
        <mat-label>Opening Bowler</mat-label>
        <input
          type="text"
          placeholder="Select Player"
          matInput
          [formControl]="currentBowler"
          [matAutocomplete]="auto3"
        />
        <mat-autocomplete
          #auto3="matAutocomplete"
          (optionSelected)="
            filteredOptionsBowler = autoCompleteService._filter('', options)
          "
        >
          @for (option of filteredOptionsBowler; track option) {
          <mat-option [value]="option">{{ option }}</mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        mat-button
        [disabled]="data.isAuto ? 'true' : null"
        (click)="onCancelClick()"
      >
        Cancel
      </button>
      <button
        [disabled]="formValid ? null : 'true'"
        mat-button
        color="primary"
        (click)="onOkClick()"
      >
        Done
      </button>
    </mat-dialog-actions>`,
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatAutocompleteModule,
  ],
})
export class OnFieldPlayerDetailsDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<OnFieldPlayerDetailsDialog>,
    private liveMatchService: LiveMatchService,
    private matchService: MatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService
  ) {
    dialogRef.disableClose = true;
    this.data = inject<any>(MAT_DIALOG_DATA);
  }

  data: any;
  striker = new FormControl('', [Validators.required]);
  nonStriker = new FormControl('', [Validators.required]);
  currentBowler = new FormControl('', [Validators.required]);
  options: string[] = [];
  filteredOptionsStriker!: string[];
  filteredOptionsNonStriker!: string[];
  filteredOptionsBowler!: string[];
  formValid: boolean = false;

  ngOnInit(): void {
    this.striker.statusChanges.subscribe(() => {
      this.updateFormStatus();
    });
    this.nonStriker.statusChanges.subscribe(() => {
      this.updateFormStatus();
    });
    this.currentBowler.statusChanges.subscribe(() => {
      this.updateFormStatus();
    });

    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.striker.setValue('');
      this.nonStriker.setValue('');
      this.currentBowler.setValue('');
    });

    this.striker.valueChanges
      .pipe(
        startWith(''),
        map((value) =>
          this.autoCompleteService._filter(value || '', this.options)
        )
      )
      .subscribe((list) => {
        this.filteredOptionsStriker = list;
      });

    this.nonStriker.valueChanges
      .pipe(
        startWith(''),
        map((value) =>
          this.autoCompleteService._filter(value || '', this.options)
        )
      )
      .subscribe((list) => {
        this.filteredOptionsNonStriker = list;
      });

    this.currentBowler.valueChanges
      .pipe(
        startWith(''),
        map((value) =>
          this.autoCompleteService._filter(value || '', this.options)
        )
      )
      .subscribe((list) => {
        this.filteredOptionsBowler = list;
      });
  }

  updateFormStatus(): void {
    if (
      this.striker.value?.length &&
      this.striker.value?.length > 0 &&
      this.nonStriker.value?.length &&
      this.nonStriker.value?.length > 0 &&
      this.currentBowler.value?.length &&
      this.currentBowler.value?.length > 0
    ) {
      this.formValid = true;
    } else this.formValid = false;
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onOkClick(): void {
    this.liveMatchService.striker.name = (this.striker.value + '').trim();
    this.liveMatchService.nonStriker.name = (this.nonStriker.value + '').trim();
    this.liveMatchService.currentBowler.name = (
      this.currentBowler.value + ''
    ).trim();
    this.dialogRef.close('Done');
  }
}
