import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';

const USERNAME_PATTERN = /^[a-z0-9_]{3,30}$/;

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, JiroCardComponent, JiroButtonComponent, JiroInputComponent],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-header">
          <h1 class="auth-logo">Jiro</h1>
          <p class="auth-subtitle">Create an account</p>
        </div>

        <jiro-card>
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

            <jiro-button type="submit" [loading]="loading()" [disabled]="!canSubmit()">
              Create Account
            </jiro-button>
          </form>

          <p class="auth-footer">
            Already have an account? <a routerLink="/login">Sign in</a>
          </p>
        </jiro-card>
      </div>
    </div>
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

    .auth-logo {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--color-primary);
      letter-spacing: -0.5px;
    }

    .auth-subtitle {
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
