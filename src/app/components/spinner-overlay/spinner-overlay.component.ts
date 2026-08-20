import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
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
  constructor(public spinnerService: SpinnerService, private router: Router) {}

  /**
   * Escape hatch for a slow/stuck API call - hides the overlay right away
   * (see SpinnerService.forceHide()'s doc comment) and sends the user
   * back to the app's home route rather than leaving them stranded on
   * whatever page triggered the load.
   */
  cancelLoading(): void {
    this.spinnerService.forceHide();
    this.router.navigateByUrl('/');
  }
}
