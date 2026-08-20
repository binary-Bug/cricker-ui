import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { SpinnerService } from '../../services/spinner.service';

/**
 * Global full-screen loading overlay - mounted once in AppComponent,
 * driven entirely by SpinnerService.isLoading$. See SpinnerService's doc
 * comment for which calls are/aren't wired to show this.
 */
@Component({
  selector: 'app-spinner-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './spinner-overlay.component.html',
  styleUrl: './spinner-overlay.component.css',
})
export class SpinnerOverlayComponent {
  constructor(public spinnerService: SpinnerService) {}
}
