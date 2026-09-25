import { Component, ViewEncapsulation } from '@angular/core';

/**
 * Numbered steps. Put plain `<li>`s inside; each can hold links, `<strong>`
 * for on-screen labels, and `<kbd>` for keys.
 *
 *   <guide-steps>
 *     <li>Open <a routerLink="/jym">Jym</a>.</li>
 *     <li>Select <strong>Start workout</strong>.</li>
 *   </guide-steps>
 */
@Component({
  selector: 'guide-steps',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `<ol class="gd-steps-list"><ng-content /></ol>`,
  styles: [`
    guide-steps { display: block; max-width: 72ch; margin: 0 0 var(--space-lg); }

    .gd-steps-list {
      list-style: none;
      margin: 0;
      padding: 0;
      counter-reset: gd-step;
      display: grid;
      gap: var(--space-sm);
    }
    .gd-steps-list > li {
      counter-increment: gd-step;
      position: relative;
      padding-left: 40px;
      min-height: 28px;
      padding-top: 2px;
    }
    .gd-steps-list > li::before {
      content: counter(gd-step);
      position: absolute;
      left: 0;
      top: 0;
      width: 28px;
      height: 28px;
      display: grid;
      place-items: center;
      font-size: var(--font-size-sm);
      font-weight: 600;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--text-on-primary);
      background: var(--color-primary);
      border-radius: var(--border-radius-pill);
    }
  `],
})
export class GuideStepsComponent {}
