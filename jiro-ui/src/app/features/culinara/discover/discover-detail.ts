import { Component, OnInit, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService, Recipe } from '../../../core/services/recipe.service';

@Component({
  selector: 'app-culinara-discover-detail',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="discover-detail">
      <!-- Loading -->
      @if (loading()) {
<div class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading recipe...</p>
      </div>
}

      <!-- Error -->
      @if (!loading() && !recipe()) {
<div class="state-message">
        <h3>Recipe not found</h3>
        <p class="text-secondary">This recipe may be private or no longer exists.</p>
        <a routerLink="/culinara/discover" class="back-link">← Back to Discover</a>
      </div>
}

      <!-- Content -->
      @if (!loading() && recipe(); as r) {
<div class="detail-root">

        <!-- Back nav + action -->
        <div class="top-bar">
          <a routerLink="/culinara/discover" class="back-link">← Discover</a>
          <button
            class="import-btn"
            [disabled]="importing()"
            (click)="importRecipe(r.id)">
            @if (!imported()) {
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7,10 12,15 17,10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
}
            @if (imported()) {
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20,6 9,17 4,12"/>
            </svg>
}
            {{ importing() ? 'Saving...' : imported() ? 'Saved!' : 'Save to My Library' }}
          </button>
        </div>

        <!-- Import success banner -->
        @if (imported()) {
<div class="import-banner">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>
          Recipe saved to your library.
          <button class="banner-link" (click)="router.navigate(['/culinara', importedId()])">Open it →</button>
        </div>
}

        <!-- Cover image -->
        @if (r.cover_image_url) {
<div class="cover-hero">
          <img [src]="r.cover_image_url" [alt]="r.title" class="cover-img">
        </div>
}

        <!-- Title -->
        <h1 class="recipe-title">{{ r.title }}</h1>

        <!-- Tags -->
        @if (r.tags && r.tags.length) {
<div class="tag-row">
          @for (tag of r.tags; track tag) {
<span class="recipe-tag">{{ tag }}</span>
}
        </div>
}

        <!-- Dietary flags -->
        @if (r.dietary_flags) {
<div class="dietary-row">
          @if (r.dietary_flags.vegan) {
<span class="dietary-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
            Vegan
          </span>
}
          @if (r.dietary_flags.vegetarian) {
<span class="dietary-pill">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5 8-6.5 8-12"/><path d="M6 20c-2-5-2.5-10 0-15 3 2 6 3 10 3"/></svg>
            Vegetarian
          </span>
}
          @if (r.dietary_flags.gluten_free) {
<span class="dietary-pill">Gluten-Free</span>
}
          @if (r.dietary_flags.dairy_free) {
<span class="dietary-pill">Dairy-Free</span>
}
          @if (r.dietary_flags.nut_free) {
<span class="dietary-pill">Nut-Free</span>
}
        </div>
}

        <!-- Nutrition macros -->
        @if (r.nutrition && (r.nutrition.calories || r.nutrition.protein || r.nutrition.carbs || r.nutrition.fat)) {
<div class="macro-bar">
          @if (r.nutrition.calories) {
<div class="macro-chip"><span class="macro-val">{{ r.nutrition.calories }}</span> cal</div>
}
          @if (r.nutrition.protein) {
<div class="macro-chip"><span class="macro-val">{{ r.nutrition.protein }}g</span> protein</div>
}
          @if (r.nutrition.carbs) {
<div class="macro-chip"><span class="macro-val">{{ r.nutrition.carbs }}g</span> carbs</div>
}
          @if (r.nutrition.fat) {
<div class="macro-chip"><span class="macro-val">{{ r.nutrition.fat }}g</span> fat</div>
}
        </div>
}

        <!-- Description -->
        @if (r.description) {
<p class="recipe-desc">{{ r.description }}</p>
}

        <!-- Ingredients -->
        @if (r.base_ingredients && r.base_ingredients.length) {
<div class="section">
          <h3 class="section-title">Ingredients</h3>
          <div class="ingredient-table">
            @for (ing of r.base_ingredients; track ing) {
<div class="ingredient-row">
              <span class="ing-item">{{ ing.item }}</span>
              <span class="ing-amount">{{ ing.amount }}</span>
            </div>
}
          </div>
        </div>
}

        <!-- Instructions -->
        @if (r.instructions) {
<div class="section">
          <h3 class="section-title">Instructions</h3>
          <div class="instructions-body">{{ r.instructions }}</div>
        </div>
}

      </div>
}
    </div>
  `,
  styles: [`
    .discover-detail { max-width: 720px; }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }
    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .top-bar {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: var(--space-md);
    }

    .back-link {
      font-size: var(--font-size-sm); color: var(--text-secondary);
      text-decoration: none;
    }
    .back-link:hover { color: var(--text-primary); text-decoration: none; }

    .import-btn {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 8px 16px; background: var(--color-primary); color: #fff;
      border: none; border-radius: var(--border-radius);
      font-size: var(--font-size-sm); font-weight: 600; font-family: inherit;
      cursor: pointer; transition: opacity 0.15s;
    }
    .import-btn:hover:not(:disabled) { opacity: 0.88; }
    .import-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .import-banner {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: 10px 14px; background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
      border-radius: var(--border-radius); margin-bottom: var(--space-lg);
      font-size: var(--font-size-sm); color: var(--text-primary);
    }
    .banner-link {
      background: none; border: none; cursor: pointer; font-family: inherit;
      font-size: var(--font-size-sm); color: var(--color-primary); font-weight: 600;
      padding: 0; margin-left: auto;
    }
    .banner-link:hover { text-decoration: underline; }

    .cover-hero {
      margin-bottom: var(--space-lg);
      border-radius: var(--border-radius-lg);
      overflow: hidden; height: 280px;
    }
    .cover-img { width: 100%; height: 100%; object-fit: cover; display: block; }

    .recipe-title {
      font-size: var(--font-size-2xl); font-weight: 700;
      color: var(--text-primary); margin-bottom: var(--space-sm);
    }

    .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-sm); }
    .recipe-tag {
      font-size: var(--font-size-xs); padding: 3px 10px;
      background: rgba(122, 59, 46, 0.08); color: var(--color-primary);
      border-radius: 10px; font-weight: 500;
    }

    .dietary-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--space-md); }
    .dietary-pill {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--font-size-xs); padding: 3px 10px;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 10px; color: var(--text-secondary); font-weight: 500;
    }

    .macro-bar {
      display: flex; flex-wrap: wrap; gap: var(--space-sm);
      padding: var(--space-md); background: var(--bg-surface);
      border-radius: var(--border-radius); border: 1px solid var(--border-color);
      margin-bottom: var(--space-md);
    }
    .macro-chip { font-size: var(--font-size-sm); color: var(--text-secondary); }
    .macro-val { font-weight: 600; color: var(--text-primary); }

    .recipe-desc {
      font-size: var(--font-size-md); color: var(--text-secondary);
      line-height: 1.65; margin-bottom: var(--space-lg);
    }

    .section { margin-bottom: var(--space-xl); }
    .section-title {
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-primary); margin-bottom: var(--space-md);
      padding-bottom: var(--space-xs); border-bottom: 1px solid var(--border-color);
    }

    .ingredient-table { display: flex; flex-direction: column; gap: 2px; }
    .ingredient-row {
      display: flex; justify-content: space-between; align-items: baseline;
      padding: 8px 0; border-bottom: 1px solid var(--border-color);
      font-size: var(--font-size-sm);
    }
    .ingredient-row:last-child { border-bottom: none; }
    .ing-item { color: var(--text-primary); }
    .ing-amount { color: var(--text-secondary); font-weight: 500; }

    .instructions-body {
      font-size: var(--font-size-md); color: var(--text-primary);
      line-height: 1.8; white-space: pre-wrap;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class CulinaraDiscoverDetailComponent implements OnInit {
  recipe = signal<Recipe | null>(null);
  loading = signal(true);
  importing = signal(false);
  imported = signal(false);
  importedId = signal<string | null>(null);

  constructor(
    private route: ActivatedRoute,
    readonly router: Router,
    private recipeService: RecipeService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.recipeService.getPublicRecipe(id).subscribe({
      next: (r) => { this.recipe.set(r); this.loading.set(false); },
      error: () => { this.recipe.set(null); this.loading.set(false); },
    });
  }

  importRecipe(id: string) {
    if (this.importing() || this.imported()) return;
    this.importing.set(true);
    this.recipeService.importPublicRecipe(id).subscribe({
      next: (r) => {
        this.importedId.set(r.id);
        this.imported.set(true);
        this.importing.set(false);
      },
      error: () => this.importing.set(false),
    });
  }
}
