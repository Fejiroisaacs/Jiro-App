import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LedgerService,
  BudgetWithSpend,
  CategoryTree,
} from '../../../core/services/ledger.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { SettingsService } from '../../../core/services/settings.service';
import { periodLabel, clamp, formatCurrency, currencySymbol } from '../shared/ledger-utils';
import { LedgerCategoryDialogComponent } from '../shared/category-dialog/ledger-category-dialog';
import { LedgerCategoryManagerComponent } from '../shared/category-manager/ledger-category-manager';
import { LedgerCategory } from '../../../core/services/ledger.service';

@Component({
  selector: 'app-budgets-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent,
    JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent,
    LedgerCategoryDialogComponent, LedgerCategoryManagerComponent,
  ],
  template: `
    <div class="budgets-page">

      <!-- Header -->
      <jiro-page-header heading="Budgets" subtitle="Spending limits, and the categories behind them">
        <jiro-button actions type="button" (click)="openAddModal()">
          <jiro-icon name="plus" [size]="14" />
          Add budget
        </jiro-button>
      </jiro-page-header>

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Summary bar -->
      @if (!loading() && budgets().length > 0) {
<section class="summary-bar" aria-label="All budgets, this period">
        <div class="summary-item">
          <span class="summary-label">Total budgeted</span>
          <span class="summary-value">{{ money(totalBudgeted()) }}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="summary-label">Total spent</span>
          <span class="summary-value" [class.over]="totalSpent() > totalBudgeted()">{{ money(totalSpent()) }}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="summary-label">Remaining</span>
          <span class="summary-value" [class.over]="totalBudgeted() - totalSpent() < 0">
            {{ money(totalBudgeted() - totalSpent()) }}
          </span>
        </div>
      </section>
}

      <!-- Empty state -->
      @if (!loading() && budgets().length === 0) {
        <jiro-empty-state
          icon="wallet"
          heading="No budgets yet"
          message="Set a limit on a spending category to stay on track.">
          <jiro-button type="button" (click)="openAddModal()">
            Set your first budget
          </jiro-button>
        </jiro-empty-state>
      }

      <!-- Budget grid -->
      @if (!loading() && budgets().length > 0) {
<div class="budgets-grid">
        @for (budget of budgets(); track budget.id) {
<jiro-card class="budget-card">

          <!-- Card header -->
          <div class="budget-header">
            <div class="category-info">
              <span
                class="color-dot"
                aria-hidden="true"
                [style.background]="budget.category_color || 'var(--text-muted)'">
              </span>
              <h2 class="category-name">{{ budget.category_name }}</h2>
            </div>
            <span class="period-badge">{{ periodLabel(budget.period) }}</span>
          </div>

          <!-- Progress bar -->
          <div class="progress-section">
            <div class="progress-track" role="progressbar"
              [attr.aria-label]="budget.category_name + ' budget used'"
              aria-valuemin="0" aria-valuemax="100"
              [attr.aria-valuenow]="clamp(round(budget.pct_used), 0, 100)"
              [attr.aria-valuetext]="round(budget.pct_used) + '% used'">
              <div
                class="progress-fill"
                [style.width.%]="clamp(budget.pct_used, 0, 100)"
                [class.warn]="budget.pct_used >= 80 && budget.pct_used < 100"
                [class.over]="budget.pct_used >= 100">
              </div>
            </div>
            <div class="progress-labels">
              <span class="spent-label">{{ money(budget.spent) }} of {{ money(budget.amount) }} this {{ periodWord(budget.period) }}</span>
              <span class="pct-label" [class.warn]="budget.pct_used >= 80 && budget.pct_used < 100" [class.over]="budget.pct_used >= 100">
                {{ budget.pct_used | number:'1.0-0' }}% used
              </span>
            </div>
          </div>

          <!-- Remaining -->
          <div class="remaining-row">
            @if (budget.remaining >= 0) {
<span class="remaining-ok">
              {{ money(budget.remaining) }} remaining
            </span>
}
            @if (budget.remaining < 0) {
<span class="remaining-over">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Over budget by {{ money(-budget.remaining) }}
            </span>
}
            <span class="card-actions">
              <button class="icon-btn" type="button" (click)="openEdit(budget)"
                [attr.aria-label]="'Edit the ' + budget.category_name + ' budget'">
                <jiro-icon name="pencil-simple" [size]="16" />
              </button>
              <button class="icon-btn delete-btn" type="button" (click)="deleteBudget(budget)"
                [attr.aria-label]="'Delete the ' + budget.category_name + ' budget'">
                <jiro-icon name="trash" [size]="16" />
              </button>
            </span>
          </div>

        </jiro-card>
}
      </div>
}

      <!-- Categories: rename, recolour, delete -->
      @if (!loading()) {
        <ledger-category-manager class="cat-manager" (changed)="onCategoriesChanged()" />
      }

      <!-- Add Budget Modal -->
      @if (showAddModal()) {
<jiro-modal title="Add budget" maxWidth="480px" (close)="closeAddModal()">
        <form class="modal-form" (ngSubmit)="submitBudget()">

          <div class="form-group">
            <div class="label-row">
              <label class="form-label" for="budget-add-category">Category</label>
              <button type="button" class="new-cat-btn" (click)="showCatDialog.set(true)">+ New category</button>
            </div>
            <select id="budget-add-category" class="form-input" [(ngModel)]="newCategoryId" name="category" required>
              <option value="" disabled>Select a category...</option>
              @for (cat of expenseCategories(); track cat.id) {
                <option [value]="cat.id">{{ cat.name }}</option>
                @for (child of cat.children; track child.id) {
                  <option [value]="child.id">{{ cat.name }} / {{ child.name }}</option>
                }
              }
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" for="budget-add-amount">Limit ({{ symbol() }})</label>
            <input
              id="budget-add-amount"
              class="form-input"
              type="number"
              inputmode="decimal"
              [(ngModel)]="newAmount"
              name="amount"
              min="0.01"
              step="0.01"
              placeholder="e.g. 500.00"
              required />
          </div>

          <div class="form-group">
            <label class="form-label" for="budget-add-period">Period</label>
            <select id="budget-add-period" class="form-input" [(ngModel)]="newPeriod" name="period">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
            <p class="field-hint">A budget always tracks the current {{ periodWord(newPeriod) }}, starting over at the next one.</p>
          </div>

          @if (formError()) {
            <p class="form-error" role="alert">{{ formError() }}</p>
          }
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeAddModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !newCategoryId || !newAmount">
              {{ saving() ? 'Saving...' : 'Create budget' }}
            </jiro-button>
          </div>

        </form>
      </jiro-modal>
}

      <!-- Edit Budget Modal -->
      @if (editing(); as b) {
<jiro-modal [title]="'Edit the ' + b.category_name + ' budget'" maxWidth="480px" (close)="closeEdit()">
        <form class="modal-form" (ngSubmit)="submitEdit(b)">
          <div class="form-group">
            <label class="form-label" for="budget-edit-amount">Limit ({{ symbol() }})</label>
            <input
              id="budget-edit-amount"
              class="form-input"
              type="number"
              inputmode="decimal"
              [(ngModel)]="editAmount"
              name="amount"
              min="0.01"
              step="0.01"
              required />
          </div>
          <div class="form-group">
            <label class="form-label" for="budget-edit-period">Period</label>
            <select id="budget-edit-period" class="form-input" [(ngModel)]="editPeriod" name="period">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
          @if (formError()) {
            <p class="form-error" role="alert">{{ formError() }}</p>
          }
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeEdit()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !editAmount || editAmount <= 0">
              {{ saving() ? 'Saving...' : 'Save changes' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>
}

      <!-- New Category (from the Add budget dialog) -->
      @if (showCatDialog()) {
        <ledger-category-dialog defaultType="expense" (saved)="onCategoryCreated($event)" (closed)="showCatDialog.set(false)" />
      }

    </div>
  `,
  styles: [`
    :host { display: block; }

    .budgets-page { max-width: 1000px; width: 100%; }

    /* ── Header ── */


    @media (max-width: 600px) {
    }

    /* ── Summary bar ── */
    .summary-bar {
      display: flex;
      align-items: center;
      gap: var(--space-lg);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-sm);
      margin-bottom: var(--space-lg);
      flex-wrap: wrap;
    }

    .summary-item { display: flex; flex-direction: column; gap: 2px; }

    .summary-label {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .summary-value {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--text-primary);
    }

    .summary-value.over { color: var(--color-danger); }

    .summary-divider {
      width: 1px;
      height: 36px;
      background: var(--border-color);
      flex-shrink: 0;
    }

    @media (max-width: 600px) {
      .summary-bar { gap: var(--space-md); }
      .summary-divider { display: none; }
    }

    /* ── State messages ── */
    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }


    /* ── Empty state ── */




    /* ── Budgets grid ── */
    .budgets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
      gap: var(--space-lg);
    }

    @media (max-width: 600px) {
      .budgets-grid { grid-template-columns: minmax(0, 1fr); }
    }

    .cat-manager { display: block; margin-top: var(--space-2xl); }

    .card-actions { display: inline-flex; gap: 2px; margin-left: auto; flex-shrink: 0; }

    .icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 40px; height: 40px; border: none; background: none; cursor: pointer;
      border-radius: var(--border-radius); color: var(--text-secondary);
    }
    .icon-btn:hover { background: var(--bg-canvas); color: var(--color-primary); }
    .icon-btn.delete-btn:hover { color: var(--color-danger); }

    .field-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; line-height: 1.5; }

    .budget-card { display: flex; flex-direction: column; gap: var(--space-md); }

    /* ── Card header ── */
    .budget-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
    }

    .category-info { display: flex; align-items: center; gap: var(--space-sm); min-width: 0; }

    .color-dot {
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .category-name {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .period-badge {
      background: var(--bg-canvas);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 2px;
      border: 1px solid var(--border-color);
      white-space: nowrap;
      flex-shrink: 0;
    }

    /* ── Progress bar ── */
    .progress-section { display: flex; flex-direction: column; gap: var(--space-xs); }

    .progress-track {
      height: 8px;
      background: var(--bg-canvas);
      border-radius: 4px;
      border: 1px solid var(--border-color);
      overflow: hidden;
    }

    .progress-fill {
      height: 100%;
      background: var(--color-accent);
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .progress-fill.warn { background: var(--color-warning); }
    .progress-fill.over { background: var(--color-danger); }

    .progress-labels {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: baseline;
      gap: 2px var(--space-sm);
    }

    .spent-label { font-size: var(--font-size-sm); color: var(--text-secondary); }

    .pct-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-accent);
      white-space: nowrap;
      margin-left: auto;
    }

    .pct-label.warn { color: var(--color-warning); }
    .pct-label.over { color: var(--color-danger); }

    /* ── Remaining row ── */
    .remaining-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
    }

    .remaining-ok {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
    }

    .remaining-over {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-danger);
    }


    /* ── Modal form ── */
    .modal-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-sm); }

    .label-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .new-cat-btn {
      background: none;
      border: none;
      padding: 8px 0;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--color-primary);
      cursor: pointer;
      line-height: 1;
    }
    .new-cat-btn:hover { opacity: 0.75; }

    .form-label {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      font-family: 'Newsreader', serif;
    }

    .form-input {
      padding: 10px 0;
      border: none;
      border-bottom: 2px dashed var(--border-color);
      border-radius: 0;
      background: transparent;
      color: var(--text-primary);
      font-size: var(--font-size-md);
      transition: border-color 0.2s;
      font-family: inherit;
      width: 100%;
      box-sizing: border-box;
      appearance: none;
      -webkit-appearance: none;
    }

    select.form-input {
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%239B8F88' stroke-width='2.5'%3E%3Cpolyline points='6,9 12,15 18,9'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 4px center;
      padding-right: 24px;
      cursor: pointer;
    }

    .form-input:focus { border-bottom-color: var(--color-primary); }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      margin-top: var(--space-xs);
    }


    .form-error { font-size: var(--font-size-sm); color: var(--color-danger); margin: 0; }

    /* ── Delete confirm ── */
  `]
})
export class BudgetsPageComponent implements OnInit {
  readonly periodLabel = periodLabel;
  readonly clamp = clamp;

