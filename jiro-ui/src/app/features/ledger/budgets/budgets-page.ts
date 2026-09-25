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
import { todayKey } from '../../../core/utils/day';
import { periodLabel, clamp, formatCurrency } from '../shared/ledger-utils';

@Component({
  selector: 'app-budgets-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent,
    JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent,
  ],
  template: `
    <div class="budgets-page">

      <!-- Header -->
      <jiro-page-header heading="Budgets" subtitle="Track your spending against limits">
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
<div class="summary-bar">
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
      </div>
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
        @for (budget of budgets(); track budget) {
<jiro-card class="budget-card">

          <!-- Card header -->
          <div class="budget-header">
            <div class="category-info">
              <span
                class="color-dot"
                [style.background]="budget.category_color || 'var(--text-muted)'">
              </span>
              <span class="category-name">{{ budget.category_name }}</span>
            </div>
            <span class="period-badge">{{ periodLabel(budget.period) }}</span>
          </div>

          <!-- Progress bar -->
          <div class="progress-section">
            <div class="progress-track">
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Over budget by {{ money(-budget.remaining) }}
            </span>
}
            <button class="delete-btn" type="button" (click)="deleteBudget(budget)" title="Delete budget"
              [attr.aria-label]="'Delete the ' + budget.category_name + ' budget'">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
              </svg>
            </button>
          </div>

        </jiro-card>
}
      </div>
}

      <!-- Add Budget Modal -->
      @if (showAddModal()) {
<jiro-modal title="Add Budget" maxWidth="480px" (close)="closeAddModal()">
        <form class="modal-form" (ngSubmit)="submitBudget()">

          <div class="form-group">
            <div class="label-row">
              <label class="form-label">Category</label>
              <button type="button" class="new-cat-btn" (click)="openCatModal()">+ New</button>
            </div>
            <select class="form-input" [(ngModel)]="newCategoryId" name="category" required>
              <option value="" disabled>Select a category...</option>
              @for (cat of expenseCategories(); track cat) {

                <option [value]="cat.id">{{ cat.name }}</option>
                @for (child of cat.children; track child) {
<option [value]="child.id">
                  &nbsp;&nbsp;{{ child.name }}
                </option>
}
              
}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Limit ($)</label>
            <input
              class="form-input"
              type="number"
              [(ngModel)]="newAmount"
              name="amount"
              min="0.01"
              step="0.01"
              placeholder="e.g. 500.00"
              required />
          </div>

          <div class="form-group">
            <label class="form-label">Period</label>
            <select class="form-input" [(ngModel)]="newPeriod" name="period">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Start Date</label>
            <input
              class="form-input"
              type="date"
              [(ngModel)]="newStartDate"
              name="startDate"
              required />
          </div>

          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeAddModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !newCategoryId || !newAmount">
              {{ saving() ? 'Saving...' : 'Create Budget' }}
            </jiro-button>
          </div>

        </form>
      </jiro-modal>
}

      <!-- New Category Modal -->
      @if (showCatModal()) {
<jiro-modal title="New Category" maxWidth="400px" (close)="closeCatModal()">
        <form class="modal-form" (ngSubmit)="submitCategory()">
          <div class="form-group">
            <label class="form-label">Name</label>
            <input class="form-input" type="text" [(ngModel)]="catForm.name" name="cat_name" placeholder="e.g. Groceries" required />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <div class="seg-group">
              <button type="button" class="seg-btn" [class.active]="catForm.type === 'expense'" (click)="catForm.type = 'expense'">Expense</button>
              <button type="button" class="seg-btn" [class.active]="catForm.type === 'income'" (click)="catForm.type = 'income'">Income</button>
            </div>
          </div>
          @if (catError()) {
<p class="form-error">{{ catError() }}</p>
}
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeCatModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="catSaving() || !catForm.name.trim()">
              {{ catSaving() ? 'Saving...' : 'Create' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>
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
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: var(--space-lg);
    }

    @media (max-width: 600px) {
      .budgets-grid { grid-template-columns: 1fr; }
    }

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
      justify-content: space-between;
      align-items: center;
    }

    .spent-label { font-size: var(--font-size-sm); color: var(--text-secondary); }

    .pct-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-accent);
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

    /* ── Delete button ── */
    .delete-btn {
      min-width: 40px; min-height: 40px;
      flex-shrink: 0;
      background: none;
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      cursor: pointer;
      width: 32px; height: 32px;
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
      position: relative;
    }

    .delete-btn:hover {
      color: var(--color-danger);
      border-color: rgba(var(--color-danger-rgb), 0.3);
      background: rgba(var(--color-danger-rgb), 0.05);
      box-shadow: 1px 1px 0 rgba(var(--color-danger-rgb), 0.2);
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
      padding: 0;
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

    /* ── Segmented control ── */
    .seg-group {
      display: flex;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }
    .seg-btn {
      flex: 1;
      padding: 9px 12px;
      border: none;
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .seg-btn + .seg-btn { border-left: 1px solid var(--border-color); }
    .seg-btn.active {
      background: var(--color-primary);
      color: var(--text-on-primary);
    }

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

  showCatModal = signal(false);
  catSaving = signal(false);
  catError = signal('');
  catForm = { name: '', type: 'expense' as 'expense' | 'income' };

  // Form fields
  newCategoryId = '';
  newAmount: number | null = null;
  newPeriod: 'monthly' | 'weekly' | 'yearly' = 'monthly';
  newStartDate = '';

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
    this.ledgerService.listCategories().subscribe({
      next: cats => this.categories.set(cats),
      error: () => {},
    });
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
    this.newStartDate = this.todayIso();
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  submitBudget() {
    if (!this.newCategoryId || !this.newAmount) return;
    this.saving.set(true);
    this.ledgerService.createBudget({
      category_id: this.newCategoryId,
      amount: this.newAmount,
      period: this.newPeriod,
      start_date: this.newStartDate,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeAddModal();
        this.loadBudgets();
      },
      error: () => this.saving.set(false),
    });
  }

  openCatModal() {
    this.catForm = { name: '', type: 'expense' };
    this.catError.set('');
    this.showCatModal.set(true);
  }

  closeCatModal() {
    this.showCatModal.set(false);
    this.catError.set('');
  }

  submitCategory() {
    if (!this.catForm.name.trim()) return;
    this.catSaving.set(true);
    this.catError.set('');
    this.ledgerService.createCategory({ name: this.catForm.name.trim(), type: this.catForm.type }).subscribe({
      next: (created) => {
        this.catSaving.set(false);
        this.showCatModal.set(false);
        this.ledgerService.listCategories().subscribe({
          next: cats => {
            this.categories.set(cats);
            if (this.catForm.type === 'expense') {
              this.newCategoryId = created.id;
            }
          },
          error: () => {},
        });
      },
      error: () => {
        this.catSaving.set(false);
        this.catError.set('Failed to create category. Please try again.');
      },
    });
  }

  /** Budget amounts through the shared formatter: separators and one currency. */
  money(value: number): string {
    return formatCurrency(value);
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

  private todayIso(): string {
    return todayKey(this.settings.timezone());
  }
}
