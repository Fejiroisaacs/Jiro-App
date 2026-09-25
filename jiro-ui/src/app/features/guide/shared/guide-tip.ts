import { Component, ViewEncapsulation } from '@angular/core';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';

/**
 * One short aside: a shortcut, a caveat, or where else a feature shows up.
 * Keep it to a sentence or two.
 *
 *   <guide-tip>Press <kbd>Ctrl</kbd> <kbd>K</kbd> from any page to search.</guide-tip>
 */
@Component({
  selector: 'guide-tip',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [JiroIconComponent],
  template: `
    <div class="gd-tip" role="note">
      <jiro-icon class="gd-tip-icon" name="info" [size]="18" />
      <p class="gd-tip-text"><span class="gd-tip-label">Tip: </span><ng-content /></p>
    </div>
  `,
  styles: [`
    guide-tip { display: block; max-width: 72ch; margin: 0 0 var(--space-lg); }

    .gd-tip {
      display: flex;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--color-accent);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }
    .gd-tip-icon { color: var(--color-accent); flex-shrink: 0; margin-top: 2px; }
    guide-page .gd-body .gd-tip-text { margin: 0; }
    .gd-tip-label { font-weight: 600; }
  `],
})
export class GuideTipComponent {}
