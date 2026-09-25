import { Component, ViewEncapsulation, computed, input, numberAttribute } from '@angular/core';

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
 * Only the visible theme's image downloads: both are `loading="lazy"`, and
 * the browser does not fetch a lazy image that is `display: none`. The
 * `loading` attribute is static, so Angular sets it before binding `src`.
 * Same approach as the landing page.
 */
@Component({
  selector: 'guide-shot',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  template: `
    <figure class="gd-shot">
      <img class="gd-shot-img gd-shot-light" loading="lazy" decoding="async"
        [attr.width]="width()" [attr.height]="height()" [style.max-width.px]="width() / 2"
        [alt]="alt()" [src]="base() + '-light.webp'" />
      <img class="gd-shot-img gd-shot-dark" loading="lazy" decoding="async"
        [attr.width]="width()" [attr.height]="height()" [style.max-width.px]="width() / 2"
        [alt]="alt()" [src]="base() + '-dark.webp'" />
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
    /* Follow the app's own dark-mode class, not the OS setting. */
    .gd-shot-dark { display: none; }
    html.dark .gd-shot-light { display: none; }
    html.dark .gd-shot-dark { display: block; }

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

  readonly base = computed(() => `/images/guide/${this.guide()}/${this.name()}`);
}
