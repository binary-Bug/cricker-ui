import { AsyncPipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  Validators,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { Observable, startWith, map } from 'rxjs';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import { AutoCompleteService } from '../../services/auto-complete.service';

@Component({
  selector: 'retire-batsmen-dialog',
  template: `<h2 mat-dialog-title>Select Batsmen</h2>
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
      <div class="grid place-items-center">
        <mat-form-field class="example-full-width">
          <mat-label>New Batsmen</mat-label>
          <input
            type="text"
            placeholder="Select Player"
            matInput
            [formControl]="newBatsmen"
            [matAutocomplete]="auto"
          />
          <mat-autocomplete
            #auto="matAutocomplete"
            (optionSelected)="
              filteredOptions = autoCompleteService._filter('', options)
            "
          >
            @for (option of filteredOptions; track option) {
            <mat-option [value]="option">{{ option }}</mat-option>
            }
          </mat-autocomplete>
        </mat-form-field>
      </div>
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
    MatRadioModule,
    MatDividerModule,
  ],
})
export class RetireBatsmenDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<RetireBatsmenDialog>,
    private matchService: MatchService,
    public liveMatchService: LiveMatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService
  ) {}

  options: string[] = [];
  filteredOptions!: string[];

  newBatsmen = new FormControl('', Validators.required);
  selectedBatsmen: string = '';

  ngOnInit(): void {
    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.newBatsmen.setValue('');
    });

    this.newBatsmen.valueChanges
      .pipe(
        startWith(''),
        map((value) =>
          this.autoCompleteService._filter(value || '', this.options)
        )
      )
      .subscribe((list) => {
        this.filteredOptions = list;
      });
  }

  onOkClick(): void {
    this.dialogRef.close({
      old: this.selectedBatsmen,
      new: (this.newBatsmen.value + '').trim(),
    });
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }
}
