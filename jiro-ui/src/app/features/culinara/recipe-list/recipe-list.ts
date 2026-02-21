import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RecipeService, Recipe } from '../../../core/services/recipe.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { RecipeFormComponent } from '../recipe-form/recipe-form';

type SortKey = 'newest' | 'trials' | 'rating' | 'az';

@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    JiroCardComponent,
    JiroButtonComponent,
    JiroModalComponent,
    RecipeFormComponent,
  ],
  template: `
    <div class="recipe-list">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Culinara</h1>
          <p class="text-secondary">Your recipe lab notebook</p>
        </div>
        <div class="header-actions">
          <a routerLink="/culinara/shopping" class="shopping-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Grocery List
          </a>
          <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">
            + New Recipe
          </jiro-button>
        </div>
      </div>

      <!-- Search + Sort -->
      <div class="controls-row">
        <input
          class="search-input"
          type="text"
          placeholder="Search recipes..."
          [(ngModel)]="searchQuery"
          (input)="onSearch()" />
        <div class="sort-pills">
          <button
            *ngFor="let s of sortOptions"
            class="sort-pill"
            [class.sort-pill--active]="sortKey() === s.key"
            (click)="sortKey.set(s.key)">
            {{ s.label }}
          </button>
        </div>
      </div>

      <!-- Tag filter chips -->
      <div class="tag-filter" *ngIf="availableTags().length > 0">
        <button
          class="tag-chip"
          [class.tag-chip--active]="activeTag() === null"
          (click)="activeTag.set(null)">
          All
        </button>
        <button
          *ngFor="let tag of availableTags()"
          class="tag-chip"
          [class.tag-chip--active]="activeTag() === tag"
          (click)="activeTag.set(activeTag() === tag ? null : tag)">
          {{ tag }}
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading recipes...</p>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading() && allRecipes().length === 0" class="state-message">
        <h3>No recipes yet</h3>
        <p class="text-secondary">Start your culinary lab by adding your first recipe.</p>
        <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">
          Add First Recipe
        </jiro-button>
      </div>

      <!-- No results for current filter -->
      <div *ngIf="!loading() && allRecipes().length > 0 && displayedRecipes().length === 0" class="state-message">
        <p class="text-secondary">No recipes match your filters.</p>
      </div>

      <!-- Recipe grid -->
      <div *ngIf="!loading() && displayedRecipes().length > 0" class="recipe-grid">
        <jiro-card
          *ngFor="let recipe of displayedRecipes()"
          [clickable]="true"
          [routerLink]="['/culinara', recipe.id]"
          class="recipe-card">
          <div class="recipe-card-inner">
            <div class="recipe-meta">
              <span class="trial-count" *ngIf="recipe.trial_count != null">
                {{ recipe.trial_count }} {{ recipe.trial_count === 1 ? 'trial' : 'trials' }}
              </span>
              <div class="rating" *ngIf="recipe.latest_rating != null">
                <span class="star">★</span>
                <span>{{ recipe.latest_rating }}</span>
              </div>
            </div>
            <h3 class="recipe-title">{{ recipe.title }}</h3>
            <p class="recipe-desc text-secondary" *ngIf="recipe.description">
              {{ recipe.description }}
            </p>
            <div class="tag-chips-row" *ngIf="recipe.tags && recipe.tags.length">
              <span *ngFor="let tag of recipe.tags" class="recipe-tag">{{ tag }}</span>
            </div>
            <div class="card-footer">
              <div class="ingredient-chips" *ngIf="recipe.base_ingredients && recipe.base_ingredients.length">
                <span
                  *ngFor="let ing of recipe.base_ingredients.slice(0, 3)"
                  class="chip">
                  {{ ing.item }}
                </span>
                <span *ngIf="recipe.base_ingredients.length > 3" class="chip chip-more">
                  +{{ recipe.base_ingredients.length - 3 }}
                </span>
              </div>
              <span class="last-cooked" *ngIf="recipe.last_cooked">
                Last made {{ formatRelative(recipe.last_cooked) }}
              </span>
            </div>
          </div>
        </jiro-card>
      </div>

      <!-- Create recipe modal -->
      <jiro-modal
        *ngIf="showCreate()"
        title="New Recipe"
        maxWidth="600px"
        (close)="showCreate.set(false)">
        <app-recipe-form
          (saved)="onRecipeSaved($event)"
          (cancelled)="showCreate.set(false)">
        </app-recipe-form>
      </jiro-modal>
    </div>
  `,
  styles: [`
    .recipe-list {
      max-width: 1100px;
    }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-xl);
      gap: var(--space-md);
      flex-wrap: wrap;
    }

    .page-header h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .header-actions ::ng-deep .jiro-btn {
      width: auto;
    }

    .shopping-link {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      text-decoration: none;
      background: var(--bg-surface);
      transition: color 0.15s, border-color 0.15s;
      white-space: nowrap;
    }

    .shopping-link:hover {
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    .controls-row {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      margin-bottom: var(--space-md);
      flex-wrap: wrap;
    }

    .search-input {
      flex: 1;
      min-width: 180px;
      max-width: 360px;
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      outline: none;
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(122, 59, 46, 0.15);
    }

    .search-input::placeholder {
      color: var(--text-muted);
    }

    .sort-pills {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .sort-pill {
      padding: 6px 14px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
      white-space: nowrap;
    }

    .sort-pill:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .sort-pill--active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #fff;
    }

    .tag-filter {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
      margin-bottom: var(--space-lg);
    }

    .tag-chip {
      padding: 4px 12px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      cursor: pointer;
      transition: all 0.15s;
      font-family: inherit;
    }

    .tag-chip:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .tag-chip--active {
      background: rgba(122, 59, 46, 0.12);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .state-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl);
      gap: var(--space-md);
      text-align: center;
    }

    .state-message ::ng-deep .jiro-btn {
      width: auto;
    }

    .spinner-lg {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .recipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-lg);
    }

    .recipe-card {
      text-decoration: none;
    }

    .recipe-card-inner {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .recipe-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .trial-count {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      background: var(--color-secondary);
      padding: 2px 8px;
      border-radius: 12px;
    }

    .rating {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-weight: 500;
    }

    .star {
      color: #c49540;
      font-size: 14px;
    }

    .recipe-title {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
    }

    .recipe-desc {
      font-size: var(--font-size-sm);
      line-height: 1.5;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .tag-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .recipe-tag {
      font-size: var(--font-size-xs);
      padding: 2px 8px;
      background: rgba(122, 59, 46, 0.08);
      color: var(--color-primary);
      border-radius: 10px;
      font-weight: 500;
    }

    .card-footer {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      margin-top: var(--space-xs);
    }

    .ingredient-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
    }

    .chip {
      font-size: var(--font-size-xs);
      padding: 2px 8px;
      background: rgba(196, 149, 106, 0.15);
      color: var(--color-primary);
      border-radius: 10px;
    }

    .chip-more {
      background: var(--color-secondary);
      color: var(--text-muted);
    }

    .last-cooked {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class RecipeListComponent implements OnInit {
  allRecipes = signal<Recipe[]>([]);
  loading = signal(true);
  showCreate = signal(false);
  sortKey = signal<SortKey>('newest');
  activeTag = signal<string | null>(null);
  searchQuery = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  sortOptions: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'trials', label: 'Most Trials' },
    { key: 'rating', label: 'Highest Rated' },
    { key: 'az', label: 'A–Z' },
  ];

  availableTags = computed(() => {
    const tagSet = new Set<string>();
    for (const r of this.allRecipes()) {
      for (const t of r.tags ?? []) tagSet.add(t);
    }
    return [...tagSet].sort();
  });

  displayedRecipes = computed(() => {
    let list = [...this.allRecipes()];

    // Tag filter
    const tag = this.activeTag();
    if (tag) {
      list = list.filter(r => r.tags?.includes(tag));
    }

    // Sort
    switch (this.sortKey()) {
      case 'trials':
        list.sort((a, b) => (b.trial_count ?? 0) - (a.trial_count ?? 0));
        break;
      case 'rating':
        list.sort((a, b) => (b.latest_rating ?? 0) - (a.latest_rating ?? 0));
        break;
      case 'az':
        list.sort((a, b) => a.title.localeCompare(b.title));
        break;
      // 'newest' is already the server default (updated_at DESC)
    }

    return list;
  });

  constructor(private recipeService: RecipeService) { }

  ngOnInit() {
    this.loadRecipes();
  }

  loadRecipes(search?: string) {
    this.loading.set(true);
    this.recipeService.listRecipes(search).subscribe({
      next: (recipes) => {
        this.allRecipes.set(recipes);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.loadRecipes(this.searchQuery || undefined);
    }, 300);
  }

  onRecipeSaved(recipe: Recipe) {
    this.showCreate.set(false);
    this.allRecipes.update(list => [recipe, ...list]);
  }

  formatRelative(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'today';
    if (diffDays === 1) return 'yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
