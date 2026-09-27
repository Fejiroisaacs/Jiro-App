import { Component, ViewEncapsulation, computed, inject, input, numberAttribute } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';

/** Theme-matched demo shot; one <img> so only the active theme loads. width/height are the webp's real pixels. */
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
