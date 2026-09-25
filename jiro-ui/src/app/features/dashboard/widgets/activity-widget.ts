import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { STRIP_DAYS } from '../../../core/services/dashboard.service';
import { SettingsService } from '../../../core/services/settings.service';
import { addDays, longDayLabel, narrowWeekday, relativeDayName, todayKey } from '../../../core/utils/day';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';

export interface ActivityData {
  /** Sessions per day, keyed YYYY-MM-DD in the user's timezone. */
  workoutCounts: Map<string, number>;
  /** Journal entries per day, same keys. */
  journalCounts: Map<string, number>;
}

interface ActivityDay {
  key: string;
  label: string;
  /** The link's accessible name: "Wednesday 23 September: 1 workout, 1 entry". */
  name: string;
  workout: boolean;
  journal: boolean;
  today: boolean;
}

@Component({
  selector: 'dash-activity-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()" skeleton="strip">
      <span head class="act-legend" aria-hidden="true">
        <i class="act-dot act-dot--w"></i> Workouts <i class="act-dot act-dot--j"></i> Journal
      </span>
      @if (data()) {
        <p class="sr-only">{{ summary() }}</p>
        <ol class="act-grid">
          @for (day of days(); track day.key) {
            <li class="act-li">
              <a class="act-col" [class.act-col--today]="day.today" [routerLink]="['/day', day.key]"
                [attr.aria-label]="day.name" [attr.aria-current]="day.today ? 'date' : null">
                <span class="act-cell" [class.on-w]="day.workout"></span>
                <span class="act-cell" [class.on-j]="day.journal"></span>
                <span class="act-day" aria-hidden="true">{{ day.label }}</span>
              </a>
            </li>
          }
        </ol>
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
    .act-grid { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 6px; list-style: none; margin: 0; padding: 0; }
    .act-li { min-width: 0; }
    .act-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 2px 0;
      border-radius: var(--border-radius-sm);
      color: inherit;
      text-decoration: none;
    }
    .act-col:hover { text-decoration: none; background: var(--bg-surface-hover); }
    .act-col:hover .act-cell:not(.on-w):not(.on-j) { background: var(--border-color); }
    .act-col:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
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

    /* Phones: 14 columns would be ~17px taps. Two rows of 7 (last week over
       this week) keep every day at a comfortable width; 14 is exactly two
       weeks, so each column holds the same weekday in both rows. */
    @media (max-width: 600px) {
      .act-grid { grid-template-columns: repeat(7, minmax(0, 1fr)); row-gap: var(--space-sm); }
      .act-col { padding: 4px 0; }
      .act-cell { max-width: 28px; }
    }
  `],
})
export class ActivityWidgetComponent {
  data = input<WidgetData<ActivityData>>(undefined);

  readonly def = WIDGET_BY_ID.get('activity')!;
  readonly state = computed(() => widgetState(this.data()));

  private readonly settings = inject(SettingsService);

  // Days are the user's calendar days (settings timezone), the same ones the
  // day view and GET /day use, so each column opens exactly what it counts.
  readonly days = computed<ActivityDay[]>(() => {
    const d = this.data();
    const today = todayKey(this.settings.timezone());
    const days: ActivityDay[] = [];
    for (let i = STRIP_DAYS - 1; i >= 0; i--) {
      const key = addDays(today, -i);
      const w = d?.workoutCounts.get(key) ?? 0;
      const j = d?.journalCounts.get(key) ?? 0;
      const rel = relativeDayName(key, today);
      const date = longDayLabel(key, today);
      const what = w || j
        ? [w ? `${w} ${w === 1 ? 'workout' : 'workouts'}` : '', j ? `${j} ${j === 1 ? 'entry' : 'entries'}` : ''].filter(Boolean).join(', ')
        : 'no workout or entry';
      days.push({
        key,
        label: narrowWeekday(key),
        name: `${rel ? rel + ', ' : ''}${date}: ${what}`,
        workout: w > 0,
        journal: j > 0,
        today: key === today,
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
