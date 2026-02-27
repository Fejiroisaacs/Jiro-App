import {
  Component, Input, Output, EventEmitter,
  signal, computed, OnChanges, SimpleChanges, AfterViewInit, ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { JournalEntry, MOODS } from '../../../core/services/journal.service';

// ─── Exported helpers used by parent components ──────────────────────────────

export function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekStart(d: Date): Date {
  const s = new Date(d);
  s.setHours(0, 0, 0, 0);
  const dow = s.getDay(); // 0 = Sun
  s.setDate(s.getDate() + (dow === 0 ? -6 : 1 - dow)); // shift to Monday
  return s;
}

export function currentWeekBounds(): { from: string; to: string } {
  const s = getWeekStart(new Date());
  const e = new Date(s);
  e.setDate(s.getDate() + 6);
  return { from: toISO(s), to: toISO(e) };
}

// ─── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'journal-week-view',
  standalone: true,
  imports: [CommonModule],
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
      <div class="wv-grid" [class.wv-loading]="loading">
        <div
          *ngFor="let day of weekDays()"
          class="wv-day"
          [class.wv-day--today]="isToday(day)">

          <!-- Day header -->
          <div class="wv-day-hdr">
            <span class="wv-day-name">{{ dayAbbr(day) }}</span>
            <span class="wv-day-num">{{ day.getDate() }}</span>
          </div>

          <!-- Sticky notes + add button -->
          <div class="wv-day-body">
            <div
              *ngFor="let e of entriesByDay()[iso(day)]"
              class="wv-note"
              [style.border-left-color]="moodColor(e.mood)"
              (click)="entryClick.emit(e)">
              <div class="wv-note-author" *ngIf="showAuthor">{{ authorName(e) }}</div>
              <div class="wv-note-title" *ngIf="e.title">{{ e.title }}</div>
              <div class="wv-note-body">{{ noteExcerpt(e.body) }}</div>
              <span class="wv-note-mood" *ngIf="e.mood">{{ moodLabel(e.mood) }}</span>
            </div>

            <button
              class="wv-add"
              (click)="dayClick.emit(iso(day))"
              aria-label="Add entry for this day">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          </div>

        </div>
      </div>

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
    .wv-grid.wv-loading { opacity: 0.4; pointer-events: none; }

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
    }

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
  constructor(private elRef: ElementRef) {}
  @Input() entries: JournalEntry[] = [];
  @Input() showAuthor = false;
  @Input() memberMap: Record<string, string> = {};
  @Input() loading = false;

  @Output() dayClick = new EventEmitter<string>();        // YYYY-MM-DD
  @Output() entryClick = new EventEmitter<JournalEntry>();
  @Output() weekChange = new EventEmitter<{ from: string; to: string }>();

  private _ws = signal(getWeekStart(new Date()));
  private _entries = signal<JournalEntry[]>([]);

  weekDays = computed(() => {
    const s = this._ws();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(s);
      d.setDate(s.getDate() + i);
      return d;
    });
  });

  weekLabel = computed(() => {
    const days = this.weekDays();
    const sf = days[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const ef = days[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${sf} – ${ef}`;
  });

  entriesByDay = computed(() => {
    const map: Record<string, JournalEntry[]> = {};
    this.weekDays().forEach(d => { map[toISO(d)] = []; });
    for (const e of this._entries()) {
      const key = toISO(new Date(e.created_at));
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
    const s = new Date(this._ws());
    s.setDate(s.getDate() - 7);
    this._ws.set(s);
    this.emitWeekChange();
  }

  nextWeek() {
    const s = new Date(this._ws());
    s.setDate(s.getDate() + 7);
    this._ws.set(s);
    this.emitWeekChange();
  }

  goToday() {
    this._ws.set(getWeekStart(new Date()));
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
    this.weekChange.emit({ from: toISO(days[0]), to: toISO(days[6]) });
  }

  isToday(d: Date): boolean { return toISO(d) === toISO(new Date()); }
  iso(d: Date): string { return toISO(d); }
  dayAbbr(d: Date): string { return d.toLocaleDateString('en-US', { weekday: 'short' }); }

  moodColor(mood: string | null | undefined): string {
    if (!mood) return 'var(--border-color)';
    const map: Record<string, string> = {
      happy: '#f59e0b', calm: '#06b6d4', energised: '#10b981',
      grateful: '#8b5cf6', anxious: '#f97316', sad: '#6b7280',
      tired: '#94a3b8', stressed: '#ef4444',
    };
    return map[mood] ?? 'var(--border-color)';
  }

  moodEmoji(mood: string): string {
    return MOODS.find(m => m.value === mood)?.emoji ?? '';
  }

  moodLabel(mood: string): string {
    return MOODS.find(m => m.value === mood)?.label ?? mood;
  }

  authorName(e: JournalEntry): string {
    return this.memberMap[e.user_id] ?? 'Unknown';
  }

  noteExcerpt(body: string): string {
    return body.length > 70 ? body.slice(0, 70) + '…' : body;
  }
}
