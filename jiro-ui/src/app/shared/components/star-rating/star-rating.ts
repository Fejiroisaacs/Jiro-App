import { Component, Input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';

@Component({
  selector: 'star-rating',
  standalone: true,
  imports: [JiroIconComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => StarRatingComponent),
      multi: true,
    },
  ],
  template: `
    <div class="stars" [class.readonly]="readonly" role="group" [attr.aria-label]="ariaLabel">
      @for (star of stars; track star) {
        <button
          type="button"
          class="star"
          [class.filled]="star <= value"
          [class.hovered]="star <= hoverValue && !readonly"
          [attr.aria-label]="star + (star === 1 ? ' star' : ' stars')"
          [attr.aria-pressed]="star === value"
          (click)="!readonly && select(star)"
          (mouseenter)="!readonly && (hoverValue = star)"
          (mouseleave)="hoverValue = 0"
          [disabled]="readonly">
          <jiro-icon [name]="star <= value || (star <= hoverValue && !readonly) ? 'star:fill' : 'star'" [size]="size" />
        </button>
      }
    </div>
  `,
  styles: [`
    .stars {
      display: inline-flex;
      gap: 2px;
    }

    .star {
      display: inline-flex;
      background: none;
      border: none;
      border-radius: var(--border-radius-sm);
      cursor: pointer;
      color: var(--text-muted);
      padding: 2px;
      transition: color 0.1s, transform 0.1s;
    }

    .star.filled {
      color: var(--color-warning);
    }

    .star.hovered {
      color: var(--color-warning);
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
  @Input() size = 20;
  @Input() ariaLabel = 'Rating';

  readonly stars = [1, 2, 3, 4, 5];
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
