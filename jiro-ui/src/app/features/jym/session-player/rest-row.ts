import { Component, input } from '@angular/core';
import { RestTimer } from './rest-timer';

/** The rest row under the workout bar: the countdown, +30s and Skip, and a progress line. */
@Component({
  selector: 'jym-rest-row',
  standalone: true,
  template: `
    <div class="rest-row" [class.rest-done]="timer().done()">
      <span class="rest-label">Rest</span>
      <span class="rest-countdown" role="timer" aria-live="off">{{ timer().display() }}</span>
      <button class="rest-btn" type="button" (click)="timer().add(30)" aria-label="Add 30 seconds to this rest">+30s</button>
      <button class="rest-btn" type="button" (click)="timer().skip()">Skip</button>
      <div class="rest-progress" aria-hidden="true">
        <div class="rest-progress-fill" [style.width.%]="(timer().remaining() / timer().length()) * 100"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .rest-row {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-xs) var(--space-xl) calc(var(--space-xs) + 3px);
      background: rgba(var(--shadow-rgb), 0.18);
      border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      position: relative; overflow: hidden;
      transition: background 0.4s;
    }

    .rest-row.rest-done { background: rgba(var(--color-accent-rgb), 0.45); }

    .rest-label {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 1px; opacity: 0.8; font-weight: 500; white-space: nowrap;
    }

    .rest-countdown {
      font-size: var(--font-size-lg); font-weight: 700;
      font-variant-numeric: tabular-nums; min-width: 52px; margin-right: auto;
    }

    .rest-btn {
      min-height: 44px; min-width: 64px; padding: 0 var(--space-md); border-radius: var(--border-radius-pill);
      border: 1px solid color-mix(in srgb, currentColor 40%, transparent); background: none;
      color: inherit; font-size: var(--font-size-sm); font-weight: 600; font-family: inherit;
      cursor: pointer; white-space: nowrap; transition: background 0.15s, border-color 0.15s;
    }
    .rest-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); border-color: color-mix(in srgb, currentColor 75%, transparent); }

    .rest-progress {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 3px; background: color-mix(in srgb, currentColor 15%, transparent);
    }

    .rest-progress-fill {
      height: 100%; background: color-mix(in srgb, currentColor 75%, transparent);
      transition: width 1s linear;
    }

    .rest-row.rest-done .rest-progress-fill { background: var(--color-positive); }

    @media (max-width: 768px) {
      .rest-row { padding: var(--space-xs) var(--space-md) calc(var(--space-xs) + 3px); }
    }
  `],
})
export class RestRowComponent {
  readonly timer = input.required<RestTimer>();
}
