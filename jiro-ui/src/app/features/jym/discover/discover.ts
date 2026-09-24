import { Component, OnInit, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JymService, PublicSplitSummary } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroIconComponent, JiroCardComponent, JiroPageHeaderComponent, JiroEmptyStateComponent],
  template: `
    <div class="discover">
      <jiro-page-header heading="Discover" subtitle="Browse public training splits from the community">
        <button actions class="back-btn" type="button" (click)="router.navigate(['/jym/splits'])">
          <jiro-icon name="caret-left" [size]="14" />
          My splits
        </button>
      </jiro-page-header>

      <!-- Search bar -->
      <form class="search-bar" (ngSubmit)="search()">
        <input
          class="search-input"
          type="search"
          aria-label="Search splits"
          [(ngModel)]="searchQuery"
          name="q"
          placeholder="Search splits..." />
        <input
          class="search-input tag-input"
          type="text"
          aria-label="Filter by tag"
          [(ngModel)]="tagFilter"
          name="tag"
          placeholder="Filter by tag..." />
        <jiro-button type="submit" [disabled]="loading()">
          <jiro-icon name="magnifying-glass" [size]="14" />
          Search
        </jiro-button>
      </form>

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Empty -->
      @if (!loading() && splits().length === 0 && searched()) {
        <jiro-empty-state
          icon="magnifying-glass"
          heading="No splits found"
          message="Try a different search term or tag." />
      }

      <!-- Prompt to search -->
      @if (!loading() && !searched()) {
        <jiro-empty-state
          icon="magnifying-glass"
          heading="Find a split to borrow"
          message="Search by name, or filter by tag, to see what the community trains." />
      }

      <!-- Results grid -->
      @if (!loading() && splits().length > 0) {
<div class="splits-grid">
        @for (split of splits(); track split) {
<jiro-card [link]="['/jym/discover', split.id]">
          <div class="split-card-inner">
            <div class="card-header">
              <h2 class="split-name">{{ split.name }}</h2>
              <span class="routine-badge">{{ split.routine_count }} {{ split.routine_count === 1 ? 'day' : 'days' }}</span>
            </div>
            @if (split.description) {
<p class="split-desc text-secondary">{{ split.description }}</p>
}
            @if (split.tags.length) {
<div class="tag-row">
              @for (tag of split.tags; track tag) {
<span class="tag-chip">{{ tag }}</span>
}
            </div>
}
            <div class="card-footer text-secondary">
              Added {{ formatDate(split.created_at) }}
            </div>
          </div>
        </jiro-card>
}
      </div>
}

      <!-- Pagination -->
      @if (!loading() && splits().length > 0) {
<div class="pagination">
        <button class="page-btn" [disabled]="page() <= 1" (click)="changePage(-1)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          Prev
        </button>
        <span class="page-label text-secondary">Page {{ page() }}</span>
        <button class="page-btn" [disabled]="splits().length < pageSize" (click)="changePage(1)">
          Next
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      </div>
}
    </div>
  `,
  styles: [`
    :host { display: block; }

    .discover { max-width: 900px; width: 100%; }

    .back-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); min-height: 40px; padding: 8px 14px; font-family: inherit;
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
    }

    .back-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .search-bar {
      display: flex; gap: var(--space-sm); margin-bottom: var(--space-xl);
      flex-wrap: wrap; align-items: center;
    }


    .search-input {
      flex: 1; min-width: 160px;
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-md);
 transition: border-color 0.2s; font-family: inherit;
    }

    .search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15); }

    .tag-input { flex: 0 1 180px; }

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

    .splits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: var(--space-lg);
    }

    .split-card-inner {
      display: flex; flex-direction: column; gap: var(--space-sm);
    }

    .card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-name { font-size: var(--font-size-lg); font-weight: 600; }

    .routine-badge {
      background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary);
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 3px 10px; border-radius: 12px; white-space: nowrap; flex-shrink: 0;
    }

    .split-desc { font-size: var(--font-size-sm); line-height: 1.4; }

    .tag-row { display: flex; flex-wrap: wrap; gap: 4px; }

    .tag-chip {
      font-size: 11px; font-weight: 500;
      padding: 2px 8px; border-radius: 10px;
      background: rgba(var(--color-primary-rgb), 0.08); color: var(--color-primary);
      border: 1px solid rgba(var(--color-primary-rgb), 0.18);
    }

    .card-footer { font-size: var(--font-size-xs); margin-top: auto; padding-top: var(--space-xs); }

    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-md); margin-top: var(--space-xl); padding-top: var(--space-lg);
      border-top: 1px solid var(--border-color);
    }

    .page-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 16px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s;
    }

    .page-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }

    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .page-label { font-size: var(--font-size-sm); min-width: 60px; text-align: center; }

  `]
})
export class DiscoverComponent implements OnInit {
  splits = signal<PublicSplitSummary[]>([]);
  loading = signal(false);
  searched = signal(false);
  page = signal(1);

  readonly pageSize = 20;

  searchQuery = '';
  tagFilter = '';

  constructor(private jymService: JymService, public router: Router) { }

  ngOnInit() {
    // Load first page on entry
    this.doSearch();
  }

  search() {
    this.page.set(1);
    this.doSearch();
  }

  changePage(delta: number) {
    this.page.update(p => p + delta);
    this.doSearch();
  }

  private doSearch() {
    this.loading.set(true);
    this.jymService.listPublicSplits(
      this.searchQuery.trim(),
      this.tagFilter.trim(),
      '',
      this.page(),
    ).subscribe({
      next: results => {
        this.splits.set(results);
        this.loading.set(false);
        this.searched.set(true);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}
