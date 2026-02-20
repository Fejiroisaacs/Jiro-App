import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RecipeService,
  Recipe,
  Ingredient,
  CreateRecipeRequest,
  UpdateRecipeRequest,
} from '../../../core/services/recipe.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

const PRESET_TAGS = [
  'African', 'Mexican', 'Asian', 'Indian', 'American',
  'Mediterranean', 'French', 'Japanese', 'Thai',
  'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drinks',
];

@Component({
  selector: 'app-recipe-form',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent],
  template: `
    <form (ngSubmit)="onSubmit()" class="recipe-form">
      <!-- Title -->
      <div class="field">
        <label class="field-label">Title <span class="required">*</span></label>
        <input
          class="field-input"
          type="text"
          [(ngModel)]="title"
          name="title"
          placeholder="e.g. Sourdough Boule"
          required />
      </div>

      <!-- Description -->
      <div class="field">
        <label class="field-label">Description</label>
        <textarea
          class="field-input field-textarea"
          [(ngModel)]="description"
          name="description"
          placeholder="Brief description of the dish..."
          rows="2"></textarea>
      </div>

      <!-- Tags -->
      <div class="field">
        <label class="field-label">Tags</label>
        <div class="tag-chips">
          <button
            *ngFor="let tag of presetTags"
            type="button"
            class="tag-chip"
            [class.tag-chip--active]="selectedTags.has(tag)"
            (click)="toggleTag(tag)">
            {{ tag }}
          </button>
        </div>
        <!-- Custom tags -->
        <div class="custom-tags-row" *ngIf="customTagsList.length > 0">
          <span *ngFor="let tag of customTagsList" class="custom-tag">
            {{ tag }}
            <button type="button" class="custom-tag-remove" (click)="removeTag(tag)" title="Remove">×</button>
          </span>
        </div>
        <!-- Custom tag input -->
        <div class="custom-tag-input-row">
          <input
            class="field-input custom-tag-input"
            type="text"
            [(ngModel)]="customTagInput"
            name="customTagInput"
            placeholder="Add custom tag..."
            (keydown.enter)="$event.preventDefault(); addCustomTag()" />
          <button
            type="button"
            class="add-custom-tag-btn"
            (click)="addCustomTag()"
            [disabled]="!customTagInput.trim()">
            Add
          </button>
        </div>
      </div>

      <!-- Ingredients -->
      <div class="field">
        <label class="field-label">Base Ingredients</label>
        <div class="ingredient-list">
          <div *ngFor="let ing of ingredients; let i = index" class="ingredient-row">
            <input
              class="field-input ing-item"
              type="text"
              [(ngModel)]="ing.item"
              [name]="'item_' + i"
              placeholder="Item (e.g. flour)" />
            <input
              class="field-input ing-amount"
              type="text"
              [(ngModel)]="ing.amount"
              [name]="'amount_' + i"
              placeholder="Amount (e.g. 500g)" />
            <button type="button" class="remove-btn" (click)="removeIngredient(i)" title="Remove">
              &times;
            </button>
          </div>
          <button type="button" class="add-link" (click)="addIngredient()">
            + Add ingredient
          </button>
        </div>
      </div>

      <!-- Instructions -->
      <div class="field">
        <label class="field-label">Instructions</label>
        <textarea
          class="field-input field-textarea"
          [(ngModel)]="instructions"
          name="instructions"
          placeholder="Step-by-step method..."
          rows="5"></textarea>
      </div>

      <!-- Error -->
      <p *ngIf="error()" class="form-error">{{ error() }}</p>

      <!-- Actions -->
      <div class="form-actions">
        <button type="button" class="btn-ghost" (click)="cancelled.emit()">Cancel</button>
        <jiro-button variant="primary" type="submit" [loading]="saving()">
          {{ recipe ? 'Save Changes' : 'Create Recipe' }}
        </jiro-button>
      </div>
    </form>
  `,
  styles: [`
    .recipe-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .field-label {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-secondary);
    }

    .required {
      color: var(--color-danger);
    }

    .field-input {
      padding: 9px 13px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
    }

    .field-input:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 3px rgba(122, 59, 46, 0.12);
    }

    .field-input::placeholder {
      color: var(--text-muted);
    }

    .field-textarea {
      resize: vertical;
      min-height: 72px;
    }

    .tag-chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
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

    .custom-tags-row {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
      margin-top: var(--space-xs);
    }

    .custom-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px 3px 10px;
      background: rgba(122, 59, 46, 0.12);
      border: 1px solid var(--color-primary);
      border-radius: 20px;
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 500;
    }

    .custom-tag-remove {
      background: none;
      border: none;
      color: var(--color-primary);
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      line-height: 1;
      opacity: 0.7;
      transition: opacity 0.15s;
    }

    .custom-tag-remove:hover {
      opacity: 1;
    }

    .custom-tag-input-row {
      display: flex;
      gap: var(--space-xs);
      margin-top: var(--space-xs);
    }

    .custom-tag-input {
      flex: 1;
      min-width: 0;
    }

    .add-custom-tag-btn {
      padding: 9px 16px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      font-family: inherit;
      transition: color 0.15s, border-color 0.15s;
    }

    .add-custom-tag-btn:hover:not([disabled]) {
      color: var(--color-primary);
      border-color: var(--color-primary);
    }

    .add-custom-tag-btn[disabled] {
      opacity: 0.4;
      cursor: default;
    }

    .ingredient-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .ingredient-row {
      display: grid;
      grid-template-columns: 1fr 140px 32px;
      gap: var(--space-xs);
      align-items: center;
    }

    .remove-btn {
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: color 0.15s, border-color 0.15s;
    }

    .remove-btn:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
    }

    .add-link {
      background: none;
      border: none;
      color: var(--color-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      padding: var(--space-xs) 0;
      text-align: left;
      font-weight: 500;
    }

    .add-link:hover {
      text-decoration: underline;
    }

    .form-error {
      font-size: var(--font-size-sm);
      color: var(--color-danger);
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      align-items: center;
      margin-top: var(--space-sm);
    }

    .form-actions ::ng-deep .jiro-btn {
      width: auto;
    }

    .btn-ghost {
      background: none;
      border: none;
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      padding: 10px 14px;
      border-radius: var(--border-radius);
    }

    .btn-ghost:hover {
      background: var(--bg-surface-hover);
    }
  `]
})
export class RecipeFormComponent implements OnInit {
  @Input() recipe: Recipe | null = null;
  @Output() saved = new EventEmitter<Recipe>();
  @Output() cancelled = new EventEmitter<void>();

