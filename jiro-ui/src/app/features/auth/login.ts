import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, JiroCardComponent, JiroButtonComponent, JiroInputComponent],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-header">
          <h1 class="auth-logo">Jiro</h1>
          <p class="auth-subtitle">Jiro, just like Fejiro. Get it? :)</p>
        </div>

        <jiro-card>
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

            <jiro-button type="submit" [loading]="loading()" [disabled]="!email || !password">
              Sign In
            </jiro-button>
          </form>

          <p class="auth-footer">
            Don't have an account? <a routerLink="/register">Create one</a>
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
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  private returnUrl = '/dashboard';

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
  ) {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
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
}
