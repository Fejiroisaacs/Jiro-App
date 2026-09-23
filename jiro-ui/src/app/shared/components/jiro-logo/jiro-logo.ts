import { Component, input } from '@angular/core';
import { JiroMarkComponent } from '../jiro-mark/jiro-mark';

/**
 * The Jiro logo: the J-and-leaf mark, optionally with the wordmark.
 *
 * Always a <span>, never a heading, so each page keeps its own h1. The
 * wordmark takes its colour from the parent (`currentColor`), which lets the
 * same component sit on the dark sidebar and on light pages. The mark tile is
 * themed through the --mark-* tokens like every other <jiro-mark>.
 *
 *   <jiro-logo />                        mark + "Jiro"
 *   <jiro-logo variant="mark" [size]="32" />
 */
@Component({
  selector: 'jiro-logo',
  standalone: true,
  imports: [JiroMarkComponent],
  template: `
    <span class="logo" [style.--logo-size]="size() + 'px'">
      <jiro-mark name="jiro" [size]="size()" [label]="variant() === 'mark' ? 'Jiro' : ''" />
      @if (variant() === 'full') {
        <span class="wordmark">Jiro</span>
      }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; }
    .logo {
      display: inline-flex;
      align-items: center;
      gap: calc(var(--logo-size) * 0.32);
      line-height: 1;
    }
    .wordmark {
      font-family: var(--font-family-display);
      font-weight: 600;
      font-size: calc(var(--logo-size) * 0.8);
      letter-spacing: -0.01em;
      color: currentColor;
    }
  `],
})
export class JiroLogoComponent {
  variant = input<'full' | 'mark'>('full');
  /** Mark size in px; the wordmark scales with it. */
  size = input<number>(28);
}
