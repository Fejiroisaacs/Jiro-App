import { Component, input } from '@angular/core';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';
import { IconName } from '../../icons/icons.generated';

/**
 * Composed empty state: optional icon, heading, one sentence, projected action.
 *
 *   <jiro-empty-state icon="barbell" heading="No exercises yet" message="Build your library to track performance over time.">
 *     <jiro-button (click)="create()">Add first exercise</jiro-button>
 *   </jiro-empty-state>
 */
@Component({
  selector: 'jiro-empty-state',
  standalone: true,
  imports: [JiroIconComponent],
  template: `
    <div class="es" [class.es--compact]="compact()">
      @if (icon(); as i) {
        <div class="es-icon"><jiro-icon [name]="i" [size]="compact() ? 24 : 40" /></div>
      }
      <h3 class="es-heading">{{ heading() }}</h3>
      @if (message()) {
        <p class="es-message">{{ message() }}</p>
      }
      <div class="es-action"><ng-content></ng-content></div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .es {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
      padding: var(--space-2xl) var(--space-lg);
      text-align: center;
    }
    .es--compact { padding: var(--space-lg); }

    .es-icon {
      color: var(--text-muted);
      margin-bottom: var(--space-xs);
    }

    .es-heading {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
    }

    .es-message {
      max-width: 44ch;
      color: var(--text-secondary);
      text-wrap: pretty;
    }

    .es-action { margin-top: var(--space-sm); }
    .es-action:empty { display: none; }
  `]
})
export class JiroEmptyStateComponent {
  heading = input.required<string>();
  message = input<string>('');
  icon = input<IconName | null>(null);
  compact = input(false);
}
