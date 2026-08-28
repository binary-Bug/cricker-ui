import { ReactiveFormsModule, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { RoomService } from '../../services/room.service';
import { Component } from '@angular/core';

@Component({
  selector: 'admin-code-dialog',
  // Icon badge + purple accent header matches the dashboard/stats redesign
  // language (room.component.css's tile-icon/hero-cta treatment) - this is
  // the first dialog getting that same visual pass.
  template: `
    <div class="admin-code-icon-wrap">
      <mat-icon class="admin-code-icon">lock</mat-icon>
    </div>
    <h2 mat-dialog-title class="admin-code-title">Admin Code</h2>
    <mat-dialog-content class="admin-code-content">
      <p class="admin-code-subtitle">
        Enter the admin code to create a new match
      </p>
      <!-- Plain styled input instead of mat-form-field - avoids Material's
           outline/notch/floating-label markup entirely, just a single
           editable box. -->
      <div class="admin-code-field">
        <label for="admin-code-input" class="admin-code-label"
          >Enter Code</label
        >
        <input
          id="admin-code-input"
          type="text"
          class="admin-code-input"
          [formControl]="adminCode"
          cdkFocusInitial
          (keyup.enter)="onOkClick()"
        />
        <div
          class="admin-code-error"
          *ngIf="adminCode.invalid && adminCode.touched"
        >
          Invalid code, please try again
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions class="admin-code-actions">
      <button
        mat-raised-button
        color="primary"
        class="admin-code-submit"
        (click)="onOkClick()"
      >
        Submit
      </button>
      <button mat-button class="admin-code-cancel" (click)="onCancelClick()">
        Cancel
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      :host {
        display: block;
        text-align: center;
        overflow-x: hidden;
      }
      .admin-code-icon-wrap {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        background-color: #ede7f6;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 4px auto 12px;
      }
      .admin-code-icon {
        color: #5e35b1;
        font-size: 28px;
        width: 28px;
        height: 28px;
      }
      .admin-code-title {
        color: #4527a0;
        font-weight: 700;
        margin: 0 0 4px;
      }
      .admin-code-content {
        /* Material's default 65vh max-height + overflow:auto is meant for
           long/scrollable dialog bodies - this dialog's content is small
           and fixed, so it should just fit without ever needing its own
           internal scrollbar. */
        padding-top: 0 !important;
        max-height: none;
        overflow: visible;
      }
      .admin-code-subtitle {
        color: #757575;
        font-size: 0.9rem;
        margin: 0 0 16px;
      }
      .admin-code-field {
        width: 100%;
        box-sizing: border-box;
        text-align: left;
      }
      .admin-code-label {
        display: block;
        font-size: 0.78rem;
        font-weight: 600;
        color: #4527a0;
        margin: 0 0 6px 2px;
      }
      .admin-code-input {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 14px;
        font: inherit;
        color: #212121;
        background-color: #fff;
        border: 1.5px solid #d1c4e9;
        border-radius: 10px;
        outline: none;
        transition:
          border-color 0.15s ease,
          box-shadow 0.15s ease;
      }
      .admin-code-input:focus {
        border-color: #5e35b1;
        box-shadow: 0 0 0 3px rgba(94, 53, 177, 0.15);
      }
      .admin-code-input.ng-invalid.ng-touched {
        border-color: #d32f2f;
      }
      .admin-code-error {
        color: #d32f2f;
        font-size: 0.78rem;
        margin: 6px 0 0 2px;
      }
      /* Compound selectors (own class + Material's own class) needed to
         out-specificity the theme's default flex-end/row layout - centers
         the buttons with equal left/right space instead of Material's
         default flex-end row. A fixed px cap (not a %) keeps the buttons a
         sensible size regardless of the dialog's own responsive width. */
      .admin-code-actions.mat-mdc-dialog-actions {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        padding: 8px 24px 20px;
      }
      .admin-code-submit.mat-mdc-button-base {
        width: 100%;
        max-width: 260px;
        height: 48px;
        border-radius: 14px;
        font-weight: 600;
        margin: 0;
        box-shadow: 0 4px 14px rgba(69, 39, 160, 0.35);
      }
      .admin-code-cancel.mat-mdc-button-base {
        width: 100%;
        max-width: 260px;
        color: #757575;
      }
    `,
  ],
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDialogTitle,
    MatDialogContent,
    MatDialogActions,
    ReactiveFormsModule,
  ],
})
export class AdminCodeDialog {
  constructor(
    public dialogRef: MatDialogRef<AdminCodeDialog>,
    private roomService: RoomService
  ) {}

  adminCode = new FormControl('', [Validators.required]);
  onOkClick(): void {
    //if (this.roomService.currentRoom.adminCode === this.adminCode.value) {
    if ('gameon' === this.adminCode.value?.toLowerCase()) {
      this.dialogRef.close('Success');
    } else {
      this.adminCode.setErrors({ error: true });
    }
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }
}
