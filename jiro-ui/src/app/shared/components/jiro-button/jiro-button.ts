import { Component, booleanAttribute, input } from '@angular/core';

/**
 * The one button. Auto width by default; add `block` for full width.
 * Consumers that need every button in a row to stretch can set
 * `--jiro-btn-width: 100%` on the container instead of reaching in.
 *
 *   <jiro-button variant="primary" (click)="save()">Save</jiro-button>
 *   <jiro-button block type="submit" [loading]="saving()">Sign in</jiro-button>
 *   <jiro-button size="sm" variant="secondary">Edit</jiro-button>
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
      [class.jiro-btn--sm]="size() === 'sm'"
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
                  box-shadow 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94),
                  transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      box-shadow: 2px 2px 0px transparent;
    }

    .jiro-btn--sm {
      min-height: 32px;
      padding: 6px 12px;
      font-size: var(--font-size-xs);
      gap: var(--space-xs);
    }

    .jiro-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none !important;
      box-shadow: none !important;
    }

    .jiro-btn:active:not(:disabled) {
      transform: translate(1px, 1px) !important;
      box-shadow: 0px 0px 0px transparent !important;
    }

    .jiro-btn--primary {
      background: var(--color-primary);
      color: var(--text-on-primary);
      border-color: var(--color-primary);
    }
    .jiro-btn--primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
      box-shadow: 4px 4px 0px rgba(var(--shadow-rgb), 0.25);
      transform: translate(-2px, -2px);
    }

    .jiro-btn--secondary {
      background: var(--color-secondary);
      color: var(--text-primary);
      border-color: var(--border-color);
    }
    .jiro-btn--secondary:hover:not(:disabled) {
      background: var(--color-secondary-hover);
      box-shadow: 4px 4px 0px rgba(var(--shadow-rgb), 0.15);
      transform: translate(-2px, -2px);
    }

    .jiro-btn--danger {
      background: var(--color-danger);
      color: var(--text-on-primary);
      border-color: var(--color-danger);
    }
    .jiro-btn--danger:hover:not(:disabled) {
      background: var(--color-danger-hover);
      box-shadow: 4px 4px 0px rgba(var(--color-danger-rgb), 0.25);
      transform: translate(-2px, -2px);
    }

    .jiro-btn__spinner {
      border-color: transparent;
      border-top-color: currentColor;
    }
  `]
})
export class JiroButtonComponent {
  variant = input<'primary' | 'secondary' | 'danger'>('primary');
  size = input<'sm' | 'md'>('md');
  type = input<'button' | 'submit'>('button');
  disabled = input(false, { transform: booleanAttribute });
  loading = input(false, { transform: booleanAttribute });
  block = input(false, { transform: booleanAttribute });
}
