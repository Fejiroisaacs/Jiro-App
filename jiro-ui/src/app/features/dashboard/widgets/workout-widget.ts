import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardJym } from '../../../core/services/dashboard.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';
import { plural, timeAgo } from './format';

@Component({
  selector: 'dash-workout-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent, JiroButtonComponent, JiroEmptyStateComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()">
      @if (data(); as d) {
        @if (current(); as c) {
          <p class="tile-big">{{ c.name }}</p>
          <p class="tile-sub">{{ c.detail }}</p>
          <div class="tile-action"><jiro-button [routerLink]="['/jym/session', c.id]">Resume</jiro-button></div>
        } @else if (last(); as l) {
          <p class="tile-big">{{ l.name }}</p>
          <p class="tile-sub">{{ l.stats }}</p>
          <p class="tile-sub">{{ l.volume }}</p>
          @if (l.muscles) {
            <p class="tile-muted muscles">{{ l.muscles }}</p>
          }
          <div class="tile-action"><jiro-button variant="secondary" routerLink="/jym">Start a session</jiro-button></div>
        } @else {
          <jiro-empty-state compact heading="No workouts yet" message="Plan a split, then start your first session.">
            <jiro-button size="sm" routerLink="/jym/plan">Plan your first split</jiro-button>
          </jiro-empty-state>
        }
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES, `.muscles { margin-top: var(--space-xs); }`],
})
export class WorkoutWidgetComponent {
  private readonly settings = inject(SettingsService);

  data = input<WidgetData<DashboardJym>>(undefined);

  readonly def = WIDGET_BY_ID.get('workout')!;
  readonly state = computed(() => widgetState(this.data()));

  readonly current = computed(() => {
    const s = this.data()?.inProgress;
    if (!s) return null;
    return {
      id: s.id,
      name: s.routine_name || 'Freestyle session',
      detail: `In progress, started ${timeAgo(s.started_at)}, ${plural(s.set_count, 'set', 'sets')} logged`,
    };
  });

  readonly last = computed(() => {
    const s = this.data()?.lastCompleted;
    if (!s) return null;
    const parts = [timeAgo(s.ended_at!), plural(s.set_count, 'set', 'sets')];
    if (s.pr_count > 0) parts.push(plural(s.pr_count, 'PR', 'PRs'));
    const volume = Math.round(this.settings.toDisplay(s.total_volume)).toLocaleString('en-US');
    return {
      name: s.routine_name || 'Freestyle session',
      stats: parts.join(', '),
      volume: `${volume} ${this.settings.unitLabel()} lifted`,
      muscles: (s.muscle_groups ?? []).filter(Boolean).slice(0, 3).join(', '),
    };
  });
}
