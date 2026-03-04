import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'ledger-quick-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="lnav" #nav>

      <a routerLink="/ledger" routerLinkActive="current" [routerLinkActiveOptions]="{exact:true}" class="lnav-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <path d="M2 10h20"/>
        </svg>
        Overview
      </a>

      <a routerLink="/ledger/transactions" routerLinkActive="current" class="lnav-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="8" y1="6" x2="21" y2="6"/>
          <line x1="8" y1="12" x2="21" y2="12"/>
          <line x1="8" y1="18" x2="21" y2="18"/>
          <line x1="3" y1="6" x2="3.01" y2="6"/>
          <line x1="3" y1="12" x2="3.01" y2="12"/>
          <line x1="3" y1="18" x2="3.01" y2="18"/>
        </svg>
        Transactions
      </a>

      <a routerLink="/ledger/accounts" routerLinkActive="current" class="lnav-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
        Accounts
      </a>

      <a routerLink="/ledger/budgets" routerLinkActive="current" class="lnav-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12,6 12,12 16,14"/>
        </svg>
        Budgets
      </a>

      <a routerLink="/ledger/networth" routerLinkActive="current" class="lnav-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
          <polyline points="17,6 23,6 23,12"/>
        </svg>
        Net Worth
      </a>

      <a routerLink="/ledger/compare" routerLinkActive="current" class="lnav-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="20" x2="18" y2="10"/>
          <line x1="12" y1="20" x2="12" y2="4"/>
          <line x1="6" y1="20" x2="6" y2="14"/>
        </svg>
        Compare
      </a>

    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: var(--space-xl); }

    .lnav {
      display: flex;
      gap: 2px;
      align-items: flex-end;
      border-bottom: 2px solid var(--border-color);
    }

    .lnav-link {
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

    .lnav-link:hover {
      color: var(--color-primary);
      background: var(--bg-canvas);
      top: -2px;
      z-index: 2;
      text-decoration: none;
    }

    .lnav-link.current {
      color: var(--color-primary);
      background: var(--bg-canvas);
      font-weight: 500;
      border-bottom: 2px solid var(--bg-canvas);
      z-index: 3;
    }

    @media (max-width: 768px) {
      :host {
        position: sticky;
        top: var(--topbar-height, 56px);
        z-index: 40;
        background: var(--bg-canvas);
        margin-bottom: var(--space-lg);
        padding-top: var(--space-sm);
      }

      .lnav {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        border-bottom: 2px solid var(--border-color);
        mask-image: linear-gradient(to right, black 80%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 80%, transparent 100%);
      }

      .lnav::-webkit-scrollbar { display: none; }
    }
  `]
})
export class LedgerQuickNavComponent implements AfterViewInit {
  @ViewChild('nav') navRef!: ElementRef<HTMLElement>;

  ngAfterViewInit() {
    // Wait a tick for routerLinkActive to apply the .current class, then scroll it into view
    setTimeout(() => this.scrollActiveIntoView());
  }

  private scrollActiveIntoView() {
    const nav = this.navRef.nativeElement;
    const active = nav.querySelector('.current') as HTMLElement | null;
    if (!active) return;
    // Center the active tab within the scrollable strip
    nav.scrollLeft = active.offsetLeft - nav.offsetWidth / 2 + active.offsetWidth / 2;
  }
}
