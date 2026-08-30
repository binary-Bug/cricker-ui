import { AsyncPipe, CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormsModule,
  ReactiveFormsModule,
  FormControl,
  Validators,
  FormGroup,
} from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { Observable, startWith, map } from 'rxjs';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import { AutoCompleteService } from '../../services/auto-complete.service';
import { UtilityService } from '../../services/utility.service';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

@Component({
  selector: 'retire-batsmen-dialog',
  template: `
    <app-dialog-icon-header
      icon="exit_to_app"
      title="Retire Batsman"
      subtitle="Choose who's retiring and their replacement"
    ></app-dialog-icon-header>
    <mat-dialog-content>
      <form [formGroup]="retireBatsmenForm">
        <div class="field-group">
          <span class="field-label">Who's Retiring? *</span>
          <mat-radio-group
            formControlName="selectedBatsmen"
            class="retiring-options"
          >
            <mat-radio-button
              color="primary"
              class="retiring-option"
              [value]="liveMatchService.striker.name"
            >
              <div
                class="retiring-avatar"
                [style.background]="utilityService.getAvatarColor(liveMatchService.striker.name)"
              >
                {{ utilityService.getInitials(liveMatchService.striker.name) }}
              </div>
              <div class="retiring-name">{{ liveMatchService.striker.name }}</div>
              <div class="retiring-role">Striker</div>
            </mat-radio-button>
            <mat-radio-button
              color="primary"
              class="retiring-option"
              [value]="liveMatchService.nonStriker.name"
            >
              <div
                class="retiring-avatar"
                [style.background]="utilityService.getAvatarColor(liveMatchService.nonStriker.name)"
              >
                {{ utilityService.getInitials(liveMatchService.nonStriker.name) }}
              </div>
              <div class="retiring-name">{{ liveMatchService.nonStriker.name }}</div>
              <div class="retiring-role">Non-Striker</div>
            </mat-radio-button>
          </mat-radio-group>
        </div>
        <div class="field-group">
          <span class="field-label">New Batsman *</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input
              type="text"
              placeholder="Select Player"
              matInput
              formControlName="newBatsmen"
              [matAutocomplete]="auto"
            />
            <mat-autocomplete
              #auto="matAutocomplete"
              (optionSelected)="onOptionSelected($event.option.value)"
            >
              <mat-option
                *ngFor="let option of filteredOptions"
                [value]="option"
                [class.add-player-option]="autoCompleteService.isAddPlayerOption(option)"
              >
                @if (autoCompleteService.isAddPlayerOption(option)) {
                <span class="add-player-row">
                  <mat-icon class="add-player-icon">person_add</mat-icon>
                  <span>Add "<strong>{{ autoCompleteService.decodeAddPlayer(option) }}</strong>" as new player</span>
                </span>
                } @else { {{ option }} }
              </mat-option>
            </mat-autocomplete>
          </mat-form-field>
          @if (autoCompleteService.hasAddPlayerOption(filteredOptions)) {
          <span class="field-hint">No matching player - select "Add Player" below to add them as new.</span>
          }
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions class="retire-batsmen-actions">
      <button mat-stroked-button class="dlg-btn-secondary" (click)="onCancelClick()">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary"
        (click)="onOkClick()"
        cdkFocusInitial
        [disabled]="retireBatsmenForm.invalid"
      >
        Done
      </button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatRadioModule,
    MatDividerModule,
    MatIconModule,
    DialogIconHeaderComponent,
  ],
  styles: [
    `
      :host {
        display: block;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 16px;
      }
      .field-group .mat-mdc-form-field {
        width: 100%;
      }
      .field-label {
        font-size: 0.78rem;
        font-weight: 600;
        color: #757575;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .field-hint {
        font-size: 0.78rem;
        color: #5e35b1;
        font-style: italic;
      }
      .retiring-options {
        display: flex;
        gap: 12px;
      }
      .retiring-options .retiring-option {
        flex: 1 1 0;
      }
      .retiring-options .retiring-option ::ng-deep .mdc-form-field {
        width: 100%;
      }
      .retiring-options .retiring-option ::ng-deep .mdc-label {
        width: 100%;
      }
      .retiring-option {
        display: block;
        background: #fafafa;
        border-radius: 12px;
        padding: 4px 10px 10px;
      }
      .retiring-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: #bdbdbd;
        color: white;
        font-weight: 700;
        font-size: 0.95rem;
        margin: 4px auto 6px;
      }
      .retiring-name {
        font-weight: 600;
        font-size: 0.9em;
        color: #4527a0;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .retiring-role {
        font-size: 0.75em;
        color: #757575;
        text-align: center;
      }
      .retire-batsmen-actions.mat-mdc-dialog-actions {
        display: flex;
        gap: 10px;
        padding: 12px 24px 20px;
      }
      @media (max-width: 340px) {
        .retire-batsmen-actions.mat-mdc-dialog-actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class RetireBatsmenDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<RetireBatsmenDialog>,
    private matchService: MatchService,
    public liveMatchService: LiveMatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService,
    public utilityService: UtilityService
  ) {}

  options: string[] = [];
  filteredOptions!: string[];

  retireBatsmenForm = new FormGroup({
    newBatsmen: new FormControl('', Validators.required),
    selectedBatsmen: new FormControl('', Validators.required),
  });

  ngOnInit(): void {
    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.retireBatsmenForm.get('newBatsmen')?.setValue('');
    });

    this.retireBatsmenForm
      .get('newBatsmen')
      ?.valueChanges.pipe(
        startWith(''),
        map((value) => {
          const term = (value || '') + '';
          const base = this.autoCompleteService._filter(term, this.options);
          return this.autoCompleteService.withAddPlayerOption(term, base);
        })
      )
      .subscribe((list) => {
        this.filteredOptions = list;
      });
  }

  onOkClick(): void {
    this.dialogRef.close({
      old: this.retireBatsmenForm.get('selectedBatsmen')?.value,
      new: (this.retireBatsmenForm.get('newBatsmen')?.value + '').trim(),
    });
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }

  onOptionSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.retireBatsmenForm.get('newBatsmen')?.setValue(name);
    }
  }
}
