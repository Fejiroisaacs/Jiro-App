import { Component, computed, input, output } from '@angular/core';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { formatDay, formatMonth } from '../../../core/utils/format-date';
import { monthGrid } from '../history-month';

/** A month of workouts: a dot on each day trained; tapping a day picks it, tapping it again clears it. */
@Component({
  selector: 'jym-history-calendar',
  standalone: true,
  imports: [JiroIconComponent],
  template: `
    <section class="cal" aria-label="Workout calendar">
      <div class="cal-head">
        <button type="button" class="cal-nav" aria-label="Previous month" (click)="monthChange.emit(-1)">
          <jiro-icon name="caret-left" [size]="16" />
        </button>
        <h2 class="cal-title" aria-live="polite">{{ title() }}</h2>
        <button type="button" class="cal-nav" aria-label="Next month" [disabled]="atToday()" (click)="monthChange.emit(1)">
          <jiro-icon name="caret-right" [size]="16" />
        </button>
      </div>
      <div class="cal-grid" role="group" [attr.aria-label]="title()">
        @for (d of weekdays; track $index) { <span class="cal-wd" aria-hidden="true">{{ d }}</span> }
        @for (c of cells(); track c.key) {
          @if (c.inMonth) {
            <button type="button" class="cal-day"
              [class.has]="(counts().get(c.key) ?? 0) > 0"
              [class.today]="c.key === today()"
              [class.selected]="c.key === selected()"
              [attr.aria-pressed]="c.key === selected()"
              [attr.aria-label]="label(c.key)"
              [disabled]="c.key > today()"
              (click)="pick.emit(c.key)">
              <span class="cal-num">{{ c.day }}</span>
              <span class="cal-dot" aria-hidden="true"></span>
            </button>
          } @else {
            <span class="cal-pad" aria-hidden="true"></span>
          }
        }
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; }

    .cal {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-sm);
    }

    .cal-head { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }

    .cal-title { margin: 0; font-size: var(--font-size-md); font-weight: 600; }

    .cal-nav {
      width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;
      background: none; border: none; border-radius: var(--border-radius-sm);
      color: var(--text-primary); cursor: pointer;
    }

    .cal-nav:hover:not(:disabled) { background: var(--bg-canvas); }

    .cal-nav:disabled { opacity: 0.35; cursor: default; }

    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; }

    .cal-wd {
      text-align: center; font-size: var(--font-size-xs); color: var(--text-muted);
      padding: var(--space-xs) 0;
    }

    .cal-day {
      min-height: 44px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      background: none; border: 1px solid transparent; border-radius: var(--border-radius-sm);
      color: var(--text-primary); font: inherit; font-size: var(--font-size-sm); cursor: pointer;
      font-variant-numeric: tabular-nums;
    }

    .cal-day:not(.selected):hover:not(:disabled) { background: var(--bg-canvas); }

    .cal-day:disabled { color: var(--text-muted); cursor: default; }

    .cal-day.today .cal-num { font-weight: 700; color: var(--color-primary); }

    .cal-dot { width: 6px; height: 6px; border-radius: 50%; background: transparent; }

    .cal-day.has .cal-dot { background: var(--color-primary); }

    .cal-day.selected { background: var(--color-primary); border-color: var(--color-primary); }

    .cal-day.selected .cal-num { color: var(--text-on-primary); }

    .cal-day.selected.has .cal-dot { background: var(--text-on-primary); }
  `],
})
export class HistoryCalendarComponent {
  /** YYYY-MM */
  readonly month = input.required<string>();
  readonly counts = input.required<Map<string, number>>();
  readonly selected = input<string | null>(null);
  /** Today's day key in the user's zone; later days can't be picked. */
  readonly today = input.required<string>();
  readonly pick = output<string>();
  /** -1 or 1. */
  readonly monthChange = output<number>();

  readonly weekdays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  readonly cells = computed(() => monthGrid(this.month()));
  readonly title = computed(() => formatMonth(this.month()));
  readonly atToday = computed(() => this.month() >= this.today().slice(0, 7));

  label(key: string): string {
    const n = this.counts().get(key) ?? 0;
    return `${formatDay(key, { weekday: true })}, ${n === 0 ? 'no workouts' : n === 1 ? '1 workout' : `${n} workouts`}`;
  }
}
