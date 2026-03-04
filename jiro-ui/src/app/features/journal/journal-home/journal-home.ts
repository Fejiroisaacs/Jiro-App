import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  JournalService,
  JournalEntry,
  JournalStreak,
  MOODS,
} from '../../../core/services/journal.service';
import { JournalQuickNavComponent } from '../journal-quick-nav/journal-quick-nav';
import { JournalWeekViewComponent, toISO } from '../journal-week-view/journal-week-view';
import { JournalDayModalComponent } from '../journal-day-modal/journal-day-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-journal-home',
  standalone: true,
  imports: [CommonModule, FormsModule, JournalQuickNavComponent, JournalWeekViewComponent, JournalDayModalComponent, JiroButtonComponent, JiroModalComponent],
  template: `
    <div class="journal-home">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Journaly</h1>
          <p class="text-secondary">Your reflection space</p>
        </div>
      </div>

      <!-- Quick nav -->
      <journal-quick-nav></journal-quick-nav>

      <!-- Streak banner -->
      <div class="streak-banner" *ngIf="streak()">
        <div class="streak-info">
          <span class="streak-count">{{ streak()!.current_streak }}</span>
          <span class="streak-label">day streak</span>
        </div>
        <div class="streak-divider"></div>
        <div class="streak-stat">
          <span class="stat-val">{{ streak()!.longest_streak }}</span>
          <span class="stat-name">best</span>
        </div>
        <div class="streak-stat">
          <span class="stat-val">{{ streak()!.total_entries }}</span>
          <span class="stat-name">entries</span>
        </div>
      </div>

      <!-- Week view calendar -->
      <journal-week-view
        [entries]="entries()"
        [loading]="loadingEntries()"
        (dayClick)="openDayModal($event)"
        (entryClick)="openEntryModal($event)">
      </journal-week-view>

      <!-- Filters -->
      <div class="filters-row">
        <input
          type="search"
          class="filter-input"
          placeholder="Search entries..."
          [(ngModel)]="searchQ"
          (ngModelChange)="onFilterChange()" />
        <select class="filter-select" [(ngModel)]="filterMood" (ngModelChange)="onFilterChange()">
          <option value="">All moods</option>
          <option *ngFor="let m of moods" [value]="m.value">{{ m.label }}</option>
        </select>
        <input
          type="text"
          class="filter-input filter-tag"
          placeholder="Filter by tag..."
          [(ngModel)]="filterTag"
          (ngModelChange)="onFilterChange()" />
      </div>

      <!-- Empty -->
      <div *ngIf="!loadingEntries() && entries().length === 0" class="state-box">
        <h3>Start your first entry</h3>
        <p class="text-secondary">A sentence is enough. Just begin.</p>
        <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal/new'])">Write now</jiro-button>
      </div>

      <!-- Entry list -->
      <div class="entries-list" *ngIf="!loadingEntries() && entries().length > 0">
        <div *ngFor="let e of entries()" class="entry-card" (click)="router.navigate(['/journal', e.id, 'edit'])">
          <div class="entry-card-top">
            <div class="entry-meta">
              <span class="entry-date">{{ formatDate(e.created_at) }}</span>
              <span class="mood-chip" *ngIf="e.mood">{{ moodLabel(e.mood) }}</span>
            </div>
            <div class="entry-card-actions" (click)="$event.stopPropagation()">
              <button class="icon-btn danger" (click)="confirmDelete(e)" aria-label="Delete entry">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
          <h3 class="entry-title" *ngIf="e.title">{{ e.title }}</h3>
          <p class="entry-excerpt">{{ excerpt(e.body) }}</p>
          <div class="entry-footer">
            <div class="tag-list">
              <span class="tag-chip" *ngFor="let t of (e.tags || [])">{{ t }}</span>
            </div>
            <span class="img-badge" *ngIf="e.images?.length">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
              {{ e.images?.length }}
            </span>
          </div>
        </div>
      </div>

    </div>

    <!-- Day modal -->
    <journal-day-modal
      *ngIf="dayModalDate()"
      [date]="dayModalDate()!"
      [entries]="dayModalEntries()"
      [initialEntry]="dayModalInitEntry()"
      (close)="closeDayModal()"
      (newEntry)="onDayModalNew()"
      (editEntry)="onDayModalEdit($event)"
      (deleteEntry)="onDayModalDelete($event)">
    </journal-day-modal>

    <!-- Delete confirm -->
    <jiro-modal *ngIf="deleteTarget()" title="Delete Entry" (close)="deleteTarget.set(null)">
      <p>Are you sure you want to delete this entry? This cannot be undone.</p>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="deleteTarget.set(null)">Cancel</jiro-button>
        <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="deleteEntry()">
          {{ deleting() ? 'Deleting...' : 'Delete' }}
        </jiro-button>
      </div>
    </jiro-modal>
  `,
  styles: [`
    .journal-home { max-width: 860px; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-xl); }
    .page-header h1 { margin: 0 0 var(--space-xs); }

    /* Streak banner */
    .streak-banner {
      display: flex; align-items: center; gap: var(--space-md);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
      margin-bottom: var(--space-xl);
    }
    .flame-emoji { font-size: 1.5rem; line-height: 1; }
    .streak-info { display: flex; align-items: baseline; gap: var(--space-xs); }
    .streak-count { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }
    .streak-label { font-size: var(--font-size-sm); color: var(--text-secondary); }
    .streak-divider { width: 1px; height: 28px; background: var(--border-color); margin: 0 var(--space-xs); }
    .streak-stat { display: flex; flex-direction: column; align-items: center; }
    .stat-val { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); }
    .stat-name { font-size: var(--font-size-xs); color: var(--text-secondary); }

    /* Filters */
    .filters-row { display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg); flex-wrap: wrap; }
    .filter-input, .filter-select {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-surface); color: var(--text-primary); padding: 7px var(--space-sm); flex: 1; min-width: 140px;
    }
    .filter-input:focus, .filter-select:focus { outline: none; border-color: var(--color-primary); }
    .filter-tag { min-width: 120px; }

    /* State */
    .state-box { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-sm); padding: var(--space-xl) 0; }

    /* Entry cards */
    .entries-list { display: flex; flex-direction: column; gap: var(--space-md); }
    .entry-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
      cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .entry-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .entry-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xs); }
    .entry-meta { display: flex; align-items: center; gap: var(--space-sm); }
    .entry-date { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .mood-chip { font-size: var(--font-size-xs); padding: 2px 8px; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); border-radius: 99px; }
    .entry-card-actions { display: flex; gap: var(--space-xs); opacity: 0.45; transition: opacity 0.15s; }
    .entry-card:hover .entry-card-actions { opacity: 1; }
    .icon-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: var(--border-radius-sm); color: var(--text-secondary); display: flex; align-items: center; transition: color 0.12s, background 0.12s; }
    .icon-btn.danger:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .entry-title { font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-xs); }
    .entry-excerpt { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0 0 var(--space-sm); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .entry-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag-chip { font-size: 0.7rem; padding: 2px 8px; background: var(--bg-canvas); border-radius: 99px; color: var(--text-secondary); border: 1px solid var(--border-color); }
    .img-badge { display: flex; align-items: center; gap: 3px; font-size: var(--font-size-xs); color: var(--text-secondary); flex-shrink: 0; }

    /* Modal */
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; gap: var(--space-sm); }
      .streak-banner { flex-wrap: wrap; gap: var(--space-sm); }
      .filters-row { flex-direction: column; }
      .filter-input, .filter-select { min-width: 0; }
    }
  `]
})
export class JournalHomeComponent implements OnInit {
  moods = MOODS;

