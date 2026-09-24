import { Component, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroCardComponent, JiroButtonComponent, JiroInputComponent, JiroLogoComponent],
  template: `
    <main class="auth-page">
      <div class="auth-container">
        <div class="auth-header">
          <jiro-logo class="auth-logo" [size]="40" />
          <h1 class="auth-subtitle">Create an account</h1>
        </div>

        <!-- ngSkipHydration: NgForm (ngModel inside <form>) has a documented
             hydration mismatch (NG0502) with no visible symptom - a normal
             client render replaces it. Register has no content a crawler
             reads through hydration anyway, so the fallback costs nothing. -->
        <jiro-card ngSkipHydration>
          <form (ngSubmit)="onSubmit()" class="auth-form">
            <jiro-input
              label="Display Name"
              type="text"
              placeholder="What should we call you?"
              [(ngModel)]="displayName"
              name="displayName">
            </jiro-input>

            <jiro-input
              label="Username"
              type="text"
              placeholder="e.g. fejiro (optional)"
              [(ngModel)]="username"
              name="username"
              [error]="usernameError()">
            </jiro-input>

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
              placeholder="Minimum 8 characters"
              [(ngModel)]="password"
              name="password">
            </jiro-input>

            <jiro-input
              label="Confirm Password"
              type="password"
              placeholder="Re-enter your password"
              [(ngModel)]="confirmPassword"
              name="confirmPassword"
              [error]="passwordMismatch() ? 'Passwords do not match' : ''">
            </jiro-input>

            <jiro-button class="outline-when-disabled" block type="submit" [loading]="loading()" [disabled]="!canSubmit()">
              Create Account
            </jiro-button>
          </form>

          <p class="auth-footer">
            Already have an account? <a routerLink="/login">Sign in</a>
          </p>
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

    /* The page h1, styled as the quiet subtitle it was before (undo the
       global display-font heading rules). */
    .auth-subtitle {
      font-family: var(--font-family);
      font-size: var(--font-size-md);
      font-weight: 400;
      letter-spacing: normal;
      line-height: var(--line-height-body);
      color: var(--text-secondary);
      margin-top: var(--space-xs);
    }

    .auth-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
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
  `]
})
export class RegisterComponent {
  displayName = '';
  username = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = signal(false);
  error = signal('');
  passwordMismatch = signal(false);
  usernameError = signal('');

  constructor(private authService: AuthService, private router: Router) {}

  canSubmit(): boolean {
    const usernameOk = !this.username || USERNAME_PATTERN.test(this.username.toLowerCase());
    return !!this.displayName.trim() && !!this.email && !!this.password
      && this.password.length >= 8 && this.password === this.confirmPassword && usernameOk;
  }

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      this.passwordMismatch.set(true);
      return;
    }
    if (this.username && !USERNAME_PATTERN.test(this.username.toLowerCase())) {
      this.usernameError.set('3-30 characters: lowercase letters, numbers, underscores only');
      return;
    }
    this.passwordMismatch.set(false);
    this.usernameError.set('');
    this.loading.set(true);
    this.error.set('');

    this.authService.register(this.email, this.password, this.displayName.trim(), this.username.toLowerCase() || undefined).subscribe({
      next: () => {
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading.set(false);
        const code = err.error?.error?.code;
        if (code === 'USERNAME_TAKEN') {
          this.usernameError.set('Username is already taken');
        } else {
          this.error.set(err.error?.error?.message || 'Registration failed');
        }
      },
    });
  }
}
