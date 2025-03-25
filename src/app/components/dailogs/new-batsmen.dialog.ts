import { AsyncPipe } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
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
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Observable, startWith, map } from 'rxjs';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import { AutoCompleteService } from '../../services/auto-complete.service';

@Component({
  selector: 'new-batsmen-dialog',
  template: `<h2 mat-dialog-title>Select Batsmen</h2>
    <mat-dialog-content>
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
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        mat-button
        [disabled]="data.isAuto ? 'true' : null"
        (click)="onCancelClick()"
      >
        Cancel
      </button>
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
  ],
})
export class NewBatsmenDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<NewBatsmenDialog>,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService
  ) {
    dialogRef.disableClose = true;
    this.data = inject<any>(MAT_DIALOG_DATA);
  }

  data: any;
  options: string[] = [];
  filteredOptions!: string[];

  newBatsmen = new FormControl('', Validators.required);

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
    this.dialogRef.close((this.newBatsmen.value + '').trim());
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }
}
