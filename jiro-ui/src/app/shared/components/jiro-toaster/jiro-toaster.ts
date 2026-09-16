import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';

/** Renders the ToastService queue. Place once per layout. */
@Component({
  selector: 'jiro-toaster',
  standalone: true,
  imports: [JiroIconComponent],
  template: `
    <div class="toaster" role="status" aria-live="polite" aria-atomic="false">
      @for (t of toastService.toasts(); track t.id) {
        <button
          type="button"
          class="toast"
          [class.toast--success]="t.kind === 'success'"
          [class.toast--error]="t.kind === 'error'"
          [class.toast--info]="t.kind === 'info'"
          (click)="toastService.dismiss(t.id)"
          title="Dismiss">
          <jiro-icon [name]="t.kind === 'error' ? 'warning-circle' : t.kind === 'info' ? 'info' : 'check-circle'" [size]="18" />
          <span>{{ t.message }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .toaster {
      position: fixed;
      left: 50%;
      bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
      transform: translateX(-50%);
      z-index: var(--z-toast);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
      width: max-content;
      max-width: calc(100vw - 2 * var(--space-md));
      pointer-events: none;
    }

    .toast {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: var(--space-sm);
      max-width: 100%;
      padding: 10px 16px 10px 12px;
      background: var(--bg-sidebar);
      color: var(--text-on-dark);
      border: none;
      border-left: 3px solid var(--color-accent);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      font-family: inherit;
      font-size: var(--font-size-sm);
      font-weight: 500;
      text-align: left;
      cursor: pointer;
      animation: toast-in 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .toast--success { border-left-color: var(--color-positive); }
    .toast--error   { border-left-color: var(--color-negative); }
    .toast--info    { border-left-color: var(--color-info); }

    .toast:focus-visible { outline-color: var(--text-on-dark); }

    @keyframes toast-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .toaster {
        bottom: calc(60px + env(safe-area-inset-bottom) + var(--space-md));
      }
    }
  `]
})
export class JiroToasterComponent {
  readonly toastService = inject(ToastService);
}
