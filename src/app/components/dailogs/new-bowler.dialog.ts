import { AsyncPipe } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { FormsModule, ReactiveFormsModule, FormControl, Validators } from "@angular/forms";
import { MatAutocompleteModule } from "@angular/material/autocomplete";
import { MatButtonModule } from "@angular/material/button";
import { MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogRef } from "@angular/material/dialog";
import { MatFormFieldModule } from "@angular/material/form-field";
import { MatInputModule } from "@angular/material/input";
import { Observable, startWith, map } from "rxjs";
import { LiveMatchService } from "../../services/live-match.service";
import { MatchService } from "../../services/match.service";

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