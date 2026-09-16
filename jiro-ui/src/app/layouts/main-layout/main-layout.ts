import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../core/services/toast.service';
import { JiroTitleStrategy } from '../../core/title.strategy';
import { MODULES, HUB_TABS, JIRO_HOME_TAB, NavTab, moduleForUrl, isSectionPath } from '../../core/navigation';
import { JiroToasterComponent } from '../../shared/components/jiro-toaster/jiro-toaster';
import { JiroConfirmComponent } from '../../shared/components/jiro-confirm/jiro-confirm';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { JiroModuleNavComponent } from '../../shared/components/jiro-module-nav/jiro-module-nav';
import { JiroUserMenuComponent } from '../../shared/components/jiro-user-menu/jiro-user-menu';

const VERIFY_DISMISSED_KEY = 'jiro_verify_dismissed';

/**
 * The signed-in shell: sidebar (desktop) or top bar + bottom bar (phone),
 * the module tab row, the verify banner, toasts and confirm dialogs.
 * Navigation comes from core/navigation.ts; nothing here is hand-listed.
 */
@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    JiroToasterComponent, JiroConfirmComponent, JiroMarkComponent, JiroIconComponent,
    JiroModuleNavComponent, JiroUserMenuComponent,
  ],
  template: `
    <jiro-toaster />
    <jiro-confirm />
    <div class="layout" [class.sidebar-collapsed]="collapsed()">
      <!-- Sidebar (desktop) -->
      <aside class="sidebar">
        <div class="sidebar-header">
          @if (collapsed()) {
            <span class="sidebar-logo-mini">J</span>
          } @else {
            <span class="sidebar-logo">JIRO</span>
          }
          <button
            type="button"
            class="toggle-btn"
            [attr.aria-label]="collapsed() ? 'Expand sidebar' : 'Collapse sidebar'"
            [attr.aria-expanded]="!collapsed()"
            (click)="collapsed.set(!collapsed())">
            <jiro-icon name="list" [size]="18" />
          </button>
        </div>

        <nav class="sidebar-nav" aria-label="Main">
          <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
            <jiro-icon name="squares-four" [size]="22" />
            @if (!collapsed()) { <span class="nav-label">Dashboard</span> }
          </a>
          <a routerLink="/guide" routerLinkActive="active" class="nav-item">
            <jiro-icon name="book-open" [size]="22" />
            @if (!collapsed()) { <span class="nav-label">Guide</span> }
          </a>

          @if (!collapsed()) {
            <div class="nav-section"><span class="nav-section-title">Modules</span></div>
          }

          @for (m of modules; track m.id) {
            <a [routerLink]="m.home" routerLinkActive="active" class="nav-item">
              <jiro-mark [name]="m.mark" [size]="28" />
              @if (!collapsed()) { <span class="nav-label">{{ m.label }}</span> }
            </a>
          }
          <div class="nav-item disabled" aria-disabled="true" title="Echo is coming soon">
            <jiro-mark name="echo" [size]="28" />
            @if (!collapsed()) { <span class="nav-label">Echo</span> }
          </div>
        </nav>

        <div class="sidebar-footer">
          <a routerLink="/settings" routerLinkActive="active" class="nav-item">
            <jiro-icon name="gear" [size]="22" />
            @if (!collapsed()) { <span class="nav-label">Settings</span> }
          </a>
          <jiro-user-menu direction="up" [compact]="collapsed()" />
        </div>
      </aside>

      <!-- Main column -->
      <div class="main">
        <!-- Top bar (phone) -->
        <header class="mobile-topbar">
          <div class="mt-left">
            <jiro-mark [name]="topbarMark()" [size]="26" />
            <span class="mt-title">{{ topbarTitle() }}</span>
          </div>
          <jiro-user-menu direction="down" [compact]="true" />
        </header>

        @if (showVerifyBanner()) {
          <div class="verify-banner" role="status">
            <span class="verify-text">Please verify your email to unlock sharing features.</span>
            <button type="button" class="verify-banner-btn" (click)="resendVerification()">Resend email</button>
            <button type="button" class="verify-banner-close" aria-label="Dismiss" (click)="dismissVerify()">
              <jiro-icon name="x" [size]="16" />
            </button>
          </div>
        }

        @if (currentModule(); as m) {
          @if (moduleNavAllowed()) {
            <jiro-module-nav [module]="m" />
          }
        }

        <main class="content" [class.content--focus]="!mobileNavAllowed()">
          <router-outlet />
        </main>
      </div>

      <!-- Bottom bar (phone). Hidden on focus screens such as cook mode, where
           the page pins its own footer to the bottom of the viewport. -->
      @if (mobileNavAllowed()) {
      <nav class="mobile-nav" aria-label="Sections">
        @for (t of mobileTabs(); track t.route) {
          <a class="mobile-nav-item" [routerLink]="t.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: !!t.exact }">
            @if (t.mark) {
              <jiro-mark [name]="t.mark" [size]="24" />
            } @else if (t.icon) {
              <jiro-icon [name]="t.icon" [size]="22" />
            }
            <span class="mobile-nav-label">{{ t.mobileLabel ?? t.label }}</span>
          </a>
        }
      </nav>
      }
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      min-height: 100dvh;
    }

    /* ── Sidebar ── */
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
      z-index: var(--z-sidebar);
    }

    .sidebar-collapsed .sidebar {
      width: var(--sidebar-collapsed-width);
    }

    .sidebar-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md);
      height: 56px;
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
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: none;
      border: none;
      color: var(--text-on-dark);
      cursor: pointer;
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

    /* Brand focus ring is invisible on the brown sidebar; use the cream text colour inset. */
    .nav-item:focus-visible,
    .mobile-nav-item:focus-visible,
    .toggle-btn:focus-visible {
      outline-color: var(--text-on-dark);
      outline-offset: -2px;
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
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: var(--space-sm);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    /* ── Main column ── */
    .main {
      flex: 1;
      min-width: 0;
      overflow-x: clip;
      margin-left: var(--sidebar-width);
      transition: margin-left 0.2s ease;
      display: flex;
      flex-direction: column;
    }

    .sidebar-collapsed .main {
      margin-left: var(--sidebar-collapsed-width);
    }

    .mobile-topbar {
      display: none;
      position: sticky;
      top: 0;
      height: var(--topbar-height);
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: 0 var(--space-sm) 0 var(--space-md);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
      z-index: var(--z-topbar);
    }

    .mt-left {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }

    .mt-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .verify-banner {
      background: rgba(var(--color-primary-rgb), 0.12);
      border-bottom: 1px solid rgba(var(--color-primary-rgb), 0.25);
      padding: 8px var(--space-lg);
      display: flex;
      align-items: center;
      gap: var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }

    .verify-text { flex: 1; }

    .verify-banner-btn {
      background: none;
      border: 1px solid var(--color-primary);
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      font-family: inherit;
      padding: 4px 10px;
      border-radius: var(--border-radius);
      cursor: pointer;
      white-space: nowrap;
    }

    .verify-banner-btn:hover {
      background: var(--color-primary);
      color: var(--text-on-primary);
    }

    .verify-banner-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      margin: -6px -8px -6px 0;
      background: none;
      border: none;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      cursor: pointer;
    }
    .verify-banner-close:hover { color: var(--text-primary); background: rgba(var(--color-primary-rgb), 0.1); }

    .content {
      flex: 1;
      padding: var(--space-xl);
    }

    /* ── Bottom bar (phone) ── */
    .mobile-nav {
      display: none;
      position: fixed;
      bottom: 0; left: 0; right: 0;
      height: calc(60px + env(safe-area-inset-bottom));
      background: var(--bg-sidebar);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      z-index: var(--z-mobile-nav);
      align-items: stretch;
      padding-bottom: env(safe-area-inset-bottom);
    }

    .mobile-nav-item {
      flex: 1 1 0;
      min-width: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 3px;
      padding: 0 2px;
      color: var(--text-on-dark);
      opacity: 0.75;
      text-decoration: none;
      font-size: 0.7rem;
      font-weight: 500;
      letter-spacing: 0.2px;
      transition: opacity 0.15s;
      min-height: 44px;
    }

    /* Five slots at 360px are about 72px each: one line, never clipped mid-bar. */
    .mobile-nav-label {
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mobile-nav-item.active { opacity: 1; }

    .mobile-nav-item:hover {
      opacity: 1;
      text-decoration: none;
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }

      .main,
      .sidebar-collapsed .main { margin-left: 0; transition: none; }

      .mobile-topbar { display: flex; }

      .verify-banner { padding: 8px var(--space-md); }

      .content {
        padding: var(--space-md);
        padding-bottom: calc(60px + env(safe-area-inset-bottom) + var(--space-md));
      }

      /* No bottom bar to clear on a focus screen. */
      .content--focus { padding-bottom: 0; }

      .mobile-nav { display: flex; }
    }
  `]
})
export class MainLayoutComponent {
  readonly modules = MODULES;
  readonly collapsed = signal(false);

  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly titleStrategy = inject(JiroTitleStrategy);

