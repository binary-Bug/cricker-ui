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
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Component } from '@angular/core';

@Component({
  selector: 'admin-code-dialog',
  template: `<h2 mat-dialog-title>Penalty Runs</h2>
    <mat-dialog-content>
      <p>Enter the runs for penalty</p>
      <mat-form-field>
        <mat-label>Enter Runs</mat-label>
        <input type="number" matInput [formControl]="runs" />
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
  ],
})
export class PenaltyRunsDialog {
  constructor(public dialogRef: MatDialogRef<PenaltyRunsDialog>) {}

  runs = new FormControl(0, [Validators.required]);
  onOkClick(): void {
    this.dialogRef.close(this.runs.value);
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }
}
