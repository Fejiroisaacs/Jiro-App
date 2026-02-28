import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AdminService } from '../../core/services/admin.service';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="admin-shell">
      <nav class="sidebar">
        <div class="sidebar-brand">Jiro Admin</div>
        <div class="nav-links">
          <a class="nav-link" routerLink="/admin/dashboard" routerLinkActive="active">Dashboard</a>
          <a class="nav-link" routerLink="/admin/users" routerLinkActive="active">Users</a>
          <a class="nav-link" routerLink="/admin/events" routerLinkActive="active">Events</a>
          <a class="nav-link" routerLink="/admin/feedback" routerLinkActive="active">Feedback</a>
        </div>
        <button class="logout-btn" (click)="logout()">Log out</button>
      </nav>
      <main class="admin-content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .admin-shell { display: flex; min-height: 100vh; background: var(--bg-canvas); }

    .sidebar {
      width: 200px; flex-shrink: 0; background: var(--bg-sidebar);
      display: flex; flex-direction: column; padding: 24px 16px; gap: 4px;
    }
    .sidebar-brand {
      font-size: 15px; font-weight: 700; color: var(--text-on-dark);
      margin-bottom: 20px; padding-left: 4px; opacity: 0.9; white-space: nowrap;
    }
    .nav-links { display: flex; flex-direction: column; gap: 4px; flex: 1; }
    .nav-link {
      display: block; padding: 8px 12px; border-radius: 6px;
      color: rgba(245,240,232,0.7); text-decoration: none; font-size: 14px;
      transition: background 0.15s, color 0.15s;
    }
    .nav-link:hover { text-decoration: none; }
    .nav-link:hover, .nav-link.active {
      background: rgba(255,255,255,0.12); color: var(--text-on-dark);
    }
    .logout-btn {
      margin-top: auto; padding: 8px 12px; border-radius: 6px; border: none;
      background: none; color: rgba(245,240,232,0.5); font-size: 14px;
      cursor: pointer; text-align: left; transition: color 0.15s; white-space: nowrap;
    }
    .logout-btn:hover { color: #f5a0a0; }
    .admin-content { flex: 1; padding: 32px; overflow-y: auto; min-width: 0; }

    @media (max-width: 680px) {
      .admin-shell { flex-direction: column; }
      .sidebar {
        width: 100%; flex-direction: row; align-items: center;
        padding: 10px 14px; gap: 0; flex-wrap: wrap; row-gap: 6px;
      }
      .sidebar-brand { margin-bottom: 0; margin-right: 12px; font-size: 14px; }
      .nav-links { flex-direction: row; gap: 2px; flex: 1; }
      .nav-link { padding: 6px 10px; font-size: 13px; }
      .logout-btn { margin-top: 0; margin-left: auto; padding: 6px 10px; font-size: 13px; }
      .admin-content { padding: 16px; }
    }
  `]
})
export class AdminLayoutComponent {
  constructor(private adminService: AdminService, private router: Router) {}

  logout() {
    this.adminService.clearSecret();
    this.router.navigate(['/admin']);
  }
}
