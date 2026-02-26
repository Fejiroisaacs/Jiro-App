import { Component, AfterViewInit, OnDestroy, ViewChild, ElementRef, signal, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'jym-quick-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule],
  template: `
    <div class="nav-outer">

      <!-- Scrollable primary tabs -->
      <div class="quick-nav" #navStrip>
        <a routerLink="/jym" routerLinkActive="current" [routerLinkActiveOptions]="{ exact: true }" class="quick-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9,22 9,12 15,12 15,22"/>
          </svg>
          Jym
        </a>
        <a routerLink="/jym/splits" routerLinkActive="current" class="quick-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          Splits
        </a>
        <a routerLink="/jym/exercises" routerLinkActive="current" class="quick-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6.5 6.5h11M6.5 12h11M6.5 17.5h11"/>
            <circle cx="3" cy="6.5" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="17.5" r="1"/>
          </svg>
          Exercises
        </a>
        <a routerLink="/jym/sessions" routerLinkActive="current" class="quick-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
          </svg>
          History
        </a>
        <a routerLink="/jym/prs" routerLinkActive="current" class="quick-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/>
            <polyline points="17,6 23,6 23,12"/>
          </svg>
          PRs
        </a>
      </div>

        <!-- More — inline right on desktop, inline last item on mobile -->
        <button
          #moreBtn
          class="quick-link more-btn"
          [class.current]="moreActive"
          (click)="toggleMore($event)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
            <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/>
          </svg>
          More
        </button>      

    </div>

    <!-- Dropdown rendered outside the nav so it's never clipped -->
    <div *ngIf="showMore()"
         class="more-dropdown"
         [style.top]="dropTop"
         [style.right]="dropRight">
      <a routerLink="/jym/templates" routerLinkActive="current" class="more-item" (click)="showMore.set(false)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14,2 14,8 20,8"/>
          <line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        Templates
      </a>
      <a routerLink="/jym/series" routerLinkActive="current" class="more-item" (click)="showMore.set(false)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
        </svg>
        My Series
      </a>
      <a routerLink="/jym/bodyweight" routerLinkActive="current" class="more-item" (click)="showMore.set(false)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
        Body Weight
      </a>
      <a routerLink="/jym/how-to" routerLinkActive="current" class="more-item" (click)="showMore.set(false)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
        How to Use
      </a>
    </div>
  `,
  styles: [`
    :host { display: block; margin-bottom: var(--space-xl); }

    /* Tab strip + pinned More button on the same baseline */
    .nav-outer {
      display: flex;
      align-items: flex-end;
      gap: 2px;
      border-bottom: 2px solid var(--border-color);
    }

    /* Tabs sit compactly — no flex growth on desktop */
    .quick-nav {
      display: flex;
      gap: 2px;
      align-items: flex-end;
    }

    .quick-link {
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
      font-family: inherit;
      white-space: nowrap;
      flex-shrink: 0;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      position: relative;
      top: 0;
      z-index: 1;
    }
    .quick-link:hover {
      color: var(--color-primary);
      background: var(--bg-canvas);
      top: -2px;
      z-index: 2;
    }
    .quick-link.current {
      color: var(--color-primary);
      background: var(--bg-canvas);
      font-weight: 500;
      border-bottom: 2px solid var(--bg-canvas);
      z-index: 3;
    }

    /* More button — no border-left so it butts against the strip */
    .more-btn { flex-shrink: 0; }

    /* Dropdown — position:fixed so it escapes any overflow/stacking context */
    .more-dropdown {
      position: fixed;
      min-width: 180px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      box-shadow: 0 6px 20px rgba(0,0,0,0.14);
      z-index: 1000;
      overflow: hidden;
      animation: dropIn 0.12s ease;
    }
    @keyframes dropIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    .more-item {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: 11px var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.12s, color 0.12s;
    }
    .more-item:last-child { border-bottom: none; }
    .more-item:hover, .more-item.current { background: var(--bg-canvas); color: var(--color-primary); }
    .more-item.current { font-weight: 500; }

    @media (max-width: 600px) {
      :host {
        position: sticky;
        top: var(--topbar-height, 56px);
        z-index: 40;
        background: var(--bg-canvas);
        margin-bottom: var(--space-lg);
        padding-top: var(--space-sm);
      }
      /* Two-row layout: scrollable tabs on top, More button below-right */
      .nav-outer {
        flex-direction: column;
        align-items: stretch;
        border-bottom: none;
        gap: 0;
      }
      /* Row 1: scrollable tab strip, border-bottom acts as the dividing line */
      .quick-nav {
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        border-bottom: 2px solid var(--border-color);
        mask-image: linear-gradient(to right, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
        padding-right: var(--space-xl); /* Add a little extra padding so the last item isn't strictly cut by the mask */
      }
      .quick-nav::-webkit-scrollbar { display: none; }
      
      /* Reset desktop More button specific styles for mobile */
      .more-btn {
        margin-bottom: -2px; 
      }
    }
  `]
})
export class JymQuickNavComponent implements AfterViewInit, OnDestroy {
  @ViewChild('navStrip') navStrip!: ElementRef<HTMLElement>;
  @ViewChild('moreBtn') moreBtn!: ElementRef<HTMLElement>;

  showMore = signal(false);
  dropTop = '0px';
  dropRight = '0px';

  get moreActive(): boolean {
    const path = window.location.pathname;
    return ['/jym/templates', '/jym/series', '/jym/bodyweight', '/jym/how-to'].some(p => path.startsWith(p));
  }

  toggleMore(e: Event) {
    e.stopPropagation();
    if (!this.showMore()) {
      // Compute fixed position from the button's viewport rect
      const rect = (this.moreBtn.nativeElement as HTMLElement).getBoundingClientRect();
      this.dropTop = `${rect.bottom + 4}px`;
      this.dropRight = `${window.innerWidth - rect.right}px`;
    }
    this.showMore.update(v => !v);
  }

  @HostListener('document:click')
  closeMore() { this.showMore.set(false); }

  ngAfterViewInit() {
    if (window.innerWidth <= 600) {
      const el = this.navStrip.nativeElement;
      setTimeout(() => {
        el.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 600);
      }, 400);
    }
  }

  ngOnDestroy() { }
}
