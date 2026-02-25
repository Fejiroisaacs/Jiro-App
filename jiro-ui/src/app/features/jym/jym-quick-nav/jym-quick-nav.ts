import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'jym-quick-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <div class="quick-nav" #navStrip>
      <a routerLink="/jym" routerLinkActive="current" [routerLinkActiveOptions]="{ exact: true }" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
        </svg>
        Jym
      </a>
      <a routerLink="/jym/splits" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
        </svg>
        Splits
      </a>
      <a routerLink="/jym/exercises" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/>
        </svg>
        Exercise Library
      </a>
      <a routerLink="/jym/sessions" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
        </svg>
        Session History
      </a>
      <a routerLink="/jym/series" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
        </svg>
        My Series
      </a>
      <a routerLink="/jym/bodyweight" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
        Body Weight
      </a>
      <a routerLink="/jym/prs" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="8" r="6"/><path d="M8 14l-2 8 6-3 6 3-2-8"/>
        </svg>
        PR Wall
      </a>
      <a routerLink="/jym/how-to" routerLinkActive="current" class="quick-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
        </svg>
        How to Use
      </a>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      margin-bottom: var(--space-xl);
      border-bottom: 2px var(--border-color); /* The literal baseline the folders sit upon */
    }

    .quick-nav {
      display: flex;
      gap: 2px; /* Super tight gap to look like adjacent folders */
      flex-wrap: wrap;
      align-items: flex-end; /* Align to the baseline */
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
      /* Make it a physical tab: round top corners, sharp bottom, connecting to the baseline */
      border-radius: var(--border-radius-sm) var(--border-radius-sm) 0 0;
      border-bottom: none; /* Let the host's bottom border act as the line, or overlap it when active */
      margin-bottom: -2px; /* Pull down to overlap the host bottom border */
      
      font-family: inherit;
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      position: relative;
      top: 0;
      z-index: 1; /* Sit behind the baseline initially */
    }

    .quick-link:hover {
      color: var(--color-primary);
      background: var(--bg-canvas); /* A slight textural shift on hover */
      top: -2px; /* Physical lift on hover */
      z-index: 2;
    }

    .quick-link.current {
      color: var(--color-primary);
      background: var(--bg-canvas);
      font-weight: 500;
      /* The active tab comes forward and completely overlaps the baseline */
      border-bottom: 2px solid var(--bg-canvas); 
      z-index: 3; 
    }

    @media (max-width: 600px) {
      :host {
        position: sticky;
        top: var(--topbar-height, 56px);
        z-index: 40;
        background: var(--bg-canvas);
        margin-bottom: var(--space-lg);
        padding-top: var(--space-sm);
        border-bottom: 1px solid var(--border-color); /* Thinner on mobile */
      }

      .quick-nav {
        flex-wrap: nowrap;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
        scrollbar-width: none;
        padding-right: var(--space-xl);
        mask-image: linear-gradient(to right, black 85%, transparent 100%);
        -webkit-mask-image: linear-gradient(to right, black 85%, transparent 100%);
      }

      .quick-nav::-webkit-scrollbar { display: none; }

      .quick-link {
        white-space: nowrap;
        flex-shrink: 0;
        font-size: var(--font-size-sm);
      }
    }
  `]
})
export class JymQuickNavComponent implements AfterViewInit {
  @ViewChild('navStrip') navStrip!: ElementRef<HTMLElement>;

  ngAfterViewInit() {
    if (window.innerWidth <= 600) {
      const el = this.navStrip.nativeElement;
      setTimeout(() => {
        el.scrollTo({ left: 60, behavior: 'smooth' });
        setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 600);
      }, 400);
    }
  }
}
