import { Component, signal, OnInit } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../shared/components/jiro-skeleton/jiro-skeleton';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [RouterLink, JiroButtonComponent, JiroLogoComponent, JiroIconComponent, JiroSkeletonComponent],
  template: `
    <main class="auth-page">
      <jiro-logo class="auth-logo" [size]="40" />
      <div class="auth-card">

        @if (state() === 'loading') {
<div class="state-box" aria-busy="true">
          <jiro-skeleton class="state-sk-icon" width="48px" height="48px" />
          <h1 class="state-msg">Verifying your email...</h1>
          <jiro-skeleton class="state-sk-text" [lines]="2" height="12px" />
        </div>
}

        @if (state() === 'success') {
<div class="state-box success">
          <jiro-icon name="check-circle" [size]="48" class="state-icon" />
          <h1>Email verified!</h1>
          <p>Your email has been verified successfully.</p>
          <a routerLink="/dashboard" class="action-link">Go to dashboard <jiro-icon name="arrow-right" [size]="16" /></a>
        </div>
}

        @if (state() === 'error') {
<div class="state-box error">
          <jiro-icon name="warning-circle" [size]="48" class="state-icon" />
          <h1>Link invalid or expired</h1>
          <p>This verification link is invalid or has expired.</p>
          @if (authService.isAuthenticated()) {
<jiro-button
           
            block
            variant="primary"
            [disabled]="resending()"
            (click)="resend()">
            {{ resending() ? 'Sending...' : 'Send new verification email' }}
          </jiro-button>
}
          @if (resent()) {
<p class="resent-msg">Sent! Check your inbox.</p>
}
          @if (!authService.isAuthenticated()) {
<a routerLink="/login" class="action-link"><jiro-icon name="arrow-left" [size]="16" /> Back to sign in</a>
}
        </div>
}

        @if (state() === 'no-token') {
<div class="state-box error">
          <h1>Invalid link</h1>
          <p>No verification token was found in this URL.</p>
          <a routerLink="/dashboard" class="action-link">Go to dashboard <jiro-icon name="arrow-right" [size]="16" /></a>
        </div>
}

      </div>
    </main>
  `,
  styles: [`
    .auth-page {
      min-height: 100dvh;
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

    .state-box h1 {
      font-size: var(--font-size-xl);
      font-weight: 600;
    }

    /* Loading state: the h1 keeps the look of the plain status line it was. */
    .state-box h1.state-msg {
      font-family: var(--font-family);
      font-size: var(--font-size-sm);
      font-weight: 400;
      letter-spacing: normal;
      line-height: var(--line-height-body);
      color: var(--text-secondary);
    }

    .state-box p {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .state-box.success .state-icon {
      color: var(--color-accent);
    }

    .state-box.error .state-icon {
      color: var(--color-danger);
    }

    .state-sk-text { width: 100%; max-width: 260px; align-items: center; }

    .action-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
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
