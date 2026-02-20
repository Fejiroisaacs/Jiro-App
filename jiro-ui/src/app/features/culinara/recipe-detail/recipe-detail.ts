import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShoppingListComponent } from '../shopping-list/shopping-list';
import {
  RecipeService,
  Recipe,
  RecipeWithTrials,
  RecipeTrial,
} from '../../../core/services/recipe.service';
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

            <p *ngIf="r.description" class="recipe-desc">{{ r.description }}</p>

            <!-- Tags -->
            <div class="tag-row" *ngIf="r.tags && r.tags.length">
              <span *ngFor="let tag of r.tags" class="recipe-tag">{{ tag }}</span>
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

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private recipeService: RecipeService
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.recipeService.getRecipe(id).subscribe({
      next: (r) => { this.recipe.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
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
}
