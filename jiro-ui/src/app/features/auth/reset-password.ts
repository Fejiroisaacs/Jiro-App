import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, JiroButtonComponent, JiroInputComponent],
  template: `
    <div class="auth-page">
      <div class="auth-card">
        <h1>Reset password</h1>

        <div *ngIf="invalidLink(); else form">
          <div class="error-box">
            <p>{{ errorMessage() }}</p>
          </div>
          <a routerLink="/forgot-password" class="back-link">Request a new reset link</a>
        </div>

        <ng-template #form>
          <p class="subtitle">Enter your new password below.</p>

          <div class="form-fields">
            <jiro-input
              [(ngModel)]="password"
              type="password"
              placeholder="New password"
              label="New password"
              [error]="passwordError() || ''">
            </jiro-input>

            <jiro-input
              [(ngModel)]="confirm"
              type="password"
              placeholder="Confirm new password"
              label="Confirm password"
              [error]="confirmError() || ''">
            </jiro-input>
          </div>

          <div class="form-error" *ngIf="error()">{{ error() }}</div>

          <jiro-button
            variant="primary"
            [disabled]="!canSubmit() || loading()"
            (click)="submit()"
            style="width: 100%">
            {{ loading() ? 'Updating...' : 'Set new password' }}
          </jiro-button>
        </ng-template>
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

    .form-error {
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-md);
    }

    .error-box {
      padding: var(--space-lg);
      background: rgba(var(--color-danger-rgb, 163, 32, 32), 0.08);
      border-radius: var(--border-radius);
      color: var(--color-danger);
      font-size: var(--font-size-sm);
      margin-bottom: var(--space-lg);
    }

    .back-link {
      display: block;
      text-align: center;
      font-size: var(--font-size-sm);
      color: var(--color-primary);
      text-decoration: none;
    }
  `]
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirm = '';
  loading = signal(false);
  error = signal<string | null>(null);
  passwordError = signal<string | null>(null);
  confirmError = signal<string | null>(null);
  invalidLink = signal(false);
  errorMessage = signal('');

  private token = '';

  constructor(
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParams['token'] ?? '';
    if (!this.token) {
      this.invalidLink.set(true);
      this.errorMessage.set('Invalid reset link — no token provided.');
    }
  }

  canSubmit() {
    return this.password.length >= 8 && this.confirm.length > 0;
  }

  submit() {
    this.error.set(null);
    this.passwordError.set(null);
    this.confirmError.set(null);

    if (this.password.length < 8) {
      this.passwordError.set('Password must be at least 8 characters');
      return;
    }
    if (this.password !== this.confirm) {
      this.confirmError.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    this.authService.resetPassword(this.token, this.password).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/login'], { queryParams: { reset: 'success' } });
      },
      error: (err) => {
        this.loading.set(false);
        const code = err?.error?.error?.code;
        if (code === 'EXPIRED_TOKEN') {
          this.invalidLink.set(true);
          this.errorMessage.set('This reset link has expired. Please request a new one.');
        } else {
          this.error.set(err?.error?.error?.message ?? 'Invalid or already used reset link.');
        }
      },
    });
  }
}
