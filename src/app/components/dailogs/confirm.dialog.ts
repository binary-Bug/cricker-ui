import { Component, Inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
  MatDialogModule,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DialogIconHeaderComponent } from './dialog-icon-header.component';

export interface ConfirmDialogData {
  title: string;
  message: string;
  icon?: string;
  variant?: 'primary' | 'warn';
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <app-dialog-icon-header
      [icon]="data.icon ?? 'help_outline'"
      [variant]="data.variant ?? 'primary'"
      [title]="data.title"
    ></app-dialog-icon-header>
    <mat-dialog-content class="confirm-content">
      <p class="confirm-message">{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions class="confirm-actions">
      <button
        mat-stroked-button
        class="dlg-btn-secondary"
        (click)="onCancel()"
      >
        {{ data.cancelText ?? 'Cancel' }}
      </button>
      <button
        mat-flat-button
        [color]="data.variant === 'warn' ? 'warn' : 'primary'"
        class="dlg-btn-primary"
        [class.warn]="data.variant === 'warn'"
        (click)="onConfirm()"
        cdkFocusInitial
      >
        {{ data.confirmText ?? 'Confirm' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
        text-align: center;
      }
      .confirm-content {
        padding-top: 0 !important;
      }
      .confirm-message {
        color: #424242;
        margin: 0 0 4px;
      }
      .confirm-actions.mat-mdc-dialog-actions {
        display: flex;
        gap: 10px;
        padding: 12px 24px 20px;
      }
      @media (max-width: 400px) {
        .confirm-actions.mat-mdc-dialog-actions {
          flex-direction: column-reverse;
        }
      }
    `,
  ],
  imports: [
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    DialogIconHeaderComponent,
  ],
})
export class ConfirmDialog {
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialog>,
    @Inject(MAT_DIALOG_DATA) public data: ConfirmDialogData
  ) {}

  onConfirm(): void {
    this.dialogRef.close(true);
  }

  onCancel(): void {
    this.dialogRef.close(false);
  }
}

