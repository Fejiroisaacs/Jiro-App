import { Component, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'journal-quick-nav',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="jnav">
      <a
        [routerLink]="['/journal']"
        class="jnav-link"
        [class.current]="activeTab === 'private'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
        Home
      </a>

      <a
        [routerLink]="['/journal/groups']"
        class="jnav-link"
        [class.current]="activeTab === 'groups'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        Groups
      </a>

      <a
        [routerLink]="['/journal/collections']"
        class="jnav-link"
        [class.current]="activeTab === 'collections'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
        </svg>
        Collections
      </a>

      <a [routerLink]="['/journal/new']" class="jnav-link jnav-new" [class.current]="activeTab === 'new'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
        New Entry
      </a>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: var(--space-xl); }

    .jnav {
      display: flex;
      gap: 2px;
      align-items: flex-end;
      border-bottom: 2px solid var(--border-color);
    }

    .jnav-link {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
      padding: var(--space-sm) var(--space-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm) var(--border-radius-sm) 0 0;
      border-bottom: none;
      margin-bottom: -2px;
      white-space: nowrap;
      flex-shrink: 0;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      position: relative;
      top: 0;
      z-index: 1;
    }

    .jnav-link:hover {
      color: var(--color-primary);
      background: var(--bg-canvas);
      top: -2px;
      z-index: 2;
      text-decoration: none;
    }

    .jnav-link.current {
      color: var(--color-primary);
      background: var(--bg-canvas);
      font-weight: 500;
      border-bottom: 2px solid var(--bg-canvas);
      z-index: 3;
    }

    .jnav-new {
      margin-left: auto;
      color: var(--color-primary);
      opacity: 0.8;
    }
    .jnav-new:hover { opacity: 1; }

    @media (max-width: 600px) {
      :host {
        position: sticky;
        top: var(--topbar-height, 56px);
        z-index: 40;
        background: var(--bg-canvas);
        margin-bottom: var(--space-lg);
        padding-top: var(--space-sm);
      }

      .jnav {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        border-bottom: 2px solid var(--border-color);
        mask-image: linear-gradient(to right, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
      }

      .jnav::-webkit-scrollbar { display: none; }
      .jnav-new { margin-left: 0; }
    }
  `]
})
export class JournalQuickNavComponent implements OnInit, OnDestroy {
  activeTab: 'private' | 'groups' | 'collections' | 'new' = 'private';
  private sub!: Subscription;

  constructor(private router: Router) {}

  ngOnInit() {
    this.detectTab();
    this.sub = this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.detectTab());
  }

  ngOnDestroy() { this.sub?.unsubscribe(); }

  private detectTab() {
    const url = this.router.url.split('?')[0];
    if (url === '/journal/new' || url.includes('/edit')) {
      this.activeTab = 'new';
    } else if (url.startsWith('/journal/groups')) {
      this.activeTab = 'groups';
    } else if (url.startsWith('/journal/collections')) {
      this.activeTab = 'collections';
    } else {
      this.activeTab = 'private';
    }
  }
}
