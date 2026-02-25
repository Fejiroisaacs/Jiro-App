import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from '../../core/services/admin.service';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-wrap">
      <div class="login-card">
        <h1 class="brand">Jiro</h1>
        <p class="subtitle">Admin Panel</p>
        <form (ngSubmit)="submit()">
          <input
            class="secret-input"
            type="password"
            [(ngModel)]="secret"
            name="secret"
            [placeholder]="isProduction ? 'Admin secret' : 'Admin secret (blank in local dev)'"
            autocomplete="current-password" />
          <div *ngIf="error()" class="error-msg">{{ error() }}</div>
          <button class="login-btn" type="submit" [disabled]="loading()">
            {{ loading() ? 'Verifying...' : 'Enter' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    :host { display: flex; height: 100vh; align-items: center; justify-content: center;
      background: var(--bg-canvas); }
    .login-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg); padding: 40px; width: 100%; max-width: 360px;
      display: flex; flex-direction: column; gap: 8px; align-items: center;
      box-shadow: var(--shadow-md);
    }
    .brand { font-size: 28px; font-weight: 700; color: var(--text-primary); margin: 0; }
    .subtitle { color: var(--text-secondary); font-size: 13px; margin: 0 0 16px; }
    form { width: 100%; display: flex; flex-direction: column; gap: 12px; }
    .secret-input {
      width: 100%; padding: 11px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-canvas);
      color: var(--text-primary); font-size: 15px; outline: none; box-sizing: border-box;
    }
    .secret-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.12); }
    .login-btn {
      width: 100%; padding: 12px; background: var(--color-primary); color: #fff;
      border: none; border-radius: var(--border-radius); font-size: 15px; font-weight: 600;
      cursor: pointer; transition: background 0.15s;
    }
    .login-btn:hover:not(:disabled) { background: var(--color-primary-hover); }
    .login-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .error-msg { color: var(--color-danger); font-size: 13px; text-align: center; }
  `]
})
export class AdminLoginComponent {
  secret = '';
  loading = signal(false);
  error = signal('');
  readonly isProduction = environment.production;

  constructor(private adminService: AdminService, private router: Router) {}

  submit() {
    this.loading.set(true);
    this.error.set('');
    this.adminService.setSecret(this.secret);
    this.adminService.getStats().subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/admin/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.adminService.clearSecret();
        if (err.status === 401) {
          this.error.set('Invalid secret');
        } else if (err.status === 0) {
          this.error.set('Cannot reach API — is the server running?');
        } else {
          this.error.set(`Server error (${err.status}) — check API logs`);
        }
      }
    });
  }
}
