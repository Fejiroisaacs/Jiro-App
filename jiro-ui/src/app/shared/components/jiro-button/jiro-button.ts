import { Component, booleanAttribute, input } from '@angular/core';

/**
 * The one button. Auto width by default; add `block` for full width.
 * Consumers that need every button in a row to stretch can set
 * `--jiro-btn-width: 100%` on the container instead of reaching in.
 *
 *   <jiro-button variant="primary" (click)="save()">Save</jiro-button>
 *   <jiro-button block type="submit" [loading]="saving()">Sign in</jiro-button>
 *   <jiro-button size="sm" variant="secondary">Edit</jiro-button>
 *
 * On a coloured surface (the session bar) use `inverse` for the one primary
 * action and `ghost` for the rest; both take their colours from the surface.
 */
@Component({
  selector: 'jiro-button',
  standalone: true,
  host: { '[class.block]': 'block()' },
  template: `
    <button
      class="jiro-btn"
      [class.jiro-btn--primary]="variant() === 'primary'"
      [class.jiro-btn--secondary]="variant() === 'secondary'"
      [class.jiro-btn--danger]="variant() === 'danger'"
      [class.jiro-btn--inverse]="variant() === 'inverse'"
      [class.jiro-btn--ghost]="variant() === 'ghost'"
      [class.jiro-btn--sm]="size() === 'sm'"
      [class.jiro-btn--lg]="size() === 'lg'"
      [disabled]="disabled() || loading()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [type]="type()">
      @if (loading()) {
        <span class="spinner spinner--sm jiro-btn__spinner" aria-hidden="true"></span>
      }
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    :host { display: inline-block; }
    :host(.block) { display: block; --jiro-btn-width: 100%; }

    .jiro-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
      width: var(--jiro-btn-width, auto);
      min-height: 40px;
      padding: 10px 20px;
      border: 1px solid transparent;
      border-radius: var(--border-radius);
      font-family: inherit;
      font-weight: 600;
      font-size: var(--font-size-sm);
      line-height: 1.2;
      cursor: pointer;
      transition: background 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  border-color 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  transform 0.1s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .jiro-btn--sm {
      min-height: 32px;
      padding: 6px 12px;
      font-size: var(--font-size-xs);
      gap: var(--space-xs);
    }

    /* A 44 px touch target, for screens used on the move such as the workout player. */
    .jiro-btn--lg { min-height: 44px; padding: 11px 20px; }

    .jiro-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
    }

    /* Opt-in (class="outline-when-disabled" on <jiro-button>): a disabled
       primary reads as an outline instead of a faded solid block, so it doesn't
       dominate a form the user hasn't filled in yet. Used on the auth forms. */
    :host(.outline-when-disabled) .jiro-btn--primary:disabled {
      background: transparent;
      color: var(--color-primary);
      border-color: var(--color-primary);
      opacity: 0.7;
    }

    .jiro-btn:active:not(:disabled) {
      transform: scale(0.98);
    }

    .jiro-btn--primary {
      background: var(--color-primary);
      color: var(--text-on-primary);
      border-color: var(--color-primary);
    }
    .jiro-btn--primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    /* Outlined, so it never reads as a selected or disabled block beside the primary. */
    .jiro-btn--secondary {
      background: transparent;
      color: var(--text-primary);
      border-color: color-mix(in srgb, var(--text-primary) 40%, transparent);
    }
    .jiro-btn--secondary:hover:not(:disabled) {
      background: rgba(var(--color-primary-rgb), 0.06);
      border-color: var(--text-primary);
    }

    .jiro-btn--danger {
      background: var(--color-danger);
      color: var(--text-on-primary);
      border-color: var(--color-danger);
    }
    .jiro-btn--danger:hover:not(:disabled) {
      background: var(--color-danger-hover);
    }

    /* Primary action on a primary-coloured surface */
    .jiro-btn--inverse {
      background: var(--text-on-primary);
      color: var(--color-primary);
      border-color: var(--text-on-primary);
    }
    .jiro-btn--inverse:hover:not(:disabled) {
      background: color-mix(in srgb, var(--text-on-primary) 88%, var(--color-primary));
    }

    /* Secondary action on any coloured surface: inherits the surface's text colour */
    .jiro-btn--ghost {
      background: transparent;
      color: inherit;
      border-color: color-mix(in srgb, currentColor 45%, transparent);
    }
    .jiro-btn--ghost:hover:not(:disabled) {
      background: color-mix(in srgb, currentColor 12%, transparent);
      border-color: color-mix(in srgb, currentColor 75%, transparent);
    }

    .jiro-btn__spinner {
      border-color: transparent;
      border-top-color: currentColor;
    }
  `]
})
export class JiroButtonComponent {
  variant = input<'primary' | 'secondary' | 'danger' | 'inverse' | 'ghost'>('primary');
  size = input<'sm' | 'md' | 'lg'>('md');
  type = input<'button' | 'submit'>('button');
  disabled = input(false, { transform: booleanAttribute });
  loading = input(false, { transform: booleanAttribute });
  block = input(false, { transform: booleanAttribute });
}