  title = '';
  description = '';
  instructions = '';
  ingredients: Ingredient[] = [];
  selectedTags = new Set<string>();
  presetTags = PRESET_TAGS;
  customTagInput = '';
  saving = signal(false);
  error = signal('');

  get customTagsList(): string[] {
    return [...this.selectedTags].filter(t => !this.presetTags.includes(t));
  }

  constructor(private recipeService: RecipeService) {}

  ngOnInit() {
    if (this.recipe) {
      this.title = this.recipe.title;
      this.description = this.recipe.description ?? '';
      this.instructions = this.recipe.instructions ?? '';
      this.ingredients = [...(this.recipe.base_ingredients ?? [])];
      this.selectedTags = new Set(this.recipe.tags ?? []);
    }
  }

  toggleTag(tag: string) {
    if (this.selectedTags.has(tag)) {
      this.selectedTags.delete(tag);
    } else {
      this.selectedTags.add(tag);
    }
  }

  addCustomTag() {
    const tag = this.customTagInput.trim();
    if (!tag) return;
    this.selectedTags.add(tag);
    this.customTagInput = '';
  }

  removeTag(tag: string) {
    this.selectedTags.delete(tag);
  }

  addIngredient() {
    this.ingredients.push({ item: '', amount: '' });
  }

  removeIngredient(index: number) {
    this.ingredients.splice(index, 1);
  }

  onSubmit() {
    if (!this.title.trim()) {
      this.error.set('Title is required');
      return;
    }
    this.error.set('');
    this.saving.set(true);

    const filteredIngredients = this.ingredients.filter(i => i.item.trim());
    const tags = [...this.selectedTags];
    const body = {
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      instructions: this.instructions.trim() || undefined,
      base_ingredients: filteredIngredients.length ? filteredIngredients : undefined,
      tags,
    };

    if (this.recipe) {
      const req: UpdateRecipeRequest = body;
      this.recipeService.updateRecipe(this.recipe.id, req).subscribe({
        next: (updated) => { this.saving.set(false); this.saved.emit(updated); },
        error: (err) => { this.saving.set(false); this.error.set(err.error?.message ?? 'Failed to save'); },
      });
    } else {
      const req: CreateRecipeRequest = body as CreateRecipeRequest;
      this.recipeService.createRecipe(req).subscribe({
        next: (created) => { this.saving.set(false); this.saved.emit(created); },
        error: (err) => { this.saving.set(false); this.error.set(err.error?.message ?? 'Failed to create'); },
      });
    }
  }
}
