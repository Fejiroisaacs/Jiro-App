import { Component, computed, input } from '@angular/core';
import { prDescription, prLabel } from './pr-kind';

/**
 * A personal-record chip that names the top record a set earned ("Weight PR"), or plain "PR".
 *
 *   <jym-pr-badge [kind]="set.pr_kind" [kinds]="set.pr_kinds" />  inline with a set row
 *   <jym-pr-badge size="md" />                                    beside a heading
 */
@Component({
  selector: 'jym-pr-badge',
  standalone: true,
  host: {
    role: 'img',
    '[attr.aria-label]': 'description()',
    '[attr.title]': 'description()',
    '[class.md]': "size() === 'md'",
  },
  template: `{{ label() }}`,
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
      color: color-mix(in srgb, var(--color-warning) 70%, var(--text-primary));
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      line-height: 1;
      white-space: nowrap;
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
  kind = input<string | null | undefined>(null);
  kinds = input<readonly string[] | null | undefined>(null);
  readonly label = computed(() => prLabel(this.kind()));
  readonly description = computed(() => prDescription(this.kinds()?.length ? this.kinds() : this.kind() ? [this.kind()!] : []));
}
