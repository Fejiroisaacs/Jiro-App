import { Component, input } from '@angular/core';

/**
 * "PR" chip shown beside a personal-record set. Replaces the baked
 * /icons/badge-icon.svg so the badge follows the theme and dark mode.
 *
 *   <jym-pr-badge />           small, inline with a set row
 *   <jym-pr-badge size="md" /> beside a heading
 */
@Component({
  selector: 'jym-pr-badge',
  standalone: true,
  host: {
    role: 'img',
    'aria-label': 'Personal record',
    title: 'Personal record',
    '[class.md]': "size() === 'md'",
  },
  template: `PR`,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 20px;
      padding: 0 6px;
      border: 1px solid rgba(var(--color-warning-rgb), 0.45);
      border-radius: var(--border-radius-pill);
      background: rgba(var(--color-warning-rgb), 0.14);
      color: var(--color-warning);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      line-height: 1;
      flex-shrink: 0;
    }
    :host(.md) {
      min-width: 36px;
      height: 24px;
      font-size: var(--font-size-xs);
    }
  `]
})
export class JymPrBadgeComponent {
  size = input<'sm' | 'md'>('sm');
}
