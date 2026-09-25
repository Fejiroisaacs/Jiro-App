import { Component, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, demoLoginErrorMessage } from '../../core/services/auth.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroCardComponent, JiroButtonComponent, JiroInputComponent, JiroLogoComponent],
  template: `
    <main class="auth-page">
      <div class="auth-container">
        <div class="auth-header">
          <jiro-logo class="auth-logo" [size]="40" />
          <p class="auth-subtitle">Your life, in one place.</p>
        </div>

        <!-- ngSkipHydration: NgForm (ngModel inside <form>) has a documented
             hydration mismatch (NG0502) with no visible symptom - a normal
             client render replaces it. Login has no content a crawler reads
             through hydration anyway, so the fallback costs nothing here. -->
        <jiro-card ngSkipHydration>
          <h1 class="auth-title">Sign in</h1>
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <jiro-input
              label="Email"
              type="email"
              placeholder="you@example.com"
              [(ngModel)]="email"
              name="email"
              [error]="error()">
            </jiro-input>

            <jiro-input
              label="Password"
              type="password"
              placeholder="Enter your password"
              [(ngModel)]="password"
              name="password">
            </jiro-input>

            <a routerLink="/forgot-password" class="forgot-link">Forgot password?</a>

            <jiro-button class="outline-when-disabled" block type="submit" [loading]="loading()" [disabled]="!email || !password">
              Sign In
            </jiro-button>
          </form>

          <p class="auth-footer">
            Don't have an account? <a routerLink="/register" [queryParams]="returnQuery">Create one</a>
          </p>
          <p class="auth-demo">
            Just looking?
            <button type="button" class="demo-link" [disabled]="demoLoading()" [attr.aria-busy]="demoLoading() ? 'true' : null" (click)="tryDemo()">
              {{ demoLoading() ? 'Opening the demo...' : 'Try the demo' }}
            </button>
          </p>
          @if (demoError()) {
            <p class="demo-error" role="alert">{{ demoError() }}</p>
          }
        </jiro-card>
      </div>
    </main>
  `,
  styles: [`
    .auth-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-page);
      padding: var(--space-lg);
    }

    .auth-container {
      width: 100%;
      max-width: 400px;
    }

    .auth-header {
      text-align: center;
      margin-bottom: var(--space-xl);
    }

    /* <jiro-logo> is inline-flex, so text-align on the header centres it;
       its wordmark takes currentColor. */
    .auth-logo {
      color: var(--color-primary);
    }

    .auth-subtitle {
      color: var(--text-secondary);
      margin-top: var(--space-xs);
    }

    .auth-title {
      font-size: var(--font-size-xl);
      font-weight: 600;
      margin-bottom: var(--space-md);
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .forgot-link {
      align-self: flex-end;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
      margin-top: -4px;
    }

    .forgot-link:hover {
      color: var(--text-primary);
    }

    .auth-footer {
      text-align: center;
      margin-top: var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    /* Underlined: inside a sentence, colour alone doesn't mark it as a link. */
    .auth-footer a {
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .auth-demo {
      text-align: center;
      margin-top: var(--space-xs);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    /* An action, so a button, dressed as the link beside it. */
    .demo-link {
      background: none;
      border: none;
      padding: 0;
      font: inherit;
      color: var(--color-primary);
      text-decoration: underline;
      text-underline-offset: 2px;
      cursor: pointer;
    }
    .demo-link:hover:not(:disabled) { color: var(--color-primary-hover); }
    .demo-link:disabled { cursor: progress; color: var(--text-secondary); }

    .demo-error {
      margin-top: var(--space-sm);
      text-align: center;
      font-size: var(--font-size-sm);
      color: var(--color-danger);
    }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');
  demoLoading = signal(false);
  demoError = signal('');

  private returnUrl = '/dashboard';
  /** Carries ?returnUrl= over to the register link, when there is one. */
  returnQuery: { returnUrl: string } | null = null;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    // Only same-origin paths: a value like '//evil.tld' or 'https://evil.tld'
    // must not become a post-login redirect target.
    const requested = this.route.snapshot.queryParamMap.get('returnUrl') ?? '';
    this.returnUrl = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/dashboard';
    if (this.returnUrl !== '/dashboard') this.returnQuery = { returnUrl: this.returnUrl };
  }

  onSubmit() {
    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.email, this.password).subscribe({
      next: () => {
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.error?.message || 'Login failed');
      },
    });
  }

  tryDemo() {
    if (this.demoLoading()) return;
    this.demoLoading.set(true);
    this.demoError.set('');
    this.authService.demoLogin().subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: (err) => {
        this.demoLoading.set(false);
        this.demoError.set(demoLoginErrorMessage(err));
      },
    });
  }
}
