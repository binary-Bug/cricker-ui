import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
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
import { MatIconModule } from '@angular/material/icon';
import { LiveMatchService } from '../../services/live-match.service';
import { MatchService } from '../../services/match.service';
import { map, Observable, startWith } from 'rxjs';
import { PlayerService } from '../../services/player.service';
import { UtilityService } from '../../services/utility.service';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';
import { CommonModule } from '@angular/common';
import { AutoCompleteService } from '../../services/auto-complete.service';

@Component({
  selector: 'on-field-player-detail-dialog',
  template: `<h2 mat-dialog-title class="dialog-title">
      {{ data.isAuto ? '2nd Innings Details' : 'Select Opening Players' }}
    </h2>
    <p class="dialog-subtitle">
      {{ data.isAuto
        ? "Second innings is underway - pick the new opening pair and first bowler."
        : "Tap a card below (or its field further down) to search &amp; select that player." }}
    </p>
    <mat-dialog-content>
      <div class="on-field-preview">
        <div
          class="on-field-preview-chip"
          role="button"
          tabindex="0"
          aria-label="Open striker picker"
          (click)="openStrikerPicker()"
          (keydown.enter)="openStrikerPicker()"
        >
          <div
            class="on-field-preview-avatar"
            [style.background]="strikerValue ? utilityService.getAvatarColor(strikerValue) : null"
          >
            {{ strikerValue ? utilityService.getInitials(strikerValue) : '?' }}
          </div>
          <div class="on-field-preview-name">{{ strikerValue || 'Not selected' }}</div>
          <div class="on-field-preview-role">Striker</div>
        </div>
        <div
          class="on-field-preview-chip"
          role="button"
          tabindex="0"
          aria-label="Open non-striker picker"
          (click)="openNonStrikerPicker()"
          (keydown.enter)="openNonStrikerPicker()"
        >
          <div
            class="on-field-preview-avatar"
            [style.background]="nonStrikerValue ? utilityService.getAvatarColor(nonStrikerValue) : null"
          >
            {{ nonStrikerValue ? utilityService.getInitials(nonStrikerValue) : '?' }}
          </div>
          <div class="on-field-preview-name">{{ nonStrikerValue || 'Not selected' }}</div>
          <div class="on-field-preview-role">Non-Striker</div>
        </div>
        <div
          class="on-field-preview-chip"
          role="button"
          tabindex="0"
          aria-label="Open bowler picker"
          (click)="openBowlerPicker()"
          (keydown.enter)="openBowlerPicker()"
        >
          <div
            class="on-field-preview-avatar"
            [style.background]="currentBowlerValue ? utilityService.getAvatarColor(currentBowlerValue) : null"
          >
            {{ currentBowlerValue ? utilityService.getInitials(currentBowlerValue) : '?' }}
          </div>
          <div class="on-field-preview-name">{{ currentBowlerValue || 'Not selected' }}</div>
          <div class="on-field-preview-role">Bowler</div>
        </div>
      </div>

      <div class="on-field-section">
        <div class="section-label">Batting</div>
        <div class="on-field-card">
          <div class="field-group">
            <span class="field-label">Striker *</span>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <input
                #strikerInput
                #strikerTrigger="matAutocompleteTrigger"
                type="text"
                placeholder="Select Player"
                matInput
                [formControl]="striker"
                [matAutocomplete]="auto1"
              />
              <mat-autocomplete
                #auto1="matAutocomplete"
                (optionSelected)="onStrikerSelected($event.option.value)"
              >
                @for (option of filteredOptionsStriker; track option) {
                <mat-option [value]="option">
                  {{ autoCompleteService.isAddPlayerOption(option)
                    ? ('Add Player - ' + autoCompleteService.decodeAddPlayer(option))
                    : option }}
                </mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>

          <div class="field-group">
            <span class="field-label">Non-Striker *</span>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <input
                #nonStrikerInput
                #nonStrikerTrigger="matAutocompleteTrigger"
                type="text"
                placeholder="Select Player"
                matInput
                [formControl]="nonStriker"
                [matAutocomplete]="auto2"
              />
              <mat-autocomplete
                #auto2="matAutocomplete"
                (optionSelected)="onNonStrikerSelected($event.option.value)"
              >
                @for (option of filteredOptionsNonStriker; track option) {
                <mat-option [value]="option">
                  {{ autoCompleteService.isAddPlayerOption(option)
                    ? ('Add Player - ' + autoCompleteService.decodeAddPlayer(option))
                    : option }}
                </mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>

          <div class="same-player-warning" *ngIf="sameBatsmenSelected">
            <mat-icon class="warning-icon">warning</mat-icon>
            Striker and Non-Striker can't be the same player.
          </div>
        </div>
      </div>

      <div class="on-field-section">
        <div class="section-label">Bowling</div>
        <div class="on-field-card">
          <div class="field-group">
            <span class="field-label">Opening Bowler *</span>
            <mat-form-field appearance="outline" subscriptSizing="dynamic">
              <input
                #bowlerInput
                #bowlerTrigger="matAutocompleteTrigger"
                type="text"
                placeholder="Select Player"
                matInput
                [formControl]="currentBowler"
                [matAutocomplete]="auto3"
              />
              <mat-autocomplete
                #auto3="matAutocomplete"
                (optionSelected)="onBowlerSelected($event.option.value)"
              >
                @for (option of filteredOptionsBowler; track option) {
                <mat-option [value]="option">
                  {{ autoCompleteService.isAddPlayerOption(option)
                    ? ('Add Player - ' + autoCompleteService.decodeAddPlayer(option))
                    : option }}
                </mat-option>
                }
              </mat-autocomplete>
            </mat-form-field>
          </div>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button
        mat-stroked-button
        color="primary"
        class="cancel-button"
        [disabled]="data.isAuto ? 'true' : null"
        (click)="onCancelClick()"
      >
        Cancel
      </button>
      <button
        [disabled]="formValid ? null : 'true'"
        mat-flat-button
        color="primary"
        class="done-button"
        (click)="onOkClick()"
      >
        Done
      </button>
    </mat-dialog-actions>`,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
      }

      .dialog-title {
        text-align: center;
        margin: 0;
      }

      .dialog-subtitle {
        text-align: center;
        margin: 4px 0 12px;
        color: #757575;
        font-size: 0.85em;
      }

      mat-dialog-content {
        flex: 1 1 auto;
        min-height: 0;
        max-height: none;
      }

      mat-dialog-actions {
        flex-shrink: 0;
        padding: 12px 16px;
        min-height: 0;
        justify-content: flex-end;
        gap: 12px;
      }

      @media (max-width: 599px) {
        mat-dialog-actions {
          gap: 10px;
        }

        mat-dialog-actions button {
          flex: 1 1 0;
        }
      }

      .on-field-section {
        margin-bottom: 16px;
      }

      .section-label {
        font-size: 0.85rem;
        font-weight: 600;
        color: #616161;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        margin: 0 0 8px 2px;
      }

      .on-field-card {
        background: #fafafa;
        border-radius: 12px;
        padding: 14px;
        display: flex;
        flex-direction: column;
        gap: 10px;
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

      .same-player-warning {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #c62828;
        font-size: 0.85em;
        font-weight: 500;
      }

      .warning-icon {
        font-size: 18px;
        width: 18px;
        height: 18px;
      }

      .on-field-preview {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-around;
        gap: 12px;
        background: #ede7f6;
        border-radius: 12px;
        padding: 14px 12px;
        margin-bottom: 16px;
      }

      .on-field-preview-chip {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        min-width: 84px;
        cursor: pointer;
        border: 2px solid transparent;
        border-radius: 10px;
        padding: 4px;
      }
      .on-field-preview-chip:hover,
      .on-field-preview-chip:focus-visible {
        border-color: #9575cd;
        outline: none;
      }

      .on-field-preview-avatar {
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
      }

      .on-field-preview-name {
        font-weight: 600;
        font-size: 0.9em;
        color: #4527a0;
        text-align: center;
        overflow-wrap: anywhere;
      }

      .on-field-preview-role {
        font-size: 0.72rem;
        color: #757575;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }

      .cancel-button.mat-mdc-button-base,
      .done-button.mat-mdc-button-base {
        min-height: 40px;
        padding: 0 24px;
      }
    `,
  ],
  standalone: true,
  imports: [
    CommonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
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
    public autoCompleteService: AutoCompleteService,
    public utilityService: UtilityService
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

  get strikerValue(): string {
    return (this.striker.value as string) || '';
  }
  get nonStrikerValue(): string {
    return (this.nonStriker.value as string) || '';
  }
  get currentBowlerValue(): string {
    return (this.currentBowler.value as string) || '';
  }

  get sameBatsmenSelected(): boolean {
    const striker = this.strikerValue.trim().toLowerCase();
    const nonStriker = this.nonStrikerValue.trim().toLowerCase();
    return !!striker && !!nonStriker && striker === nonStriker;
  }

  @ViewChild('strikerInput') strikerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('strikerTrigger') strikerTrigger?: MatAutocompleteTrigger;
  @ViewChild('nonStrikerInput') nonStrikerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('nonStrikerTrigger') nonStrikerTrigger?: MatAutocompleteTrigger;
  @ViewChild('bowlerInput') bowlerInput?: ElementRef<HTMLInputElement>;
  @ViewChild('bowlerTrigger') bowlerTrigger?: MatAutocompleteTrigger;

  // Each preview chip doubles as a picker trigger for its own field, same
  // as the New Bowler dialog's click-to-open behaviour.
  openStrikerPicker(): void {
    this.strikerInput?.nativeElement.focus();
    this.strikerTrigger?.openPanel();
  }
  openNonStrikerPicker(): void {
    this.nonStrikerInput?.nativeElement.focus();
    this.nonStrikerTrigger?.openPanel();
  }
  openBowlerPicker(): void {
    this.bowlerInput?.nativeElement.focus();
    this.bowlerTrigger?.openPanel();
  }

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
        map((value) => {
          const term = (value || '') + '';
          const base = this.autoCompleteService._filter(term, this.options);
          return this.autoCompleteService.withAddPlayerOption(term, base);
        })
      )
      .subscribe((list) => {
        this.filteredOptionsStriker = list;
        this.updateFormStatus();
      });

    this.nonStriker.valueChanges
      .pipe(
        startWith(''),
        map((value) => {
          const term = (value || '') + '';
          const base = this.autoCompleteService._filter(term, this.options);
          return this.autoCompleteService.withAddPlayerOption(term, base);
        })
      )
      .subscribe((list) => {
        this.filteredOptionsNonStriker = list;
        this.updateFormStatus();
      });

    this.currentBowler.valueChanges
      .pipe(
        startWith(''),
        map((value) => {
          const term = (value || '') + '';
          const base = this.autoCompleteService._filter(term, this.options);
          return this.autoCompleteService.withAddPlayerOption(term, base);
        })
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
      this.currentBowler.value?.length > 0 &&
      !this.sameBatsmenSelected
    ) {
      this.formValid = true;
    } else this.formValid = false;
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onStrikerSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.striker.setValue(name);
    }
  }
  onNonStrikerSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.nonStriker.setValue(name);
    }
  }
  onBowlerSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.currentBowler.setValue(name);
    }
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

