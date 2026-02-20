import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'jiro-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="onBackdropClick($event)">
      <div class="modal-content" [style.max-width]="maxWidth">
        <div class="modal-header" *ngIf="title">
          <h2>{{ title }}</h2>
          <button class="modal-close" (click)="close.emit()">&times;</button>
        </div>
        <div class="modal-body">
          <ng-content></ng-content>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: var(--space-lg);
      animation: fadeIn 0.15s ease;
    }

    .modal-content {
      background: var(--bg-surface);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      animation: slideUp 0.2s ease;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-lg) var(--space-lg) 0;
    }

    .modal-header h2 {
      font-size: var(--font-size-lg);
      font-weight: 600;
    }

    .modal-close {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--text-muted);
      padding: var(--space-xs);
      line-height: 1;
    }

    .modal-close:hover {
      color: var(--text-primary);
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
export class JiroModalComponent {
  @Input() title = '';
  @Input() maxWidth = '520px';
  @Output() close = new EventEmitter<void>();

  onBackdropClick(event: MouseEvent) {
    if ((event.target as HTMLElement).classList.contains('modal-backdrop')) {
      this.close.emit();
    }
  }
}
