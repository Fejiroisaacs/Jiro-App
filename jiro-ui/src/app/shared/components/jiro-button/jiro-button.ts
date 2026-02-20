import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'jiro-button',
  standalone: true,
  imports: [CommonModule],
  template: `
    <button
      class="jiro-btn"
      [class]="'jiro-btn jiro-btn--' + variant"
      [disabled]="disabled || loading"
      [type]="type">
      <span *ngIf="loading" class="spinner"></span>
      <ng-content></ng-content>
    </button>
  `,
  styles: [`
    .jiro-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
      padding: 10px 20px;
      border: none;
      border-radius: var(--border-radius);
      font-weight: 500;
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: background-color 0.2s ease, opacity 0.2s ease;
      width: 100%;
    }

    .jiro-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .jiro-btn--primary {
      background: var(--color-primary);
      color: var(--text-on-primary);
    }
    .jiro-btn--primary:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }

    .jiro-btn--secondary {
      background: var(--color-secondary);
      color: var(--text-primary);
    }
    .jiro-btn--secondary:hover:not(:disabled) {
      background: var(--color-secondary-hover);
    }

    .jiro-btn--danger {
      background: var(--color-danger);
      color: var(--text-on-primary);
    }
    .jiro-btn--danger:hover:not(:disabled) {
      background: var(--color-danger-hover);
    }

    .spinner {
      width: 16px;
      height: 16px;
      border: 2px solid transparent;
      border-top-color: currentColor;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class JiroButtonComponent {
  @Input() variant: 'primary' | 'secondary' | 'danger' = 'primary';
  @Input() disabled = false;
  @Input() loading = false;
  @Input() type: 'button' | 'submit' = 'button';
}
