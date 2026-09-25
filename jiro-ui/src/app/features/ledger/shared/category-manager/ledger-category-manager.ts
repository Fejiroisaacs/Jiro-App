import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CategoryTree, LedgerCategory, LedgerService } from '../../../../core/services/ledger.service';
import { ToastService } from '../../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../../shared/components/jiro-icon/jiro-icon';
import { JiroModalComponent } from '../../../../shared/components/jiro-modal/jiro-modal';
import { LedgerCategoryDialogComponent } from '../category-dialog/ledger-category-dialog';

/** Add, rename, recolour and delete categories; emits `changed` after any edit (budgets show them). */
@Component({
  selector: 'ledger-category-manager',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroIconComponent, JiroModalComponent, LedgerCategoryDialogComponent],
  template: `
    <section class="cat-manager" aria-labelledby="cat-manager-title">
      <div class="cm-head">
        <div>
          <h2 class="cm-title" id="cat-manager-title">Categories</h2>
          <p class="cm-sub">Rename, recolour or delete the categories your transactions and budgets use.</p>
        </div>
        <jiro-button variant="secondary" size="sm" type="button" (click)="openNew()">
          <jiro-icon name="plus" [size]="14" />
          New category
        </jiro-button>
      </div>

      @for (group of groups(); track group.type) {
        <h3 class="cm-group">{{ group.label }}</h3>
        @if (group.items.length === 0) {
          <p class="cm-empty">No {{ group.type }} categories yet.</p>
        }
        <ul class="cm-list">
          @for (c of group.items; track c.id) {
            <li class="cm-row">
              <span class="cm-dot" [style.background]="c.color || 'var(--text-muted)'" aria-hidden="true"></span>
              <span class="cm-name">{{ c.name }}</span>
              <button type="button" class="cm-btn" (click)="edit.set(c)" [attr.aria-label]="'Edit ' + c.name">
                <jiro-icon name="pencil-simple" [size]="16" />
              </button>
              <button type="button" class="cm-btn cm-danger" (click)="openDelete(c)" [attr.aria-label]="'Delete ' + c.name">
                <jiro-icon name="trash" [size]="16" />
              </button>
            </li>
          }
        </ul>
      }
    </section>

    @if (creating()) {
      <ledger-category-dialog (saved)="onSaved('added')" (closed)="creating.set(false)" />
    }
    @if (edit(); as c) {
      <ledger-category-dialog [category]="c" (saved)="onSaved('saved')" (closed)="edit.set(null)" />
    }

    @if (deleting(); as c) {
      <jiro-modal [title]="'Delete ' + c.name + '?'" maxWidth="440px" (close)="deleting.set(null)">
        <form class="del-form" (ngSubmit)="confirmDelete(c)">
          <p class="del-copy">
            Its transactions are kept and moved to the category you choose below.
            Any budget set on {{ c.name }} is removed.
          </p>
          <div class="form-group">
            <label class="form-label" for="cat-move-to">Move its transactions to</label>
            <select id="cat-move-to" class="form-input" name="move_to" [(ngModel)]="moveTo">
              <option value="">Uncategorised</option>
              @for (o of moveTargets(); track o.id) {
                <option [value]="o.id">{{ o.name }}</option>
              }
            </select>
          </div>
          @if (deleteError()) {
            <p class="form-error" role="alert">{{ deleteError() }}</p>
          }
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="deleting.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="submit" [disabled]="deleteBusy()">
              {{ deleteBusy() ? 'Deleting...' : 'Delete category' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .cat-manager {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg); padding: var(--space-lg); box-shadow: var(--shadow-sm);
    }
    .cm-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-md); flex-wrap: wrap; }
    .cm-title { font-size: var(--font-size-lg); font-weight: 600; margin: 0; }
    .cm-sub { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 4px 0 0; }
    .cm-group {
      font-size: var(--font-size-xs); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-muted); margin: var(--space-lg) 0 var(--space-xs);
    }
    .cm-empty { font-size: var(--font-size-sm); color: var(--text-muted); margin: 0; }
    .cm-list {
      list-style: none; margin: 0; padding: 0;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); column-gap: var(--space-lg);
    }
    .cm-row {
      display: flex; align-items: center; gap: var(--space-sm); min-width: 0;
      padding: 2px 0; border-bottom: 1px solid var(--border-color);
    }
    .cm-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
    .cm-name { flex: 1; min-width: 0; font-size: var(--font-size-sm); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cm-btn {
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
      width: 40px; height: 40px; border: none; background: none; border-radius: var(--border-radius);
      color: var(--text-secondary); cursor: pointer;
    }
    .cm-btn:hover { color: var(--color-primary); background: var(--bg-canvas); }
    .cm-danger:hover { color: var(--color-danger); }
    .del-form { display: flex; flex-direction: column; gap: var(--space-md); }
    .del-copy { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0; line-height: 1.5; }
    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }
    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }
    .form-input {
      padding: 10px 14px; border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary); font-size: var(--font-size-md); width: 100%;
    }
    .form-error { font-size: var(--font-size-sm); color: var(--color-danger); margin: 0; }
    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); flex-wrap: wrap; }
  `],
})
export class LedgerCategoryManagerComponent implements OnInit {
  @Output() changed = new EventEmitter<void>();

  private readonly ledger = inject(LedgerService);
  private readonly toast = inject(ToastService);

  categories = signal<CategoryTree[]>([]);
  creating = signal(false);
  edit = signal<LedgerCategory | null>(null);
  deleting = signal<LedgerCategory | null>(null);
  deleteBusy = signal(false);
  deleteError = signal('');
  moveTo = '';

  /** Flattened (subcategories after their parent), in the API's order: type, then name. */
  private flat = computed<LedgerCategory[]>(() =>
    this.categories().flatMap(c => [c as LedgerCategory, ...c.children]));

  groups = computed(() => [
    { type: 'expense' as const, label: 'Expense', items: this.flat().filter(c => c.type === 'expense') },
    { type: 'income' as const, label: 'Income', items: this.flat().filter(c => c.type === 'income') },
  ]);

  moveTargets = computed(() => {
    const d = this.deleting();
    return d ? this.flat().filter(c => c.type === d.type && c.id !== d.id) : [];
  });

  ngOnInit() {
    this.load();
  }

  load() {
    this.ledger.listCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () => this.toast.error('Could not load your categories.'),
    });
  }

  openNew() {
    this.creating.set(true);
  }

  onSaved(verb: 'added' | 'saved') {
    this.creating.set(false);
    this.edit.set(null);
    this.toast.success(`Category ${verb}`);
    this.load();
    this.changed.emit();
  }

  openDelete(c: LedgerCategory) {
    this.moveTo = '';
    this.deleteError.set('');
    this.deleting.set(c);
  }

  confirmDelete(c: LedgerCategory) {
    this.deleteBusy.set(true);
    this.deleteError.set('');
    const target = this.flat().find(o => o.id === this.moveTo);
    this.ledger.deleteCategory(c.id, this.moveTo || null).subscribe({
      next: res => {
        this.deleteBusy.set(false);
        this.deleting.set(null);
        const where = target ? target.name : 'Uncategorised';
        const n = res.moved;
        this.toast.success(n > 0
          ? `${c.name} deleted. ${n} transaction${n === 1 ? '' : 's'} moved to ${where}.`
          : `${c.name} deleted.`);
        this.load();
        this.changed.emit();
      },
      error: err => {
        this.deleteBusy.set(false);
        this.deleteError.set(err?.error?.error?.message ?? 'The category could not be deleted. Please try again.');
      },
    });
  }
}
