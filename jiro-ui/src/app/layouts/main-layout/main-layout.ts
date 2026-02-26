import { Component, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="layout" [class.sidebar-collapsed]="collapsed()">
      <!-- Sidebar -->
      <aside class="sidebar">
        <div class="sidebar-header">
          <span class="sidebar-logo" *ngIf="!collapsed()">JIRO</span>
          <span class="sidebar-logo-mini" *ngIf="collapsed()">J</span>
          <button class="toggle-btn" (click)="collapsed.set(!collapsed())">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
            <span *ngIf="!collapsed()" class="nav-label">Dashboard</span>
          </a>

          <div class="nav-section" *ngIf="!collapsed()">
            <span class="nav-section-title">Modules</span>
          </div>

          <a routerLink="/jym" routerLinkActive="active" class="nav-item">
            <img src="/icons/jym-icon.svg" width="28" height="28" alt="Jym" />
            <span *ngIf="!collapsed()" class="nav-label">Jym</span>
          </a>
          
          <a routerLink="/culinara" routerLinkActive="active" class="nav-item">
            <img src="/icons/culinara-icon.svg" width="28" height="28" alt="Culinara" />
            <span *ngIf="!collapsed()" class="nav-label">Culinara</span>
          </a>

          <a class="nav-item disabled">
            <img src="/icons/ledger-icon.svg" width="28" height="28" alt="Ledger" />
            <span *ngIf="!collapsed()" class="nav-label">Ledger</span>
          </a>
          
          <a class="nav-item disabled">
            <img src="/icons/folio-icon.svg" width="28" height="28" alt="Folio" />
            <span *ngIf="!collapsed()" class="nav-label">Folio</span>
          </a>

          <a class="nav-item disabled">
            <img src="/icons/echo-icon.svg" width="28" height="28" alt="Echo" />
            <span *ngIf="!collapsed()" class="nav-label">Echo</span>
          </a>

        </nav>

        <div class="sidebar-footer">
          <a routerLink="/settings" routerLinkActive="active" class="nav-item">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
            <span *ngIf="!collapsed()" class="nav-label">Settings</span>
          </a>
        </div>
      </aside>

      <!-- Main content -->
      <div class="main">
        <!-- Topbar -->
        <header class="topbar">
          <div class="topbar-left">
            <!-- breadcrumb placeholder -->
          </div>
          <div class="topbar-right">
            <!-- Dark mode toggle -->
            <button class="dark-toggle" (click)="toggleDark()" [title]="settingsService.darkMode() ? 'Switch to light mode' : 'Switch to dark mode'">
              <svg *ngIf="!settingsService.darkMode()" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
              <svg *ngIf="settingsService.darkMode()" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            </button>

            <div class="user-menu" (click)="showMenu.set(!showMenu())">
              <div class="user-avatar">
                {{ userInitial() }}
              </div>
              <span class="user-email" *ngIf="authService.user() as user">
                {{ user.display_name || user.email }}
              </span>

              <div class="dropdown" *ngIf="showMenu()">
                <a routerLink="/settings" class="dropdown-item">Settings</a>
                <button class="dropdown-item danger" (click)="authService.logout()">Logout</button>
              </div>
            </div>
          </div>
        </header>

        <!-- Email verification banner -->
        <div class="verify-banner" *ngIf="authService.user() && !authService.user()!.email_verified">
          <span>Please verify your email to unlock sharing features.</span>
          <button class="verify-banner-btn" (click)="resendVerification()">Resend email</button>
        </div>

        <!-- Page content -->
        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Mobile bottom navigation -->
      <nav class="mobile-nav">
        <a routerLink="/dashboard" routerLinkActive="active" class="mobile-nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          <span>Home</span>
        </a>
        <a routerLink="/culinara" routerLinkActive="active" class="mobile-nav-item">
          <img src="/icons/culinara-icon.svg" width="28" height="28" alt="Culinara" />
          <span>Culinara</span>
        </a>
        <a routerLink="/jym" routerLinkActive="active" class="mobile-nav-item">
          <img src="/icons/jym-icon.svg" width="28" height="28" alt="Jym" />
          <span>Jym</span>
        </a>
        <a routerLink="/settings" routerLinkActive="active" class="mobile-nav-item">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <span>Settings</span>
        </a>
      </nav>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      width: var(--sidebar-width);
      background: var(--bg-sidebar);
      color: var(--text-on-dark);
      display: flex;
      flex-direction: column;
      transition: width 0.2s ease;
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      z-index: 100;
    }

    .sidebar-collapsed .sidebar {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md);
      height: var(--topbar-height);
    }

    .sidebar-logo {
      font-size: var(--font-size-xl);
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .sidebar-logo-mini {
      font-size: var(--font-size-xl);
      font-weight: 700;
    }

    .toggle-btn {
      background: none;
      border: none;
      color: var(--text-on-dark);
      cursor: pointer;
      padding: var(--space-xs);
      border-radius: var(--border-radius);
      opacity: 0.7;
    }

    .toggle-btn:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
    }

    .sidebar-nav {
      flex: 1;
      padding: var(--space-sm);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: 10px 12px;
      border-radius: var(--border-radius);
      color: var(--text-on-dark);
      opacity: 0.7;
      text-decoration: none;
      transition: opacity 0.15s, background 0.15s;
      cursor: pointer;
      border: none;
      background: none;
      font-size: var(--font-size-sm);
      width: 100%;
      text-align: left;
    }

    .nav-item:hover {
      opacity: 1;
      background: rgba(255, 255, 255, 0.1);
      text-decoration: none;
    }

    .nav-item.active {
      opacity: 1;
      background: rgba(255, 255, 255, 0.15);
    }

    .nav-item.disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }

    .nav-section {
      padding: var(--space-md) 12px var(--space-xs);
    }

    .nav-section-title {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.5;
    }

    .sidebar-footer {
      padding: var(--space-sm);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* Main content */
    .main {
      flex: 1;
      min-width: 0;
      overflow-x: hidden;
      margin-left: var(--sidebar-width);
      transition: margin-left 0.2s ease;
      display: flex;
      flex-direction: column;
    }

    .sidebar-collapsed .main {
      margin-left: var(--sidebar-collapsed-width);
    }

    .topbar {
      height: var(--topbar-height);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 var(--space-lg);
      position: sticky;
      top: 0;
      z-index: 50;
    }

    .topbar-right {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .dark-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      background: none;
      color: var(--text-secondary);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .dark-toggle:hover {
      background: var(--bg-surface-hover);
      color: var(--text-primary);
    }

    .user-menu {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      cursor: pointer;
      position: relative;
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--border-radius);
    }

    .user-menu:hover {
      background: var(--bg-surface-hover);
    }

    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--text-on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-sm);
      font-weight: 600;
    }

    .user-email {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    .dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      min-width: 160px;
      padding: var(--space-xs);
      margin-top: var(--space-xs);
    }

    .dropdown-item {
      display: block;
      width: 100%;
      padding: var(--space-sm) var(--space-md);
      border: none;
      background: none;
      text-align: left;
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
    }

    .dropdown-item:hover {
      background: var(--bg-surface-hover);
      text-decoration: none;
    }

    .dropdown-item.danger {
      color: var(--color-danger);
    }

    .verify-banner {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      border-bottom: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
      padding: 10px var(--space-lg);
      display: flex;
      align-items: center;
      gap: var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }

    .verify-banner-btn {
      background: none;
      border: 1px solid var(--color-primary);
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 3px 10px;
      border-radius: var(--border-radius);
      cursor: pointer;
      white-space: nowrap;
    }

    .verify-banner-btn:hover {
      background: var(--color-primary);
      color: var(--text-on-primary);
    }

    .content {
      flex: 1;
      padding: var(--space-xl);
    }

    /* ── Mobile bottom navigation ── */
    .mobile-nav {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: 60px;
      background: var(--bg-sidebar);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      z-index: 200;
      align-items: stretch;
      padding-bottom: env(safe-area-inset-bottom);
    }

    .mobile-nav-item {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      color: var(--text-on-dark);
      opacity: 0.55;
      text-decoration: none;
      font-size: 0.6rem;
      font-weight: 500;
      letter-spacing: 0.3px;
      transition: opacity 0.15s;
      min-height: 44px;
    }

    .mobile-nav-item.active { opacity: 1; }

    .mobile-nav-item:hover {
      opacity: 1;
      text-decoration: none;
    }

    /* ── Mobile responsive ── */
    @media (max-width: 768px) {
      .sidebar { display: none; }

      .main,
      .sidebar-collapsed .main { margin-left: 0; transition: none; overflow-x: clip; }

      .topbar { padding: 0 var(--space-md); }

      .user-email { display: none; }

      .content {
        padding: var(--space-md);
        padding-bottom: calc(60px + env(safe-area-inset-bottom) + var(--space-md));
      }

      .mobile-nav { display: flex; }
    }
  `]
})
export class MainLayoutComponent {
  collapsed = signal(false);
  showMenu = signal(false);

  constructor(public authService: AuthService, public settingsService: SettingsService) {
    effect(() => {
      const theme = settingsService.theme();
      const dark = settingsService.darkMode();
      const classes: string[] = [];
      if (theme !== 'earth') classes.push(`theme-${theme}`);
      if (dark) classes.push('dark');
      document.documentElement.className = classes.join(' ');
    });
  }

  userInitial(): string {
    const user = this.authService.user();
    if (!user) return '?';
    return (user.display_name || user.email)[0].toUpperCase();
  }

  toggleDark() {
    this.settingsService.toggleDarkMode();
  }

  resendVerification() {
    this.authService.resendVerification().subscribe();
  }
}
