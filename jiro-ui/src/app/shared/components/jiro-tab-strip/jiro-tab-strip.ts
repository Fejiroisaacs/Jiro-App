import { Location } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

export interface TabOption<T extends string = string> {
  value: T;
  label: string;
}

/**
 * Segmented sub-tabs inside a module section (Exercises | PRs, ...).
 * Sticks under the shell chrome. State lives in the host; use the two
 * helpers below to mirror it into `?tab=` so links and reloads work.
 */
@Component({
  selector: 'jiro-tab-strip',
  standalone: true,
  template: `
    <div class="tab-strip" role="tablist" [attr.aria-label]="label()">
      @for (t of tabs(); track t.value) {
        <button
          type="button"
          role="tab"
          class="tab-btn"
          [class.active]="value() === t.value"
          [attr.aria-selected]="value() === t.value"
          [attr.tabindex]="value() === t.value ? 0 : -1"
          (click)="valueChange.emit(t.value)"
          (keydown.arrowright)="step(1)"
          (keydown.arrowleft)="step(-1)">
          {{ t.label }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; margin: 12px 16px 0; }

    .tab-strip {
      display: inline-flex;
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: 10px;
      padding: 3px;
      position: sticky;
      top: calc(var(--topbar-height, 0px) + var(--module-nav-height, 0px) + 12px);
      z-index: var(--z-sticky);
      max-width: 480px;
      box-shadow: inset 0 1px 3px rgba(var(--shadow-rgb), 0.06);
    }

    .tab-btn {
      flex: 1;
      padding: 7px 18px;
      border: none;
      border-radius: 7px;
      background: none;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease;
      white-space: nowrap;
      letter-spacing: 0.1px;
    }

    .tab-btn:hover:not(.active) {
      background: var(--bg-surface);
      color: var(--text-primary);
    }

    .tab-btn.active {
      background: var(--bg-surface);
      color: var(--color-primary);
      font-weight: 600;
      box-shadow: 0 1px 4px rgba(var(--shadow-rgb), 0.14), 0 0 0 1px rgba(var(--shadow-rgb), 0.06);
    }
  `]
})
export class JiroTabStripComponent {
  tabs = input.required<TabOption[]>();
  value = input.required<string>();
  label = input<string>('Sections');
  valueChange = output<string>();

  step(delta: number) {
    const list = this.tabs();
    const i = list.findIndex(t => t.value === this.value());
    const next = list[(i + delta + list.length) % list.length];
    this.valueChange.emit(next.value);
  }
}

/** Initial tab from `?tab=`, validated against the allowed values. */
export function tabFromRoute<T extends string>(route: ActivatedRoute, allowed: readonly T[], fallback: T): T {
  const q = route.snapshot.queryParamMap.get('tab');
  return (allowed as readonly string[]).includes(q ?? '') ? (q as T) : fallback;
}

/**
 * Mirror the tab into the URL without a navigation. `router.navigate` would
 * trigger scrollPositionRestoration and jump the page to the top.
 */
export function writeTabToUrl(router: Router, location: Location, route: ActivatedRoute, tab: string) {
  const tree = router.createUrlTree([], { relativeTo: route, queryParams: { tab }, queryParamsHandling: 'merge' });
  location.replaceState(router.serializeUrl(tree));
}
