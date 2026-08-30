import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/**
 * Shared icon-badge + title + optional subtitle header, used at the top of
 * every redesigned dialog instead of each one pasting its own copy of the
 * markup/CSS (see .dlg-* classes in styles.css). Purely presentational.
 */
@Component({
  selector: 'app-dialog-icon-header',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  template: `
    <div class="dlg-header-row">
      <div class="dlg-icon-badge" [class.warn]="variant === 'warn'">
        <mat-icon class="dlg-icon">{{ icon }}</mat-icon>
      </div>
      <h2 class="dlg-title" [class.warn]="variant === 'warn'">{{ title }}</h2>
    </div>
    <p class="dlg-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
  `,
})
export class DialogIconHeaderComponent {
  @Input() icon: string = 'help_outline';
  @Input() variant: 'primary' | 'warn' = 'primary';
  @Input() title!: string;
  @Input() subtitle?: string;
}
