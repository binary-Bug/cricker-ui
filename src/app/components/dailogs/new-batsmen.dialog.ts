import { AsyncPipe, CommonModule } from '@angular/common';
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
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Observable, startWith, map } from 'rxjs';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { PlayerService } from '../../services/player.service';
import { AutoCompleteService } from '../../services/auto-complete.service';
import { UtilityService } from '../../services/utility.service';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

@Component({
  selector: 'new-batsmen-dialog',
  template: `
    <app-dialog-icon-header
      icon="person_add"
      title="New Batsman"
      subtitle="Select the next batsman to come to the crease"
    ></app-dialog-icon-header>
    <mat-dialog-content>
      <div class="new-batsmen-preview">
        <div
          class="new-batsmen-preview-avatar"
          [style.background]="batsmanValue ? utilityService.getAvatarColor(batsmanValue) : null"
        >
          {{ batsmanValue ? utilityService.getInitials(batsmanValue) : '?' }}
        </div>
        <div class="new-batsmen-preview-name">{{ batsmanValue || 'Not selected' }}</div>
      </div>
      <div class="field-group">
        <span class="field-label">New Batsman *</span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input
            type="text"
            placeholder="Select Player"
            matInput
            [formControl]="newBatsmen"
            [matAutocomplete]="auto"
          />
          <mat-autocomplete
            #auto="matAutocomplete"
            (optionSelected)="onOptionSelected($event.option.value)"
          >
            @for (option of filteredOptions; track option) {
            <mat-option
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
            }
          </mat-autocomplete>
        </mat-form-field>
        @if (autoCompleteService.hasAddPlayerOption(filteredOptions)) {
        <span class="field-hint">No matching player - select "Add Player" below to add them as new.</span>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="new-batsmen-actions">
      <button
        mat-stroked-button
        class="dlg-btn-secondary"
        [disabled]="data.isAuto ? 'true' : null"
        (click)="onCancelClick()"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary"
        (click)="onOkClick()"
        cdkFocusInitial
        [disabled]="newBatsmen.invalid"
      >
        Done
      </button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    MatButtonModule,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatIconModule,
    DialogIconHeaderComponent,
  ],
  styles: [
    `
      :host {
        display: block;
      }
      .new-batsmen-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        background: #ede7f6;
        border-radius: 12px;
        padding: 14px 12px;
        margin-bottom: 16px;
      }
      .new-batsmen-preview-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: #bdbdbd;
        color: white;
        font-weight: 700;
        font-size: 1.05rem;
      }
      .new-batsmen-preview-name {
        font-weight: 600;
        font-size: 0.95em;
        color: #4527a0;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
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
      .new-batsmen-actions.mat-mdc-dialog-actions {
        display: flex;
        gap: 10px;
        padding: 12px 24px 20px;
      }
      @media (max-width: 340px) {
        .new-batsmen-actions.mat-mdc-dialog-actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class NewBatsmenDialog implements OnInit {
  constructor(
    public dialogRef: MatDialogRef<NewBatsmenDialog>,
    private matchService: MatchService,
    private liveMatchService: LiveMatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService,
    public utilityService: UtilityService
  ) {
    dialogRef.disableClose = true;
    this.data = inject<any>(MAT_DIALOG_DATA);
  }

  data: any;
  options: string[] = [];
  filteredOptions!: string[];

  newBatsmen = new FormControl('', Validators.required);

  get batsmanValue(): string {
    return (this.newBatsmen.value || '').trim();
  }

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
    this.dialogRef.close((this.newBatsmen.value + '').trim());
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }

  onOptionSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.newBatsmen.setValue(name);
    }
  }
}

