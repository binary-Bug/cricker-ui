import { CommonModule } from '@angular/common';
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
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
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

export interface DialogData {
  isExtraChecked: boolean;
  isByeChecked: boolean;
}

@Component({
  selector: 'wicket-dialog',
  template: `
    <app-dialog-icon-header
      icon="sports_cricket"
      variant="warn"
      title="Wicket Details"
      subtitle="Record how the wicket fell"
    ></app-dialog-icon-header>

    <mat-dialog-content>
      <div class="field-group">
        <span class="field-label">Who's Out? *</span>
        <mat-radio-group
          [(ngModel)]="selectedBatsmen"
          (ngModelChange)="radioSelected()"
          class="wicket-who-options"
        >
          <mat-radio-button
            color="warn"
            class="wicket-who-option"
            [value]="liveMatchService.striker.name"
          >
            <div
              class="wicket-who-avatar"
              [style.background]="utilityService.getAvatarColor(liveMatchService.striker.name)"
            >
              {{ utilityService.getInitials(liveMatchService.striker.name) }}
            </div>
            <div class="wicket-who-name">{{ liveMatchService.striker.name }}</div>
            <div class="wicket-who-role">Striker</div>
          </mat-radio-button>
          <mat-radio-button
            color="warn"
            class="wicket-who-option"
            [value]="liveMatchService.nonStriker.name"
          >
            <div
              class="wicket-who-avatar"
              [style.background]="utilityService.getAvatarColor(liveMatchService.nonStriker.name)"
            >
              {{ utilityService.getInitials(liveMatchService.nonStriker.name) }}
            </div>
            <div class="wicket-who-name">{{ liveMatchService.nonStriker.name }}</div>
            <div class="wicket-who-role">Non-Striker</div>
          </mat-radio-button>
        </mat-radio-group>
      </div>

      <div class="field-group">
        <span class="field-label">How Was They Out? *</span>
        <mat-chip-listbox (change)="onWicketOptionSelected($event)">
          <div class="wicket-type-grid">
            @for (chip of availableWicketOptions; track chip) {
            <mat-chip-option color="warn" class="wicket-type-chip">{{ chip.name }}</mat-chip-option>
            }
          </div>
        </mat-chip-listbox>
      </div>

      @if (currentWicketOption) {
      <form>
        @if (
          currentWicketOption === 'Caught' ||
          currentWicketOption === 'Stumped' ||
          currentWicketOption === 'Run-out'
        ) {
        <div class="field-group">
          <span class="field-label">{{ actionPlayerLabel }} *</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input
              type="text"
              placeholder="Select Player"
              matInput
              [formControl]="actionPlayer"
              [matAutocomplete]="auto1"
            />
            <mat-autocomplete
              #auto1="matAutocomplete"
              (optionSelected)="onActionPlayerSelected($event.option.value)"
            >
              @for (option of filteredOptionsActionPlayer; track option) {
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
          @if (autoCompleteService.hasAddPlayerOption(filteredOptionsActionPlayer)) {
          <span class="field-hint">No matching player - select "Add Player" below to add them as new.</span>
          }
        </div>
        }
        @if (currentWicketOption === 'Run-out') {
        <div class="field-group">
          <span class="field-label">Run Out At *</span>
          <div class="segmented-toggle">
            <button
              type="button"
              class="segment-btn"
              [class.selected]="selectedEnd === 'striker'"
              (click)="selectedEnd = 'striker'"
            >
              Striker's End
            </button>
            <button
              type="button"
              class="segment-btn"
              [class.selected]="selectedEnd === 'nonStriker'"
              (click)="selectedEnd = 'nonStriker'"
            >
              Non-Striker's End
            </button>
          </div>
        </div>
        }
        @if (
          this.matchService.teamData[this.matchService.currentRoles['bat']]
            .wicketsLost !== this.matchService.totalPlayers! - 2
        ) {
        <div class="new-batsmen-preview">
          <div
            class="new-batsmen-preview-avatar"
            [style.background]="newBatsmenValue ? utilityService.getAvatarColor(newBatsmenValue) : null"
          >
            {{ newBatsmenValue ? utilityService.getInitials(newBatsmenValue) : '?' }}
          </div>
          <div class="new-batsmen-preview-name">{{ newBatsmenValue || 'Not selected' }}</div>
        </div>
        <div class="field-group">
          <span class="field-label">New Batsman *</span>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <input
              type="text"
              placeholder="Select Player"
              matInput
              [formControl]="newBatsmen"
              [matAutocomplete]="auto2"
            />
            <mat-autocomplete
              #auto2="matAutocomplete"
              (optionSelected)="onNewBatsmenSelected($event.option.value)"
            >
              @for (option of filteredOptionsNewBatsmen; track option) {
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
          @if (autoCompleteService.hasAddPlayerOption(filteredOptionsNewBatsmen)) {
          <span class="field-hint">No matching player - select "Add Player" below to add them as new.</span>
          }
        </div>
        }
      </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions class="wicket-actions">
      <button mat-stroked-button class="dlg-btn-secondary" (click)="onCancelClick()">
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        class="dlg-btn-primary warn"
        [disabled]="isInvalid ? 'true' : null"
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
    MatDialogContent,
    MatDialogActions,
    MatChipsModule,
    MatRadioModule,
    MatAutocompleteModule,
    MatInputModule,
    MatFormFieldModule,
    MatIconModule,
    DialogIconHeaderComponent,
  ],
  styles: [
    `
      :host {
        display: block;
      }
      mat-dialog-content {
        padding-top: 12px;
        padding-bottom: 12px;
      }
      .field-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 10px;
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
      .wicket-who-options {
        display: flex;
        gap: 12px;
      }
      .wicket-who-options .wicket-who-option {
        flex: 1 1 0;
      }
      .wicket-who-options .wicket-who-option ::ng-deep .mdc-form-field {
        width: 100%;
      }
      .wicket-who-options .wicket-who-option ::ng-deep .mdc-label {
        width: 100%;
      }
      .wicket-who-option {
        display: block;
        background: #fafafa;
        border-radius: 12px;
        padding: 4px 10px 6px;
      }
      .wicket-who-avatar {
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: #bdbdbd;
        color: white;
        font-weight: 700;
        font-size: 0.9rem;
        margin: 2px auto 4px;
      }
      .wicket-who-name {
        font-weight: 600;
        font-size: 0.9em;
        color: #4527a0;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .wicket-who-role {
        font-size: 0.75em;
        color: #757575;
        text-align: center;
      }
      .wicket-type-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        width: 100%;
      }
      .wicket-type-chip {
        width: 100%;
      }
      .wicket-type-chip ::ng-deep .mdc-evolution-chip {
        width: 100%;
        justify-content: center;
      }
      @media (max-width: 400px) {
        .wicket-type-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      .segmented-toggle {
        display: flex;
        gap: 8px;
      }
      .segment-btn {
        flex: 1 1 0;
        border: 1.5px solid #d1c4e9;
        background: white;
        color: #4527a0;
        border-radius: 10px;
        padding: 8px;
        font-weight: 600;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .segment-btn.selected {
        background: #4527a0;
        border-color: #4527a0;
        color: white;
      }
      .new-batsmen-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        background: #ede7f6;
        border-radius: 12px;
        padding: 6px 12px;
        margin-bottom: 10px;
      }
      .new-batsmen-preview-avatar {
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
        font-size: 1rem;
      }
      .new-batsmen-preview-name {
        font-weight: 600;
        font-size: 0.95em;
        color: #4527a0;
        text-align: center;
        overflow-wrap: anywhere;
      }
      .wicket-actions.mat-mdc-dialog-actions {
        display: flex;
        gap: 10px;
        padding: 12px 24px 20px;
      }
      @media (max-width: 340px) {
        .wicket-actions.mat-mdc-dialog-actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class WicketDialog implements OnInit {
  public data: DialogData;
  constructor(
    public dialogRef: MatDialogRef<WicketDialog>,
    public liveMatchService: LiveMatchService,
    public matchService: MatchService,
    private playerService: PlayerService,
    public autoCompleteService: AutoCompleteService,
    public utilityService: UtilityService
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
  newBatsmen = new FormControl('', Validators.required);
  options: string[] = [];
  filteredOptionsActionPlayer!: string[];
  filteredOptionsNewBatsmen!: string[];
  actionPlayerLabel: string = '';
  isInvalid: boolean = true;

  currentWicketOption: string = '';
  selectedBatsmen: string = '';
  selectedEnd: string = 'striker';

  get newBatsmenValue(): string {
    return (this.newBatsmen.value || '').trim();
  }

  ngOnInit() {
    this.playerService.getAllPlayers().then((players) => {
      players.forEach((player) => {
        this.options.push(player.name);
      });
      this.options = this.autoCompleteService.populatePlayersArray(
        this.options
      );
      this.actionPlayer.setValue('');
      this.newBatsmen.setValue('');
      if (
        this.matchService.teamData[this.matchService.currentRoles['bat']]
          .wicketsLost ===
        this.matchService.totalPlayers! - 2
      ) {
        this.newBatsmen.setValue('none');
      }
    });

    if (this.data.isExtraChecked) {
      this.availableWicketOptions = [
        { name: 'Stumped' },
        { name: 'Run-out' },
        { name: 'Hit-Wicket' },
      ];
    } else if (this.data.isByeChecked) {
      this.availableWicketOptions = [{ name: 'Run-out' }];
    }

    this.actionPlayer.valueChanges
      .pipe(
        startWith(''),
        map((value) => {
          const term = (value || '') + '';
          const base = this.autoCompleteService._filter(term, this.options);
          return this.autoCompleteService.withAddPlayerOption(term, base);
        })
      )
      .subscribe((list) => {
        this.filteredOptionsActionPlayer = list;
      });

    this.actionPlayer.valueChanges.subscribe(() => {
      this.refreshValidity();
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
        this.filteredOptionsNewBatsmen = list;
      });

    this.newBatsmen.valueChanges.subscribe(() => {
      this.refreshValidity();
    });
  }

  public radioSelected() {
    this.refreshValidity();
  }

  /** Single source of truth for Done's disabled state - requires who's out, how out,
   *  a fielder when the wicket type needs one, and a new batsman (or 'none' if all-out). */
  private refreshValidity(): void {
    const hasWho = this.selectedBatsmen.length > 1;
    const hasHow = this.currentWicketOption.length > 0;
    const requiresFielder =
      this.currentWicketOption === 'Caught' ||
      this.currentWicketOption === 'Stumped' ||
      this.currentWicketOption === 'Run-out';
    const hasFielder =
      !requiresFielder ||
      (!!this.actionPlayer.value && this.actionPlayer.value.trim().length > 1);
    const hasNewBatsmen =
      !!this.newBatsmen.value && this.newBatsmen.value.trim().length > 1;
    this.isInvalid = !(hasWho && hasHow && hasFielder && hasNewBatsmen);
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onActionPlayerSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.actionPlayer.setValue(name);
    }
  }
  onNewBatsmenSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.newBatsmen.setValue(name);
    }
  }

  onOkClick(): void {
    this.dialogRef.close({
      action: 'Done',
      selectedBatsmen: this.selectedBatsmen,
      wicketType: this.currentWicketOption,
      newBatsmen:
        this.newBatsmen.value?.length && this.newBatsmen.value?.length > 1
          ? (this.newBatsmen.value + '').trim()
          : 'none',
      actionPlayer: (this.actionPlayer.value + '').trim(),
      selectedEnd: this.selectedEnd,
    });
  }

  onWicketOptionSelected(selectedChip: MatChipListboxChange) {
    this.currentWicketOption = selectedChip.value;
    switch (this.currentWicketOption) {
      case 'Caught':
        this.actionPlayerLabel = 'Caught By';
        break;
      case 'Stumped':
        this.actionPlayerLabel = 'Stumped By';
        break;
      case 'Run-out':
        this.actionPlayerLabel = 'Run out By';
        break;
    }
    this.refreshValidity();
  }
}
