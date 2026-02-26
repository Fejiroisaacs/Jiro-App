import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService, SharedRecipeResponse } from '../../../core/services/recipe.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-recipe-share',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="share-page">
      <header class="share-header">
        <div class="brand">
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="8" fill="#7A3B2E"/>
            <text x="16" y="22" text-anchor="middle" font-family="Georgia,serif" font-size="18" fill="#F5F0E8" font-weight="bold">J</text>
          </svg>
          <span class="brand-name">Jiro</span>
        </div>
        <a routerLink="/culinara" class="home-link">My Recipes</a>
      </header>

      <main class="share-main">
        <div *ngIf="loading()" class="state-box">
          <div class="spinner"></div>
          <p>Loading shared recipe…</p>
        </div>

        <div *ngIf="!loading() && error()" class="state-box error-box">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p class="error-msg">This link is invalid or has expired.</p>
          <a routerLink="/culinara" class="btn-primary">Browse your recipes</a>
        </div>

        <div *ngIf="!loading() && !error() && shared() as s" class="recipe-card">
          <div class="recipe-meta">
            <p class="shared-by">Shared by <strong>{{ s.shared_by }}</strong></p>
          </div>

          <h1 class="recipe-title">{{ s.recipe.title }}</h1>

          <p *ngIf="s.recipe.description" class="recipe-desc">{{ s.recipe.description }}</p>

          <div class="tag-row" *ngIf="s.recipe.tags.length">
            <span *ngFor="let tag of s.recipe.tags" class="tag">{{ tag }}</span>
          </div>

          <div class="info-chips" *ngIf="s.recipe.dietary_flags">
            <span *ngIf="s.recipe.dietary_flags.vegan" class="chip">Vegan</span>
            <span *ngIf="s.recipe.dietary_flags.vegetarian" class="chip">Vegetarian</span>
            <span *ngIf="s.recipe.dietary_flags.gluten_free" class="chip">Gluten-free</span>
            <span *ngIf="s.recipe.dietary_flags.dairy_free" class="chip">Dairy-free</span>
          </div>

          <div *ngIf="s.recipe.base_ingredients.length" class="section">
            <h2 class="section-title">Ingredients</h2>
            <ul class="ingredient-list">
              <li *ngFor="let ing of s.recipe.base_ingredients" class="ingredient-item">
                <span class="ing-amount" *ngIf="ing.amount">{{ ing.amount }}</span>
                <span class="ing-item">{{ ing.item }}</span>
              </li>
            </ul>
          </div>

          <div *ngIf="s.recipe.instructions" class="section">
            <h2 class="section-title">Instructions</h2>
            <div class="instructions">{{ s.recipe.instructions }}</div>
          </div>

          <div class="import-bar">
            <p class="import-hint">Want to save this recipe to your collection?</p>
            <button class="btn-primary" (click)="importRecipe()" [disabled]="importing()">
              <span *ngIf="!importing()">Import Recipe</span>
              <span *ngIf="importing()" class="btn-spinner"></span>
            </button>
            <p *ngIf="importSuccess()" class="import-success">Imported! <a routerLink="/culinara">View your recipes →</a></p>
            <p *ngIf="importError()" class="import-error">{{ importError() }}</p>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; background: var(--bg-page, #F5F0E8); color: var(--text-primary, #2C1810); font-family: Inter, sans-serif; }

    .share-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: var(--bg-canvas, #fff);
      border-bottom: 1px solid var(--border-color, #e5e0d8);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .brand { display: flex; align-items: center; gap: 10px; }
    .brand-name { font-size: 1.2rem; font-weight: 700; color: var(--text-primary); }

    .home-link {
      font-size: 0.85rem;
      color: var(--color-primary, #7A3B2E);
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

    .spinner {
      width: 36px;
      height: 36px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary, #7A3B2E);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      margin: 0 auto 16px;
    }

    .error-box svg { margin: 0 auto 12px; display: block; opacity: 0.5; }
    .error-msg { margin: 0 0 20px; font-size: 1rem; }

    .recipe-card {
      background: var(--bg-canvas, #fff);
      border: 1px solid var(--border-color, #e5e0d8);
      border-radius: 12px;
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
      background: var(--bg-surface-hover, #f0ebe3);
      color: var(--text-secondary);
      font-size: 0.72rem;
      padding: 2px 9px;
      border-radius: 20px;
      font-weight: 500;
    }

    .info-chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
    .chip {
      background: var(--bg-surface, #faf7f3);
      border: 1px solid var(--border-color, #e5e0d8);
      border-radius: 6px;
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
      border-bottom: 1px solid var(--border-color, #e5e0d8);
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
      border-top: 1px solid var(--border-color, #e5e0d8);
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
      background: var(--color-primary, #7A3B2E);
      color: #fff;
      border: none;
      border-radius: 7px;
      font-size: 0.88rem;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      text-decoration: none;
      transition: opacity 0.15s;
      min-width: 130px;
      min-height: 36px;
    }

    .btn-primary:hover:not([disabled]) { opacity: 0.88; }
    .btn-primary[disabled] { opacity: 0.6; cursor: not-allowed; }

    .btn-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .import-success { margin: 0; font-size: 0.85rem; color: #2d8a4e; }
    .import-success a { color: inherit; font-weight: 600; }
    .import-error { margin: 0; font-size: 0.85rem; color: var(--color-danger, #c0392b); }

    @keyframes spin { to { transform: rotate(360deg); } }

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
