import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RecipeService, Recipe } from '../../../core/services/recipe.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';

@Component({
  selector: 'app-discover',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, JiroCardComponent],
  template: `
    <div class="discover-page">
      <div class="page-header">
        <div>
          <a routerLink="/culinara" class="back-link">← Culinara</a>
          <h1>Discover</h1>
          <p class="text-secondary">Recipes shared publicly by the community</p>
        </div>
      </div>

      <div class="controls-row">
        <input
          class="search-input"
          type="text"
          placeholder="Search public recipes..."
          [(ngModel)]="searchQuery"
          (input)="onSearch()" />
      </div>

      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading...</p>
      </div>

      <div *ngIf="!loading() && recipes().length === 0" class="state-message">
        <p class="text-secondary">No public recipes found{{ searchQuery ? ' matching your search' : '' }}.</p>
      </div>

      <div *ngIf="!loading() && recipes().length > 0" class="recipe-grid">
        <jiro-card
          *ngFor="let recipe of recipes()"
          [clickable]="true"
          [routerLink]="['/culinara/discover', recipe.id]"
          class="recipe-card">
          <div class="recipe-card-inner">
            <div class="recipe-cover" *ngIf="recipe.cover_image_url">
              <img [src]="recipe.cover_image_url" [alt]="recipe.title" class="cover-thumb">
            </div>
            <h3 class="recipe-title">{{ recipe.title }}</h3>
            <p class="recipe-desc text-secondary" *ngIf="recipe.description">{{ recipe.description }}</p>
            <div class="tag-chips-row" *ngIf="recipe.tags && recipe.tags.length">
              <span *ngFor="let tag of recipe.tags" class="recipe-tag">{{ tag }}</span>
            </div>
          </div>
        </jiro-card>
      </div>

      <div *ngIf="recipes().length > 0" class="load-more-row">
        <button
          class="load-more-btn"
          *ngIf="recipes().length >= pageSize"
          [disabled]="loadingMore()"
          (click)="loadMore()">
          {{ loadingMore() ? 'Loading...' : 'Load more' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .discover-page { max-width: 1100px; }

    .back-link {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
      display: inline-block;
      margin-bottom: var(--space-xs);
    }
    .back-link:hover { color: var(--text-primary); text-decoration: none; }

    .page-header { margin-bottom: var(--space-xl); }
    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .controls-row { margin-bottom: var(--space-lg); }

    .search-input {
      width: 100%; max-width: 400px;
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      outline: none;
    }
    .search-input:focus { border-color: var(--color-primary); }
    .search-input::placeholder { color: var(--text-muted); }

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

    .recipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-lg);
    }

    .recipe-card { text-decoration: none; }

    .recipe-card-inner { display: flex; flex-direction: column; gap: var(--space-sm); }

    .recipe-cover {
      margin: calc(-1 * var(--space-md)) calc(-1 * var(--space-md)) 0;
      border-radius: var(--border-radius) var(--border-radius) 0 0;
      overflow: hidden; height: 160px;
    }
    .cover-thumb { width: 100%; height: 100%; object-fit: cover; display: block; }

    .recipe-title { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); }
    .recipe-desc {
      font-size: var(--font-size-sm); line-height: 1.5;
      display: -webkit-box; -webkit-line-clamp: 2;
      -webkit-box-orient: vertical; overflow: hidden;
    }

    .tag-chips-row { display: flex; flex-wrap: wrap; gap: 4px; }
    .recipe-tag {
      font-size: var(--font-size-xs); padding: 2px 8px;
      background: rgba(122, 59, 46, 0.08); color: var(--color-primary);
      border-radius: 10px; font-weight: 500;
    }

    .load-more-row { display: flex; justify-content: center; margin-top: var(--space-xl); }
    .load-more-btn {
      padding: 10px 28px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm);
      font-weight: 500; cursor: pointer; font-family: inherit;
      transition: border-color 0.15s;
    }
    .load-more-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }
    .load-more-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class DiscoverComponent implements OnInit {
  recipes = signal<Recipe[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  searchQuery = '';
  readonly pageSize = 20;
  private offset = 0;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private recipeService: RecipeService) {}

  ngOnInit() { this.load(); }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.offset = 0;
      this.recipes.set([]);
      this.load();
    }, 300);
  }

  loadMore() {
    this.offset += this.pageSize;
    this.loadingMore.set(true);
    this.recipeService.listPublicRecipes(this.searchQuery || undefined, this.pageSize, this.offset).subscribe({
      next: (more) => { this.recipes.update(r => [...r, ...more]); this.loadingMore.set(false); },
      error: () => this.loadingMore.set(false),
    });
  }

  private load() {
    this.loading.set(true);
    this.recipeService.listPublicRecipes(this.searchQuery || undefined, this.pageSize, this.offset).subscribe({
      next: (r) => { this.recipes.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
