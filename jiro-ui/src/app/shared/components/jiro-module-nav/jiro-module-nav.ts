import { Component, computed, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ModuleNav } from '../../../core/navigation';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';
import { JiroMarkComponent } from '../jiro-mark/jiro-mark';

/**
 * The module's section tabs. Rendered once by the shell (desktop) from
 * `core/navigation.ts`; on phones the bottom bar takes over and only tabs
 * that do not fit there (`mobile: false`) show here as chips.
 */
@Component({
  selector: 'jiro-module-nav',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, JiroIconComponent, JiroMarkComponent],
  template: `
    <nav class="mn" [attr.aria-label]="module().label + ' sections'">
      <div class="mn-row">
        @for (t of module().tabs; track t.route) {
          <a
            class="mn-tab"
            [routerLink]="t.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{ exact: !!t.exact }">
            @if (t.mark) {
              <jiro-mark [name]="t.mark" [size]="16" [tile]="false" />
            } @else if (t.icon) {
              <jiro-icon [name]="t.icon" [size]="16" />
            }
            <span>{{ t.label }}</span>
          </a>
        }
      </div>
      @if (overflow().length) {
        <div class="mn-overflow">
          @for (t of overflow(); track t.route) {
            <a class="mn-chip" [routerLink]="t.route" routerLinkActive="active">
              @if (t.icon) { <jiro-icon [name]="t.icon" [size]="14" /> }
              <span>{{ t.label }}</span>
            </a>
          }
        </div>
      }
    </nav>
  `,
  styles: [`
    :host { display: block; }

    .mn-row {
      display: flex;
      align-items: stretch;
      gap: 4px;
      height: var(--module-nav-height, 44px);
      padding: 0 var(--space-xl);
      background: var(--bg-page);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: var(--z-topbar);
      overflow-x: auto;
      scrollbar-width: none;
    }
    .mn-row::-webkit-scrollbar { display: none; }

    .mn-tab {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 0 12px;
      margin-bottom: -1px;
      border-bottom: 2px solid transparent;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      white-space: nowrap;
      text-decoration: none;
      transition: color 0.15s, border-color 0.15s;
    }
    .mn-tab jiro-mark { --mark-fg: currentColor; }
    .mn-tab:hover { color: var(--text-primary); text-decoration: none; }
    .mn-tab.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }
    .mn-tab:focus-visible { outline-offset: -2px; border-radius: var(--border-radius-sm); }

    .mn-overflow {
      display: none;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md) 0;
    }
    .mn-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-pill);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      text-decoration: none;
    }
    .mn-chip.active { color: var(--color-primary); border-color: var(--color-primary); }

    @media (max-width: 768px) {
      .mn-row { display: none; }
      .mn-overflow { display: flex; }
    }
  `]
})
export class JiroModuleNavComponent {
  module = input.required<ModuleNav>();
  readonly overflow = computed(() => this.module().tabs.filter(t => t.mobile === false));
}
