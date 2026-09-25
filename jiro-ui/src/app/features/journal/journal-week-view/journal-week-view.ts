import {
  Component, Input, Output, EventEmitter,
  signal, computed, inject, OnChanges, SimpleChanges, AfterViewInit, ElementRef,
} from '@angular/core';

import {
  JournalEntry,
  moodColor as moodColorFor,
  moodLabel as moodLabelFor,
  moodMeta,
} from '../../../core/services/journal.service';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { SettingsService } from '../../../core/services/settings.service';
import { addDays, dayKey, dayStartISO, mondayOfKey, shortDayLabel, todayKey } from '../../../core/utils/day';

// ─── Exported helpers used by parent components ──────────────────────────────
// Weeks are Monday-to-Sunday calendar weeks of day keys in the user's zone
// (settings, else the browser's), the same days the day view and the
// dashboard strip use.

/** This week's first and last day keys in `timeZone`. */
export function currentWeekBounds(timeZone: string): { from: string; to: string } {
  const from = mondayOfKey(todayKey(timeZone));
  return { from, to: addDays(from, 6) };
}

/**
 * A week of day keys as the instants the entries endpoint filters on
 * (created_at >= from AND created_at <= to). Bare dates would be read as UTC
 * midnights, which cut the week in the wrong place and drop Sunday entirely.
 */
export function weekRangeQuery(week: { from: string; to: string }, timeZone: string): { from: string; to: string } {
  return { from: dayStartISO(week.from, timeZone), to: dayStartISO(addDays(week.to, 1), timeZone) };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'journal-week-view',
  standalone: true,
  imports: [JiroSkeletonComponent],
  template: `
    <div class="wv">

      <!-- Navigation header -->
      <div class="wv-nav">
        <button class="wv-nav-btn" (click)="prevWeek()" aria-label="Previous week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>

        <div class="wv-center">
          <span class="wv-label">{{ weekLabel() }}</span>
          <button class="wv-today" (click)="goToday()">Today</button>
        </div>

        <button class="wv-nav-btn" (click)="nextWeek()" aria-label="Next week">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </button>
      </div>

      <!-- Day columns -->
      @if (loading) {
        <div class="wv-grid" aria-busy="true" aria-label="Loading this week">
          @for (i of skeletonDays; track i) {
            <div class="wv-day"><jiro-skeleton [lines]="2" height="46px" /></div>
          }
        </div>
      } @else {
      <div class="wv-grid">
        @for (day of weekDays(); track day) {
<div
         
          class="wv-day"
          [class.wv-day--today]="isToday(day)">

          <!-- Day header. Not itself a control: the button below is the one
               way into a day, so there is one target per column. -->
          <div class="wv-day-hdr">
            <span class="wv-day-name">{{ dayAbbr(day) }}</span>
            <span class="wv-day-num">{{ dayNum(day) }}</span>
          </div>

          <button
            class="wv-add"
            type="button"
            (click)="dayClick.emit(iso(day))"
            [attr.aria-label]="'Open ' + dayAbbr(day) + ' ' + dayNum(day)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>

          <!-- Sticky notes -->
          <div class="wv-day-body">
            @for (e of entriesByDay()[iso(day)]; track e) {
<div
             
              class="wv-note"
              role="button"
              tabindex="0"
              [style.border-left-color]="moodColor(e.mood)"
              (click)="entryClick.emit(e)"
              (keydown.enter)="entryClick.emit(e)"
              (keydown.space)="$event.preventDefault(); entryClick.emit(e)">
              @if (showAuthor) {
<div class="wv-note-author">{{ authorName(e) }}</div>
}
              @if (e.title) {
<div class="wv-note-title">{{ e.title }}</div>
}
              <div class="wv-note-body">{{ noteExcerpt(e.body) }}</div>
              @if (e.mood) {
<span class="wv-note-mood">{{ moodLabel(e.mood) }}</span>
}
            </div>
}
          </div>

        </div>
}
      </div>
      }

    </div>
  `,
  styles: [`
    .wv {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-lg);
      margin-bottom: var(--space-xl);
    }

    /* ── Navigation ─────────────────────────────────────── */
    .wv-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      gap: var(--space-sm);
    }
    .wv-nav-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 4px 6px;
      display: flex;
      align-items: center;
      transition: background 0.15s;
      flex-shrink: 0;
    }
    .wv-nav-btn:hover { background: var(--bg-surface-hover); }
    .wv-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
    }
    .wv-label { font-weight: 600; font-size: var(--font-size-sm); }
    .wv-today {
      font-size: var(--font-size-xs);
      color: var(--color-primary);
      background: none;
      border: none;
      cursor: pointer;
      padding: 0;
      opacity: 0.8;
    }
    .wv-today:hover { opacity: 1; text-decoration: underline; }

    /* ── Days grid ───────────────────────────────────────── */
    .wv-grid {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scrollbar-width: none;
      padding-bottom: 4px;
      min-height: 170px;
    }
    .wv-grid::-webkit-scrollbar { display: none; }
    .wv-note:focus-visible { outline-offset: 2px; }

    .wv-day {
      flex: 1;
      min-width: 100px;
      display: flex;
      flex-direction: column;
    }

    /* Day header */
    .wv-day-hdr {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 2px;
      margin-bottom: 6px;
      border-radius: var(--border-radius-sm);
    }
    .wv-day--today .wv-day-hdr {
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
    }
    .wv-day-name {
      font-size: 0.6rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--text-secondary);
    }
    .wv-day-num {
      font-size: var(--font-size-md);
      font-weight: 700;
      line-height: 1.15;
      color: var(--text-primary);
    }
    .wv-day--today .wv-day-num { color: var(--color-primary); }

    /* Day body */
    .wv-day-body {
      display: flex;
      flex-direction: column;
      gap: 5px;
      flex: 1;
      max-height: 200px;
      overflow-y: auto;
      scrollbar-width: none;
    }
    .wv-day-body::-webkit-scrollbar { display: none; }

    /* ── Sticky note ─────────────────────────────────────── */
    .wv-note {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      padding: 5px 7px;
      cursor: pointer;
      transition: box-shadow 0.15s, transform 0.1s;
      word-break: break-word;
    }
    .wv-note:hover {
      box-shadow: 0 3px 10px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }
    .wv-note-author {
      font-size: 0.6rem;
      font-weight: 700;
      color: var(--color-primary);
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wv-note-title {
      font-size: var(--font-size-xs);
      font-weight: 600;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .wv-note-body {
      font-size: 0.68rem;
      color: var(--text-secondary);
      line-height: 1.45;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }
    .wv-note-mood {
      display: block;
      font-size: 0.7rem;
      margin-top: 3px;
    }

    /* ── Add button ──────────────────────────────────────── */
    .wv-add {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      background: none;
      border: 1px dashed color-mix(in srgb, var(--border-color) 60%, transparent);
      border-radius: var(--border-radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      min-height: 28px;
      opacity: 0.5;
    }
    .wv-add:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
      opacity: 1;
      background: color-mix(in srgb, var(--color-primary) 5%, transparent);
    }

    @media (max-width: 600px) {
      .wv { padding: var(--space-md) var(--space-sm); }
      .wv-day { min-width: 90px; }
    }
  `],
})
export class JournalWeekViewComponent implements OnChanges, AfterViewInit {
  constructor(private elRef: ElementRef) { }
  private readonly settings = inject(SettingsService);
  @Input() entries: JournalEntry[] = [];
  @Input() showAuthor = false;
  @Input() memberMap: Record<string, string> = {};
  @Input() loading = false;

