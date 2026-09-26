import { Component, OnInit, inject, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  JournalService,
  JournalEntry,
  JournalStreak,
  ListEntriesParams,
  MOODS,
  moodColor as moodColorFor,
  moodLabel as moodLabelFor,
} from '../../../core/services/journal.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JournalWeekViewComponent, currentWeekBounds, weekRangeQuery } from '../journal-week-view/journal-week-view';
import { SettingsService } from '../../../core/services/settings.service';
import { addDays, dayKey, todayKey } from '../../../core/utils/day';
import { MoodTrendComponent } from '../mood-trend/mood-trend';
import { JournalDayModalComponent } from '../journal-day-modal/journal-day-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-journal-home',
  standalone: true,
  imports: [
    FormsModule, JiroPageHeaderComponent, JournalWeekViewComponent,
    JournalDayModalComponent, JiroButtonComponent, JiroEmptyStateComponent,
    MoodTrendComponent,
  ],
  template: `
    <div class="journal-home">

      <jiro-page-header heading="Journaly" subtitle="Your reflection space">
        <jiro-button actions variant="primary" type="button" (click)="router.navigate(['/journal/new'])">New entry</jiro-button>
      </jiro-page-header>

      <!-- Streak banner -->
      @if (streak()) {
<div class="streak-banner">
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
}

      <!-- Mood distribution over the last 30 days -->
      <journal-mood-trend [entries]="recentEntries()" />

      <!-- Week view calendar -->
      <journal-week-view
        [entries]="weekEntries()"
        [loading]="loadingEntries()"
        (dayClick)="openDayModal($event)"
        (entryClick)="openEntryModal($event)"
        (weekChange)="onWeekChange($event)">
      </journal-week-view>

      <!-- Filters -->
      <div class="filters-row">
        <input
          type="search"
          class="filter-input"
          aria-label="Search entries"
          placeholder="Search entries..."
          [ngModel]="searchQ()"
          (ngModelChange)="onSearchChange($event)" />
        <select class="filter-select" aria-label="Filter by mood" [ngModel]="filterMood()" (ngModelChange)="filterMood.set($event); applyFilters()">
          <option value="">All moods</option>
          @for (m of moods; track m.value) {
<option [value]="m.value">{{ m.label }}</option>
}
        </select>
        <input
          type="text"
          class="filter-input filter-tag"
          aria-label="Filter by tag"
          placeholder="Filter by tag..."
          [ngModel]="filterTag()"
          (ngModelChange)="filterTag.set($event); applyFilters()" />
      </div>

      <!-- What the list below is showing. The calendar always shows a week; the
           list follows it until a filter is on, and then it spans all time. -->
      <div class="list-head">
        <h2 class="list-title">{{ filtering() ? 'Matching entries' : 'Entries this week' }}</h2>
        @if (filtering()) {
          <button class="list-clear" type="button" (click)="clearFilters()">Back to this week</button>
        }
      </div>

      <!-- Empty -->
      @if (!loadingEntries() && entries().length === 0) {
        @if (filtering()) {
          <jiro-empty-state
            icon="magnifying-glass"
            heading="Nothing matches"
            message="No entry matches this search, mood or tag.">
            <jiro-button variant="secondary" type="button" (click)="clearFilters()">Back to this week</jiro-button>
          </jiro-empty-state>
        } @else {
          <jiro-empty-state
            icon="notebook"
            heading="Nothing written this week"
            message="A sentence is enough. Just begin.">
            <jiro-button type="button" (click)="router.navigate(['/journal/new'])">Write now</jiro-button>
          </jiro-empty-state>
        }
      }

      <!-- Entry list -->
      @if (!loadingEntries() && entries().length > 0) {
<div class="entries-list">
        @for (e of entries(); track e.id) {
<div class="entry-card" (click)="router.navigate(['/journal', e.id, 'edit'])">
          <div class="entry-card-top">
            <div class="entry-meta">
              <span class="entry-date">{{ formatDate(e.created_at) }}</span>
              @if (e.mood) {
<span class="mood-chip" [style.border-left-color]="moodColor(e.mood)">{{ moodLabel(e.mood) }}</span>
}
            </div>
            <div class="entry-card-actions" (click)="$event.stopPropagation()">
              <button class="icon-btn danger" type="button" (click)="deleteEntry(e)" [attr.aria-label]="'Delete the entry from ' + formatDate(e.created_at)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
          @if (e.title) {
<h3 class="entry-title">{{ e.title }}</h3>
}
          <p class="entry-excerpt">{{ excerpt(e.body) }}</p>
          <div class="entry-footer">
            <div class="tag-list">
              @for (t of (e.tags || []); track t) {
<span class="tag-chip">{{ t }}</span>
}
            </div>
            @if (e.images?.length) {
<span class="img-badge">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21,15 16,10 5,21"/>
              </svg>
              {{ e.images?.length }}
            </span>
}
          </div>
        </div>
}
      </div>
}

    </div>

    <!-- Day modal -->
    @if (dayModalDate()) {
<journal-day-modal
     
      [date]="dayModalDate()!"
      [entries]="dayModalEntries()"
      [initialEntry]="dayModalInitEntry()"
      [dayLink]="true"
      (close)="closeDayModal()"
      (newEntry)="onDayModalNew()"
      (editEntry)="onDayModalEdit($event)"
      (deleteEntry)="onDayModalDelete($event)">
    </journal-day-modal>
}

  `,
  styles: [`
    .journal-home { max-width: 860px; }


    /* Streak banner */
    .streak-banner {
      display: flex; align-items: center; gap: var(--space-md);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
      margin-bottom: var(--space-xl);
    }
    .streak-info { display: flex; align-items: baseline; gap: var(--space-xs); }
    .streak-count { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }
    .streak-label { font-size: var(--font-size-sm); color: var(--text-secondary); }
    .streak-divider { width: 1px; height: 28px; background: var(--border-color); margin: 0 var(--space-xs); }
    .streak-stat { display: flex; flex-direction: column; align-items: center; }
    .stat-val { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); }
    .stat-name { font-size: var(--font-size-xs); color: var(--text-secondary); }

    /* Filters */
    .filters-row { display: flex; gap: var(--space-sm); margin-bottom: var(--space-lg); flex-wrap: wrap; }

    .list-head {
      display: flex; align-items: baseline; justify-content: space-between;
      gap: var(--space-sm); margin-bottom: var(--space-md);
    }
    .list-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md); font-weight: 600; color: var(--text-primary);
    }
    .list-clear {
      background: none; border: none; padding: 0;
      color: var(--color-primary); font: inherit; font-size: var(--font-size-sm);
      cursor: pointer; text-decoration: underline; white-space: nowrap;
    }
    .filter-input, .filter-select {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-surface); color: var(--text-primary); padding: 7px var(--space-sm); flex: 1; min-width: 140px;
    }
    .filter-input:focus, .filter-select:focus { border-color: var(--color-primary); }
    .filter-tag { min-width: 120px; }

    /* State */

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
    .mood-chip {
      font-size: var(--font-size-xs); padding: 2px 8px 2px 7px;
      background: var(--bg-canvas); color: var(--text-secondary);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--border-color);
      border-radius: var(--border-radius-sm);
    }
    .entry-card-actions { display: flex; gap: var(--space-xs); opacity: 0.45; transition: opacity 0.15s; }
    .entry-card:hover .entry-card-actions { opacity: 1; }
    .icon-btn { background: none; border: none; cursor: pointer; width: 40px; height: 40px; border-radius: var(--border-radius-sm); color: var(--text-secondary); display: flex; align-items: center; justify-content: center; transition: color 0.12s, background 0.12s; }
    .icon-btn.danger:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .entry-title { font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-xs); }
    .entry-excerpt { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0 0 var(--space-sm); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .entry-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag-chip { font-size: 0.7rem; padding: 2px 8px; background: var(--bg-canvas); border-radius: 99px; color: var(--text-secondary); border: 1px solid var(--border-color); }
    .img-badge { display: flex; align-items: center; gap: 3px; font-size: var(--font-size-xs); color: var(--text-secondary); flex-shrink: 0; }

    /* Modal */

    @media (max-width: 600px) {
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
  /** Last 30 days, fetched once, feeding the mood chart only. */
  recentEntries = signal<JournalEntry[]>([]);

  private readonly settings = inject(SettingsService);

  /** The week the calendar is showing (day keys). Every fetch is bounded by it. */
  week = signal<{ from: string; to: string }>(currentWeekBounds(this.settings.timezone()));

  searchQ = signal('');
  filterMood = signal('');
  filterTag = signal('');

  /** True while a search, mood or tag narrows the list beyond the week. */
  filtering = computed(() =>
    !!(this.searchQ().trim() || this.filterMood() || this.filterTag())
  );

  /**
   * The calendar only ever draws the selected week. While filtering, the list
   * below spans all time, so the calendar takes the week's slice of it rather
   * than showing matches from other weeks in the wrong columns.
   */
  weekEntries = computed(() => {
    if (!this.filtering()) return this.entries();
    const { from, to } = this.week();
    return this.entries().filter(e => {
      const day = this.dayOf(e.created_at);
      return day >= from && day <= to;
    });
  });

  dayModalDate = signal<string | null>(null);
  dayModalInitEntry = signal<JournalEntry | null>(null);
  dayModalEntries = computed(() => {
    const date = this.dayModalDate();
    if (!date) return [];
    return this.entries().filter(e => this.dayOf(e.created_at) === date);
  });

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private svc: JournalService, public router: Router) { }

  /** The user's calendar day of an instant, as the week view and day view cut it. */
  private dayOf(instant: string): string {
    return dayKey(instant, this.settings.timezone());
  }

  ngOnInit() {
    this.svc.getStreak().subscribe(s => this.streak.set(s));
    this.loadEntries();
    this.loadRecent();
  }

  /** The 30-day window behind the mood chart. Independent of the week. */
  private loadRecent() {
    const tz = this.settings.timezone();
    const today = todayKey(tz);
    // 50 is the API's page cap; a larger limit is not honoured (it falls back to 20).
    this.svc.listEntries({ ...weekRangeQuery({ from: addDays(today, -29), to: today }, tz), limit: 50 }).subscribe({
      next: e => this.recentEntries.set(e),
      error: () => this.recentEntries.set([]),
    });
  }

  loadEntries() {
    this.loadingEntries.set(true);
    // 50 is the API's page cap; a larger limit is not honoured (it falls back to 20).
    const params: ListEntriesParams = { limit: 50 };
    if (this.searchQ().trim()) params.q = this.searchQ().trim();
    if (this.filterMood()) params.mood = this.filterMood();
    if (this.filterTag()) params.tag = this.filterTag();
    // Unfiltered, the list mirrors the calendar. Filtering within one week
    // finds almost nothing, so a filter searches the whole journal instead.
    if (!this.filtering()) {
      Object.assign(params, weekRangeQuery(this.week(), this.settings.timezone()));
    }
    this.svc.listEntries(params).subscribe({
      next: e => { this.entries.set(e); this.loadingEntries.set(false); },
      error: () => {
        this.loadingEntries.set(false);
        this.toast.error('Could not load your entries.');
      },
    });
  }

  onWeekChange(range: { from: string; to: string }) {
    this.week.set(range);
    if (!this.filtering()) this.loadEntries();
  }

  applyFilters() { this.loadEntries(); }

  onSearchChange(value: string) {
    this.searchQ.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadEntries(), 300);
  }

  clearFilters() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchQ.set('');
    this.filterMood.set('');
    this.filterTag.set('');
    this.loadEntries();
  }

  openDayModal(date: string) {
    this.dayModalInitEntry.set(null);
    this.dayModalDate.set(date);
  }

  openEntryModal(entry: JournalEntry) {
    this.dayModalInitEntry.set(entry);
    this.dayModalDate.set(this.dayOf(entry.created_at));
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
    if (entry) this.deleteEntry(entry);
  }

  async deleteEntry(e: JournalEntry) {
    const ok = await this.confirmService.confirm({
      title: `Delete the entry from ${this.formatDate(e.created_at)}?`,
      message: 'The entry and any images on it are removed permanently.',
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    this.svc.deleteEntry(e.id).subscribe({
      next: () => {
        this.entries.update(es => es.filter(x => x.id !== e.id));
        this.recentEntries.update(es => es.filter(x => x.id !== e.id));
        this.svc.getStreak().subscribe(s => this.streak.set(s));
        this.toast.success('Entry deleted');
      },
      error: () => this.toast.error('Could not delete the entry.'),
    });
  }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  excerpt(body: string): string {
    return body.length > 180 ? body.slice(0, 180) + '...' : body;
  }

  moodLabel(value: string): string { return moodLabelFor(value); }
  moodColor(value: string): string { return moodColorFor(value); }
}
