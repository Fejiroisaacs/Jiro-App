import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Recipe } from '../../../core/services/recipe.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';
import { shortDate } from './format';

@Component({
  selector: 'dash-recent-recipes-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent, JiroButtonComponent, JiroEmptyStateComponent, JiroIconComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()" skeleton="list">
      @if (data()) {
        @if (rows().length === 0) {
          <jiro-empty-state compact heading="No recipes yet" message="Save a recipe you make often.">
            <jiro-button size="sm" routerLink="/culinara">Add your first recipe</jiro-button>
          </jiro-empty-state>
        } @else {
          <ul class="rr">
            @for (r of rows(); track r.id) {
              <li>
                <a class="rr-link" [routerLink]="['/culinara', r.id]">
                  <span class="rr-title">{{ r.title }}</span>
                  <span class="rr-sub">{{ r.cooked }}</span>
                </a>
              </li>
            }
          </ul>
          <div class="tile-action">
            <a class="tile-link" routerLink="/culinara">All recipes <jiro-icon name="arrow-right" [size]="14" /></a>
          </div>
        }
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES, `
    .rr { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .rr li + li { border-top: 1px solid var(--border-color); }
    .rr-link {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      min-height: 44px;
      padding: var(--space-xs) 0;
      color: var(--text-primary);
      text-decoration: none;
    }
    .rr-link:hover .rr-title { text-decoration: underline; }
    .rr-title {
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rr-sub { font-size: var(--font-size-xs); color: var(--text-muted); }
    .tile-action { padding-top: var(--space-sm); }
  `],
})
export class RecentRecipesWidgetComponent {
  data = input<WidgetData<Recipe[]>>(undefined);

  readonly def = WIDGET_BY_ID.get('recent_recipes')!;
  readonly state = computed(() => widgetState(this.data()));

  readonly rows = computed(() =>
    (this.data() ?? []).map(r => ({
      id: r.id,
      title: r.title,
      cooked: r.last_cooked ? `Last cooked ${shortDate(r.last_cooked)}` : 'Not cooked yet',
    })),
  );
}
