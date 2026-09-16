import { Component, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';
import { IconName } from '../../icons/icons.generated';

export interface JiroMenuItem {
  id: string;
  label: string;
  icon?: IconName;
  danger?: boolean;
}

let menuSeq = 0;

/**
 * Overflow ("more actions") menu for a list row or card. A dots trigger
 * opens a small `role="menu"`; `select` emits the chosen item's id.
 *
 *   <jiro-menu [label]="'More actions for ' + ex.name" [items]="rowActions" (select)="onRowAction(ex, $event)" />
 *
 * Keyboard: Enter/Space or Arrow keys open, arrows and Home/End move,
 * Escape closes and returns focus, Tab leaves. Clicks inside never reach
 * a surrounding link or card, so the row does not navigate.
 */
@Component({
  selector: 'jiro-menu',
  standalone: true,
  imports: [JiroIconComponent],
  template: `
    <div class="jm" [class.jm--up]="direction() === 'up'" (click)="$event.stopPropagation(); $event.preventDefault()">
      <button
        #trigger
        type="button"
        class="jm-trigger"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="menuId"
        [attr.aria-label]="label()"
        [title]="label()"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)">
        <jiro-icon name="dots-three" [size]="20" />
      </button>

      @if (open()) {
        <div class="jm-menu" role="menu" [id]="menuId" (keydown)="onMenuKeydown($event)">
          @for (item of items(); track item.id) {
            <button role="menuitem" type="button" class="jm-item" [class.jm-item--danger]="item.danger" (click)="choose(item)">
              @if (item.icon; as icon) {
                <jiro-icon [name]="icon" [size]="16" />
              }
              {{ item.label }}
            </button>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: inline-block; }
    .jm { position: relative; }

    .jm-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: var(--border-radius-sm);
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .jm-trigger:hover, .jm-trigger[aria-expanded="true"] {
      background: var(--bg-surface-hover);
      color: var(--text-primary);
    }

    .jm-menu {
      position: absolute;
      top: calc(100% + 4px);
      right: 0;
      z-index: var(--z-dropdown);
      min-width: 160px;
      padding: var(--space-xs);
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
    }
    .jm--up .jm-menu { top: auto; bottom: calc(100% + 4px); }

    .jm-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      min-height: 40px;
      padding: 8px 12px;
      border: none;
      border-radius: var(--border-radius-sm);
      background: none;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--font-size-sm);
      text-align: left;
      white-space: nowrap;
      cursor: pointer;
    }
    .jm-item:hover, .jm-item:focus-visible { background: var(--bg-surface-hover); outline-offset: -2px; }
    .jm-item--danger { color: var(--color-negative); }
  `]
})
export class JiroMenuComponent {
  items = input.required<JiroMenuItem[]>();
  /** Accessible name of the trigger, e.g. "More actions for Bench Press". */
  label = input<string>('More actions');
  direction = input<'down' | 'up'>('down');
  select = output<string>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly menuId = `jiro-menu-${++menuSeq}`;
  readonly open = signal(false);

  toggle() {
    this.open() ? this.close() : this.openMenu();
  }

  openMenu(focus: 'first' | 'last' = 'first') {
    this.open.set(true);
    // The menu renders on the next change detection; focus after it exists.
    setTimeout(() => {
      const items = this.menuItems();
      items[focus === 'first' ? 0 : items.length - 1]?.focus();
    }, 0);
  }

  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.trigger().nativeElement.focus();
  }

  choose(item: JiroMenuItem) {
    this.close(true);
    this.select.emit(item.id);
  }

  onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); this.openMenu('first'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); this.openMenu('last'); }
    else if (event.key === 'Escape' && this.open()) { event.preventDefault(); this.close(true); }
  }

  onMenuKeydown(event: KeyboardEvent) {
    const items = this.menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => { event.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    switch (event.key) {
      case 'ArrowDown': move(index + 1); break;
      case 'ArrowUp': move(index - 1); break;
      case 'Home': move(0); break;
      case 'End': move(items.length - 1); break;
      case 'Escape': event.preventDefault(); this.close(true); break;
      case 'Tab': this.close(); break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.open()) return;
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.close();
  }

  private menuItems(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"]'));
  }
}
