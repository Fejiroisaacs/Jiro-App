import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JymService, PublicSplitSummary } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent],
  template: `
    <div class="discover">
      <div class="page-header">
        <div>
          <h1>Discover</h1>
          <p class="text-secondary">Browse public training splits from the community</p>
        </div>
        <button class="back-btn" (click)="router.navigate(['/jym/splits'])">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          My Splits
        </button>
      </div>

      <!-- Search bar -->
      <form class="search-bar" (ngSubmit)="search()">
        <input
          class="search-input"
          type="text"
          [(ngModel)]="searchQuery"
          name="q"
          placeholder="Search splits..." />
        <input
          class="search-input tag-input"
          type="text"
          [(ngModel)]="tagFilter"
          name="tag"
          placeholder="Filter by tag..." />
        <jiro-button variant="primary" type="submit" [disabled]="loading()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          Search
        </jiro-button>
      </form>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Searching...</p>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading() && splits().length === 0 && searched()" class="state-message">
        <h3>No splits found</h3>
        <p class="text-secondary">Try a different search term or tag.</p>
      </div>

      <!-- Prompt to search -->
      <div *ngIf="!loading() && !searched()" class="state-message prompt">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="prompt-icon">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <p class="text-secondary">Search for splits or browse by tag above.</p>
      </div>

      <!-- Results grid -->
      <div *ngIf="!loading() && splits().length > 0" class="splits-grid">
        <div
          *ngFor="let split of splits()"
          class="split-card"
          (click)="router.navigate(['/jym/discover', split.id])">
          <div class="card-header">
            <h3 class="split-name">{{ split.name }}</h3>
            <span class="routine-badge">{{ split.routine_count }} {{ split.routine_count === 1 ? 'day' : 'days' }}</span>
          </div>
          <p class="split-desc text-secondary" *ngIf="split.description">{{ split.description }}</p>
          <div *ngIf="split.tags.length" class="tag-row">
            <span *ngFor="let tag of split.tags" class="tag-chip">{{ tag }}</span>
          </div>
          <div class="card-footer text-secondary">
            Added {{ formatDate(split.created_at) }}
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div *ngIf="!loading() && splits().length > 0" class="pagination">
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
    </div>
  `,
  styles: [`
    :host { display: block; }

    .discover { max-width: 900px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-lg); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .back-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: 8px 14px;
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
    }

    .back-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .search-bar {
      display: flex; gap: var(--space-sm); margin-bottom: var(--space-xl);
      flex-wrap: wrap; align-items: center;
    }

    .search-bar ::ng-deep .jiro-btn { width: auto; flex-shrink: 0; }

    .search-input {
      flex: 1; min-width: 160px;
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-md);
      outline: none; transition: border-color 0.2s; font-family: inherit;
    }

    .search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.15); }

    .tag-input { flex: 0 1 180px; }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }

    .prompt-icon { color: var(--border-color); }

    .spinner-lg {
      width: 36px; height: 36px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .splits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: var(--space-lg);
    }

    .split-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      display: flex; flex-direction: column; gap: var(--space-sm);
      cursor: pointer; transition: all 0.15s;
      position: relative;
      top: 0;
    }

    .split-card:hover {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(122,59,46,0.08);
      top: -1px;
    }

    .card-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-name { font-size: var(--font-size-lg); font-weight: 600; }

    .routine-badge {
      background: rgba(122,59,46,0.12); color: var(--color-primary);
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 3px 10px; border-radius: 12px; white-space: nowrap; flex-shrink: 0;
    }

    .split-desc { font-size: var(--font-size-sm); line-height: 1.4; }

    .tag-row { display: flex; flex-wrap: wrap; gap: 4px; }

    .tag-chip {
      font-size: 11px; font-weight: 500;
      padding: 2px 8px; border-radius: 10px;
      background: rgba(122,59,46,0.08); color: var(--color-primary);
      border: 1px solid rgba(122,59,46,0.18);
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

    @keyframes spin { to { transform: rotate(360deg); } }
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
