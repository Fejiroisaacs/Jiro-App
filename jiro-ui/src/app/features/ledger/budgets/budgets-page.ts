import { Component, OnInit, signal, computed } from '@angular/core';
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
import { LedgerQuickNavComponent } from '../ledger-quick-nav/ledger-quick-nav';
import { periodLabel, clamp } from '../shared/ledger-utils';

@Component({
  selector: 'app-budgets-page',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent, LedgerQuickNavComponent],
  template: `
    <div class="budgets-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Budgets</h1>
          <p class="text-secondary">Track your spending against limits</p>
        </div>
        <jiro-button variant="primary" type="button" (click)="openAddModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Budget
        </jiro-button>
      </div>

      <ledger-quick-nav />

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading budgets...</p>
      </div>

      <!-- Summary bar -->
      <div *ngIf="!loading() && budgets().length > 0" class="summary-bar">
        <div class="summary-item">
          <span class="summary-label">Total Budgeted</span>
          <span class="summary-value">\${{ totalBudgeted() | number:'1.2-2' }}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="summary-label">Total Spent</span>
          <span class="summary-value" [class.over]="totalSpent() > totalBudgeted()">\${{ totalSpent() | number:'1.2-2' }}</span>
        </div>
        <div class="summary-divider"></div>
        <div class="summary-item">
          <span class="summary-label">Remaining</span>
          <span class="summary-value" [class.over]="totalBudgeted() - totalSpent() < 0">
            \${{ (totalBudgeted() - totalSpent()) | number:'1.2-2' }}
          </span>
        </div>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading() && budgets().length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="2" y="7" width="20" height="14" rx="2"/>
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
            <line x1="12" y1="12" x2="12" y2="16"/>
            <line x1="10" y1="14" x2="14" y2="14"/>
          </svg>
        </div>
        <h3>No budgets yet</h3>
        <p class="text-secondary">Set limits on your spending categories to stay on track.</p>
        <jiro-button variant="primary" type="button" (click)="openAddModal()">
          Set your first budget
        </jiro-button>
      </div>

      <!-- Budget grid -->
      <div *ngIf="!loading() && budgets().length > 0" class="budgets-grid">
        <jiro-card *ngFor="let budget of budgets()" class="budget-card">

          <!-- Card header -->
          <div class="budget-header">
            <div class="category-info">
              <span
                class="color-dot"
                [style.background]="budget.category_color || '#9B8F88'">
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
              <span class="spent-label">\${{ budget.spent | number:'1.2-2' }} / \${{ budget.amount | number:'1.2-2' }}</span>
              <span class="pct-label" [class.warn]="budget.pct_used >= 80 && budget.pct_used < 100" [class.over]="budget.pct_used >= 100">
                {{ budget.pct_used | number:'1.0-0' }}% used
              </span>
            </div>
          </div>

          <!-- Remaining -->
          <div class="remaining-row">
            <span *ngIf="budget.remaining >= 0" class="remaining-ok">
              \${{ budget.remaining | number:'1.2-2' }} remaining
            </span>
            <span *ngIf="budget.remaining < 0" class="remaining-over">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Over budget by \${{ (-budget.remaining) | number:'1.2-2' }}
            </span>
            <button class="delete-btn" (click)="confirmDelete(budget)" title="Delete budget">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
              </svg>
            </button>
          </div>

        </jiro-card>
      </div>

      <!-- Add Budget Modal -->
      <jiro-modal *ngIf="showAddModal()" title="Add Budget" maxWidth="480px" (close)="closeAddModal()">
        <form class="modal-form" (ngSubmit)="submitBudget()">

          <div class="form-group">
            <div class="label-row">
              <label class="form-label">Category</label>
              <button type="button" class="new-cat-btn" (click)="openCatModal()">+ New</button>
            </div>
            <select class="form-input" [(ngModel)]="newCategoryId" name="category" required>
              <option value="" disabled>Select a category...</option>
              <ng-container *ngFor="let cat of expenseCategories()">
                <option [value]="cat.id">{{ cat.name }}</option>
                <option *ngFor="let child of cat.children" [value]="child.id">
                  &nbsp;&nbsp;{{ child.name }}
                </option>
              </ng-container>
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

      <!-- New Category Modal -->
      <jiro-modal *ngIf="showCatModal()" title="New Category" maxWidth="400px" (close)="closeCatModal()">
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
          <p *ngIf="catError()" class="form-error">{{ catError() }}</p>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeCatModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="catSaving() || !catForm.name.trim()">
              {{ catSaving() ? 'Saving...' : 'Create' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- Delete Confirmation Modal -->
      <jiro-modal *ngIf="deletingBudget()" title="Delete Budget?" maxWidth="420px" (close)="deletingBudget.set(null)">
        <div class="delete-confirm">
          <p>Delete the budget for <strong>{{ deletingBudget()!.category_name }}</strong>?</p>
          <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
            This will remove the spending limit. Your transaction history will not be affected.
          </p>
          <div class="form-actions" style="margin-top: var(--space-lg);">
            <jiro-button variant="secondary" type="button" (click)="deletingBudget.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="deleteBudget()">
              {{ deleting() ? 'Deleting...' : 'Delete' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .budgets-page { max-width: 1000px; width: 100%; }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .page-header ::ng-deep .jiro-btn { width: auto; }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
      .page-header ::ng-deep .jiro-btn { width: auto; }
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
    .state-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl);
      gap: var(--space-md);
      text-align: center;
    }

    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl) var(--space-lg);
      gap: var(--space-md);
      text-align: center;
      border: 1px dashed var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
    }

    .empty-icon {
      color: var(--text-muted);
      opacity: 0.5;
    }

    .empty-state h3 { font-size: var(--font-size-xl); font-weight: 600; color: var(--text-primary); }

    .empty-state ::ng-deep .jiro-btn { width: auto; margin-top: var(--space-xs); }

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
      background: #4A6741;
      border-radius: 4px;
      transition: width 0.4s ease;
    }

    .progress-fill.warn { background: #F59E0B; }
    .progress-fill.over { background: #C1582A; }

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

    .pct-label.warn { color: #F59E0B; }
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
      border-color: rgba(193,88,42,0.3);
      background: rgba(193,88,42,0.05);
      box-shadow: 1px 1px 0 rgba(193,88,42,0.2);
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
      outline: none;
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

    .form-actions ::ng-deep .jiro-btn { width: auto; }

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
      color: #fff;
    }

    /* ── Delete confirm ── */
    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-xs); }

    @keyframes spin { to { transform: rotate(360deg); } }
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
  deletingBudget = signal<BudgetWithSpend | null>(null);

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

  confirmDelete(budget: BudgetWithSpend) {
    this.deletingBudget.set(budget);
  }

  deleteBudget() {
    const budget = this.deletingBudget();
    if (!budget) return;
    this.deleting.set(true);
    this.ledgerService.deleteBudget(budget.id).subscribe({
      next: () => {
        this.budgets.update(list => list.filter(b => b.id !== budget.id));
        this.deletingBudget.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
