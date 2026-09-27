import { Component, OnInit, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService, SharedRecipeResponse } from '../../../core/services/recipe.service';
import { AuthService } from '../../../core/services/auth.service';
import { JiroLogoComponent } from '../../../shared/components/jiro-logo/jiro-logo';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';

@Component({
  selector: 'app-recipe-share',
  standalone: true,
  imports: [RouterLink, JiroLogoComponent, JiroIconComponent, JiroSkeletonComponent],
  template: `
    <div class="share-page">
      <header class="share-header">
        <a routerLink="/" class="brand" aria-label="Jiro home"><jiro-logo [size]="28" /></a>
        <a routerLink="/culinara" class="home-link">My recipes</a>
      </header>

      <main class="share-main">
        @if (loading()) {
<div class="recipe-card" role="status" aria-label="Loading shared recipe">
          <jiro-skeleton width="30%" height="12px" />
          <jiro-skeleton width="65%" height="32px" class="sk-gap" />
          <jiro-skeleton [lines]="2" class="sk-gap" />
          <jiro-skeleton width="40%" height="18px" class="sk-section" />
          <jiro-skeleton [lines]="5" class="sk-gap" />
        </div>
}

        @if (!loading() && error()) {
<div class="state-box error-box">
          <jiro-icon name="warning-circle" [size]="40" class="error-icon" />
          <h1 class="error-title">Recipe not found</h1>
          <p class="error-msg">This link is invalid or has expired.</p>
          <a routerLink="/culinara" class="btn-primary">Browse your recipes</a>
        </div>
}

        @if (!loading() && !error() && shared(); as s) {
<div class="recipe-card">
          <div class="recipe-meta">
            <p class="shared-by">Shared by <strong>{{ s.shared_by }}</strong></p>
          </div>

          <h1 class="recipe-title">{{ s.recipe.title }}</h1>

          @if (s.recipe.description) {
<p class="recipe-desc">{{ s.recipe.description }}</p>
}

          @if (s.recipe.tags.length) {
<div class="tag-row">
            @for (tag of s.recipe.tags; track tag) {
<span class="tag">{{ tag }}</span>
}
          </div>
}

          @if (s.recipe.dietary_flags) {
<div class="info-chips">
            @if (s.recipe.dietary_flags.vegan) {
<span class="chip">Vegan</span>
}
            @if (s.recipe.dietary_flags.vegetarian) {
<span class="chip">Vegetarian</span>
}
            @if (s.recipe.dietary_flags.gluten_free) {
<span class="chip">Gluten-free</span>
}
            @if (s.recipe.dietary_flags.dairy_free) {
<span class="chip">Dairy-free</span>
}
          </div>
}

          @if (s.recipe.base_ingredients.length) {
<div class="section">
            <h2 class="section-title">Ingredients</h2>
            <ul class="ingredient-list">
              @for (ing of s.recipe.base_ingredients; track ing) {
<li class="ingredient-item">
                @if (ing.amount) {
<span class="ing-amount">{{ ing.amount }}</span>
}
                <span class="ing-item">{{ ing.item }}</span>
              </li>
}
            </ul>
          </div>
}

          @if (s.recipe.instructions) {
<div class="section">
            <h2 class="section-title">Instructions</h2>
            <div class="instructions">{{ s.recipe.instructions }}</div>
          </div>
}

          <div class="import-bar">
            <p class="import-hint">Want to save this recipe to your collection?</p>
            <button class="btn-primary" (click)="importRecipe()" [disabled]="importing()">
              @if (!importing()) {
<span>Import recipe</span>
}
              @if (importing()) {
<span class="btn-spinner"></span>
}
            </button>
            @if (importSuccess()) {
<p class="import-success">Imported! <a routerLink="/culinara" class="icon-link">View your recipes <jiro-icon name="arrow-right" [size]="14" /></a></p>
}
            @if (importError()) {
<p class="import-error">{{ importError() }}</p>
}
          </div>
        </div>
}
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100dvh; background: var(--bg-page); color: var(--text-primary); }

    .share-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .brand { display: inline-flex; color: var(--text-primary); text-decoration: none; }

    .home-link {
      font-size: 0.85rem;
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 500;
    }

    .home-link:hover { text-decoration: underline; }

    .share-main {
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 16px 64px;
    }

    .state-box {
      text-align: center;
      padding: 80px 24px;
      color: var(--text-secondary);
    }

    .sk-gap { margin-top: 12px; }
    .sk-section { margin-top: 28px; }

    .error-icon { display: flex; margin: 0 auto 12px; color: var(--text-muted); }
    .error-title { font-size: 1.5rem; margin: 0 0 8px; color: var(--text-primary); }
    .error-msg { margin: 0 0 20px; font-size: 1rem; }

    .recipe-card {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: 32px;
    }

    .recipe-meta { margin-bottom: 6px; }
    .shared-by { font-size: 0.8rem; color: var(--text-muted); margin: 0; }
    .shared-by strong { color: var(--text-secondary); }

    .recipe-title {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 12px;
      line-height: 1.2;
    }

    .recipe-desc {
      color: var(--text-secondary);
      margin: 0 0 14px;
      line-height: 1.5;
    }

    .tag-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
    .tag {
      background: var(--bg-surface-hover);
      color: var(--text-secondary);
      font-size: 0.72rem;
      padding: 2px 9px;
      border-radius: var(--border-radius-pill);
      font-weight: 500;
    }

    .info-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .chip {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-pill);
      padding: 4px 10px;
      font-size: 0.78rem;
      color: var(--text-secondary);
    }

    .section { margin-bottom: 28px; }
    .section-title {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border-color);
    }

    .ingredient-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
    .ingredient-item { display: flex; gap: 6px; font-size: 0.9rem; align-items: baseline; }
    .ing-amount { color: var(--text-muted); font-size: 0.82rem; min-width: 80px; }
    .ing-item { font-weight: 500; }
    .ing-note { color: var(--text-muted); font-size: 0.82rem; font-style: italic; }

    .instructions {
      white-space: pre-wrap;
      font-size: 0.9rem;
      line-height: 1.7;
      color: var(--text-secondary);
    }

    .import-bar {
      margin-top: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
    }

    .import-hint { margin: 0; font-size: 0.88rem; color: var(--text-secondary); }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 20px;
      background: var(--color-primary);
      color: var(--text-on-primary);
      border: none;
      border-radius: var(--border-radius);
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
      min-width: 130px;
      min-height: 36px;
    }

    .btn-primary:hover:not([disabled]) { background: var(--color-primary-hover); }
    .btn-primary[disabled] { opacity: 0.6; cursor: not-allowed; }

    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid color-mix(in srgb, var(--text-on-primary) 40%, transparent);
      border-top-color: var(--text-on-primary);
      border-radius: 50%;
      animation: jiro-spin 0.7s linear infinite;
    }

    .import-success { margin: 0; font-size: 0.85rem; color: var(--color-positive); }
    .import-success a { color: inherit; font-weight: 600; }
    .icon-link { display: inline-flex; align-items: center; gap: 4px; }
    .import-error { margin: 0; font-size: 0.85rem; color: var(--color-negative); }

    @media (max-width: 600px) {
      .recipe-card { padding: 20px 16px; }
      .recipe-title { font-size: 1.35rem; }
    }
  `],
})
export class RecipeShareComponent implements OnInit {
  loading = signal(true);
  error = signal(false);
  shared = signal<SharedRecipeResponse | null>(null);
  importing = signal(false);
  importSuccess = signal(false);
  importError = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token')!;
    this.recipeService.getSharedRecipe(token).subscribe({
      next: (res) => {
        this.shared.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  importRecipe() {
    const token = this.route.snapshot.paramMap.get('token')!;
    if (!this.authService.isAuthenticated()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }
    this.importing.set(true);
    this.importError.set('');
    this.recipeService.importSharedRecipe(token).subscribe({
      next: () => {
        this.importing.set(false);
        this.importSuccess.set(true);
      },
      error: (err) => {
        this.importing.set(false);
        const msg = err?.error?.error || 'Failed to import recipe.';
        this.importError.set(msg);
      },
    });
  }
}
