import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';

/**
 * Page title block used at the top of every page.
 *
 *   <jiro-page-header heading="Ledger" subtitle="September overview">
 *     <jiro-button actions>Log transaction</jiro-button>
 *   </jiro-page-header>
 *
 * Anything with an `actions` attribute is projected to the right of the title
 * and wraps underneath on narrow screens.
 */
@Component({
  selector: 'jiro-page-header',
  standalone: true,
  imports: [RouterLink, JiroIconComponent],
  template: `
    <header class="ph">
      @if (backLink()) {
        <a [routerLink]="backLink()" class="ph-back">
          <jiro-icon name="caret-left" [size]="14" />
          {{ backLabel() || 'Back' }}
        </a>
      }
      <div class="ph-row">
        <div class="ph-text">
          <h1>{{ heading() }}</h1>
          @if (subtitle()) {
            <p class="ph-sub">{{ subtitle() }}</p>
          }
        </div>
        <div class="ph-actions">
          <ng-content select="[actions]"></ng-content>
        </div>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }

    .ph { margin-bottom: var(--space-xl); }

    .ph-back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: var(--space-sm);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
    .ph-back:hover { color: var(--text-primary); text-decoration: none; }

    .ph-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-md);
      flex-wrap: wrap;
    }

    .ph-text { min-width: 0; }

    h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-primary);
    }

    .ph-sub {
      margin-top: var(--space-xs);
      color: var(--text-secondary);
    }

    .ph-actions {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }
    .ph-actions:empty { display: none; }

    @media (max-width: 600px) {
      .ph-row { flex-direction: column; }
      .ph-actions { width: 100%; }
    }
  `]
})
export class JiroPageHeaderComponent {
  heading = input.required<string>();
  subtitle = input<string>('');
  backLink = input<string | any[] | null>(null);
  backLabel = input<string>('');
}
