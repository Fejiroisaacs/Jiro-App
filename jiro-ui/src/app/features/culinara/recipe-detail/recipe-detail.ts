import { Component, OnInit, computed, signal, HostListener, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShoppingListComponent } from '../shopping-list/shopping-list';
import {
  RecipeService,
  Recipe,
  RecipeWithTrials,
  RecipeTrial,
  Collection,
} from '../../../core/services/recipe.service';
import { UploadService } from '../../../core/services/upload.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { RecipeFormComponent } from '../recipe-form/recipe-form';
import { TrialModalComponent } from '../trial-modal/trial-modal';
import { PromoteDialogComponent } from '../promote-dialog/promote-dialog';

type MobileTab = 'recipe' | 'trials';

interface CookStep {
  text: string;
  done: boolean;
}

interface CookIngredient {
  item: string;
  amount: string;
  checked: boolean;
}

@Component({
  selector: 'app-recipe-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JiroButtonComponent,
    JiroModalComponent,
    RecipeFormComponent,
    TrialModalComponent,
    PromoteDialogComponent,
  ],
  template: `
    <div class="detail-wrapper">
      <!-- Loading -->
      <div *ngIf="loading()" class="state-center">
        <div class="spinner-lg"></div>
      </div>

      <!-- Error -->
      <div *ngIf="!loading() && !recipe()" class="state-center">
        <p class="text-secondary">Recipe not found.</p>
        <a routerLink="/culinara" class="back-link">← Back to Culinara</a>
      </div>

      <!-- Content -->
      <div *ngIf="recipe() as r" class="detail-root">
        <!-- Mobile tab bar -->
        <div class="mobile-tabs">
          <button
            class="mobile-tab"
            [class.mobile-tab--active]="mobileTab() === 'recipe'"
            (click)="mobileTab.set('recipe')">
            Recipe
          </button>
          <button
            class="mobile-tab"
            [class.mobile-tab--active]="mobileTab() === 'trials'"
            (click)="mobileTab.set('trials')">
            Trial Log
            <span class="tab-count" *ngIf="r.trials && r.trials.length">{{ r.trials.length }}</span>
          </button>
        </div>

        <div class="detail-layout">
          <!-- Left: Recipe base -->
          <div class="recipe-panel" [class.mobile-hidden]="mobileTab() !== 'recipe'">
            <!-- Back nav -->
            <a routerLink="/culinara" class="back-link">← Culinara</a>

            <!-- Cover photo -->
            <div class="cover-hero" *ngIf="r.cover_image_url">
              <img [src]="r.cover_image_url" [alt]="r.title" class="cover-hero-img">
              <div class="cover-hero-actions">
                <label class="cover-action-btn" title="Change cover photo">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onCoverFileChange($event)" style="display:none">
                </label>
                <button class="cover-action-btn cover-action-btn--danger" title="Remove cover photo" (click)="removeCoverImage()">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                </button>
              </div>
            </div>

            <!-- Add cover photo (no cover yet) -->
            <div class="cover-empty" *ngIf="!r.cover_image_url && !coverUploading()">
              <label class="cover-add-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                Add cover photo
                <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onCoverFileChange($event)" style="display:none">
              </label>
            </div>

            <!-- Cover upload progress -->
            <div class="cover-uploading" *ngIf="coverUploading()">
              <div class="cover-progress-bar">
                <div class="cover-progress-fill" [style.width.%]="coverProgress()"></div>
              </div>
              <span class="cover-progress-label">Uploading {{ coverProgress() }}%</span>
            </div>

            <p class="cover-error text-secondary" *ngIf="coverError()">{{ coverError() }}</p>

            <!-- Header -->
            <div class="panel-header">
              <h1 class="recipe-title">{{ r.title }}</h1>
              <div class="header-actions">
                <button class="icon-btn" title="Cook mode" (click)="enterCookMode()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 13.87A4 4 0 0 1 7.41 6a5.11 5.11 0 0 1 1.05-1.54 5 5 0 0 1 7.08 0A5.11 5.11 0 0 1 16.59 6 4 4 0 0 1 18 13.87V21H6Z"/>
                    <line x1="6" y1="17" x2="18" y2="17"/>
                  </svg>
                </button>
                <button class="icon-btn" title="Share recipe" (click)="shareRecipe()">
                  <svg *ngIf="!shareLoading()" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  <span *ngIf="shareLoading()" class="btn-spinner"></span>
                </button>
                <button class="icon-btn" title="Edit recipe" (click)="showEdit.set(true)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-btn danger" title="Delete recipe" (click)="confirmDelete()">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14H6L5 6"/>
                    <path d="M10 11v6M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- Share link banner -->
            <div class="share-banner" *ngIf="shareUrl()">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0">
                <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
              </svg>
              <div class="share-url-row">
                <input class="share-url-input" [value]="shareUrl()" readonly>
                <button class="share-copy-btn" (click)="copyShareUrl()">{{ shareCopied() ? 'Copied!' : 'Copy' }}</button>
              </div>
              <button class="share-close-btn" (click)="shareUrl.set('')">✕</button>
            </div>

            <!-- Public toggle -->
            <div class="public-toggle-row">
              <div class="public-toggle-info">
                <span class="public-toggle-label">Share publicly</span>
                <span class="public-toggle-sub">Visible to anyone in Discover</span>
              </div>
              <button
                class="toggle-switch"
                [class.toggle-switch--on]="isPublic()"
                [disabled]="publicToggling()"
                (click)="togglePublic()"
                [title]="isPublic() ? 'Make private' : 'Make public'">
                <span class="toggle-thumb"></span>
              </button>
            </div>

            <p *ngIf="r.description" class="recipe-desc">{{ r.description }}</p>

            <!-- Tags -->
            <div class="tag-row" *ngIf="r.tags && r.tags.length">
              <span *ngFor="let tag of r.tags" class="recipe-tag">{{ tag }}</span>
            </div>

            <!-- Dietary flags -->
            <div class="dietary-row" *ngIf="r.dietary_flags">
              <span class="dietary-pill" *ngIf="r.dietary_flags.vegan">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.9C15.5 4.9 17 3.5 19 1c1 2 2 4.5 2 8 0 5.5-4.5 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>
                Vegan
              </span>
              <span class="dietary-pill" *ngIf="r.dietary_flags.vegetarian">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5 8-6.5 8-12"/><path d="M6 20c-2-5-2.5-10 0-15 3 2 6 3 10 3"/></svg>
                Vegetarian
              </span>
              <span class="dietary-pill" *ngIf="r.dietary_flags.gluten_free">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><line x1="20" y1="2" x2="22" y2="4"/><path d="M17.47 8.53 19 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L19 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/></svg>
                Gluten-Free
              </span>
              <span class="dietary-pill" *ngIf="r.dietary_flags.dairy_free">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 2 1.88 1.88"/><path d="M14.12 3.88 16 2"/><path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1"/><path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 .67-2.22 2.75 2.75 0 0 1 4.78 0A4 4 0 0 1 12 11"/><path d="M12 20c3.3 0 6-2.7 6-6v-3a4 4 0 0 0-.67-2.22 2.75 2.75 0 0 0-4.78 0A4 4 0 0 0 12 11"/><path d="M2 2 22 22"/></svg>
                Dairy-Free
              </span>
              <span class="dietary-pill" *ngIf="r.dietary_flags.nut_free">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                Nut-Free
              </span>
            </div>

            <!-- Nutrition -->
            <div class="macro-bar" *ngIf="r.nutrition && (r.nutrition.calories || r.nutrition.protein || r.nutrition.carbs || r.nutrition.fat)">
              <div class="macro-chip" *ngIf="r.nutrition.calories"><span class="macro-val">{{ r.nutrition.calories }}</span> cal</div>
              <div class="macro-chip" *ngIf="r.nutrition.protein"><span class="macro-val">{{ r.nutrition.protein }}g</span> protein</div>
              <div class="macro-chip" *ngIf="r.nutrition.carbs"><span class="macro-val">{{ r.nutrition.carbs }}g</span> carbs</div>
              <div class="macro-chip" *ngIf="r.nutrition.fat"><span class="macro-val">{{ r.nutrition.fat }}g</span> fat</div>
            </div>

            <!-- Add to Collection -->
            <div class="collection-picker" *ngIf="collections().length > 0">
              <button class="collection-toggle" (click)="showCollectionPicker.set(!showCollectionPicker()); $event.stopPropagation()">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                {{ recipeCollectionIds().size > 0 ? recipeCollectionIds().size + ' collection' + (recipeCollectionIds().size > 1 ? 's' : '') : 'Add to collection' }}
              </button>
              <div class="collection-dropdown" *ngIf="showCollectionPicker()" (click)="$event.stopPropagation()">
                <button
                  *ngFor="let col of collections()"
                  class="collection-option"
                  [class.collection-option--active]="recipeCollectionIds().has(col.id)"
                  (click)="toggleCollection(col)">
                  <span class="col-check">{{ recipeCollectionIds().has(col.id) ? '✓' : '' }}</span>
                  {{ col.name }}
                </button>
              </div>
            </div>

            <!-- Stats row -->
            <div class="stats-row">
              <div class="stat" *ngIf="r.trials && r.trials.length > 0">
                <span class="stat-value">{{ r.trials.length }}</span>
                <span class="stat-label">{{ r.trials.length === 1 ? 'Trial' : 'Trials' }}</span>
              </div>
              <div class="stat" *ngIf="latestRating() != null">
                <span class="stat-value star-val">★ {{ latestRating() }}</span>
                <span class="stat-label">Latest</span>
              </div>
              <div class="stat" *ngIf="avgRating() != null">
                <span class="stat-value star-val">★ {{ avgRating() }}</span>
                <span class="stat-label">Average</span>
              </div>
            </div>

            <!-- Ingredients -->
            <div class="section" *ngIf="r.base_ingredients && r.base_ingredients.length">
              <div class="section-header">
                <h3 class="section-title">Base Ingredients</h3>
                <button class="add-grocery-btn" (click)="addToGrocery()" title="Add to grocery list">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                    <line x1="3" y1="6" x2="21" y2="6"/>
                    <path d="M16 10a4 4 0 0 1-8 0"/>
                  </svg>
                  Add to grocery list
                </button>
              </div>
              <div class="ingredient-table">
                <div *ngFor="let ing of r.base_ingredients" class="ingredient-row">
                  <span class="ing-item">{{ ing.item }}</span>
                  <span class="ing-amount">{{ ing.amount }}</span>
                </div>
              </div>
              <p *ngIf="groceryAdded()" class="grocery-confirm">✓ Added to grocery list</p>
            </div>

            <!-- Instructions -->
            <div class="section" *ngIf="r.instructions">
              <h3 class="section-title">Instructions</h3>
              <div class="instructions-text">{{ r.instructions }}</div>
            </div>
          </div>

          <!-- Right: Trials -->
          <div class="trials-panel" [class.mobile-hidden]="mobileTab() !== 'trials'">
            <div class="trials-header">
              <h2 class="trials-title">Trial Log</h2>
              <jiro-button variant="primary" type="button" (click)="openNewTrial()">
                + Log Trial
              </jiro-button>
            </div>

            <!-- Empty trials -->
            <div *ngIf="!r.trials || r.trials.length === 0" class="trials-empty">
              <p>No trials yet</p>
              <p class="text-secondary">Cook the recipe and log your first experiment.</p>
            </div>

            <!-- Trial cards -->
            <div *ngIf="r.trials && r.trials.length" class="trials-list">
              <div *ngFor="let trial of r.trials" class="trial-card">
                <!-- Trial header -->
                <div class="trial-header">
                  <div class="trial-meta">
                    <span class="trial-date">{{ formatDate(trial.date_cooked) }}</span>
                    <div class="trial-rating" *ngIf="trial.rating">
                      <span class="star">★</span> {{ trial.rating }}/5
                    </div>
                  </div>
                  <div class="trial-actions">
                    <button
                      class="text-btn"
                      title="Edit trial"
                      (click)="openEditTrial(trial)">
                      Edit
                    </button>
                    <button
                      class="text-btn"
                      title="Promote to base recipe"
                      (click)="openPromote(trial)">
                      Promote
                    </button>
                    <button
                      class="text-btn danger"
                      title="Delete trial"
                      (click)="deleteTrial(trial)">
                      Delete
                    </button>
                  </div>
                </div>

                <!-- Modifications -->
                <div class="trial-mods" *ngIf="trial.modifications && trial.modifications.length">
                  <p class="mods-label">Modifications</p>
                  <div *ngFor="let mod of trial.modifications" class="mod-row">
                    <span class="mod-item">{{ mod.item }}</span>
                    <span class="mod-sep">→</span>
                    <span class="mod-change">{{ mod.change }}</span>
                  </div>
                </div>

                <!-- Notes -->
                <p *ngIf="trial.notes" class="trial-notes">{{ trial.notes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit recipe modal -->
      <jiro-modal
        *ngIf="showEdit() && recipe()"
        title="Edit Recipe"
        maxWidth="600px"
        (close)="showEdit.set(false)">
        <app-recipe-form
          [recipe]="recipe()!"
          (saved)="onRecipeUpdated($event)"
          (cancelled)="showEdit.set(false)">
        </app-recipe-form>
      </jiro-modal>

      <!-- Log trial modal -->
      <jiro-modal
        *ngIf="showTrial() && recipe()"
        title="Log Trial"
        maxWidth="560px"
        (close)="showTrial.set(false)">
        <app-trial-modal
          [recipeId]="recipe()!.id"
          (saved)="onTrialSaved($event)"
          (cancelled)="showTrial.set(false)">
        </app-trial-modal>
      </jiro-modal>

      <!-- Edit trial modal -->
      <jiro-modal
        *ngIf="editingTrial()"
        title="Edit Trial"
        maxWidth="560px"
        (close)="editingTrial.set(null)">
        <app-trial-modal
          [trial]="editingTrial()!"
          (saved)="onTrialUpdated($event)"
          (cancelled)="editingTrial.set(null)">
        </app-trial-modal>
      </jiro-modal>

      <!-- Promote modal -->
      <jiro-modal
        *ngIf="promotingTrial() && recipe()"
        title="Promote Trial to Base"
        maxWidth="480px"
        (close)="promotingTrial.set(null)">
        <app-promote-dialog
          [trial]="promotingTrial()!"
          (promoted)="onPromoted($event)"
          (cancelled)="promotingTrial.set(null)">
        </app-promote-dialog>
      </jiro-modal>

      <!-- Cook mode overlay -->
      <div *ngIf="cookMode()" class="cook-overlay">
        <div class="cook-header">
          <h2 class="cook-title">{{ recipe()?.title }}</h2>
          <button class="cook-close" (click)="exitCookMode()" title="Exit without logging">
            ✕ Exit
          </button>
        </div>

        <div class="cook-body">
          <!-- Ingredients checklist -->
          <div class="cook-section" *ngIf="cookIngredients().length">
            <h3 class="cook-section-title">Ingredients</h3>
            <div class="cook-ingredients">
              <label
                *ngFor="let ing of cookIngredients(); let i = index"
                class="cook-ingredient"
                [class.cook-ingredient--checked]="ing.checked"
                (click)="toggleCookIngredient(i)">
                <input type="checkbox" [checked]="ing.checked" (click)="$event.stopPropagation()" (change)="toggleCookIngredient(i)" />
                <span class="ing-item">{{ ing.item }}</span>
                <span class="ing-amount">{{ ing.amount }}</span>
              </label>
            </div>
          </div>

          <!-- Steps -->
          <div class="cook-section" *ngIf="cookSteps().length">
            <h3 class="cook-section-title">Steps</h3>
            <div class="cook-steps">
              <div
                *ngFor="let step of cookSteps(); let i = index"
                class="cook-step"
                [class.cook-step--done]="step.done"
                (click)="toggleStep(i)">
                <div class="step-num">{{ i + 1 }}</div>
                <p class="step-text">{{ step.text }}</p>
                <div class="step-check">
                  <svg *ngIf="step.done" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div class="cook-empty" *ngIf="cookIngredients().length === 0 && cookSteps().length === 0">
            <p class="text-secondary">No ingredients or instructions added to this recipe yet.</p>
          </div>
        </div>

        <!-- Sticky finish footer -->
        <div class="cook-footer">
          <div class="cook-footer-inner">
            <div class="cook-footer-left">
              <span class="cook-footer-label">Rate this cook</span>
              <div class="cook-stars">
                <button
                  *ngFor="let s of [1,2,3,4,5]"
                  type="button"
                  class="cook-star"
                  [class.cook-star--filled]="s <= cookRating()"
                  (click)="cookRating.set(s === cookRating() ? 0 : s)">
                  ★
                </button>
              </div>
              <textarea
                class="cook-notes"
                placeholder="Notes (optional)..."
                rows="2"
                (input)="cookNotes = $any($event.target).value"
                [value]="cookNotes"></textarea>
            </div>
            <div class="cook-footer-actions">
              <button class="cook-log-btn" (click)="finishCooking()" [disabled]="cookSaving()">
                <span *ngIf="!cookSaving()">Log Trial</span>
                <span *ngIf="cookSaving()">Saving...</span>
              </button>
              <button class="cook-skip-btn" (click)="exitCookMode()">Skip</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-wrapper {
      height: 100%;
      position: relative;
    }

    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 300px;
      gap: var(--space-md);
    }

    .spinner-lg {
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* Mobile tabs — only visible on small screens */
    .mobile-tabs {
      display: none;
      gap: 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: var(--space-lg);
    }

    .mobile-tab {
      flex: 1;
      padding: 12px 16px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
      margin-bottom: -1px;
    }

    .mobile-tab--active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
    }

    .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      font-size: 10px;
      background: var(--color-secondary);
      border-radius: 50%;
      color: var(--text-secondary);
    }

    .detail-root {
      height: 100%;
    }

    .detail-layout {
      display: grid;
      grid-template-columns: 1fr 420px;
      gap: var(--space-xl);
      align-items: start;
    }

    /* Back link */
    .back-link {
      display: inline-block;
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      text-decoration: none;
      margin-bottom: var(--space-md);
      transition: color 0.15s;
    }

    .back-link:hover {
      color: var(--text-primary);
    }

    /* Cover photo */
    .cover-hero {
      position: relative;
      border-radius: var(--border-radius);
      overflow: hidden;
      height: 220px;
    }

    .cover-hero-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .cover-hero-actions {
      position: absolute;
      top: var(--space-sm);
      right: var(--space-sm);
      display: flex;
      gap: 6px;
    }

    .cover-action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.55);
      color: #fff;
      border: none;
      cursor: pointer;
      transition: background 0.15s;
    }

    .cover-action-btn:hover {
      background: rgba(0, 0, 0, 0.75);
    }

    .cover-action-btn--danger:hover {
      background: rgba(180, 40, 40, 0.85);
    }

    .cover-empty {
      display: flex;
    }

    .cover-add-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border: 1px dashed var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s;
    }

    .cover-add-btn:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .cover-uploading {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .cover-progress-bar {
      flex: 1;
      height: 4px;
      background: var(--border-color);
      border-radius: 2px;
      overflow: hidden;
    }

    .cover-progress-fill {
      height: 100%;
      background: var(--color-primary);
      transition: width 0.2s;
    }

    .cover-progress-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      white-space: nowrap;
    }

    .cover-error {
      font-size: var(--font-size-sm);
      margin-top: calc(-1 * var(--space-xs));
    }

    /* Recipe panel */
    .recipe-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .panel-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-md);
    }

    .recipe-title {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.2;
    }

    .header-actions {
      display: flex;
      gap: var(--space-xs);
      flex-shrink: 0;
    }

    .icon-btn {
      width: 36px;
      height: 36px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-muted);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, border-color 0.15s;
    }

    .icon-btn:hover {
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    .icon-btn.danger:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    .recipe-desc {
      color: var(--text-secondary);
      font-size: var(--font-size-md);
      line-height: 1.6;
    }

    .tag-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .recipe-tag {
      font-size: var(--font-size-xs);
      padding: 3px 10px;
      background: rgba(122, 59, 46, 0.08);
      color: var(--color-primary);
      border-radius: 12px;
      font-weight: 500;
    }

    .stats-row {
      display: flex;
      gap: var(--space-xl);
    }

    .stat {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .stat-value {
      font-size: var(--font-size-xl);
      font-weight: 600;
      color: var(--text-primary);
    }

    .star-val {
      color: #c49540;
    }

    .stat-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .section {
      margin-top: var(--space-md);
    }

    .dietary-row {
      display: flex; flex-wrap: wrap; gap: 6px;
    }

    .dietary-pill {
      font-size: var(--font-size-xs); padding: 3px 10px;
      background: rgba(122, 59, 46, 0.08); color: var(--color-primary);
      border: 1px solid rgba(122, 59, 46, 0.2);
      border-radius: 12px; font-weight: 500;
      display: inline-flex; align-items: center; gap: 4px;
    }

    .macro-bar {
      display: flex; gap: var(--space-sm); flex-wrap: wrap;
    }

    .macro-chip {
      font-size: var(--font-size-xs); color: var(--text-secondary);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: 4px 10px;
    }

    .macro-val { font-weight: 600; color: var(--text-primary); }

    .collection-picker {
      position: relative;
    }

    .collection-toggle {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: all 0.15s;
    }

    .collection-toggle:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
    }

    .collection-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      margin-top: 4px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      z-index: 10;
      min-width: 160px;
      overflow: hidden;
    }

    .collection-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      font-family: inherit;
      transition: background 0.1s;
      text-align: left;
    }

    .collection-option:hover {
      background: var(--bg-canvas);
    }

    .collection-option--active {
      color: var(--color-primary);
      font-weight: 500;
    }

    .col-check {
      width: 14px;
      text-align: center;
      font-size: 12px;
      color: var(--color-primary);
    }

    .section-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: var(--space-sm);
    }

    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-sm);
    }

    .section-header .section-title {
      margin-bottom: 0;
    }

    .add-grocery-btn {
      display: flex;
      align-items: center;
      gap: 5px;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-muted);
      font-size: var(--font-size-xs);
      font-weight: 500;
      cursor: pointer;
      padding: 4px 10px;
      font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
    }

    .add-grocery-btn:hover {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .grocery-confirm {
      font-size: var(--font-size-xs);
      color: var(--color-primary);
      margin-top: var(--space-xs);
      font-weight: 500;
    }

    .ingredient-table {
      display: flex;
      flex-direction: column;
      gap: 0;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .ingredient-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    .ingredient-row:last-child {
      border-bottom: none;
    }

    .ing-item {
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }

    .ing-amount {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
    }

    .instructions-text {
      font-size: var(--font-size-sm);
      color: var(--text-primary);
      line-height: 1.8;
      white-space: pre-wrap;
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md);
    }

    /* Trials panel */
    .trials-panel {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg);
      position: sticky;
      top: 80px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
    }

    .trials-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
    }

    .trials-title {
      font-size: var(--font-size-lg);
      font-weight: 600;
    }

    .trials-header ::ng-deep .jiro-btn {
      width: auto;
    }

    .trials-empty {
      text-align: center;
      padding: var(--space-xl) 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
    }

    .trials-empty p {
      font-size: var(--font-size-sm);
    }

    .trials-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .trial-card {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .trial-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-xs);
    }

    .trial-meta {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .trial-date {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }

    .trial-rating {
      font-size: var(--font-size-xs);
      color: #c49540;
      font-weight: 500;
    }

    .trial-actions {
      display: flex;
      gap: 2px;
    }

    .text-btn {
      background: none;
      border: none;
      font-size: var(--font-size-xs);
      cursor: pointer;
      color: var(--color-primary);
      padding: 4px 8px;
      border-radius: 4px;
      font-weight: 500;
      transition: background 0.15s;
    }

    .text-btn:hover {
      background: rgba(122, 59, 46, 0.08);
    }

    .text-btn.danger {
      color: var(--color-danger);
    }

    .text-btn.danger:hover {
      background: rgba(var(--color-danger-rgb, 180, 60, 60), 0.08);
    }

    .trial-mods {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .mods-label {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .mod-row {
      display: grid;
      grid-template-columns: 1fr 20px 1fr;
      gap: 4px;
      font-size: var(--font-size-xs);
      align-items: center;
    }

    .mod-item {
      color: var(--text-secondary);
    }

    .mod-sep {
      text-align: center;
      color: var(--text-muted);
    }

    .mod-change {
      color: var(--color-primary);
      font-weight: 500;
    }

    .trial-notes {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* ===== Cook mode overlay ===== */
    .cook-overlay {
      position: fixed;
      inset: 0;
      background: var(--bg-page);
      z-index: 9000;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .cook-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md) var(--space-xl);
      border-bottom: 1px solid var(--border-color);
      background: var(--bg-surface);
      flex-shrink: 0;
    }

    .cook-title {
      font-size: var(--font-size-xl);
      font-weight: 700;
    }

    .cook-close {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      padding: 8px 16px;
      font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
    }

    .cook-close:hover {
      color: var(--text-primary);
      border-color: var(--text-secondary);
    }

    .cook-body {
      flex: 1;
      overflow-y: auto;
      padding: var(--space-xl);
      display: flex;
      flex-direction: column;
      gap: var(--space-2xl);
      max-width: 720px;
      margin: 0 auto;
      width: 100%;
    }

    .cook-section-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: var(--space-md);
    }

    .cook-ingredients {
      display: flex;
      flex-direction: column;
      gap: 2px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .cook-ingredient {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      padding: 14px 16px;
      border-bottom: 1px solid var(--border-color);
      cursor: pointer;
      transition: background 0.15s;
      user-select: none;
    }

    .cook-ingredient:last-child {
      border-bottom: none;
    }

    .cook-ingredient:hover {
      background: var(--bg-surface);
    }

    .cook-ingredient input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--color-primary);
      cursor: pointer;
      flex-shrink: 0;
    }

    .cook-ingredient .ing-item {
      flex: 1;
      font-size: var(--font-size-md);
      transition: opacity 0.2s, text-decoration 0.2s;
    }

    .cook-ingredient .ing-amount {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    .cook-ingredient--checked .ing-item {
      opacity: 0.45;
      text-decoration: line-through;
    }

    .cook-ingredient--checked .ing-amount {
      opacity: 0.45;
    }

    .cook-steps {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .cook-step {
      display: grid;
      grid-template-columns: 44px 1fr 36px;
      align-items: start;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-lg);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
      background: var(--bg-surface);
    }

    .cook-step:hover {
      border-color: var(--color-primary);
    }

    .cook-step--done {
      opacity: 0.55;
      background: var(--bg-canvas);
    }

    .step-num {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: rgba(122, 59, 46, 0.12);
      color: var(--color-primary);
      font-weight: 700;
      font-size: var(--font-size-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-text {
      font-size: var(--font-size-md);
      line-height: 1.6;
      color: var(--text-primary);
      padding-top: 4px;
    }

    .step-check {
      display: flex;
      align-items: center;
      justify-content: center;
      padding-top: 6px;
      color: var(--color-primary);
      flex-shrink: 0;
    }

    .cook-empty {
      text-align: center;
      padding: var(--space-2xl);
    }

    /* Cook footer */
    .cook-footer {
      flex-shrink: 0;
      border-top: 1px solid var(--border-color);
      background: var(--bg-surface);
      padding: var(--space-md) var(--space-xl);
    }

    .cook-footer-inner {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      align-items: flex-end;
      gap: var(--space-lg);
    }

    .cook-footer-left {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .cook-footer-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .cook-stars {
      display: flex;
      gap: 4px;
    }

    .cook-star {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--border-color);
      line-height: 1;
      padding: 0 2px;
      transition: color 0.15s, transform 0.1s;
    }

    .cook-star:hover,
    .cook-star--filled {
      color: #c49540;
    }

    .cook-star:hover {
      transform: scale(1.15);
    }

    .cook-notes {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      outline: none;
      resize: none;
      transition: border-color 0.2s;
      box-sizing: border-box;
    }

    .cook-notes:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(122, 59, 46, 0.12);
    }

    .cook-notes::placeholder {
      color: var(--text-muted);
    }

    .cook-footer-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      flex-shrink: 0;
    }

    .cook-log-btn {
      padding: 10px 24px;
      background: var(--color-primary);
      color: #fff;
      border: none;
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity 0.15s;
      white-space: nowrap;
    }

    .cook-log-btn:hover:not([disabled]) {
      opacity: 0.88;
    }

    .cook-log-btn[disabled] {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .cook-skip-btn {
      background: none;
      border: none;
      color: var(--text-muted);
      font-size: var(--font-size-xs);
      cursor: pointer;
      padding: 4px 8px;
      text-align: center;
      font-family: inherit;
      transition: color 0.15s;
    }

    .cook-skip-btn:hover {
      color: var(--text-secondary);
    }

    /* Public toggle */
    .public-toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: 10px 0;
      border-bottom: 1px solid var(--border-color);
      margin-bottom: var(--space-sm);
    }
    .public-toggle-info { display: flex; flex-direction: column; gap: 2px; }
    .public-toggle-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); }
    .public-toggle-sub { font-size: var(--font-size-xs); color: var(--text-secondary); }

    .toggle-switch {
      position: relative;
      width: 40px; height: 22px;
      border: none; border-radius: 11px;
      background: var(--border-color);
      cursor: pointer;
      transition: background 0.2s;
      flex-shrink: 0;
      padding: 0;
    }
    .toggle-switch--on { background: var(--color-primary); }
    .toggle-switch:disabled { opacity: 0.5; cursor: not-allowed; }
    .toggle-thumb {
      position: absolute;
      top: 3px; left: 3px;
      width: 16px; height: 16px;
      border-radius: 50%;
      background: #fff;
      transition: transform 0.2s;
      display: block;
    }
    .toggle-switch--on .toggle-thumb { transform: translateX(18px); }

    /* Share banner */
    .share-banner {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 10px 14px;
      background: var(--bg-surface-hover);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      margin-bottom: var(--space-sm);
      font-size: var(--font-size-xs);
      min-width: 0;
    }

    .share-url-row {
      display: flex;
      flex: 1;
      min-width: 0;
      gap: 6px;
      align-items: center;
    }

    .share-url-input {
      flex: 1;
      min-width: 0;
      padding: 4px 8px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-canvas);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-family: monospace;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .share-copy-btn {
      flex-shrink: 0;
      padding: 3px 10px;
      background: var(--color-primary);
      color: #fff;
      border: none;
      border-radius: var(--border-radius);
      font-size: var(--font-size-xs);
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s;
    }

    .share-copy-btn:hover { opacity: 0.88; }

    .share-close-btn {
      flex-shrink: 0;
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      padding: 2px 4px;
      font-size: var(--font-size-sm);
      line-height: 1;
      transition: color 0.15s;
    }

    .share-close-btn:hover { color: var(--text-secondary); }

    /* Mobile layout */
    @media (max-width: 767px) {
      .mobile-tabs {
        display: flex;
      }

      .mobile-hidden {
        display: none;
      }

      .detail-layout {
        grid-template-columns: 1fr;
      }

      .trials-panel {
        position: static;
        max-height: none;
        overflow-y: visible;
        border-radius: var(--border-radius);
      }
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `]
})
export class RecipeDetailComponent implements OnInit {
  recipe = signal<RecipeWithTrials | null>(null);
  loading = signal(true);
  showEdit = signal(false);
  showTrial = signal(false);
  editingTrial = signal<RecipeTrial | null>(null);
  promotingTrial = signal<RecipeTrial | null>(null);
  mobileTab = signal<MobileTab>('recipe');
  cookMode = signal(false);
  cookIngredients = signal<CookIngredient[]>([]);
  cookSteps = signal<CookStep[]>([]);
  cookRating = signal(0);
  cookNotes = '';
  cookSaving = signal(false);
  groceryAdded = signal(false);
  shareUrl = signal('');
  shareLoading = signal(false);
  shareCopied = signal(false);
  isPublic = signal(false);
  publicToggling = signal(false);

