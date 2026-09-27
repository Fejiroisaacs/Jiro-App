import { Component, ElementRef, effect, inject } from '@angular/core';
import { ConfirmService } from '../../../core/services/confirm.service';
import { JiroModalComponent } from '../jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../jiro-button/jiro-button';

/** Renders the ConfirmService dialog. Place once per layout. */
@Component({
  selector: 'jiro-confirm',
  standalone: true,
  imports: [JiroModalComponent, JiroButtonComponent],
  template: `
    @if (confirmService.pending(); as p) {
      <jiro-modal [title]="p.options.title" maxWidth="420px" (close)="confirmService.resolve('cancel')">
        <p class="confirm-message">{{ p.options.message }}</p>
        <div class="confirm-actions">
          <!-- With a middle choice, Cancel steps back to ghost so the two ways forward read first. -->
          <jiro-button data-cancel [variant]="p.options.altLabel ? 'ghost' : 'secondary'" type="button" (click)="confirmService.resolve('cancel')">
            {{ p.options.cancelLabel }}
          </jiro-button>
          @if (p.options.altLabel) {
            <jiro-button variant="secondary" type="button" (click)="confirmService.resolve('alt')">
              {{ p.options.altLabel }}
            </jiro-button>
          }
          <jiro-button [variant]="p.options.danger ? 'danger' : 'primary'" type="button" (click)="confirmService.resolve('confirm')">
            {{ p.options.confirmLabel }}
          </jiro-button>
        </div>
      </jiro-modal>
    }
  `,
  styles: [`
    .confirm-message {
      color: var(--text-secondary);
      line-height: var(--line-height-body);
      margin-bottom: var(--space-lg);
    }
    .confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
    }
    @media (max-width: 480px) {
      .confirm-actions { flex-direction: column-reverse; --jiro-btn-width: 100%; }
    }
  `]
})
export class JiroConfirmComponent {
  readonly confirmService = inject(ConfirmService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  constructor() {
    // Move focus to Cancel, the safe action, when a dialog opens; Escape and
    // backdrop clicks are handled by jiro-modal and resolve to 'cancel'.
    effect(() => {
      if (!this.confirmService.pending()) return;
      queueMicrotask(() => {
        this.host.nativeElement.querySelector<HTMLButtonElement>('[data-cancel] button')?.focus();
      });
    });
  }
}
