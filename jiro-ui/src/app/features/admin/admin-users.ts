import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, AdminUser } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="users-page">
      <h1 class="page-title">Users</h1>

      <form class="search-bar" (ngSubmit)="search()">
        <input class="search-input" type="text" [(ngModel)]="searchQuery" name="q" placeholder="Search by email or username..." />
        <button class="search-btn" type="submit">Search</button>
      </form>

      <div *ngIf="loading()" class="state-msg">Loading...</div>
      <div *ngIf="error()" class="error-msg">{{ error() }}</div>

      <div class="table-wrap" *ngIf="!loading() && users().length > 0">
      <table class="users-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Username</th>
            <th>Verified</th>
            <th>Sessions</th>
            <th>Recipes</th>
            <th>Splits</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let u of users()" class="user-row" (click)="router.navigate(['/admin/users', u.id])">
            <td>{{ u.email }}</td>
            <td>{{ u.username ?? '—' }}</td>
            <td>
              <span class="badge" [class.verified]="u.email_verified">
                {{ u.email_verified ? 'Yes' : 'No' }}
              </span>
            </td>
            <td>{{ u.session_count }}</td>
            <td>{{ u.recipe_count }}</td>
            <td>{{ u.split_count }}</td>
            <td>{{ formatDate(u.created_at) }}</td>
          </tr>
        </tbody>
      </table>
      </div>

      <div *ngIf="!loading() && users().length === 0 && searched()" class="state-msg">No users found.</div>

      <div *ngIf="users().length > 0" class="pagination">
        <button class="page-btn" [disabled]="page() <= 1" (click)="changePage(-1)">Prev</button>
        <span class="page-label">Page {{ page() }}</span>
        <button class="page-btn" [disabled]="users().length < pageSize" (click)="changePage(1)">Next</button>
      </div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
    .search-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .search-input {
      flex: 1; padding: 9px 12px; border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-surface); color: var(--text-primary); font-size: 14px; outline: none;
    }
    .search-input:focus { border-color: var(--color-primary); }
    .search-btn {
      padding: 9px 18px; background: var(--color-primary); color: #fff;
      border: none; border-radius: 6px; font-size: 14px; cursor: pointer;
    }
    .state-msg { color: var(--text-secondary); }
    .error-msg { color: #e05c5c; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .users-table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 560px; }
    .users-table th {
      text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary); font-weight: 600; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em;
    }
    .user-row { cursor: pointer; border-bottom: 1px solid var(--border-color); }
    .user-row td { padding: 10px 12px; }
    .user-row:hover td { background: rgba(122,59,46,0.06); }
    .badge { padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; background: var(--border-color); color: var(--text-secondary); }
    .badge.verified { background: rgba(56,160,100,0.15); color: #2a8a54; }
    .pagination { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .page-btn {
      padding: 7px 16px; border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font-size: 13px;
    }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-label { font-size: 13px; color: var(--text-secondary); }
    @media (max-width: 600px) {
      .page-title { font-size: 20px; margin-bottom: 14px; }
      .search-input { width: 100%; }
      .search-btn { width: 100%; }
    }
  `]
})
export class AdminUsersComponent implements OnInit {
  users = signal<AdminUser[]>([]);
  loading = signal(true);
  error = signal('');
  searched = signal(false);
  page = signal(1);
  searchQuery = '';
  readonly pageSize = 50;

  constructor(public router: Router, private adminService: AdminService) {}

  ngOnInit() { this.load(); }

  search() { this.page.set(1); this.load(); }

  changePage(d: number) { this.page.update(p => p + d); this.load(); }

  private load() {
    this.loading.set(true);
    this.adminService.listUsers(this.searchQuery.trim(), this.page()).subscribe({
      next: users => { this.users.set(users); this.loading.set(false); this.searched.set(true); },
      error: () => { this.loading.set(false); this.error.set('Failed to load users'); }
    });
  }

  formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