  private readonly nav = toSignal(
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(() => this.readRoute()),
      startWith(this.readRoute()),
    ),
    { initialValue: this.readRoute() },
  );

  readonly currentModule = computed(() => moduleForUrl(this.nav().url));
  readonly moduleNavAllowed = computed(() => this.nav().moduleNav);
  readonly mobileNavAllowed = computed(() => this.nav().mobileNav);

  readonly mobileTabs = computed<NavTab[]>(() => {
    const m = this.currentModule();
    return m ? [JIRO_HOME_TAB, ...m.tabs.filter(t => t.mobile !== false)] : HUB_TABS;
  });

  readonly topbarMark = computed(() => this.currentModule()?.mark ?? 'jiro');
  readonly topbarTitle = computed(() => {
    const m = this.currentModule();
    const title = this.titleStrategy.current();
    if (!m) return title || 'Jiro';
    return isSectionPath(m, this.nav().url) ? m.label : (title || m.label);
  });

  private readonly verifyDismissed = signal(readDismissed());
  readonly showVerifyBanner = computed(() => {
    const user = this.auth.user();
    if (!user || user.email_verified || this.verifyDismissed()) return false;
    // Focus screens (cook mode) need the vertical space more than the nudge,
    // and the banner is waiting on every other page.
    return this.mobileNavAllowed();
  });

  private readRoute(): { url: string; moduleNav: boolean; mobileNav: boolean } {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    return {
      url: this.router.url,
      moduleNav: route.data['moduleNav'] !== false,
      mobileNav: route.data['mobileNav'] !== false,
    };
  }

  dismissVerify() {
    try { sessionStorage.setItem(VERIFY_DISMISSED_KEY, '1'); } catch { /* storage unavailable */ }
    this.verifyDismissed.set(true);
  }

  resendVerification() {
    this.auth.resendVerification().subscribe({
      next: () => this.toast.success('Verification email sent.'),
      error: () => this.toast.error('Could not send the email. Please try again.'),
    });
  }
}

function readDismissed(): boolean {
  try { return sessionStorage.getItem(VERIFY_DISMISSED_KEY) === '1'; } catch { return false; }
}
