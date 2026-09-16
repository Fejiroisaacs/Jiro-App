import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [JiroButtonComponent],
  template: `
    <main class="nf">
      <p class="nf-code">404</p>
      <h1>Page not found</h1>
      <p class="nf-text">That address does not match anything in Jiro. It may have moved, or the link may be mistyped.</p>
      <div class="nf-action">
        <jiro-button type="button" (click)="goHome()">
          {{ authService.isAuthenticated() ? 'Back to your dashboard' : 'Back to the start' }}
        </jiro-button>
      </div>
    </main>
  `,
  styles: [`
    .nf {
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: var(--space-2xl) var(--space-lg);
      background: var(--bg-page);
      color: var(--text-primary);
    }
    .nf-code {
      font-family: var(--font-family);
      font-size: var(--font-size-sm);
      font-weight: 600;
      letter-spacing: 0.12em;
      color: var(--text-muted);
      margin-bottom: var(--space-sm);
    }
    h1 {
      font-size: var(--font-size-2xl);
      margin-bottom: var(--space-md);
      text-wrap: balance;
    }
    .nf-text {
      max-width: 42ch;
      color: var(--text-secondary);
      line-height: 1.55;
      margin-bottom: var(--space-xl);
      text-wrap: pretty;
    }
    .nf-action { width: 100%; max-width: 280px; }
  `]
})
export class NotFoundComponent {
  readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  goHome() {
    this.router.navigateByUrl(this.authService.isAuthenticated() ? '/dashboard' : '/');
  }
}
