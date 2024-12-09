import { Component } from '@angular/core';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { CommonModule } from '@angular/common';
import {
  FormControl,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatRadioModule } from '@angular/material/radio';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialog,
} from '@angular/material/dialog';
import { Router } from '@angular/router';
import { MatchService } from '../../services/match.service';
import { OnFieldPlayerDetailsDialog } from '../dailogs/on-field-player-detail.dialog';
@Component({
  selector: 'app-new-match-details',
  standalone: true,
  imports: [
    MatInputModule,
    MatFormFieldModule,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatRadioModule,
    MatButtonModule,
  ],
  templateUrl: './new-match-details.component.html',
  styleUrl: './new-match-details.component.css',
})
export class NewMatchDetailsComponent {
  constructor(
    public dialog: MatDialog,
    private router: Router,
    private matchService: MatchService
  ) {}
  team1Name: string = '';
  team2Name: string = '';
  team1Captain: string = '';
  team2Captain: string = '';
  tossWinner = new FormControl('team1');
  tossResult = new FormControl('bat');
  totalPlayers: number = 0;
  totalOvers: number = 0;

  openCurrentPlayerDialog(): void {
    const dialogRef = this.dialog.open(OnFieldPlayerDetailsDialog);

    dialogRef.afterClosed().subscribe((result) => {
      if (result) {
        this.matchService.teamData['team1'].name = this.team1Name;
        this.matchService.teamData['team1'].captain = this.team1Captain;
        this.matchService.teamData['team2'].name = this.team2Name;
        this.matchService.teamData['team2'].captain = this.team2Captain;
        this.matchService.tossResult = this.tossResult.value;
        this.matchService.tossWinner = this.tossWinner.value;
        this.matchService.totalPlayers = this.totalPlayers;
        this.matchService.totalOvers = this.totalOvers;
        this.matchService.setCurrentRoles();
        this.router.navigateByUrl('live');
      }
    });
  }
}
