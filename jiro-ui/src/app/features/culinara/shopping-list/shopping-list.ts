import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

export interface ShopItem {
  id: string;
  recipeTitle: string;
  item: string;
  amount: string;
  checked: boolean;
}

const STORAGE_KEY = 'culinara_shopping_list';

@Component({
  selector: 'app-shopping-list',
  standalone: true,
  imports: [CommonModule, RouterLink, JiroButtonComponent],
  template: `
    <div class="shopping-list">
      <div class="page-header">
        <div>
          <a routerLink="/culinara" class="back-link">← Culinara</a>
          <h1>Grocery List</h1>
          <p class="text-secondary">{{ uncheckedCount() }} item{{ uncheckedCount() !== 1 ? 's' : '' }} remaining</p>
        </div>
        <div class="header-actions">
          <button class="action-btn" (click)="clearChecked()" *ngIf="checkedCount() > 0">
            Clear checked ({{ checkedCount() }})
          </button>
          <button class="action-btn action-btn--danger" (click)="clearAll()" *ngIf="items().length > 0">
            Clear all
          </button>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="items().length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>
        </div>
        <h3>Your grocery list is empty</h3>
        <p class="text-secondary">Open a recipe and tap "Add to grocery list" to start building your list.</p>
        <a routerLink="/culinara" style="margin-top: 8px;">
          <jiro-button variant="primary" type="button">Browse Recipes</jiro-button>
        </a>
      </div>

      <!-- Grouped by recipe -->
      <div *ngFor="let group of groupedItems()" class="recipe-group">
        <div class="group-header">
          <span class="group-title">{{ group.recipeTitle }}</span>
          <button class="add-all-btn" (click)="addGroupToCart(group.recipeTitle)">Check all</button>
        </div>
        <div class="group-items">
          <label
            *ngFor="let item of group.items"
            class="shop-item"
            [class.shop-item--checked]="item.checked">
            <input
              type="checkbox"
              [checked]="item.checked"
              (change)="toggleItem(item.id)" />
            <span class="item-name">{{ item.item }}</span>
            <span class="item-amount">{{ item.amount }}</span>
            <button class="remove-item" (click)="removeItem(item.id)" title="Remove">×</button>
          </label>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .shopping-list {
      max-width: 640px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-xl);
      gap: var(--space-md);
    }

    .back-link {
      display: inline-block;
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      text-decoration: none;
      margin-bottom: var(--space-sm);
      transition: color 0.15s;
    }

    .back-link:hover {
      color: var(--text-primary);
    }

    .page-header h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
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

    .empty-state h3 {
      font-size: var(--font-size-lg);
      font-weight: 600;
    }

    .empty-state ::ng-deep .jiro-btn {
      width: auto;
    }

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
    }

    .add-all-btn:hover {
      text-decoration: underline;
    }

    .group-items {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .shop-item {
      display: grid;
      grid-template-columns: 22px 1fr auto 28px;
      align-items: center;
      gap: var(--space-md);
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s;
      user-select: none;
    }

    .shop-item:last-child {
      border-bottom: none;
    }

    .shop-item:hover {
      background: var(--bg-surface);
    }

    .shop-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary);
      cursor: pointer;
      flex-shrink: 0;
    }

    .item-name {
      font-size: var(--font-size-md);
      color: var(--text-primary);
      transition: opacity 0.2s, text-decoration 0.2s;
    }

    .item-amount {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      white-space: nowrap;
    }

    .shop-item--checked .item-name {
      opacity: 0.45;
      text-decoration: line-through;
    }

    .shop-item--checked .item-amount {
      opacity: 0.45;
    }

    .remove-item {
      width: 24px;
      height: 24px;
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
      background: rgba(180, 60, 60, 0.08);
    }
  `]
})
export class ShoppingListComponent implements OnInit {
  items = signal<ShopItem[]>([]);

  uncheckedCount = computed(() => this.items().filter(i => !i.checked).length);
  checkedCount = computed(() => this.items().filter(i => i.checked).length);

  groupedItems = computed(() => {
    const groups = new Map<string, ShopItem[]>();
    for (const item of this.items()) {
      if (!groups.has(item.recipeTitle)) groups.set(item.recipeTitle, []);
      groups.get(item.recipeTitle)!.push(item);
    }
    return [...groups.entries()].map(([recipeTitle, items]) => ({ recipeTitle, items }));
  });

  ngOnInit() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.items.set(raw ? JSON.parse(raw) : []);
    } catch {
      this.items.set([]);
    }
  }

  private save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.items()));
  }

  toggleItem(id: string) {
    this.items.update(list =>
      list.map(i => i.id === id ? { ...i, checked: !i.checked } : i)
    );
    this.save();
  }

  removeItem(id: string) {
    this.items.update(list => list.filter(i => i.id !== id));
    this.save();
  }

  clearChecked() {
    this.items.update(list => list.filter(i => !i.checked));
    this.save();
  }

  clearAll() {
    if (!confirm('Clear the entire grocery list?')) return;
    this.items.set([]);
    this.save();
  }

  addGroupToCart(recipeTitle: string) {
    this.items.update(list =>
      list.map(i => i.recipeTitle === recipeTitle ? { ...i, checked: true } : i)
    );
    this.save();
  }

  /** Static helper — call from recipe-detail to add a recipe's ingredients */
  static addRecipe(recipeTitle: string, ingredients: { item: string; amount: string }[]) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const existing: ShopItem[] = raw ? JSON.parse(raw) : [];
      const newItems: ShopItem[] = ingredients.map(ing => ({
        id: crypto.randomUUID(),
        recipeTitle,
        item: ing.item,
        amount: ing.amount,
        checked: false,
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, ...newItems]));
    } catch {
      // ignore
    }
  }
}
