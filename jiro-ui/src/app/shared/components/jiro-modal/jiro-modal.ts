import { A11yModule } from '@angular/cdk/a11y';
import { AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Injector, Input, OnDestroy, Output, afterNextRender, inject, viewChild } from '@angular/core';

import { JiroIconComponent } from '../jiro-icon/jiro-icon';

let modalSeq = 0;

/** Open modals, oldest first. Escape closes only the top one (dialogs do nest). */
const openModals: JiroModalComponent[] = [];

/** For custom dialogs that sit under a jiro-modal (a confirm) and must leave Escape to it. */
export function isJiroModalOpen(): boolean {
  return openModals.length > 0;
}

@Component({
  selector: 'jiro-modal',
  standalone: true,
  imports: [A11yModule, JiroIconComponent],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div
        #dialog
        class="modal-content"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        cdkTrapFocus
        [cdkTrapFocusAutoCapture]="true"
        [attr.aria-labelledby]="title ? titleId : null"
        [style.max-width]="maxWidth">
        @if (title) {
<div class="modal-header">
          <h2 [id]="titleId">{{ title }}</h2>
          <button type="button" class="modal-close" (click)="close.emit()" aria-label="Close">
            <jiro-icon name="x" [size]="18" />
          </button>
        </div>
}
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: var(--z-modal);
      padding: var(--space-lg);
      animation: fadeIn 0.15s ease;
    }

    .modal-content {
      background: var(--bg-canvas);
      color: var(--text-primary); /* own the text colour: a modal can be opened from the dark sidebar */
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
      width: 100%;
      max-height: 90dvh;
      overflow-y: auto;
      animation: slideUp 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    .modal-content:focus { outline: none; } /* focused only as the no-tabbables fallback */

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      padding: var(--space-lg) var(--space-lg) 0;
    }

    .modal-header h2 {
      font-size: var(--font-size-lg);
      font-weight: 600;
    }

    .modal-close {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      margin: -8px -8px -8px 0;
      background: none;
      border: none;
      border-radius: var(--border-radius);
      cursor: pointer;
      color: var(--text-muted);
      flex-shrink: 0;
    }

    .modal-close:hover {
      color: var(--text-primary);
      background: var(--bg-surface-hover);
    }

    .modal-body {
      padding: var(--space-lg);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class JiroModalComponent implements AfterViewInit, OnDestroy {
  @Input() title = '';
  @Input() maxWidth = '520px';
  @Output() close = new EventEmitter<void>();

  readonly titleId = `jiro-modal-title-${++modalSeq}`;

  private readonly injector = inject(Injector);
  private readonly dialog = viewChild.required<ElementRef<HTMLElement>>('dialog');

  constructor() {
    openModals.push(this);
  }

  // Runs after cdkTrapFocusAutoCapture: honour a consumer's autofocus, else focus the dialog if nothing is tabbable.
  ngAfterViewInit() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      const auto = dialog.querySelector<HTMLElement>('[autofocus]');
      if (auto) auto.focus();
      else if (!dialog.contains(dialog.ownerDocument.activeElement)) dialog.focus();
    }, { injector: this.injector });
  }

  ngOnDestroy() {
    openModals.splice(openModals.indexOf(this), 1);
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (openModals[openModals.length - 1] === this) this.close.emit();
  }

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
