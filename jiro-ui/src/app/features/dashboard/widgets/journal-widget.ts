import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardJournal } from '../../../core/services/dashboard.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';

@Component({
  selector: 'dash-journal-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent, JiroButtonComponent, JiroEmptyStateComponent, JiroIconComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()">
      @if (data(); as d) {
        @if (d.streak.total_entries === 0) {
          <jiro-empty-state compact heading="No entries yet" message="A sentence is enough. Just begin.">
            <jiro-button size="sm" routerLink="/journal/new">Start your first entry</jiro-button>
          </jiro-empty-state>
        } @else {
          <p class="tile-num">{{ d.streak.current_streak }}<span class="tile-unit">day streak</span></p>
          <p class="tile-sub">Best {{ d.streak.longest_streak }}, {{ d.streak.total_entries }} {{ d.streak.total_entries === 1 ? 'entry' : 'entries' }} in all</p>
          <div class="tile-action">
            @if (d.wroteToday) {
              <span class="tile-done"><jiro-icon name="check-circle" [size]="18" /> Written today</span>
            } @else {
              <jiro-button routerLink="/journal/new">Write today</jiro-button>
            }
          </div>
        }
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES, `.tile-done { min-height: 44px; }`],
})
export class JournalWidgetComponent {
  data = input<WidgetData<DashboardJournal>>(undefined);

  readonly def = WIDGET_BY_ID.get('journal')!;
  readonly state = computed(() => widgetState(this.data()));
}
