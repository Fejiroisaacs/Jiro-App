import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

@Component({
  selector: 'jiro-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => JiroInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="jiro-input-wrapper" [class.has-error]="error">
      <label *ngIf="label" class="jiro-label">{{ label }}</label>
      <input
        class="jiro-input"
        [type]="type"
        [placeholder]="placeholder"
        [value]="value"
        (input)="onInput($event)"
        (blur)="onTouched()" />
      <span *ngIf="error" class="jiro-error">{{ error }}</span>
    </div>
  `,
  styles: [`
    .jiro-input-wrapper {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .jiro-label {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-secondary);
    }

    .jiro-input {
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      outline: none;
    }

    .jiro-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(122, 59, 46, 0.15);
    }

    .jiro-input::placeholder {
      color: var(--text-muted);
    }

    .has-error .jiro-input {
      border-color: var(--color-danger);
    }

    .jiro-error {
      font-size: var(--font-size-xs);
      color: var(--color-danger);
    }
  `]
})
export class JiroInputComponent implements ControlValueAccessor {
  @Input() label = '';
  @Input() type = 'text';
  @Input() placeholder = '';
  @Input() error = '';

  value = '';
  onChange: (val: string) => void = () => {};
  onTouched: () => void = () => {};

  onInput(event: Event) {
    const val = (event.target as HTMLInputElement).value;
    this.value = val;
    this.onChange(val);
  }

  writeValue(val: string): void {
    this.value = val || '';
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
