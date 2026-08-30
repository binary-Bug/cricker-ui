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

export interface PlayerGroup {
  label: string;
  names: string[];
}

@Component({
  selector: 'new-bowler-dialog',
  template: `
    <app-dialog-icon-header
      icon="change_circle"
      title="New Bowler"
      subtitle="Select the bowler for the next over"
    ></app-dialog-icon-header>
    <mat-dialog-content>
      <div class="new-bowler-preview">
        <div
          class="new-bowler-preview-avatar"
          [style.background]="bowlerValue ? utilityService.getAvatarColor(bowlerValue) : null"
        >
          {{ bowlerValue ? utilityService.getInitials(bowlerValue) : '?' }}
        </div>
        <div class="new-bowler-preview-name">{{ bowlerValue || 'Not selected' }}</div>
      </div>
      <div class="field-group">
        <span class="field-label">New Bowler *</span>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <input
            type="text"
            placeholder="Select Player"
            matInput
            [formControl]="newBowler"
            [matAutocomplete]="auto"
          />
          <mat-autocomplete
            #auto="matAutocomplete"
            (optionSelected)="onOptionSelected($event.option.value)"
            (closed)="closed()"
            (opened)="opened()"
          >
            @for (group of filteredOptions; track group) {
            <mat-optgroup style="font-weight: 500;" [label]="group.label">
              @for (name of group.names; track name) {
              <mat-option
                [value]="name"
                [class.add-player-option]="autoCompleteService.isAddPlayerOption(name)"
              >
                @if (autoCompleteService.isAddPlayerOption(name)) {
                <span class="add-player-row">
                  <mat-icon class="add-player-icon">person_add</mat-icon>
                  <span>Add "<strong>{{ autoCompleteService.decodeAddPlayer(name) }}</strong>" as new player</span>
                </span>
                } @else { {{ name }} }
              </mat-option>
              }
            </mat-optgroup>
            }
          </mat-autocomplete>
        </mat-form-field>
        @if (autoCompleteService.hasAddPlayerOption(filteredOptions[filteredOptions.length - 1]?.names)) {
        <span class="field-hint">No matching player - select "Add Player" below to add them as new.</span>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="new-bowler-actions">
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
        [disabled]="newBowler.invalid"
      >
        Done
      </button>
    </mat-dialog-actions>
  `,
  standalone: true,
  imports: [
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
      .new-bowler-preview {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        background: #ede7f6;
        border-radius: 12px;
        padding: 14px 12px;
        margin-bottom: 16px;
      }
      .new-bowler-preview-avatar {
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
      .new-bowler-preview-name {
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
      .new-bowler-actions.mat-mdc-dialog-actions {
        display: flex;
        gap: 10px;
        padding: 12px 24px 20px;
      }
      @media (max-width: 340px) {
        .new-bowler-actions.mat-mdc-dialog-actions {
          flex-direction: column-reverse;
          align-items: stretch;
        }
      }
    `,
  ],
})
export class NewBowlerDialog implements OnInit, OnDestroy {
  constructor(
    public dialogRef: MatDialogRef<NewBowlerDialog>,
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
  filteredOptions: PlayerGroup[] = [
    { label: 'This Match', names: [] },
    { label: 'All Players', names: [] },
  ];

  newBowler = new FormControl('', Validators.required);

  get bowlerValue(): string {
    return (this.newBowler.value || '').trim();
  }

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
          const term = (value || '') + '';
          if (this.filteredOptions.length === 2) {
            const baseThisMatch = this.autoCompleteService._filter(
              term,
              this.autoCompleteService._filter(
                this.liveMatchService.currentBowler.name,
                this.matchService.teamData[
                  this.matchService.currentRoles['ball']
                ].Bowlers.map((bowler) => bowler.name),
                true
              )
            );
            // "This Match" is a curated shortlist - the "Add Player" option only
            // ever appears once, in the "All Players" group set below.
            this.filteredOptions[0].names = baseThisMatch;
          }
          const baseAll = this.autoCompleteService._filter(term, this.options);
          return this.autoCompleteService.withAddPlayerOption(term, baseAll);
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

  onOptionSelected(val: string): void {
    if (this.autoCompleteService.isAddPlayerOption(val)) {
      const name = this.autoCompleteService.decodeAddPlayer(val);
      this.newBowler.setValue(name);
    } else {
      this.bowlerSelected();
    }
  }

  ngOnDestroy(): void {
    document
      .getElementsByClassName('cdk-overlay-connected-position-bounding-box')[0]
      ?.classList.remove('newBowlerDialogClass');
  }
}
