import { Component, Inject, inject } from '@angular/core';
import { RoomService } from '../../services/room.service';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
  MatDialogRef,
  MatDialogTitle,
  MatDialogContent,
  MatDialogActions,
} from '@angular/material/dialog';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
@Component({
  selector: 'app-room',
  standalone: true,
  imports: [MatButtonModule],
  templateUrl: './room.component.html',
  styleUrl: './room.component.css',
})
export class RoomComponent {
  constructor(public dialog: MatDialog, private router: Router) {}
  roomService = inject(RoomService);
  openCodeDialog(): void {
    const dialogRef = this.dialog.open(DialogOverviewExampleDialog);

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.router.navigateByUrl('newMatchDetails');
      }
    });
  }
  exit(): void {
    this.roomService.currentRoom = null;
    this.router.navigateByUrl('');
  }
}

@Component({
  selector: 'dialog-overview-example-dialog',
  template: `<h2 mat-dialog-title>Admin Code</h2>
    <mat-dialog-content>
      <p>Enter the admin code to create new match</p>
      <mat-form-field>
        <mat-label>Enter Code</mat-label>
        <input matInput [formControl]="adminCode" />
        <mat-error>Invalid Code</mat-error>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions>
      <button mat-button (click)="onCancelClick()">Cancel</button>
      <button mat-button color="primary" (click)="onOkClick()" cdkFocusInitial>
        Submit
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
export class DialogOverviewExampleDialog {
  constructor(
    public dialogRef: MatDialogRef<DialogOverviewExampleDialog>,
    private roomService: RoomService
  ) {}

  adminCode = new FormControl('', [Validators.required]);
  onOkClick(): void {
    if (this.roomService.currentRoom.adminCode === this.adminCode.value) {
      this.dialogRef.close('Success');
    } else {
      this.adminCode.setErrors({ error: true });
    }
  }
  onCancelClick(): void {
    this.dialogRef.close();
  }
}
