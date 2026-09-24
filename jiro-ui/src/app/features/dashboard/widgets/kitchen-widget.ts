import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CookStreak } from '../../../core/services/recipe.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';

@Component({
  selector: 'dash-kitchen-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent, JiroButtonComponent, JiroEmptyStateComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()">
      @if (data(); as d) {
        @if (d.total_cook_days === 0) {
          <jiro-empty-state compact heading="Nothing cooked yet" message="Add a recipe and log the first time you make it.">
            <jiro-button size="sm" routerLink="/culinara">Add your first recipe</jiro-button>
          </jiro-empty-state>
        } @else {
          <p class="tile-num">{{ d.current_streak }}<span class="tile-unit">day cook streak</span></p>
          <p class="tile-sub">Best {{ d.longest_streak }}, {{ d.total_cook_days }} {{ d.total_cook_days === 1 ? 'day' : 'days' }} cooked in all</p>
          <div class="tile-action"><jiro-button variant="secondary" routerLink="/culinara">Log a cook</jiro-button></div>
        }
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES],
})
export class KitchenWidgetComponent {
  data = input<WidgetData<CookStreak>>(undefined);

  readonly def = WIDGET_BY_ID.get('kitchen')!;
  readonly state = computed(() => widgetState(this.data()));
}