  streak = signal<JournalStreak | null>(null);
  entries = signal<JournalEntry[]>([]);
  loadingEntries = signal(false);

  searchQ = '';
  filterMood = '';
  filterTag = '';

  deleteTarget = signal<JournalEntry | null>(null);
  deleting = signal(false);

  dayModalDate = signal<string | null>(null);
  dayModalInitEntry = signal<JournalEntry | null>(null);
  dayModalEntries = computed(() => {
    const date = this.dayModalDate();
    if (!date) return [];
    return this.entries().filter(e => toISO(new Date(e.created_at)) === date);
  });

  constructor(private svc: JournalService, public router: Router) { }

  ngOnInit() {
    this.svc.getStreak().subscribe(s => this.streak.set(s));
    this.loadEntries();
  }

  loadEntries() {
    this.loadingEntries.set(true);
    const params: any = {};
    if (this.searchQ) params.q = this.searchQ;
    if (this.filterMood) params.mood = this.filterMood;
    if (this.filterTag) params.tag = this.filterTag;
    this.svc.listEntries(params).subscribe({
      next: e => { this.entries.set(e); this.loadingEntries.set(false); },
      error: () => this.loadingEntries.set(false),
    });
  }

  onFilterChange() { this.loadEntries(); }

  openDayModal(date: string) {
    this.dayModalInitEntry.set(null);
    this.dayModalDate.set(date);
  }

  openEntryModal(entry: JournalEntry) {
    this.dayModalInitEntry.set(entry);
    this.dayModalDate.set(toISO(new Date(entry.created_at)));
  }

  closeDayModal() {
    this.dayModalDate.set(null);
    this.dayModalInitEntry.set(null);
  }

  onDayModalNew() {
    const date = this.dayModalDate();
    this.closeDayModal();
    this.router.navigate(['/journal/new'], date ? { queryParams: { date } } : {});
  }

  onDayModalEdit(id: string) {
    this.closeDayModal();
    this.router.navigate(['/journal', id, 'edit']);
  }

  onDayModalDelete(id: string) {
    const entry = this.entries().find(e => e.id === id);
    if (entry) this.confirmDelete(entry);
  }

  confirmDelete(e: JournalEntry) { this.deleteTarget.set(e); }

  deleteEntry() {
    const e = this.deleteTarget();
    if (!e) return;
    this.deleting.set(true);
    this.svc.deleteEntry(e.id).subscribe({
      next: () => { this.entries.update(es => es.filter(x => x.id !== e.id)); this.deleteTarget.set(null); this.deleting.set(false); },
      error: () => this.deleting.set(false),
    });
  }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  excerpt(body: string): string {
    return body.length > 180 ? body.slice(0, 180) + '...' : body;
  }

  moodEmoji(value: string): string { return MOODS.find(m => m.value === value)?.emoji ?? ''; }
  moodLabel(value: string): string { return MOODS.find(m => m.value === value)?.label ?? value; }
}
