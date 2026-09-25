import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { GroceryItem, GroceryList, GroceryService } from '../../../core/services/grocery.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';

interface GroceryGroup {
  key: string;
  title: string;
  items: GroceryItem[];
}

/** Heading for items typed in by hand. */
const MANUAL_GROUP = 'Added by hand';

/**
 * The grocery list, saved to the account. Items are grouped under the
 * recipe they came from, in the order they were added.
 */
@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroButtonComponent, JiroPageHeaderComponent],
  template: `
    <div class="shopping-list">
      <jiro-page-header
        heading="Grocery list"
        [subtitle]="loaded() ? uncheckedCount() + (uncheckedCount() === 1 ? ' item remaining' : ' items remaining') : ''">
        <div actions class="header-actions">
          @if (checkedCount() > 0) {
            <button class="action-btn" type="button" (click)="clearChecked()">
              Clear checked ({{ checkedCount() }})
            </button>
          }
          @if (items().length > 0) {
            <button class="action-btn action-btn--danger" type="button" (click)="clearAll()">
              Clear all
            </button>
          }
        </div>
      </jiro-page-header>

      <form class="add-form" (ngSubmit)="addManual()" aria-label="Add an item to the grocery list">
        <label class="sr-only" for="grocery-new-item">Item</label>
        <input id="grocery-new-item" class="add-input" name="item" type="text" maxlength="200"
          placeholder="Add an item" autocomplete="off"
          [(ngModel)]="newItem" />
        <label class="sr-only" for="grocery-new-amount">Amount (optional)</label>
        <input id="grocery-new-amount" class="add-input add-input--amount" name="amount" type="text" maxlength="100"
          placeholder="Amount" autocomplete="off"
          [(ngModel)]="newAmount" />
        <jiro-button type="submit" variant="secondary" [disabled]="!newItem.trim()" [loading]="adding()">Add</jiro-button>
      </form>

      @if (!loaded()) {
        <div class="state-loading" aria-busy="true"><div class="spinner"></div></div>
      } @else if (items().length === 0) {
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
          </div>
          <h2>Your grocery list is empty</h2>
          <p class="text-secondary">Open a recipe and select "Add to grocery list", add your planned week from the Meal Planner, or type an item above.</p>
          <a class="browse-link" routerLink="/culinara">Browse recipes</a>
        </div>
      }

      @for (group of groups(); track group.key) {
        <section class="recipe-group" [attr.aria-label]="group.title">
          <div class="group-header">
            <h2 class="group-title">{{ group.title }}</h2>
            @if (groupUnchecked(group) > 0) {
              <button class="add-all-btn" type="button" (click)="checkGroup(group)"
                [attr.aria-label]="'Check all items for ' + group.title">Check all</button>
            }
          </div>
          <ul class="group-items">
            @for (item of group.items; track item.id) {
              <li class="shop-item" [class.shop-item--checked]="item.checked">
                <label class="item-label">
                  <input type="checkbox" [checked]="item.checked" (change)="toggleItem(item)" />
                  <span class="item-name">{{ item.item }}</span>
                  <span class="item-amount">{{ item.amount }}</span>
                </label>
                <button class="remove-item" type="button" (click)="removeItem(item)" title="Remove"
                  [attr.aria-label]="'Remove ' + item.item + ' from the list'">×</button>
              </li>
            }
          </ul>
        </section>
      }
    </div>
  `,
  styles: [`
    .shopping-list {
      max-width: 640px;
    }

    .header-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      align-items: flex-end;
      flex-shrink: 0;
    }

    .action-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      cursor: pointer;
      padding: 6px 12px;
      min-height: 32px;
      font-family: inherit;
      white-space: nowrap;
      transition: color 0.15s, border-color 0.15s;
    }

    .action-btn:hover {
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    .action-btn--danger:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    .add-form {
      display: flex;
      gap: var(--space-sm);
      margin-bottom: var(--space-xl);
    }

    .add-input {
      flex: 1;
      min-width: 0;
      min-height: 40px;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-family: inherit;
      font-size: var(--font-size-sm);
    }
    .add-input--amount { flex: 0 0 110px; }
    .add-input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 1px; }

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding: var(--space-2xl);
      gap: var(--space-md);
    }

    .empty-icon {
      color: var(--text-muted);
    }

    .empty-state h2 {
      font-size: var(--font-size-lg);
      font-weight: 600;
    }

    .empty-state p { max-width: 44ch; }

    /* A link that looks like the primary button: it navigates, so it is an
       <a>, and there is only one element to focus. */
    .browse-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      margin-top: var(--space-xs);
      padding: 10px 20px;
      border-radius: var(--border-radius);
      background: var(--color-primary);
      color: var(--text-on-primary);
      font-weight: 600;
      font-size: var(--font-size-sm);
      text-decoration: none;
    }
    .browse-link:hover { background: var(--color-primary-hover); }

    .recipe-group {
      margin-bottom: var(--space-xl);
    }

    .group-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-sm);
      padding-bottom: var(--space-xs);
      border-bottom: 1px solid var(--border-color);
    }

    .group-title {
      margin: 0;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .add-all-btn {
      background: none;
      border: none;
      font-size: var(--font-size-xs);
      color: var(--color-primary);
      cursor: pointer;
      font-weight: 500;
      font-family: inherit;
      min-height: 32px;
      padding: 0 4px;
    }

    .add-all-btn:hover {
      text-decoration: underline;
    }

    .group-items {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .shop-item {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding-right: 12px;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.15s;
    }

    .shop-item:last-child {
      border-bottom: none;
    }

    .shop-item:hover {
      background: var(--bg-surface);
    }

    .item-label {
      flex: 1;
      min-width: 0;
      display: grid;
      grid-template-columns: 22px 1fr auto;
      align-items: center;
      gap: var(--space-md);
      padding: 14px 0 14px 16px;
      cursor: pointer;
      user-select: none;
    }

    .item-label input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary);
      cursor: pointer;
    }

    .item-name {
      font-size: var(--font-size-md);
      color: var(--text-primary);
      overflow-wrap: anywhere;
      transition: opacity 0.2s, text-decoration 0.2s;
    }

    .item-amount {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .shop-item--checked .item-name {
      opacity: 0.55;
      text-decoration: line-through;
    }

    .shop-item--checked .item-amount {
      opacity: 0.55;
    }

    .remove-item {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: 18px;
      cursor: pointer;
      border-radius: 4px;
      transition: color 0.15s, background 0.15s;
    }

    .remove-item:hover {
      color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    }

    @media (max-width: 480px) {
      .add-input--amount { flex-basis: 84px; }
    }
  `]
})
export class ShoppingListComponent implements OnInit {
  private readonly grocery = inject(GroceryService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  items = signal<GroceryItem[]>([]);
  loaded = signal(false);
  adding = signal(false);
  newItem = '';
  newAmount = '';

  uncheckedCount = computed(() => this.items().filter(i => !i.checked).length);
  checkedCount = computed(() => this.items().filter(i => i.checked).length);

  /** Groups in the order their first item was added; typed items under their own heading. */
  groups = computed<GroceryGroup[]>(() => {
    const groups = new Map<string, GroceryGroup>();
    for (const item of this.items()) {
      const key = item.recipe_id ?? (item.recipe_title ? `title:${item.recipe_title}` : 'manual');
      let g = groups.get(key);
      if (!g) {
        g = { key, title: item.recipe_title || MANUAL_GROUP, items: [] };
        groups.set(key, g);
      }
      g.items.push(item);
    }
    return [...groups.values()];
  });

  ngOnInit() {
    this.grocery.list().subscribe({
      next: (res) => this.migrateLegacyOr(res.items),
      error: () => {
        this.loaded.set(true);
        this.toast.error('Could not load your grocery list');
      },
    });
  }

  /**
   * Once per browser: a list saved here before the list moved to the
   * account is uploaded when the account's list is empty, then removed from
   * the browser. When the account already has a list, that list wins and the
   * old browser copy is dropped. The look-only demo never touches it.
   */
  private migrateLegacyOr(serverItems: GroceryItem[]) {
    const legacy = this.auth.isDemo() ? null : this.grocery.readLegacyList();
    if (!legacy) {
      this.show(serverItems);
      return;
    }
    if (serverItems.length > 0) {
      this.grocery.clearLegacyList();
      this.show(serverItems);
      return;
    }
    this.grocery.importLegacy(legacy).subscribe({
      next: (res) => {
        this.grocery.clearLegacyList();
        this.show(res.items);
        if (res.added > 0) {
          this.toast.success(`Moved ${res.added} ${res.added === 1 ? 'item' : 'items'} from this browser to your account`);
        }
      },
      // Keep the browser copy to try again next visit.
      error: () => this.show(serverItems),
    });
  }

  private show(items: GroceryItem[]) {
    this.items.set(items);
    this.loaded.set(true);
  }

  private apply(res: GroceryList) {
    this.items.set(res.items);
  }

  groupUnchecked(group: GroceryGroup): number {
    return group.items.filter(i => !i.checked).length;
  }

  addManual() {
    const item = this.newItem.trim();
    if (!item || this.adding()) return;
    this.adding.set(true);
    this.grocery.addItem(item, this.newAmount.trim()).subscribe({
      next: (res) => {
        this.apply(res);
        this.adding.set(false);
        this.newItem = '';
        this.newAmount = '';
        if (res.added === 0) this.toast.show(`${item} is already on your list`, { kind: 'info' });
      },
      error: () => {
        this.adding.set(false);
        this.toast.error('Could not add the item');
      },
    });
  }

  toggleItem(item: GroceryItem) {
    const checked = !item.checked;
    this.patchLocal(i => i.id === item.id, checked);
    this.grocery.setChecked(item.id, checked).subscribe({
      error: () => {
        this.patchLocal(i => i.id === item.id, !checked);
        this.toast.error('Could not update the item');
      },
    });
  }

  checkGroup(group: GroceryGroup) {
    const ids = group.items.filter(i => !i.checked).map(i => i.id);
    if (ids.length === 0) return;
    const set = new Set(ids);
    this.patchLocal(i => set.has(i.id), true);
    this.grocery.setManyChecked(true, ids).subscribe({
      next: (res) => this.apply(res),
      error: () => {
        this.patchLocal(i => set.has(i.id), false);
        this.toast.error('Could not update the items');
      },
    });
  }

  removeItem(item: GroceryItem) {
    const before = this.items();
    this.items.set(before.filter(i => i.id !== item.id));
    this.grocery.remove(item.id).subscribe({
      error: () => {
        this.items.set(before);
        this.toast.error('Could not remove the item');
      },
    });
  }

  clearChecked() {
    this.grocery.clearChecked().subscribe({
      next: (res) => this.apply(res),
      error: () => this.toast.error('Could not clear the checked items'),
    });
  }

  async clearAll() {
    const ok = await this.confirmService.confirm({
      title: 'Clear the grocery list?',
      message: 'Every item will be removed, including ones you have not bought yet.',
      confirmLabel: 'Clear list',
    });
    if (!ok) return;
    this.grocery.clearAll().subscribe({
      next: (res) => this.apply(res),
      error: () => this.toast.error('Could not clear the list'),
    });
  }

  private patchLocal(match: (i: GroceryItem) => boolean, checked: boolean) {
    this.items.update(list => list.map(i => (match(i) ? { ...i, checked } : i)));
  }
}
