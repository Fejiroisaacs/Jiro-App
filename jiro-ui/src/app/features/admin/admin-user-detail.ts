import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService, AdminUserDetail } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-user-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="user-detail">
      <button class="back-btn" (click)="router.navigate(['/admin/users'])">
        ← Users
      </button>

      <div *ngIf="loading()" class="state-msg">Loading...</div>
      <div *ngIf="error()" class="error-msg">{{ error() }}</div>

      <ng-container *ngIf="user() as u">
        <div class="header">
          <div>
            <h1 class="user-email">{{ u.email }}</h1>
            <p class="user-sub">{{ u.username ? '@' + u.username : 'No username' }} · Joined {{ formatDate(u.created_at) }}</p>
          </div>
          <span class="badge" [class.verified]="u.email_verified">
            {{ u.email_verified ? 'Email verified' : 'Not verified' }}
          </span>
        </div>

        <!-- Activity summary -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-val">{{ u.session_count }}</div>
            <div class="stat-lbl">Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">{{ u.recipe_count }}</div>
            <div class="stat-lbl">Recipes</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">{{ u.split_count }}</div>
            <div class="stat-lbl">Splits</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">{{ u.last_session_at ? formatDate(u.last_session_at) : '—' }}</div>
            <div class="stat-lbl">Last Session</div>
          </div>
          <div class="stat-card">
            <div class="stat-val">{{ u.last_login_at ? formatDate(u.last_login_at) : '—' }}</div>
            <div class="stat-lbl">Last Login</div>
          </div>
        </div>

        <!-- Actions -->
        <div class="actions-section">
          <h2 class="section-title">Actions</h2>

          <!-- Send password reset email -->
          <div class="action-block">
            <div class="action-label">Send Password Reset Link</div>
            <p class="action-desc">Emails the user a reset link — they set their own new password.</p>
            <button class="action-btn" [disabled]="actionLoading()" (click)="sendPasswordReset()">Send Reset Email</button>
          </div>

          <!-- Revoke sessions -->
          <div class="action-block">
            <div class="action-label">Revoke All Sessions</div>
            <p class="action-desc">Forces the user to log in again on all devices.</p>
            <button class="action-btn danger" [disabled]="actionLoading()" (click)="revokeSessions()">Revoke Sessions</button>
          </div>

          <!-- Delete user -->
          <div class="action-block danger-zone">
            <div class="action-label">Delete User</div>
            <p class="action-desc">Permanently deletes this account and all associated data. This cannot be undone.</p>
            <button class="action-btn danger" [disabled]="actionLoading()" (click)="deleteUser()">Delete User</button>
          </div>
        </div>

        <div *ngIf="actionMsg()" class="action-feedback">{{ actionMsg() }}</div>
      </ng-container>
    </div>
  `,
  styles: [`
    .back-btn { background: none; border: 1px solid var(--border-color); border-radius: 6px;
      padding: 7px 14px; color: var(--text-secondary); font-size: 13px; cursor: pointer; margin-bottom: 20px; }
    .back-btn:hover { color: var(--color-primary); border-color: var(--color-primary); }
    .state-msg { color: var(--text-secondary); }
    .error-msg { color: var(--color-danger); }
    .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 24px; gap: 12px; }
    .user-email { font-size: 20px; font-weight: 700; margin: 0 0 4px; }
    .user-sub { color: var(--text-secondary); font-size: 13px; margin: 0; }
    .badge { padding: 4px 10px; border-radius: 10px; font-size: 12px; font-weight: 600;
      background: var(--border-color); color: var(--text-secondary); flex-shrink: 0; }
    .badge.verified { background: rgba(56,160,100,0.15); color: #2a8a54; }
    .stat-grid { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 32px; }
    .stat-card { background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: 8px;
      padding: 16px 20px; min-width: 100px; flex: 1 1 120px; }
    .stat-val { font-size: 22px; font-weight: 700; color: var(--color-primary); }
    .stat-lbl { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
    .section-title { font-size: 16px; font-weight: 600; margin: 0 0 16px; }
    .actions-section { display: flex; flex-direction: column; gap: 16px; }
    .action-block { background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
    .action-block.danger-zone { border-color: rgba(224,92,92,0.3); }
    .action-label { font-size: 14px; font-weight: 600; }
    .action-desc { font-size: 13px; color: var(--text-secondary); margin: 0; }
    .action-btn { padding: 8px 16px; background: var(--color-primary); color: #fff;
      border: none; border-radius: 6px; font-size: 14px; cursor: pointer; }
    .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .action-btn.danger { background: var(--color-danger); }
    .action-btn.danger:hover:not(:disabled) { background: var(--color-danger-hover); }
    .action-feedback { margin-top: 16px; padding: 10px 14px; background: rgba(56,160,100,0.1);
      color: #56c87a; border-radius: 6px; font-size: 13px; }
    @media (max-width: 600px) {
      .header { flex-direction: column; align-items: flex-start; gap: 8px; }
      .user-email { font-size: 16px; word-break: break-all; }
      .stat-val { font-size: 18px; }
    }
  `]
})
export class AdminUserDetailComponent implements OnInit {
  user = signal<AdminUserDetail | null>(null);
  loading = signal(true);
  error = signal('');
  actionLoading = signal(false);
  actionMsg = signal('');

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private adminService: AdminService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.adminService.getUser(id).subscribe({
      next: u => { this.user.set(u); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('User not found'); }
    });
  }

  revokeSessions() {
    const id = this.user()!.id;
    this.actionLoading.set(true);
    this.adminService.revokeSessions(id).subscribe({
      next: () => { this.actionLoading.set(false); this.actionMsg.set('Sessions revoked.'); },
      error: () => { this.actionLoading.set(false); this.actionMsg.set('Failed to revoke sessions.'); }
    });
  }

  sendPasswordReset() {
    const id = this.user()!.id;
    this.actionLoading.set(true);
    this.adminService.sendPasswordReset(id).subscribe({
      next: () => { this.actionLoading.set(false); this.actionMsg.set('Password reset email sent.'); },
      error: () => { this.actionLoading.set(false); this.actionMsg.set('Failed to send reset email.'); }
    });
  }

  deleteUser() {
    if (!confirm(`Delete ${this.user()!.email}? This cannot be undone.`)) return;
    const id = this.user()!.id;
    this.actionLoading.set(true);
    this.adminService.deleteUser(id).subscribe({
      next: () => { this.actionLoading.set(false); this.router.navigate(['/admin/users']); },
      error: () => { this.actionLoading.set(false); this.actionMsg.set('Failed to delete user.'); }
    });
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
