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
      border: 1px solid transparent;
      border-radius: var(--border-radius);
      font-weight: 600;
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
      width: 100%;
      box-shadow: 2px 2px 0px transparent;
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
      box-shadow: 4px 4px 0px rgba(92, 64, 51, 0.25);
      transform: translate(-2px, -2px);
    }

    .jiro-btn--secondary {
      background: var(--color-secondary);
      color: var(--text-primary);
      border-color: var(--border-color);
    }
    .jiro-btn--secondary:hover:not(:disabled) {
      background: var(--color-secondary-hover);
      box-shadow: 4px 4px 0px rgba(92, 64, 51, 0.15);
      transform: translate(-2px, -2px);
    }

    .jiro-btn--danger {
      background: var(--color-danger);
      color: var(--text-on-primary);
      border-color: var(--color-danger);
    }
    .jiro-btn--danger:hover:not(:disabled) {
      background: var(--color-danger-hover);
      box-shadow: 4px 4px 0px rgba(193, 88, 42, 0.25);
      transform: translate(-2px, -2px);
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
