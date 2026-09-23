import { Component, Input, booleanAttribute } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * `[routerLink]` applied straight to `<jiro-card>` still fires on click — the
 * directive attaches to any host — but the host is a `<div>`, so the card was
 * never focusable and had no way to fire on Enter/Space. It also silently
 * broke ctrl/middle-click "open in new tab", since only a real `href` gets
 * that from the browser. `link` renders a native `<a>` instead, which gets
 * all of that for free.
 */
@Component({
  selector: 'jiro-card',
  standalone: true,
  imports: [RouterLink],
  host: { '[class.fill]': 'fill' },
  template: `
    <a class="jiro-card" [class.clickable]="clickable || !!link" [routerLink]="link ?? null">
      <ng-content></ng-content>
    </a>
  `,
  styles: [`
    /* fill: stretch to the parent's height (a grid row) and stack the content. */
    :host(.fill) { display: block; height: 100%; }
    :host(.fill) .jiro-card { display: flex; flex-direction: column; height: 100%; }

    .jiro-card {
      display: block;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg);
      box-shadow: var(--shadow-sm);
      color: inherit;
      text-decoration: none;
      transition: box-shadow 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .jiro-card.clickable {
      cursor: pointer;
    }

    .jiro-card.clickable:hover {
      box-shadow: var(--shadow-md);
      transform: translate(-2px, -2px);
    }

    a.jiro-card:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  `]
})
export class JiroCardComponent {
  @Input() clickable = false;
  @Input() link?: string | unknown[];
  @Input({ transform: booleanAttribute }) fill = false;
}