  budgets = signal<BudgetWithSpend[]>([]);
  categories = signal<CategoryTree[]>([]);
  loading = signal(true);
  saving = signal(false);
  deleting = signal(false);
  showAddModal = signal(false);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly settings = inject(SettingsService);

  showCatDialog = signal(false);
  formError = signal('');
  readonly symbol = computed(() => currencySymbol(this.settings.currency()));

  // Add form fields
  newCategoryId = '';
  newAmount: number | null = null;
  newPeriod: 'monthly' | 'weekly' | 'yearly' = 'monthly';

  // Edit form fields
  editing = signal<BudgetWithSpend | null>(null);
  editAmount: number | null = null;
  editPeriod: 'monthly' | 'weekly' | 'yearly' = 'monthly';

  expenseCategories = computed(() =>
    this.categories().filter(c => c.type === 'expense')
  );

  totalBudgeted = computed(() =>
    this.budgets().reduce((sum, b) => sum + b.amount, 0)
  );

  totalSpent = computed(() =>
    this.budgets().reduce((sum, b) => sum + b.spent, 0)
  );

  constructor(private ledgerService: LedgerService) {}

  ngOnInit() {
    this.loadBudgets();
    this.loadCategories();
  }

  private loadCategories() {
    this.ledgerService.listCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () => {},
    });
  }

  /** A category was renamed, recoloured or deleted: budgets show its name and colour. */
  onCategoriesChanged() {
    this.loadCategories();
    this.ledgerService.listBudgets().subscribe({ next: b => this.budgets.set(b) });
  }

  round(v: number): number {
    return Math.round(v);
  }

  private reason(err: unknown, fallback: string): string {
    return (err as { error?: { error?: { message?: string } } })?.error?.error?.message ?? fallback;
  }

  private loadBudgets() {
    this.loading.set(true);
    this.ledgerService.listBudgets().subscribe({
      next: b => { this.budgets.set(b); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  openAddModal() {
    this.newCategoryId = '';
    this.newAmount = null;
    this.newPeriod = 'monthly';
    this.formError.set('');
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  submitBudget() {
    if (!this.newCategoryId || !this.newAmount) return;
    this.saving.set(true);
    this.formError.set('');
    this.ledgerService.createBudget({
      category_id: this.newCategoryId,
      amount: this.newAmount,
      period: this.newPeriod,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAddModal();
        this.toast.success('Budget created');
        this.loadBudgets();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(this.reason(err, 'The budget could not be saved. Please try again.'));
      },
    });
  }

  openEdit(b: BudgetWithSpend) {
    this.editAmount = b.amount;
    this.editPeriod = b.period;
    this.formError.set('');
    this.editing.set(b);
  }

  closeEdit() {
    this.editing.set(null);
  }

  submitEdit(b: BudgetWithSpend) {
    if (!this.editAmount || this.editAmount <= 0) return;
    this.saving.set(true);
    this.formError.set('');
    this.ledgerService.updateBudget(b.id, { amount: this.editAmount, period: this.editPeriod }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeEdit();
        this.toast.success('Budget saved');
        this.loadBudgets();
      },
      error: err => {
        this.saving.set(false);
        this.formError.set(this.reason(err, 'The budget could not be saved. Please try again.'));
      },
    });
  }

  onCategoryCreated(created: LedgerCategory) {
    this.showCatDialog.set(false);
    this.loadCategories();
    if (created.type === 'expense') this.newCategoryId = created.id;
  }

  /** Budget amounts through the shared formatter: separators and one currency. */
  money(value: number): string {
    return formatCurrency(value, this.settings.currency());
  }

  /** "month" / "week" / "year", for the "of $400 this month" line. */
  periodWord(period: string): string {
    const map: Record<string, string> = { monthly: 'month', weekly: 'week', yearly: 'year' };
    return map[period] ?? period;
  }

  async deleteBudget(budget: BudgetWithSpend) {
    const ok = await this.confirmService.confirm({
      title: `Delete the ${budget.category_name} budget?`,
      message: 'The spending limit is removed. Your transaction history is not affected.',
      confirmLabel: 'Delete budget',
      danger: true,
    });
    if (!ok) return;
    this.ledgerService.deleteBudget(budget.id).subscribe({
      next: () => {
        this.budgets.update(list => list.filter(b => b.id !== budget.id));
        this.toast.success('Budget deleted');
      },
      error: () => this.toast.error('Could not delete the budget.'),
    });
  }

}
