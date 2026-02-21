import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterLink, JiroButtonComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">

        <div *ngIf="state() === 'loading'" class="state-box">
          <div class="spinner"></div>
          <p>Verifying your email...</p>
        </div>

        <div *ngIf="state() === 'success'" class="state-box success">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <h2>Email verified!</h2>
          <p>Your email has been verified successfully.</p>
          <a routerLink="/dashboard" class="action-link">Go to dashboard →</a>
        </div>

        <div *ngIf="state() === 'error'" class="state-box error">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <h2>Link invalid or expired</h2>
          <p>This verification link is invalid or has expired.</p>
          <jiro-button
            *ngIf="authService.isAuthenticated()"
            variant="primary"
            [disabled]="resending()"
            (click)="resend()">
            {{ resending() ? 'Sending...' : 'Send new verification email' }}
          </jiro-button>
          <p *ngIf="resent()" class="resent-msg">Sent! Check your inbox.</p>
          <a routerLink="/login" class="action-link" *ngIf="!authService.isAuthenticated()">Back to login →</a>
        </div>

        <div *ngIf="state() === 'no-token'" class="state-box error">
          <h2>Invalid link</h2>
          <p>No verification token was found in this URL.</p>
          <a routerLink="/dashboard" class="action-link">Go to dashboard →</a>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-main);
      padding: var(--space-lg);
    }

    .auth-card {
      width: 100%;
      max-width: 420px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-2xl);
    }

    .state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      text-align: center;
      padding: var(--space-lg) 0;
    }

    .state-box h2 {
      font-size: var(--font-size-xl);
      font-weight: 600;
    }

    .state-box p {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .state-box.success svg {
      color: var(--color-accent);
    }

    .state-box.error svg {
      color: var(--color-danger);
    }

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .action-link {
      margin-top: var(--space-sm);
      font-size: var(--font-size-sm);
      color: var(--color-primary);
      text-decoration: none;
    }

    .resent-msg {
      color: var(--color-accent);
      font-size: var(--font-size-sm);
    }
  `]
})
export class VerifyEmailComponent implements OnInit {
  state = signal<'loading' | 'success' | 'error' | 'no-token'>('loading');
  resending = signal(false);
  resent = signal(false);

  constructor(
    public authService: AuthService,
    private route: ActivatedRoute,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.queryParams['token'];
    if (!token) {
      this.state.set('no-token');
      return;
    }

    this.authService.verifyEmail(token).subscribe({
      next: () => this.state.set('success'),
      error: () => this.state.set('error'),
    });
  }

  resend() {
    this.resending.set(true);
    this.authService.resendVerification().subscribe({
      next: () => {
        this.resending.set(false);
        this.resent.set(true);
      },
      error: () => {
        this.resending.set(false);
        this.resent.set(true); // show sent regardless
      },
    });
  }
}
