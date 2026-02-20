import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RecipeService, RecipeTrial, Recipe, Modification } from '../../../core/services/recipe.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-promote-dialog',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent],
  template: `
    <div class="promote-dialog">
      <p class="promote-desc">
        Promoting this trial will merge its modifications into the base recipe's ingredient list.
        This action cannot be undone.
      </p>

      <!-- Modifications preview -->
      <div class="mods-preview" *ngIf="modifications().length > 0">
        <h4 class="mods-title">Changes to be applied</h4>
        <div class="mod-list">
          <div *ngFor="let mod of modifications()" class="mod-row">
            <span class="mod-item">{{ mod.item }}</span>
            <span class="mod-arrow">→</span>
            <span class="mod-change">{{ mod.change }}</span>
          </div>
        </div>
      </div>

      <p *ngIf="modifications().length === 0" class="no-mods">
        This trial has no modifications recorded. Promoting it won't change the base ingredients.
      </p>

      <!-- Error -->
      <p *ngIf="error()" class="form-error">{{ error() }}</p>

      <!-- Actions -->
      <div class="dialog-actions">
        <button class="btn-ghost" (click)="cancelled.emit()">Cancel</button>
        <jiro-button variant="primary" type="button" [loading]="promoting()" (click)="onPromote()">
          Promote to Base
        </jiro-button>
      </div>
    </div>
  `,
  styles: [`
    .promote-dialog {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .promote-desc {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
    }

    .mods-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: var(--space-sm);
    }

    .mods-preview {
      background: var(--bg-main);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md);
    }

    .mod-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
    }

    .mod-row {
      display: grid;
      grid-template-columns: 1fr 24px 1fr;
      gap: var(--space-xs);
      align-items: center;
      font-size: var(--font-size-sm);
    }

    .mod-item {
      font-weight: 500;
      color: var(--text-primary);
    }

    .mod-arrow {
      text-align: center;
      color: var(--text-muted);
    }

    .mod-change {
      color: var(--color-primary);
      font-weight: 500;
    }

    .no-mods {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      font-style: italic;
    }

    .form-error {
      font-size: var(--font-size-sm);
      color: var(--color-danger);
    }

    .dialog-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      align-items: center;
      margin-top: var(--space-sm);
    }

    .dialog-actions ::ng-deep .jiro-btn {
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
export class PromoteDialogComponent {
  @Input() trial!: RecipeTrial;
  @Output() promoted = new EventEmitter<Recipe>();
  @Output() cancelled = new EventEmitter<void>();

  promoting = signal(false);
  error = signal('');

  constructor(private recipeService: RecipeService) {}

  modifications(): Modification[] {
    return this.trial?.modifications ?? [];
  }

  onPromote() {
    this.error.set('');
    this.promoting.set(true);
    this.recipeService.promoteTrial(this.trial.id).subscribe({
      next: (recipe) => { this.promoting.set(false); this.promoted.emit(recipe); },
      error: (err) => { this.promoting.set(false); this.error.set(err.error?.message ?? 'Failed to promote'); },
    });
  }
}
