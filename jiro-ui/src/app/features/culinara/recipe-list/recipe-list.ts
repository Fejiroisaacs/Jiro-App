import { Component, Injector, OnInit, afterNextRender, computed, effect, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

import { FormsModule } from '@angular/forms';
import { RecipeService, Recipe, CookStreak, Collection } from '../../../core/services/recipe.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { RecipeFormComponent } from '../recipe-form/recipe-form';

type SortKey = 'newest' | 'trials' | 'rating' | 'az';

@Component({
  selector: 'app-recipe-list',
  standalone: true,
  imports: [
    FormsModule,
    JiroCardComponent,
    JiroButtonComponent,
    JiroModalComponent,
    JiroIconComponent,
    JiroPageHeaderComponent,
    JiroEmptyStateComponent,
    RecipeFormComponent
],
  template: `
    <div class="recipe-list">
      <!-- Header -->
      <jiro-page-header heading="Culinara" subtitle="Your recipe notebook">
        <div actions class="header-right">
          @if (cookStreak()?.current_streak) {
<div class="streak-badge">
            <span class="streak-flame">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
            </span>
            <div class="streak-info">
              <span class="streak-num">{{ cookStreak()!.current_streak }}</span>
              <span class="streak-label">day streak</span>
            </div>
            @if (cookStreak()!.total_cook_days) {
<div class="streak-stat">
              <span class="streak-total">{{ cookStreak()!.total_cook_days }}</span> days cooked
            </div>
}
          </div>
}
          <div class="header-actions">
            <jiro-button type="button" (click)="showCreate.set(true)">
              <jiro-icon name="plus" [size]="14" />
              New recipe
            </jiro-button>
          </div>
        </div>
      </jiro-page-header>

      <!-- Search + Sort -->
      <div class="controls-row">
        <input
          class="search-input"
          type="text"
          placeholder="Search recipes..."
          [(ngModel)]="searchQuery"
          (input)="onSearch()" />
        <div class="sort-pills">
          @for (s of sortOptions; track s) {
<button
           
            class="sort-pill"
            [class.sort-pill--active]="sortKey() === s.key"
            (click)="sortKey.set(s.key)">
            {{ s.label }}
          </button>
}
        </div>
      </div>

      <!-- Tag filter chips -->
      @if (availableTags().length > 0) {
<div class="tag-filter">
        <button
          class="tag-chip"
          [class.tag-chip--active]="activeTag() === null"
          (click)="activeTag.set(null)">
          All
        </button>
        @for (tag of availableTags(); track tag) {
<button
         
          class="tag-chip"
          [class.tag-chip--active]="activeTag() === tag"
          (click)="activeTag.set(activeTag() === tag ? null : tag)">
          {{ tag }}
        </button>
}
      </div>
}

      <!-- Collection filter. Shown with no collections too, so the first one
           can be made here and not only from the New Recipe form. -->
      @if (collectionsLoaded()) {
        <div class="collection-filter" role="group" aria-label="Collections">
          @if (collections().length > 0) {
            <button type="button"
              class="collection-chip"
              [class.collection-chip--active]="activeCollection() === null"
              [attr.aria-pressed]="activeCollection() === null"
              (click)="activeCollection.set(null)">
              All
            </button>
          }
          @for (col of collections(); track col.id) {
            <button type="button"
              class="collection-chip"
              [class.collection-chip--active]="activeCollection() === col.id"
              [attr.aria-pressed]="activeCollection() === col.id"
              (click)="activeCollection.set(activeCollection() === col.id ? null : col.id)">
              <svg class="folder-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg> {{ col.name }}
              @if (col.recipe_count) {
                <span class="col-count" [attr.aria-label]="col.recipe_count + (col.recipe_count === 1 ? ' recipe' : ' recipes')">{{ col.recipe_count }}</span>
              }
            </button>
          }
          @if (!showNewCollectionInput) {
            @if (collections().length === 0) {
              <button type="button" class="collection-chip collection-chip--new" (click)="openNewCollection()">
                <span aria-hidden="true">+</span> New collection
              </button>
            } @else {
              <button type="button" class="collection-chip collection-chip--add" (click)="openNewCollection()"
                aria-label="New collection" title="New collection">+</button>
            }
          } @else {
            <form class="new-collection-inline" (ngSubmit)="createCollection()">
              <input
                id="new-collection-name"
                name="collectionName"
                class="new-collection-input"
                aria-label="Collection name"
                maxlength="100"
                autocomplete="off"
                [(ngModel)]="newCollectionName"
                placeholder="Collection name"
                (keydown.escape)="cancelNewCollection()" />
              <button type="submit" class="new-collection-save" aria-label="Create collection" title="Create collection">✓</button>
            </form>
          }
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Empty state -->
      @if (!loading() && allRecipes().length === 0) {
        <jiro-empty-state
          icon="fork-knife"
          heading="No recipes yet"
          message="Add your first recipe and start keeping notes on how each cook went.">
          <jiro-button type="button" (click)="showCreate.set(true)">Add your first recipe</jiro-button>
        </jiro-empty-state>
      }

      <!-- No results for current filter -->
      @if (!loading() && allRecipes().length > 0 && displayedRecipes().length === 0) {
        <jiro-empty-state
          icon="magnifying-glass"
          heading="No recipes match"
          message="Try another search term, tag or collection." />
      }

      <!-- Recipe grid -->
      @if (!loading() && displayedRecipes().length > 0) {
<div class="recipe-grid">
        @for (recipe of displayedRecipes(); track recipe) {
<jiro-card
          [link]="['/culinara', recipe.id]"
          class="recipe-card">
          <div class="recipe-card-inner">
            @if (recipe.cover_image_url) {
<div class="recipe-cover">
              <img [src]="recipe.cover_image_url" [alt]="recipe.title" class="cover-thumb">
            </div>
}
            @if (recipe.latest_rating != null || recipe.trial_count != null) {
<div class="recipe-meta">
              @if (recipe.latest_rating != null) {
<span class="rating">
                <span class="star" aria-hidden="true">★</span>
                <span class="sr-only">Rated </span><span>{{ recipe.latest_rating }}</span><span class="sr-only"> out of 5.</span>
              </span>
}
              @if (recipe.trial_count != null) {
<span class="trial-count">{{ recipe.trial_count }} {{ recipe.trial_count === 1 ? 'trial' : 'trials' }}</span>
}
            </div>
}
            <h2 class="recipe-title">{{ recipe.title }}</h2>
            @if (recipe.description) {
<p class="recipe-desc text-secondary">
              {{ recipe.description }}
            </p>
}
            @if (recipe.tags && recipe.tags.length) {
<div class="tag-chips-row">
              @for (tag of recipe.tags; track tag) {
<span class="recipe-tag">{{ tag }}</span>
}
            </div>
}
            <div class="card-footer">
              @if (ingredientLine(recipe); as line) {
<p class="ingredient-line" [title]="line">{{ line }}</p>
}
              @if (recipe.last_cooked) {
<span class="last-cooked">
                Last made {{ formatRelative(recipe.last_cooked) }}
              </span>
}
            </div>
          </div>
        </jiro-card>
}
      </div>
}

      <!-- Create recipe modal -->
      @if (showCreate()) {
<jiro-modal
       
        title="New recipe"
        maxWidth="600px"
        (close)="showCreate.set(false)">
        <app-recipe-form
          (saved)="onRecipeSaved($event)"
          (cancelled)="showCreate.set(false)">
        </app-recipe-form>
      </jiro-modal>
}
    </div>
  `,
  styles: [`
    .recipe-list {
      max-width: 1100px;
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

    /* On desktop the wrapper is invisible — children flow inline with the button */
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
      transition: border-color 0.2s;
    }

    .search-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15);
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
      color: var(--text-on-primary);
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
      background: rgba(var(--color-primary-rgb), 0.12);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }


    .recipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-lg);
    }

    .recipe-card {
      text-decoration: none;
      min-width: 0;
    }

    .recipe-card-inner {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .recipe-cover {
      margin: calc(-1 * var(--space-md)) calc(-1 * var(--space-md)) 0;
      border-radius: var(--border-radius) var(--border-radius) 0 0;
      overflow: hidden;
      height: 160px;
    }

    .cover-thumb {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .recipe-meta {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    /* Plain meta text beside the rating; pills are reserved for tags. */
    .trial-count {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
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
      color: var(--color-warning);
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
      background: rgba(var(--color-primary-rgb), 0.08);
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

    /* One muted line, truncated with an ellipsis rather than wrapping. */
    .ingredient-line {
      margin: 0;
      min-width: 0;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .last-cooked {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .header-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: var(--space-sm);
    }

    .streak-badge {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: 6px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
    }

    .streak-flame {
      display: flex;
      align-items: center;
      color: var(--color-primary);
    }

    .streak-info {
      display: flex;
      align-items: baseline;
      gap: 4px;
    }

    .streak-num {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--text-primary);
    }

    .streak-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
    }

    .streak-stat {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      border-left: 1px solid var(--border-color);
      padding-left: var(--space-sm);
    }

    .streak-total {
      font-weight: 600;
      color: var(--text-secondary);
    }

    .collection-filter {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
      margin-bottom: var(--space-md);
    }

    .collection-chip {
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
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .collection-chip:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .collection-chip--active {
      background: rgba(var(--color-primary-rgb), 0.12);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .collection-chip--add {
      font-size: var(--font-size-md);
      padding: 2px 10px;
      min-width: 32px;
      justify-content: center;
    }

    .collection-chip--new {
      border-style: dashed;
    }

    .col-count {
      background: var(--color-secondary);
      border-radius: 50%;
      width: 16px;
      height: 16px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 10px;
      color: var(--text-muted);
    }

    .new-collection-inline {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .new-collection-input {
      padding: 4px 10px;
      border: 1px solid var(--color-primary);
      border-radius: 20px;
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-xs);
      width: 140px;
      font-family: inherit;
    }

    .new-collection-save {
      background: var(--color-primary);
      color: var(--text-on-primary);
      border: none;
      border-radius: 50%;
      width: 28px;
      height: 28px;
      font-size: 13px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    @media (max-width: 600px) {
      .page-header {
        flex-direction: column;
        align-items: stretch;
      }

      .header-right {
        align-items: stretch;
      }

      .streak-badge {
        justify-content: center;
      }

      /* Stack: full-width primary button on top, secondary links row below */
      .header-actions {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-sm);
      }

      .header-actions { --jiro-btn-width: 100%; }

    }
  `]
})
export class RecipeListComponent implements OnInit {
  allRecipes = signal<Recipe[]>([]);
  cookStreak = signal<CookStreak | null>(null);
  collections = signal<Collection[]>([]);
  collectionsLoaded = signal(false);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  activeCollection = signal<string | null>(null);
  loading = signal(true);
  showCreate = signal(false);
  sortKey = signal<SortKey>('newest');
  activeTag = signal<string | null>(null);
  searchQuery = '';
  showNewCollectionInput = false;
  newCollectionName = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private collectionRecipeIds = signal<Set<string>>(new Set());

  sortOptions: { key: SortKey; label: string }[] = [
    { key: 'newest', label: 'Newest' },
    { key: 'trials', label: 'Most Trials' },
    { key: 'rating', label: 'Highest Rated' },
    { key: 'az', label: 'A-Z' },
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

    // Collection filter
    const colIds = this.collectionRecipeIds();
    if (this.activeCollection() && colIds.size > 0) {
      list = list.filter(r => colIds.has(r.id));
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

  constructor(private recipeService: RecipeService) {
    effect(() => {
      this.onCollectionChange();
    });
  }

  ngOnInit() {
    this.loadRecipes();
    this.recipeService.getCookStreak().subscribe({
      next: (s) => this.cookStreak.set(s),
    });
    this.loadCollections();
  }

  loadCollections() {
    this.recipeService.listCollections().subscribe({
      next: (cols) => {
        this.collections.set(cols);
        this.collectionsLoaded.set(true);
      },
    });
  }

  openNewCollection() {
    this.showNewCollectionInput = true;
    // The input only exists after this change is rendered.
    afterNextRender(() => document.getElementById('new-collection-name')?.focus(), { injector: this.injector });
  }

  cancelNewCollection() {
    this.showNewCollectionInput = false;
    this.newCollectionName = '';
  }

  createCollection() {
    const name = this.newCollectionName.trim();
    if (!name) return;
    this.recipeService.createCollection(name).subscribe({
      next: () => {
        this.cancelNewCollection();
        this.loadCollections();
        this.toast.success(`Collection "${name}" created`);
      },
      error: () => this.toast.error('Could not create the collection'),
    });
  }

  onCollectionChange() {
    const colId = this.activeCollection();
    if (!colId) {
      this.collectionRecipeIds.set(new Set());
      return;
    }
    this.recipeService.getCollectionRecipeIds(colId).subscribe({
      next: (ids) => this.collectionRecipeIds.set(new Set(ids)),
    });
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

  /**
   * Card ingredient summary: the first three names, comma-separated, with the
   * rest as a "+N" suffix. Reads `item` (the API contract) and skips entries
   * without one, so old seeded rows shaped `{ name }` cannot crash the card.
   */
  ingredientLine(recipe: Recipe): string {
    const names = (recipe.base_ingredients ?? [])
      .map(ing => (typeof ing?.item === 'string' ? ing.item.trim() : ''))
      .filter(name => name.length > 0);
    if (names.length === 0) return '';
    const shown = names.slice(0, 3).join(', ');
    const extra = names.length - 3;
    return extra > 0 ? `${shown} +${extra}` : shown;
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
