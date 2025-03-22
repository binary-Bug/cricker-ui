import { Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { LoadMatchService } from '../../services/load-match.service';
import { LoadMatchDTO } from '../../models/LoadMatchDTO.interface';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-match-list',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './match-list.component.html',
  styleUrl: './match-list.component.css',
})
export class MatchListComponent {
  public matchesList: LoadMatchDTO[] = [];
  constructor(
    public loadMatchService: LoadMatchService,
    public router: Router
  ) {
    loadMatchService.getAllMatches().then((matches) => {
      this.matchesList = matches;
    });
  }
}
