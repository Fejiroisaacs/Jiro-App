import { Component, computed, inject, input, linkedSignal, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { parseDecimal } from '../number-input';
import { nearestLoadable, platesFor, platesPerSide } from '../plates';

/** Plates for one side of the bar, from the account's bar and plates; starts at `weight`, and any weight can be typed. */
@Component({
  selector: 'jym-plates-sheet',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroModalComponent],
  template: `
    <jiro-modal sheet title="Plates" maxWidth="420px" (close)="close.emit()">
      <label class="field-label" for="plates-weight">Weight ({{ settings.unitLabel() }})</label>
      <input
        id="plates-weight"
        class="plates-input"
        type="text"
        inputmode="decimal"
        enterkeyhint="done"
        autocomplete="off"
        [ngModel]="typed()"
        (ngModelChange)="typed.set($event)"
        (keydown.enter)="$any($event.target).blur()" />

      @let r = result();
      <div class="plates-result" aria-live="polite">
        @if (r.kind === 'plates') {
          <div class="plate-stack" role="img" [attr.aria-label]="'Each side: ' + r.side.join(', ') + ' ' + settings.unitLabel()">
            <span class="plate-sleeve" aria-hidden="true"></span>
            @for (p of r.side; track $index) {
              <span class="plate" aria-hidden="true" [style.height.px]="plateHeight(p)">{{ p }}</span>
            }
          </div>
          <p class="plates-line">Each side: {{ r.side.join(', ') }}</p>
        } @else if (r.kind === 'bar') {
          <p class="plates-line">Just the bar.</p>
        } @else if (r.kind === 'light') {
          <p class="plates-line">That's lighter than the bar.</p>
        } @else if (r.kind === 'near') {
          <p class="plates-line">Your plates can't make exactly {{ typed() }} {{ settings.unitLabel() }}. The closest you can load:</p>
          <div class="near-chips">
            @for (w of r.near; track w) {
              <button type="button" class="near-chip" (click)="typed.set('' + w)">{{ w }} {{ settings.unitLabel() }}</button>
            }
          </div>
        } @else {
          <p class="plates-line plates-muted">Type a weight to see the plates for each side.</p>
        }
      </div>

      <p class="plates-bar">
        On a {{ plates().bar }} {{ settings.unitLabel() }} bar.
        <a class="plates-link" routerLink="/settings" fragment="workouts" (click)="close.emit()">Change bar and plates</a>
      </p>
    </jiro-modal>
  `,
  styles: [`
    .field-label {
      display: block;
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: var(--space-xs);
    }
    .plates-input {
      width: 100%; box-sizing: border-box; min-height: 48px; padding: 10px 12px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-lg); font-weight: 600; font-family: inherit; font-variant-numeric: tabular-nums;
    }
    .plates-input:focus { border-color: var(--color-primary); }
    .plates-result { min-height: 132px; padding: var(--space-md) 0 var(--space-sm); }
    .plate-stack {
      position: relative; display: flex; align-items: center; gap: 4px;
      height: 88px; padding-left: var(--space-lg);
    }
    .plate-sleeve {
      position: absolute; left: 0; right: 0; top: 50%; height: 8px; transform: translateY(-50%);
      background: var(--border-color); border-radius: var(--border-radius-pill);
    }
    .plate {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      min-width: 32px; padding: 0 4px; border-radius: var(--border-radius-sm);
      background: var(--text-primary); color: var(--bg-surface);
      font-size: var(--font-size-xs); font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .plates-line { font-size: var(--font-size-md); font-weight: 600; margin-top: var(--space-sm); font-variant-numeric: tabular-nums; }
    .plates-muted { color: var(--text-secondary); font-weight: 400; }
    .near-chips { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }
    .near-chip {
      min-height: 44px; padding: 0 var(--space-md);
      border: 1px solid var(--color-primary); border-radius: var(--border-radius-pill);
      background: none; color: var(--color-primary);
      font-family: inherit; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    }
    .plates-bar { font-size: var(--font-size-sm); color: var(--text-secondary); border-top: 1px solid var(--border-color); padding-top: var(--space-sm); }
    .plates-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-primary); font-weight: 600; }
  `],
})
export class PlatesSheetComponent {
  readonly settings = inject(SettingsService);
  /** The weight it opens at: the exercise's next working set. */
  readonly weight = input('');
  readonly close = output<void>();

  readonly typed = linkedSignal(() => this.weight());
  /** The account's bar and plate sizes for the unit in use. */
  readonly plates = computed(() => platesFor(this.settings.weightUnit(), this.settings.plates()));
  readonly result = computed(() => {
    const weight = parseDecimal(this.typed());
    const set = this.plates();
    const none = { side: [] as number[], near: [] as number[] };
    if (weight === null || weight <= 0) return { kind: 'none', ...none };
    if (weight < set.bar) return { kind: 'light', ...none };
    const side = platesPerSide(weight, set);
    if (side) return { kind: side.length ? 'plates' : 'bar', ...none, side };
    const { below, above } = nearestLoadable(weight, set);
    return { kind: 'near', ...none, near: [below, above].filter((w): w is number => w !== null) };
  });

  /** A plate drawn taller the heavier it is, against the heaviest size on hand. */
  plateHeight(plate: number): number {
    const heaviest = Math.max(...this.plates().sizes);
    return Math.round(32 + 52 * (plate / heaviest));
  }
}
