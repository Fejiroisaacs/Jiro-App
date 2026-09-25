import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LedgerCategory, LedgerService } from '../../../../core/services/ledger.service';
import { JiroButtonComponent } from '../../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../../shared/components/jiro-modal/jiro-modal';
import { CATEGORY_PALETTE } from '../ledger-utils';

let dialogSeq = 0;

/** New category, or rename and recolour one; the type is fixed at creation so transactions aren't misfiled. */
@Component({
  selector: 'ledger-category-dialog',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroModalComponent],
  template: `
    <jiro-modal [title]="category ? 'Edit category' : 'New category'" maxWidth="420px" (close)="closed.emit()">
      <form class="cat-form" (ngSubmit)="submit()">
        <div class="form-group">
          <label class="form-label" [for]="uid + '-name'">Name</label>
          <input class="form-input" type="text" [id]="uid + '-name'" name="cat_name"
            [(ngModel)]="name" placeholder="e.g. Groceries" maxlength="100" required />
        </div>

        @if (!category) {
          <fieldset class="form-group">
            <legend class="form-label">Type</legend>
            <div class="seg-group">
              <label class="seg-btn" [class.active]="type === 'expense'">
                <input type="radio" name="cat_type" value="expense" [(ngModel)]="type" />Expense
              </label>
              <label class="seg-btn" [class.active]="type === 'income'">
                <input type="radio" name="cat_type" value="income" [(ngModel)]="type" />Income
              </label>
            </div>
          </fieldset>
        }

        <fieldset class="form-group">
          <legend class="form-label">Colour</legend>
          <div class="swatches">
            @for (c of palette; track c.hex) {
              <label class="swatch" [class.selected]="color === c.hex" [style.--swatch]="c.hex" [title]="c.name">
                <input type="radio" name="cat_color" [value]="c.hex" [(ngModel)]="color" />
                <span class="sr-only">{{ c.name }}</span>
              </label>
            }
          </div>
        </fieldset>

        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <div class="form-actions">
          <jiro-button variant="secondary" type="button" (click)="closed.emit()">Cancel</jiro-button>
          <jiro-button variant="primary" type="submit" [disabled]="saving() || !name.trim()">
            {{ saving() ? 'Saving...' : category ? 'Save' : 'Create' }}
          </jiro-button>
        </div>
      </form>
    </jiro-modal>
  `,
  styles: [`
    .cat-form { display: flex; flex-direction: column; gap: var(--space-md); }
    fieldset { border: none; padding: 0; margin: 0; min-width: 0; }
    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }
    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); padding: 0; }
    .form-input {
      padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary); font-size: var(--font-size-md);
      width: 100%; box-sizing: border-box;
    }
    .form-input:focus { border-color: var(--color-primary); }
    .seg-group { display: flex; border: 1px solid var(--border-color); border-radius: var(--border-radius); overflow: hidden; }
    .seg-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; min-height: 40px;
      background: var(--bg-surface); color: var(--text-secondary); font-size: var(--font-size-sm);
      font-weight: 500; cursor: pointer;
    }
    .seg-btn + .seg-btn { border-left: 1px solid var(--border-color); }
    .seg-btn.active { background: var(--color-primary); color: var(--text-on-primary); }
    .seg-btn input, .swatch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
    .seg-btn:focus-within, .swatch:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .swatches { display: flex; flex-wrap: wrap; gap: 8px; }
    .swatch {
      position: relative; width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
      background: var(--swatch); border: 2px solid transparent; box-shadow: inset 0 0 0 2px var(--bg-canvas);
    }
    .swatch.selected { border-color: var(--text-primary); }
    .form-error { font-size: var(--font-size-sm); color: var(--color-danger); margin: 0; }
    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); flex-wrap: wrap; }
  `],
})
export class LedgerCategoryDialogComponent implements OnInit {
  /** The category to edit; null to create one. */
  @Input() category: LedgerCategory | null = null;
  /** The type a new category starts as. */
  @Input() defaultType: 'income' | 'expense' = 'expense';
  @Output() saved = new EventEmitter<LedgerCategory>();
  @Output() closed = new EventEmitter<void>();

  private readonly ledger = inject(LedgerService);
  readonly palette = CATEGORY_PALETTE;
  readonly uid = `cat-dialog-${++dialogSeq}`;

  name = '';
  type: 'income' | 'expense' = 'expense';
  /** '' until one is picked: a new category then gets the next unused palette colour. */
  color = '';
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    if (this.category) {
      this.name = this.category.name;
      this.type = this.category.type;
      this.color = (this.category.color ?? '').toUpperCase();
    } else {
      this.type = this.defaultType;
    }
  }

  submit() {
    const name = this.name.trim();
    if (!name || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    const req$ = this.category
      ? this.ledger.updateCategory(this.category.id, { name, ...(this.color ? { color: this.color } : {}) })
      : this.ledger.createCategory({ name, type: this.type, ...(this.color ? { color: this.color } : {}) });
    req$.subscribe({
      next: cat => {
        this.saving.set(false);
        this.saved.emit(cat);
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.error?.message ?? 'The category could not be saved. Please try again.');
      },
    });
  }
}
