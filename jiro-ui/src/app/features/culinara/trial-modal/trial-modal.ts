import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  RecipeService,
  RecipeTrial,
  Modification,
  CreateTrialRequest,
  UpdateTrialRequest,
} from '../../../core/services/recipe.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { StarRatingComponent } from '../../../shared/components/star-rating/star-rating';

@Component({
  selector: 'app-trial-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent, StarRatingComponent],
  template: `
    <form (ngSubmit)="onSubmit()" class="trial-form">
      <!-- Date cooked -->
      <div class="field">
        <label class="field-label">Date Cooked</label>
        <input
          class="field-input"
          type="date"
          [(ngModel)]="dateCookedStr"
          name="date_cooked" />
      </div>

      <!-- Modifications -->
      <div class="field">
        <label class="field-label">Modifications</label>
        <p class="field-hint">What did you change from the base recipe?</p>
        <div class="mod-list">
          <div *ngFor="let mod of modifications; let i = index" class="mod-row">
            <input
              class="field-input mod-item"
              type="text"
              [(ngModel)]="mod.item"
              [name]="'mod_item_' + i"
              placeholder="Ingredient (e.g. flour)" />
            <input
              class="field-input mod-change"
              type="text"
              [(ngModel)]="mod.change"
              [name]="'mod_change_' + i"
              placeholder="Change (e.g. +50g, toasted)" />
            <button type="button" class="remove-btn" (click)="removeMod(i)">&times;</button>
          </div>
          <button type="button" class="add-link" (click)="addMod()">+ Add modification</button>
        </div>
      </div>

      <!-- Notes -->
      <div class="field">
        <label class="field-label">Notes</label>
        <textarea
          class="field-input field-textarea"
          [(ngModel)]="notes"
          name="notes"
          placeholder="What worked, what to try next time..."
          rows="4"></textarea>
      </div>

      <!-- Rating -->
      <div class="field">
        <label class="field-label">Rating</label>
        <star-rating [(ngModel)]="rating" name="rating"></star-rating>
      </div>

      <!-- Error -->
      <p *ngIf="error()" class="form-error">{{ error() }}</p>

      <!-- Actions -->
      <div class="form-actions">
        <button type="button" class="btn-ghost" (click)="cancelled.emit()">Cancel</button>
        <jiro-button variant="primary" type="submit" [loading]="saving()">
          {{ trial ? 'Save Changes' : 'Log Trial' }}
        </jiro-button>
      </div>
    </form>
  `,
  styles: [`
    .trial-form {
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

    .field-hint {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      margin: 0;
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
      min-height: 80px;
    }

    .mod-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .mod-row {
      display: grid;
      grid-template-columns: 1fr 1fr 32px;
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
export class TrialModalComponent implements OnInit {
  /** When provided the modal operates in edit mode */
  @Input() trial: RecipeTrial | null = null;
  /** Required only in create mode */
  @Input() recipeId: string = '';
  @Output() saved = new EventEmitter<RecipeTrial>();
  @Output() cancelled = new EventEmitter<void>();

  dateCookedStr = '';
  modifications: Modification[] = [];
  notes = '';
  rating = 0;
  saving = signal(false);
  error = signal('');

  constructor(private recipeService: RecipeService) {}

  ngOnInit() {
    if (this.trial) {
      // Edit mode — pre-fill
      const d = new Date(this.trial.date_cooked);
      this.dateCookedStr = d.toISOString().split('T')[0];
      this.modifications = this.trial.modifications ? [...this.trial.modifications] : [];
      this.notes = this.trial.notes ?? '';
      this.rating = this.trial.rating ?? 0;
    } else {
      // Create mode — default to today
      this.dateCookedStr = new Date().toISOString().split('T')[0];
    }
  }

  addMod() {
    this.modifications.push({ item: '', change: '' });
  }

  removeMod(index: number) {
    this.modifications.splice(index, 1);
  }

  onSubmit() {
    this.error.set('');
    this.saving.set(true);

    const filteredMods = this.modifications.filter(m => m.item.trim());

    if (this.trial) {
      // Edit mode
      const req: UpdateTrialRequest = {
        date_cooked: this.dateCookedStr ? new Date(this.dateCookedStr + 'T12:00:00Z').toISOString() : undefined,
        notes: this.notes.trim() || undefined,
        modifications: filteredMods.length ? filteredMods : [],
        rating: this.rating > 0 ? this.rating : undefined,
      };
      this.recipeService.updateTrial(this.trial.id, req).subscribe({
        next: (updated) => { this.saving.set(false); this.saved.emit(updated); },
        error: (err) => { this.saving.set(false); this.error.set(err.error?.message ?? 'Failed to save'); },
      });
    } else {
      // Create mode
      const req: CreateTrialRequest = {
        date_cooked: this.dateCookedStr ? new Date(this.dateCookedStr + 'T12:00:00Z').toISOString() : undefined,
        notes: this.notes.trim() || undefined,
        modifications: filteredMods.length ? filteredMods : undefined,
        rating: this.rating > 0 ? this.rating : undefined,
      };
      this.recipeService.createTrial(this.recipeId, req).subscribe({
        next: (trial) => { this.saving.set(false); this.saved.emit(trial); },
        error: (err) => { this.saving.set(false); this.error.set(err.error?.message ?? 'Failed to log trial'); },
      });
    }
  }
}
