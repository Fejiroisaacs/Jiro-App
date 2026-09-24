import { Component, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroButtonComponent, JiroInputComponent, JiroLogoComponent],
  template: `
    <main class="auth-page">
      <jiro-logo class="auth-logo" [size]="40" />
      <div class="auth-card">
        <h1>Forgot password</h1>
        <p class="subtitle">Enter your email and we'll send you a reset link.</p>

        @if (sent()) {
<div>
          <div class="success-box">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            <p>Check your inbox! If that email is registered you'll receive a reset link shortly.</p>
          </div>
          <a routerLink="/login" class="back-link">← Back to login</a>
        </div>
} @else {

          <div class="form-fields">
            <jiro-input
              [(ngModel)]="email"
              type="email"
              placeholder="you@example.com"
              label="Email">
            </jiro-input>
          </div>

          <jiro-button
            block
            variant="primary"
            [disabled]="!email.trim() || loading()"
            (click)="submit()"
            style="width: 100%; margin-top: 8px">
            {{ loading() ? 'Sending...' : 'Send reset link' }}
          </jiro-button>

          <a routerLink="/login" class="back-link">← Back to login</a>
        
}

        
      </div>
    </main>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      background: var(--bg-main);
      padding: var(--space-lg);
    }

    /* Brand above the card; the wordmark takes currentColor. */
    .auth-logo {
      color: var(--color-primary);
      margin-bottom: var(--space-xl);
    }

    .auth-card {
      width: 100%;
      max-width: 400px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-2xl);
    }

    h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      margin-bottom: var(--space-sm);
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-xl);
    }

    .form-fields {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      margin-bottom: var(--space-lg);
    }

    .success-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-xl);
      background: var(--bg-main);
      border-radius: var(--border-radius);
      text-align: center;
      color: var(--color-accent);
      margin-bottom: var(--space-lg);
    }

    .success-box p {
      color: var(--text-primary);
      font-size: var(--font-size-sm);
    }

    .back-link {
      display: block;
      margin-top: var(--space-lg);
      text-align: center;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
    }

    .back-link:hover {
      color: var(--text-primary);
    }
  `]
})
export class ForgotPasswordComponent {
  email = '';
  loading = signal(false);
  sent = signal(false);

  constructor(private authService: AuthService) {}

  submit() {
    if (!this.email.trim() || this.loading()) return;
    this.loading.set(true);
    this.authService.forgotPassword(this.email.trim()).subscribe({
      next: () => {
        this.loading.set(false);
        this.sent.set(true);
      },
      error: () => {
        // Always show success to prevent enumeration
        this.loading.set(false);
        this.sent.set(true);
      },
    });
  }
}