  @Output() dayClick = new EventEmitter<string>();        // YYYY-MM-DD
  @Output() entryClick = new EventEmitter<JournalEntry>();
  @Output() weekChange = new EventEmitter<{ from: string; to: string }>();

  /** Seven placeholder columns while the week loads. */
  readonly skeletonDays = [0, 1, 2, 3, 4, 5, 6];

  /** Monday of the shown week, as a day key. */
  private _ws = signal(currentWeekBounds(this.settings.timezone()).from);
  private _entries = signal<JournalEntry[]>([]);

  /** The week's seven day keys, Monday first. */
  weekDays = computed(() => {
    const s = this._ws();
    return Array.from({ length: 7 }, (_, i) => addDays(s, i));
  });

  weekLabel = computed(() => {
    const days = this.weekDays();
    return `${shortDayLabel(days[0])} – ${shortDayLabel(days[6])}, ${days[6].slice(0, 4)}`;
  });

  entriesByDay = computed(() => {
    const tz = this.settings.timezone();
    const map: Record<string, JournalEntry[]> = {};
    this.weekDays().forEach(d => { map[d] = []; });
    for (const e of this._entries()) {
      const key = dayKey(e.created_at, tz);
      if (key in map) map[key].push(e);
    }
    return map;
  });

  ngAfterViewInit() {
    setTimeout(() => this.scrollToToday(), 50);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entries']) {
      this._entries.set(this.entries);
    }
  }

  prevWeek() {
    this._ws.set(addDays(this._ws(), -7));
    this.emitWeekChange();
  }

  nextWeek() {
    this._ws.set(addDays(this._ws(), 7));
    this.emitWeekChange();
  }

  goToday() {
    this._ws.set(currentWeekBounds(this.settings.timezone()).from);
    this.emitWeekChange();
    setTimeout(() => this.scrollToToday(), 50);
  }

  private scrollToToday() {
    const grid: HTMLElement | null = this.elRef.nativeElement.querySelector('.wv-grid');
    const todayCol: HTMLElement | null = this.elRef.nativeElement.querySelector('.wv-day--today');
    if (grid && todayCol) {
      grid.scrollTo({ left: todayCol.offsetLeft - 16, behavior: 'smooth' });
    }
  }

  private emitWeekChange() {
    const days = this.weekDays();
    this.weekChange.emit({ from: days[0], to: days[6] });
  }

  isToday(d: string): boolean { return d === todayKey(this.settings.timezone()); }
  iso(d: string): string { return d; }
  /** Day of the month, from the key itself. */
  dayNum(d: string): number { return Number(d.slice(8, 10)); }
  dayAbbr(d: string): string {
    const [y, m, day] = d.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
  }

  /** The palette lives beside MOODS in the service; a note with no mood keeps the hairline. */
  moodColor(mood: string | null | undefined): string {
    return mood ? moodColorFor(mood) : 'var(--border-color)';
  }

  moodIcon(mood: string): string {
    return moodMeta(mood)?.icon ?? '';
  }

  moodLabel(mood: string): string {
    return moodLabelFor(mood);
  }

  authorName(e: JournalEntry): string {
    return this.memberMap[e.user_id] ?? 'Unknown';
  }

  noteExcerpt(body: string): string {
    return body.length > 70 ? body.slice(0, 70) + '…' : body;
  }
}
