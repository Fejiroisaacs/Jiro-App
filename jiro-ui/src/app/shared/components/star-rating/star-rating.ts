import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'star-rating',
  standalone: true,
  imports: [CommonModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true,
    },
  ],
  template: `
    <div class="stars" [class.readonly]="readonly">
      <button
        *ngFor="let star of [1,2,3,4,5]"
        type="button"
        class="star"
        [class.filled]="star <= value"
        [class.hovered]="star <= hoverValue && !readonly"
        (click)="!readonly && select(star)"
        (mouseenter)="!readonly && (hoverValue = star)"
        (mouseleave)="hoverValue = 0"
        [disabled]="readonly">
        &#9733;
      </button>
    </div>
  `,
  styles: [`
    .stars {
      display: inline-flex;
      gap: 2px;
    }

    .star {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--border-color);
      transition: color 0.1s;
      padding: 0 2px;
    }

    .star.filled {
      color: var(--jiro-clay);
    }

    .star.hovered {
      color: var(--jiro-clay);
      opacity: 0.7;
    }

    .star:hover:not(:disabled) {
      transform: scale(1.1);
    }

    .readonly .star {
      cursor: default;
    }
  `]
})
export class StarRatingComponent implements ControlValueAccessor {
  @Input() readonly = false;

  value = 0;
  hoverValue = 0;
  onChange: (val: number) => void = () => {};
  onTouched: () => void = () => {};

  select(rating: number) {
    this.value = rating;
    this.onChange(rating);
    this.onTouched();
  }

  writeValue(val: number): void {
    this.value = val || 0;
  }

  registerOnChange(fn: (val: number) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
}
