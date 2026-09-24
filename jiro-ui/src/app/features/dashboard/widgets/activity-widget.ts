import { Component, computed, input } from '@angular/core';
import { utcDateKey } from '../../../core/services/dashboard.service';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';

export interface ActivityData {
  /** UTC calendar days (YYYY-MM-DD) with a completed workout. */
  workoutDays: Set<string>;
  /** UTC calendar days with a journal entry. */
  journalDays: Set<string>;
}

interface ActivityDay {
  key: string;
  label: string;
  workout: boolean;
  journal: boolean;
  today: boolean;
}

@Component({
  selector: 'dash-activity-widget',
  standalone: true,
  imports: [WidgetShellComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()" skeleton="strip">
      <span head class="act-legend" aria-hidden="true">
        <i class="act-dot act-dot--w"></i> Workouts <i class="act-dot act-dot--j"></i> Journal
      </span>
      @if (data()) {
        <div class="act-grid" role="img" [attr.aria-label]="summary()">
          @for (day of days(); track day.key) {
            <div class="act-col" [class.act-col--today]="day.today" [title]="day.key">
              <span class="act-cell" [class.on-w]="day.workout"></span>
              <span class="act-cell" [class.on-j]="day.journal"></span>
              <span class="act-day">{{ day.label }}</span>
            </div>
          }
        </div>
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES, `
    .act-legend {
      margin-left: auto;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: var(--font-size-xs);
      font-weight: 500;
      color: var(--text-secondary);
    }
    .act-dot { display: inline-block; width: 10px; height: 10px; border-radius: var(--border-radius-sm); margin-left: 10px; }
    .act-dot:first-child { margin-left: 0; }
    .act-dot--w { background: var(--color-primary); }
    .act-dot--j { background: var(--color-accent); }
    .act-grid { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 6px; }
    .act-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .act-cell {
      display: block;
      width: 100%;
      max-width: 24px;
      aspect-ratio: 1;
      border-radius: var(--border-radius-sm);
      background: var(--bg-surface-hover);
    }
    .act-cell.on-w { background: var(--color-primary); }
    .act-cell.on-j { background: var(--color-accent); }
    .act-day { font-size: 10px; color: var(--text-muted); }
    .act-col--today .act-day { color: var(--color-primary); font-weight: 700; }

    @media (max-width: 480px) {
      .act-grid { gap: 3px; }
      .act-day { font-size: 9px; }
    }
  `],
})
export class ActivityWidgetComponent {
  data = input<WidgetData<ActivityData>>(undefined);

  readonly def = WIDGET_BY_ID.get('activity')!;
  readonly state = computed(() => widgetState(this.data()));

  // Days are UTC calendar days, the unit the API uses for streaks and calendars.
  readonly days = computed<ActivityDay[]>(() => {
    const d = this.data();
    const todayKey = utcDateKey(new Date());
    const days: ActivityDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);
      const key = utcDateKey(date);
      days.push({
        key,
        label: date.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' }),
        workout: !!d?.workoutDays.has(key),
        journal: !!d?.journalDays.has(key),
        today: key === todayKey,
      });
    }
    return days;
  });

  readonly summary = computed(() => {
    const a = this.days();
    const w = a.filter(x => x.workout).length;
    const j = a.filter(x => x.journal).length;
    return `${w} workout ${w === 1 ? 'day' : 'days'} and ${j} journal ${j === 1 ? 'day' : 'days'} in the last 14 days`;
  });
}
