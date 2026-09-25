import { Component, ViewEncapsulation, computed, inject, input, numberAttribute } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';

/**
 * A screenshot pair from the demo, shown for the app's current theme.
 * Resolves to `/images/guide/<guide>/<name>-light.webp` and `-dark.webp`.
 *
 *   <guide-shot guide="jym" name="session-player" [width]="1600" [height]="1000"
 *     alt="A workout in progress: three logged sets of bench press." />
 *
 * `width` and `height` are the webp's real pixel size (printed by
 * scripts/guide-shots/to-webp.py); they reserve the space so nothing jumps.
 * Shots are captured at 2x, so the image is never shown wider than half its
 * pixel width: a small dialog stays dialog-sized instead of being blown up.
 *
 * One <img> whose src follows the app's dark-mode setting, so only the
 * active theme's image is ever requested; switching theme swaps it. (Two
 * images with one hidden relied on the browser skipping a hidden lazy image,
 * which it did not reliably do on long pages.)
 */
@Component({
  selector: 'guide-shot',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <figure class="gd-shot">
      <img class="gd-shot-img" loading="lazy" decoding="async"
        [attr.width]="width()" [attr.height]="height()" [style.max-width.px]="width() / 2"
        [alt]="alt()" [src]="src()" />
      @if (caption()) {
        <figcaption class="gd-shot-caption">{{ caption() }}</figcaption>
      }
    </figure>
  `,
  styles: [`
    guide-shot { display: block; margin: 0 0 var(--space-lg); }

    .gd-shot { margin: 0; }
    .gd-shot-img {
      display: block;
      width: 100%;
      height: auto;
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-md);
    }
    .gd-shot-caption {
      margin-top: var(--space-sm);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      max-width: 72ch;
    }
  `],
})
export class GuideShotComponent {
  /** Folder under /images/guide/, e.g. "jym". */
  readonly guide = input.required<string>();
  /** Shot name from the guide's shot list, e.g. "session-player". */
  readonly name = input.required<string>();
  readonly alt = input.required<string>();
  readonly width = input.required({ transform: numberAttribute });
  readonly height = input.required({ transform: numberAttribute });
  readonly caption = input<string>('');

  private readonly settings = inject(SettingsService);

  /** The app's own dark-mode setting (the one behind html.dark), not the OS's. */
  readonly src = computed(() =>
    `/images/guide/${this.guide()}/${this.name()}-${this.settings.darkMode() ? 'dark' : 'light'}.webp`);
}
