import { Component, inject, OnDestroy, OnInit } from '@angular/core';
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

export interface PlayerGroup {
  label: string;
  names: string[];
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
        <mat-autocomplete
          #auto="matAutocomplete"
          (optionSelected)="bowlerSelected()"
          (closed)="closed()"
          (opened)="opened()"
        >
          @for (group of filteredOptions; track group) {
          <mat-optgroup style="font-weight: 500;" [label]="group.label">
            @for (name of group.names; track name) {
            <mat-option [value]="name">{{ name }}</mat-option>
            }
          </mat-optgroup>
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
        mat-button
        color="primary"
        (click)="onOkClick()"
        cdkFocusInitial
        [disabled]="newBowler.invalid"
      >
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
export class NewBowlerDialog implements OnInit, OnDestroy {
  constructor(
    public dialogRef: MatDialogRef<NewBowlerDialog>,
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
  filteredOptions: PlayerGroup[] = [
    { label: 'This Match', names: [] },
    { label: 'All Players', names: [] },
  ];

  newBowler = new FormControl('', Validators.required);

  ngOnInit(): void {
    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.options = this.autoCompleteService._filter(
        this.liveMatchService.currentBowler.name,
        this.options,
        true
      );
      this.newBowler.setValue('');
    });

    this.filteredOptions[0].names = this.autoCompleteService._filter(
      this.liveMatchService.currentBowler.name,
      this.matchService.teamData[
        this.matchService.currentRoles['ball']
      ].Bowlers.map((bowler) => bowler.name),
      true
    );

    if (this.filteredOptions[0].names.length === 0) {
      this.filteredOptions.splice(0, 1);
    }

    this.newBowler.valueChanges
      .pipe(
        startWith(''),
        map((value) => {
          if (this.filteredOptions.length === 2) {
            this.filteredOptions[0].names = this.autoCompleteService._filter(
              value || '',
              this.autoCompleteService._filter(
                this.liveMatchService.currentBowler.name,
                this.matchService.teamData[
                  this.matchService.currentRoles['ball']
                ].Bowlers.map((bowler) => bowler.name),
                true
              )
            );
          }
          return this.autoCompleteService._filter(value || '', this.options);
        })
      )
      .subscribe((list) => {
        this.filteredOptions[this.filteredOptions.length - 1].names = list;
      });
  }

  public bowlerSelected(): void {
    this.filteredOptions.forEach((group) => {
      if (group.label !== 'This Match')
        group.names = this.autoCompleteService._filter('', this.options);
      else
        group.names = this.autoCompleteService._filter(
          this.liveMatchService.currentBowler.name,
          this.matchService.teamData[
            this.matchService.currentRoles['ball']
          ].Bowlers.map((bowler) => bowler.name),
          true
        );
    });
  }

  closed(): void {
    document
      .getElementsByClassName('cdk-overlay-connected-position-bounding-box')[0]
      ?.classList.add('newBowlerDialogClass');
  }
  opened(): void {
    document
      .getElementsByClassName('cdk-overlay-connected-position-bounding-box')[0]
      ?.classList.remove('newBowlerDialogClass');
  }

  onOkClick(): void {
    this.dialogRef.close((this.newBowler.value + '').trim());
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }

  ngOnDestroy(): void {
    document
      .getElementsByClassName('cdk-overlay-connected-position-bounding-box')[0]
      ?.classList.remove('newBowlerDialogClass');
  }
}
