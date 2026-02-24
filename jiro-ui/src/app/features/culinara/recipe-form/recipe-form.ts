import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RecipeService,
  Recipe,
  Ingredient,
  Nutrition,
  DietaryFlags,
  CreateRecipeRequest,
  UpdateRecipeRequest,
  Collection,
} from '../../../core/services/recipe.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

const PRESET_TAGS = [
  'Mexican', 'Chinese', 'Indian', 'Mediterranean', 'Thai',
  'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drinks',
];

const DIETARY_FLAG_OPTIONS: { key: keyof DietaryFlags; label: string }[] = [
  { key: 'vegan', label: 'Vegan' },
  { key: 'vegetarian', label: 'Vegetarian' },
  { key: 'gluten_free', label: 'Gluten-Free' },
  { key: 'dairy_free', label: 'Dairy-Free' },
  { key: 'nut_free', label: 'Nut-Free' },
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
          <jiro-button type="button" variant="secondary" (click)="addIngredient()" class="add-ingredient-btn">
            + Add ingredient
          </jiro-button>
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

      <!-- Dietary Flags -->
      <div class="field">
        <label class="field-label">Dietary Flags</label>
        <div class="tag-chips">
          <button
            *ngFor="let flag of dietaryFlagOptions"
            type="button"
            class="tag-chip"
            [class.tag-chip--active]="dietaryFlags[flag.key]"
            (click)="toggleDietaryFlag(flag.key)">
            {{ flag.label }}
          </button>
        </div>
      </div>

      <!-- Nutrition (optional) -->
      <div class="field">
        <label class="field-label">Nutrition <span class="field-hint">(optional, per serving)</span></label>
        <div class="macro-grid">
          <div class="macro-field">
            <label class="macro-label">Calories</label>
            <input class="field-input macro-input" type="number" min="0" [(ngModel)]="nutrition.calories" name="cal" placeholder="—" />
          </div>
          <div class="macro-field">
            <label class="macro-label">Protein (g)</label>
            <input class="field-input macro-input" type="number" min="0" [(ngModel)]="nutrition.protein" name="pro" placeholder="—" />
          </div>
          <div class="macro-field">
            <label class="macro-label">Carbs (g)</label>
            <input class="field-input macro-input" type="number" min="0" [(ngModel)]="nutrition.carbs" name="carb" placeholder="—" />
          </div>
          <div class="macro-field">
            <label class="macro-label">Fat (g)</label>
            <input class="field-input macro-input" type="number" min="0" [(ngModel)]="nutrition.fat" name="fat" placeholder="—" />
          </div>
        </div>
      </div>

      <!-- Collection (create only) -->
      <div class="field" *ngIf="!recipe">
        <label class="field-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: -2px"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          Add to Collection
        </label>
        <select class="field-input" [(ngModel)]="selectedCollectionId" name="collection" (change)="onCollectionSelectChange()">
          <option value="">None</option>
          <option *ngFor="let col of collections()" [value]="col.id">{{ col.name }}</option>
          <option value="__new__">+ New Collection</option>
        </select>
        <div class="new-col-row" *ngIf="showNewCollectionInForm">
          <input
            class="field-input"
            [(ngModel)]="newCollectionNameInForm"
            name="newColName"
            placeholder="Collection name"
            (keydown.enter)="createCollectionInForm(); $event.preventDefault()" />
          <button type="button" class="new-col-btn" (click)="createCollectionInForm()">Create</button>
        </div>
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
      gap: var(--space-lg);
      max-width: 100%;
      overflow: hidden;
      box-sizing: border-box;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      min-width: 0;
    }

    .field-label {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
      text-transform: capitalize;
      letter-spacing: 0.01em;
      border-bottom: 1px dashed var(--border-color);
      padding-bottom: 4px;
      margin-bottom: 4px;
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
      box-sizing: border-box;
      min-width: 0;
      width: 100%;
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
      gap: var(--space-sm);
      margin-top: var(--space-xs);
    }

    .tag-chip {
      padding: 6px 14px;
      border: 1px solid var(--border-color);
      border-radius: 4px; /* Paper label look */
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 2px 2px 0px transparent;
      transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .tag-chip:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
      transform: translate(-1px, -1px);
      box-shadow: 2px 2px 0px rgba(92, 64, 51, 0.15);
    }

    .tag-chip--active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--text-on-primary);
      box-shadow: 2px 2px 0px rgba(92, 64, 51, 0.25);
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
      gap: var(--space-sm);
      align-items: center;
    }

    .remove-btn {
      width: 32px;
      height: 32px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-muted);
      cursor: pointer;
      font-size: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .remove-btn:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
      box-shadow: 2px 2px 0px rgba(193, 88, 42, 0.15);
      transform: translate(-1px, -1px);
    }

    .add-ingredient-btn {
      margin-top: var(--space-xs);
      align-self: flex-start;
      margin-right: auto;
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

    .macro-grid {
      display: flex;
      justify-content: space-between;
      gap: var(--space-md);
      background: var(--bg-surface);
      padding: var(--space-md);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: 2px 2px 0px rgba(92, 64, 51, 0.05);
    }

    .macro-field { 
      display: flex; 
      flex-direction: column; 
      gap: 4px; 
      flex: 1;
      border-right: 1px solid var(--border-color);
      padding-right: var(--space-md);
    }
    
    .macro-field:last-child {
      border-right: none;
      padding-right: 0;
    }

    .macro-label {
      font-family: var(--font-family-display);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-weight: 500;
      text-align: center;
    }

    .macro-input {
      text-align: center;
      -moz-appearance: textfield;
      min-width: 0;
      border: none !important;
      box-shadow: none !important;
      padding: 4px;
      font-weight: 600;
      font-size: var(--font-size-lg);
      background: transparent;
    }

    .macro-input:focus {
      background: var(--bg-page);
    }

    .macro-input::-webkit-inner-spin-button,
    .macro-input::-webkit-outer-spin-button {
      -webkit-appearance: none; margin: 0;
    }

    .new-col-row {
      display: flex;
      gap: var(--space-xs);
      margin-top: var(--space-xs);
    }

    .new-col-btn {
      padding: 8px 14px;
      background: var(--color-primary);
      color: #fff;
      border: none;
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      white-space: nowrap;
    }

    .field-hint {
      font-weight: 400;
      color: var(--text-muted);
      font-size: var(--font-size-xs);
    }

    @media (max-width: 480px) {
      .macro-grid { grid-template-columns: repeat(2, 1fr); }
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
  dietaryFlagOptions = DIETARY_FLAG_OPTIONS;
  dietaryFlags: Record<string, boolean> = {};
  nutrition = { calories: null as number | null, protein: null as number | null, carbs: null as number | null, fat: null as number | null };
  customTagInput = '';
  saving = signal(false);
  error = signal('');

  get customTagsList(): string[] {
    return [...this.selectedTags].filter(t => !this.presetTags.includes(t));
  }

  constructor(private recipeService: RecipeService) { }

  ngOnInit() {
    // Load collections for the dropdown
    this.recipeService.listCollections().subscribe({
      next: (cols) => this.collections.set(cols),
    });

    if (this.recipe) {
      this.title = this.recipe.title;
      this.description = this.recipe.description ?? '';
      this.instructions = this.recipe.instructions ?? '';
      this.ingredients = [...(this.recipe.base_ingredients ?? [])];
      this.selectedTags = new Set(this.recipe.tags ?? []);
      if (this.recipe.dietary_flags) {
        this.dietaryFlags = { ...this.recipe.dietary_flags as Record<string, boolean> };
      }
      if (this.recipe.nutrition) {
        const n = this.recipe.nutrition;
        this.nutrition = { calories: n.calories ?? null, protein: n.protein ?? null, carbs: n.carbs ?? null, fat: n.fat ?? null };
      }
    }
  }

  collections = signal<Collection[]>([]);
  selectedCollectionId = '';
  showNewCollectionInForm = false;
  newCollectionNameInForm = '';

  onCollectionSelectChange() {
    if (this.selectedCollectionId === '__new__') {
      this.showNewCollectionInForm = true;
      this.selectedCollectionId = '';
    } else {
      this.showNewCollectionInForm = false;
    }
  }

  createCollectionInForm() {
    const name = this.newCollectionNameInForm.trim();
    if (!name) return;
    this.recipeService.createCollection(name).subscribe({
      next: (col) => {
        this.collections.update(list => [...list, col]);
        this.selectedCollectionId = col.id;
        this.showNewCollectionInForm = false;
        this.newCollectionNameInForm = '';
      },
    });
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

  toggleDietaryFlag(key: string) {
    this.dietaryFlags[key] = !this.dietaryFlags[key];
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

    // Build nutrition — only send if at least one macro is set
    const hasNutrition = Object.values(this.nutrition).some(v => v != null);
    const nutritionPayload = hasNutrition ? this.nutrition : undefined;

    // Build dietary flags — only send if at least one is true
    const activeFlags = Object.fromEntries(
      Object.entries(this.dietaryFlags).filter(([, v]) => v)
    );
    const dietaryPayload = Object.keys(activeFlags).length > 0 ? activeFlags : undefined;

    const body = {
      title: this.title.trim(),
      description: this.description.trim() || undefined,
      instructions: this.instructions.trim() || undefined,
      base_ingredients: filteredIngredients.length ? filteredIngredients : undefined,
      tags,
      nutrition: nutritionPayload,
      dietary_flags: dietaryPayload,
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
        next: (created) => {
          this.saving.set(false);
          if (this.selectedCollectionId) {
            this.recipeService.addToCollection(this.selectedCollectionId, created.id).subscribe();
          }
          this.saved.emit(created);
        },
        error: (err) => { this.saving.set(false); this.error.set(err.error?.message ?? 'Failed to create'); },
      });
    }
  }
}
