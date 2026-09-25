import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';

/** One line of the grocery list, saved to the account. */
export interface GroceryItem {
  id: string;
  item: string;
  amount: string;
  /** The recipe it came from; null when typed by hand or the recipe was deleted. */
  recipe_id: string | null;
  /** The recipe's title when the item was added, used as the group heading. */
  recipe_title: string | null;
  checked: boolean;
  position: number;
  created_at: string;
  updated_at: string;
}

/**
 * The whole list after a change, plus what the change did. Adding an item
 * that is already on the list from the same recipe (or typed by hand, for a
 * manual item) is skipped, not duplicated.
 */
export interface GroceryList {
  items: GroceryItem[];
  added: number;
  skipped: number;
}

/** The confirmation after adding a recipe or a week to the list. */
export function groceryAddedMessage(added: number, skipped: number): string {
  const n = (k: number) => `${k} ${k === 1 ? 'item' : 'items'}`;
  if (added === 0) return skipped > 0 ? 'Already on your grocery list' : 'Nothing to add to your grocery list';
  return skipped > 0
    ? `Added ${n(added)} to your grocery list, ${skipped} already there`
    : `Added ${n(added)} to your grocery list`;
}

/** The list's old browser-only storage, read once to move it to the account. */
const LEGACY_STORAGE_KEY = 'culinara_shopping_list';

interface LegacyItem {
  recipeTitle?: string;
  item?: string;
  amount?: string;
  checked?: boolean;
}

const API = `${environment.apiUrl}/culinara/grocery-list`;

@Injectable({ providedIn: 'root' })
export class GroceryService {
  private readonly http = inject(HttpClient);

  list(): Observable<GroceryList> {
    return this.http.get<GroceryList>(API);
  }

  addItem(item: string, amount = ''): Observable<GroceryList> {
    return this.http.post<GroceryList>(`${API}/items`, { item, amount });
  }

  addRecipe(recipeId: string): Observable<GroceryList> {
    return this.http.post<GroceryList>(`${API}/recipes/${recipeId}`, {});
  }

  addMealPlan(planId: string): Observable<GroceryList> {
    return this.http.post<GroceryList>(`${API}/meal-plan/${planId}`, {});
  }

  setChecked(id: string, checked: boolean): Observable<GroceryItem> {
    return this.http.patch<GroceryItem>(`${API}/items/${id}`, { checked });
  }

  /** Checks (or unchecks) the given items, or every item when `ids` is omitted. */
  setManyChecked(checked: boolean, ids?: string[]): Observable<GroceryList> {
    return this.http.post<GroceryList>(`${API}/check`, ids ? { ids, checked } : { checked });
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/items/${id}`);
  }

  clearChecked(): Observable<GroceryList> {
    return this.http.delete<GroceryList>(`${API}/checked`);
  }

  clearAll(): Observable<GroceryList> {
    return this.http.delete<GroceryList>(API);
  }

  /**
   * A list saved in this browser before the list moved to the account, or
   * null when there is none. Anything unreadable counts as none.
   */
  readLegacyList(): LegacyItem[] | null {
    try {
      const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }

  clearLegacyList() {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage blocked: nothing was read from it either.
    }
  }

  /**
   * Uploads the browser's old list. The server only takes it into an empty
   * list, so a second tab or device cannot import it twice.
   */
  importLegacy(items: LegacyItem[]): Observable<GroceryList> {
    const clean = items
      .filter(i => typeof i?.item === 'string' && i.item.trim() !== '')
      .slice(0, 500)
      .map(i => ({
        item: String(i.item).trim().slice(0, 200),
        amount: typeof i.amount === 'string' ? i.amount.trim().slice(0, 100) : '',
        recipe_title: typeof i.recipeTitle === 'string' ? i.recipeTitle.trim().slice(0, 255) : '',
        checked: i.checked === true,
      }));
    if (clean.length === 0) return of({ items: [], added: 0, skipped: 0 });
    return this.http.post<GroceryList>(`${API}/import`, { items: clean });
  }
}