  latestRating = computed(() => {
    const trials = this.recipe()?.trials;
    if (!trials?.length) return null;
    const rated = trials.filter(t => t.rating != null);
    if (!rated.length) return null;
    return rated[0].rating!;
  });

  avgRating = computed(() => {
    const trials = this.recipe()?.trials;
    if (!trials?.length) return null;
    const rated = trials.filter(t => t.rating != null);
    if (!rated.length) return null;
    if (rated.length === 1) return null; // same as latest, no need to duplicate
    const avg = rated.reduce((sum, t) => sum + t.rating!, 0) / rated.length;
    return Math.round(avg * 10) / 10;
  });

  coverUploading = signal(false);
  coverProgress = signal(0);
  coverError = signal('');

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService,
    private uploadService: UploadService,
    private elRef: ElementRef
  ) { }

  @HostListener('document:click', ['$event'])
  onDocClick(event: Event) {
    if (this.showCollectionPicker() && !this.elRef.nativeElement.querySelector('.collection-picker')?.contains(event.target)) {
      this.showCollectionPicker.set(false);
    }
  }

  collections = signal<Collection[]>([]);
  recipeCollectionIds = signal<Set<string>>(new Set());
  showCollectionPicker = signal(false);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.recipeService.getRecipe(id).subscribe({
      next: (r) => { this.recipe.set(r); this.isPublic.set(r.is_public); this.loading.set(false); this.loadRecipeCollections(r.id); },
      error: () => this.loading.set(false),
    });
    this.recipeService.listCollections().subscribe({
      next: (cols) => this.collections.set(cols),
    });
  }

  loadRecipeCollections(recipeId: string) {
    // Check which collections contain this recipe
    const cols = this.collections();
    // We'll check each collection — or better, iterate after collections load
    this.recipeService.listCollections().subscribe({
      next: (allCols) => {
        this.collections.set(allCols);
        const ids = new Set<string>();
        let pending = allCols.length;
        if (pending === 0) return;
        for (const col of allCols) {
          this.recipeService.getCollectionRecipeIds(col.id).subscribe({
            next: (recipeIds) => {
              if (recipeIds.includes(recipeId)) {
                ids.add(col.id);
              }
              pending--;
              if (pending === 0) {
                this.recipeCollectionIds.set(ids);
              }
            },
          });
        }
      },
    });
  }

  toggleCollection(col: Collection) {
    const r = this.recipe();
    if (!r) return;
    const ids = this.recipeCollectionIds();
    if (ids.has(col.id)) {
      this.recipeService.removeFromCollection(col.id, r.id).subscribe({
        next: () => {
          const updated = new Set(ids);
          updated.delete(col.id);
          this.recipeCollectionIds.set(updated);
        },
      });
    } else {
      this.recipeService.addToCollection(col.id, r.id).subscribe({
        next: () => {
          const updated = new Set(ids);
          updated.add(col.id);
          this.recipeCollectionIds.set(updated);
        },
      });
    }
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  openNewTrial() {
    this.showTrial.set(true);
  }

  openEditTrial(trial: RecipeTrial) {
    this.editingTrial.set(trial);
  }

  onRecipeUpdated(updated: Recipe) {
    this.showEdit.set(false);
    this.recipe.update(r => r ? { ...r, ...updated } : r);
  }

  onTrialSaved(trial: RecipeTrial) {
    this.showTrial.set(false);
    this.recipe.update(r => {
      if (!r) return r;
      return { ...r, trials: [trial, ...r.trials] };
    });
  }

  onTrialUpdated(updated: RecipeTrial) {
    this.editingTrial.set(null);
    this.recipe.update(r => {
      if (!r) return r;
      return { ...r, trials: r.trials.map(t => t.id === updated.id ? updated : t) };
    });
  }

  openPromote(trial: RecipeTrial) {
    this.promotingTrial.set(trial);
  }

  onPromoted(updated: Recipe) {
    this.promotingTrial.set(null);
    this.recipe.update(r => r ? { ...r, ...updated } : r);
  }

  deleteTrial(trial: RecipeTrial) {
    if (!confirm('Delete this trial?')) return;
    this.recipeService.deleteTrial(trial.id).subscribe({
      next: () => {
        this.recipe.update(r => {
          if (!r) return r;
          return { ...r, trials: r.trials.filter(t => t.id !== trial.id) };
        });
      }
    });
  }

  confirmDelete() {
    const r = this.recipe();
    if (!r) return;
    if (!confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    this.recipeService.deleteRecipe(r.id).subscribe({
      next: () => this.router.navigate(['/culinara'])
    });
  }

  enterCookMode() {
    const r = this.recipe();
    if (!r) return;

    const ingredients: CookIngredient[] = (r.base_ingredients ?? []).map(i => ({
      item: i.item,
      amount: i.amount,
      checked: false,
    }));

    const steps: CookStep[] = (r.instructions ?? '')
      .split('\n')
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .map(text => ({ text, done: false }));

    this.cookIngredients.set(ingredients);
    this.cookSteps.set(steps);
    this.cookRating.set(0);
    this.cookNotes = '';
    this.cookMode.set(true);
  }

  exitCookMode() {
    this.cookMode.set(false);
    this.cookRating.set(0);
    this.cookNotes = '';
  }

  finishCooking() {
    const r = this.recipe();
    if (!r) return;
    this.cookSaving.set(true);
    const req = {
      date_cooked: new Date().toISOString(),
      notes: this.cookNotes.trim() || undefined,
      rating: this.cookRating() > 0 ? this.cookRating() : undefined,
    };
    this.recipeService.createTrial(r.id, req).subscribe({
      next: (trial) => {
        this.cookSaving.set(false);
        this.recipe.update(rv => {
          if (!rv) return rv;
          return { ...rv, trials: [trial, ...rv.trials] };
        });
        this.exitCookMode();
      },
      error: () => {
        this.cookSaving.set(false);
        this.exitCookMode();
      },
    });
  }

  toggleStep(index: number) {
    this.cookSteps.update(steps =>
      steps.map((s, i) => i === index ? { ...s, done: !s.done } : s)
    );
  }

  toggleCookIngredient(index: number) {
    this.cookIngredients.update(list =>
      list.map((ing, i) => i === index ? { ...ing, checked: !ing.checked } : ing)
    );
  }

  addToGrocery() {
    const r = this.recipe();
    if (!r?.base_ingredients?.length) return;
    ShoppingListComponent.addRecipe(r.title, r.base_ingredients);
    this.groceryAdded.set(true);
    setTimeout(() => this.groceryAdded.set(false), 2500);
  }

  shareRecipe() {
    const r = this.recipe();
    if (!r) return;
    this.shareLoading.set(true);
    this.recipeService.createRecipeShare(r.id).subscribe({
      next: (res) => {
        this.shareUrl.set(res.share_url);
        this.shareLoading.set(false);
      },
      error: () => this.shareLoading.set(false),
    });
  }

  copyShareUrl() {
    navigator.clipboard.writeText(this.shareUrl()).then(() => {
      this.shareCopied.set(true);
      setTimeout(() => this.shareCopied.set(false), 2000);
    });
  }

  togglePublic() {
    const r = this.recipe();
    if (!r || this.publicToggling()) return;
    const next = !this.isPublic();
    this.publicToggling.set(true);
    this.recipeService.setPublic(r.id, next).subscribe({
      next: () => { this.isPublic.set(next); this.publicToggling.set(false); },
      error: () => this.publicToggling.set(false),
    });
  }

  onCoverFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!input) return;
    input.value = '';
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.coverError.set('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.coverError.set('Image must be under 5 MB.');
      return;
    }

    const r = this.recipe();
    if (!r) return;

    this.coverError.set('');
    this.coverUploading.set(true);
    this.coverProgress.set(0);

    this.uploadService.uploadRecipeImage(r.id, file, pct => this.coverProgress.set(pct)).subscribe({
      next: (url) => {
        this.coverUploading.set(false);
        this.recipe.update(rec => rec ? { ...rec, cover_image_url: url } : rec);
      },
      error: () => {
        this.coverUploading.set(false);
        this.coverError.set('Upload failed. Please try again.');
      },
    });
  }

  removeCoverImage() {
    const r = this.recipe();
    if (!r) return;

    this.uploadService.deleteRecipeImage(r.id).subscribe({
      next: () => {
        this.recipe.update(rec => rec ? { ...rec, cover_image_url: null } : rec);
      },
      error: () => {
        this.coverError.set('Failed to remove cover photo.');
      },
    });
  }
}
