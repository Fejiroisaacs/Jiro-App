import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS, IconName } from '../../icons/icons.generated';

/**
 * Inline Phosphor icon. Inherits `color`; sized by `size` (px).
 * Decorative by default (aria-hidden). Pass `label` when the icon is the
 * only content of a control and needs an accessible name.
 *
 *   <jiro-icon name="trash" />
 *   <jiro-icon name="star:fill" [size]="20" label="Favourite" />
 */
@Component({
  selector: 'jiro-icon',
  standalone: true,
  template: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="currentColor"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"
      [innerHTML]="markup()"></svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      line-height: 0;
      vertical-align: middle;
    }
    svg { display: block; }
  `],
})
export class JiroIconComponent {
  name = input.required<IconName>();
  size = input<number | string>(18);
  label = input<string>('');

  private readonly sanitizer = inject(DomSanitizer);

  readonly markup = computed<SafeHtml>(() =>
    this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name()] ?? ''),
  );
}
