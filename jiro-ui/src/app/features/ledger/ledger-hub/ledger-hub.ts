import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  LedgerService,
  LedgerAccount,
  LedgerTransaction,
  LedgerSummary,
  BudgetWithSpend,
} from '../../../core/services/ledger.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { LedgerQuickNavComponent } from '../ledger-quick-nav/ledger-quick-nav';
import { LedgerTransactionFormComponent, TransactionPayload } from '../shared/transaction-form/ledger-transaction-form';
import { formatCurrency, formatDate, formatPct, clamp, hexWithAlpha } from '../shared/ledger-utils';

@Component({
  selector: 'app-ledger-hub',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JiroButtonComponent,
    JiroModalComponent,
    LedgerQuickNavComponent,
    LedgerTransactionFormComponent,
  ],
  template: `
    <div class="ledger-hub">

      <!-- ── Page Header ── -->
      <div class="page-header">
        <div>
          <h1>Ledger</h1>
          <p class="text-secondary">{{ currentMonthLabel }} overview</p>
        </div>
        <div class="header-actions">
          <jiro-button variant="primary" type="button" (click)="openAddTransaction()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Log Transaction
          </jiro-button>
        </div>
      </div>

      <ledger-quick-nav />

      <!-- ── Loading ── -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p class="text-secondary">Loading your finances...</p>
      </div>

      <!-- ── No Accounts Empty State ── -->
      <div *ngIf="!loading() && accounts().length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
          </svg>
        </div>
        <h3>No accounts yet</h3>
        <p class="text-secondary">Add your first account to start tracking your finances.</p>
        <div class="empty-action">
          <jiro-button variant="primary" type="button" (click)="router.navigate(['/ledger/accounts'])">
            Add your first account
          </jiro-button>
        </div>
      </div>

      <!-- ── Main content (accounts exist) ── -->
      <ng-container *ngIf="!loading() && accounts().length > 0">

        <!-- Monthly Summary Bar -->
        <div class="summary-bar">
          <div class="summary-item">
            <span class="summary-label">Income</span>
            <span class="summary-value income">{{ formatCurrency(summary()?.income ?? 0) }}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Expenses</span>
            <span class="summary-value expense">{{ formatCurrency(summary()?.expenses ?? 0) }}</span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Net</span>
            <span class="summary-value" [class.income]="(summary()?.net ?? 0) >= 0" [class.expense]="(summary()?.net ?? 0) < 0">
              {{ formatCurrency(summary()?.net ?? 0) }}
            </span>
          </div>
          <div class="summary-divider"></div>
          <div class="summary-item">
            <span class="summary-label">Savings Rate</span>
            <span class="summary-value savings">{{ formatPct(summary()?.savings_rate ?? 0) }}</span>
          </div>
        </div>

        <!-- ── Two-column body ── -->
        <div class="hub-body">

          <!-- Left: Budgets -->
          <div class="hub-left">
            <div class="section-header">
              <h2 class="section-title">Budgets</h2>
              <a routerLink="/ledger/budgets" class="section-link">Manage →</a>
            </div>

            <!-- Budgets empty -->
            <div *ngIf="budgets().length === 0" class="mini-empty">
              <p class="text-secondary">No budgets set up yet.</p>
              <a routerLink="/ledger/budgets" class="section-link">Create budget →</a>
            </div>

            <!-- Budgets grid (desktop) / horizontal scroll (mobile) -->
            <div *ngIf="budgets().length > 0" class="budgets-grid">
              <div *ngFor="let b of budgets()" class="budget-card">
                <div class="budget-card-top">
                  <span class="budget-cat-dot" [style.background]="b.category_color || '#9B8F88'"></span>
                  <span class="budget-cat-name">{{ b.category_name }}</span>
                  <span class="budget-pct" [class.pct-ok]="b.pct_used < 80" [class.pct-warn]="b.pct_used >= 80 && b.pct_used < 100" [class.pct-over]="b.pct_used >= 100">
                    {{ b.pct_used | number:'1.0-0' }}%
                  </span>
                </div>
                <div class="budget-bar-track">
                  <div class="budget-bar-fill"
                    [style.width.%]="clamp(b.pct_used, 0, 100)"
                    [class.bar-ok]="b.pct_used < 80"
                    [class.bar-warn]="b.pct_used >= 80 && b.pct_used < 100"
                    [class.bar-over]="b.pct_used >= 100">
                  </div>
                </div>
                <div class="budget-amounts">
                  <span class="text-secondary">{{ formatCurrency(b.spent) }} spent</span>
                  <span class="text-muted">of {{ formatCurrency(b.amount) }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Right: Recent Transactions -->
          <div class="hub-right">
            <div class="section-header">
              <h2 class="section-title">Recent Transactions</h2>
              <a routerLink="/ledger/transactions" class="section-link">All →</a>
            </div>

            <!-- Transactions empty -->
            <div *ngIf="transactions().length === 0" class="mini-empty">
              <p class="text-secondary">No transactions this month.</p>
            </div>

            <!-- Transactions list -->
            <div *ngIf="transactions().length > 0" class="txn-list">
              <div *ngFor="let t of transactions()" class="txn-row">
                <div class="txn-left">
                  <span class="txn-desc">{{ t.description || 'Untitled' }}</span>
                  <span *ngIf="t.category_name" class="cat-chip" [style.background]="hexWithAlpha(t.category_color, 0.12)" [style.color]="t.category_color || 'var(--text-muted)'">
                    {{ t.category_name }}
                  </span>
                </div>
                <div class="txn-right">
                  <span class="txn-amount" [class.amount-pos]="t.type === 'income'" [class.amount-neg]="t.type === 'expense'">
                    {{ t.type === 'expense' ? '-' : '+' }}{{ formatCurrency(t.amount) }}
                  </span>
                  <span class="txn-date text-muted">{{ formatDate(t.date) }}</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </ng-container>

      <!-- ── FAB (mobile only) ── -->
      <button class="fab" (click)="openAddTransaction()" aria-label="Log transaction">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      </button>

      <!-- ── Add Transaction Modal ── -->
      <jiro-modal *ngIf="showTxnModal()" title="Log Transaction" maxWidth="520px" (close)="closeAddTransaction()">
        <ledger-transaction-form
          [accounts]="accounts()"
          [saving]="txnSaving()"
          [error]="txnError()"
          submitLabel="Log Transaction"
          (formSubmit)="onTxnSubmit($event)"
          (formCancel)="closeAddTransaction()">
        </ledger-transaction-form>
      </jiro-modal>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .ledger-hub { max-width: 1100px; width: 100%; }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions { display: flex; gap: var(--space-sm); flex-shrink: 0; align-items: center; }

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    /* ── Summary Bar ── */
    .summary-bar {
      display: flex;
      align-items: center;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg) var(--space-xl);
      margin-bottom: var(--space-xl);
      gap: 0;
      box-shadow: var(--shadow-sm);
      overflow-x: auto;
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-xs);
      flex: 1;
      min-width: 100px;
      padding: 0 var(--space-md);
    }

    .summary-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
      white-space: nowrap;
    }

    .summary-value {
      font-size: var(--font-size-xl);
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }

    .summary-value.income { color: var(--color-accent); }

    .summary-value.expense { color: var(--color-danger); }

    .summary-value.savings { color: var(--color-primary); }

    .summary-divider {
      width: 1px;
      height: 40px;
      background: var(--border-color);
      flex-shrink: 0;
    }

    /* ── Hub body ── */
    .hub-body {
      display: grid;
      grid-template-columns: 60% 1fr;
      gap: var(--space-xl);
      align-items: start;
    }

    /* ── Section header ── */
    .section-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: var(--space-md);
    }

    .section-title {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-secondary);
    }

    .section-link {
      font-size: var(--font-size-sm);
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 500;
      transition: opacity 0.15s;
    }

    .section-link:hover { opacity: 0.75; }

    /* ── Budget cards ── */
    .budgets-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-md);
    }

    .budget-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .budget-card-top {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .budget-cat-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .budget-cat-name {
      font-size: var(--font-size-sm);
      font-weight: 600;
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .budget-pct {
      font-size: var(--font-size-xs);
      font-weight: 700;
      white-space: nowrap;
    }

    .pct-ok { color: var(--color-accent); }
    .pct-warn { color: #F59E0B; }
    .pct-over { color: var(--color-danger); }

    .budget-bar-track {
      height: 6px;
      background: var(--bg-canvas);
      border-radius: 3px;
      overflow: hidden;
    }

    .budget-bar-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
      min-width: 2px;
    }

    .bar-ok { background: var(--color-accent); }
    .bar-warn { background: #F59E0B; }
    .bar-over { background: var(--color-danger); }

    .budget-amounts {
      display: flex;
      justify-content: space-between;
      font-size: var(--font-size-xs);
      gap: var(--space-xs);
    }

    /* ── Transactions list ── */
    .txn-list {
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      overflow: hidden;
      box-shadow: var(--shadow-sm);
    }

    .txn-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
    }

    .txn-row:last-child { border-bottom: none; }

    .txn-left {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
      flex: 1;
    }

    .txn-desc {
      font-size: var(--font-size-sm);
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .cat-chip {
      display: inline-block;
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      width: max-content;
    }

    .txn-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
    }

    .txn-amount {
      font-size: var(--font-size-sm);
      font-weight: 700;
      white-space: nowrap;
    }

    .amount-pos { color: var(--color-accent); }
    .amount-neg { color: var(--color-danger); }

    .txn-date {
      font-size: var(--font-size-xs);
    }

    /* ── Mini empty ── */
    .mini-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-xl) var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      text-align: center;
    }

    /* ── Empty state (no accounts) ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-2xl) var(--space-lg);
      text-align: center;
    }

    .empty-icon {
      color: var(--text-muted);
      opacity: 0.5;
    }

    .empty-state h3 { font-size: var(--font-size-xl); font-weight: 600; }

    .empty-action ::ng-deep .jiro-btn { width: auto; }

    /* ── Spinner ── */
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
      width: 40px;
      height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* ── FAB ── */
    .fab {
      display: none;
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: var(--color-primary);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 4px 4px 0px rgba(92,64,51,0.25);
      align-items: center;
      justify-content: center;
      z-index: 100;
      transition: all 0.2s;
    }

    .fab:active { transform: translate(2px, 2px); box-shadow: 2px 2px 0 rgba(92,64,51,0.25); }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .page-header { flex-direction: column; }
      .header-actions { display: none; }

      .summary-bar {
        padding: var(--space-md) var(--space-lg);
        margin-bottom: var(--space-lg);
      }

      .summary-value { font-size: var(--font-size-lg); }

      .hub-body {
        grid-template-columns: 1fr;
        gap: var(--space-lg);
      }

      /* Mobile budgets: horizontal scroll */
      .budgets-grid {
        display: flex;
        overflow-x: auto;
        gap: 12px;
        padding-bottom: var(--space-sm);
        scrollbar-width: none;
      }

      .budgets-grid::-webkit-scrollbar { display: none; }

      .budget-card {
        min-width: 180px;
        flex-shrink: 0;
      }

      .fab { display: flex; }
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class LedgerHubComponent implements OnInit {
  accounts = signal<LedgerAccount[]>([]);
  summary = signal<LedgerSummary | null>(null);
  budgets = signal<BudgetWithSpend[]>([]);
  transactions = signal<LedgerTransaction[]>([]);
  loading = signal(true);

  showTxnModal = signal(false);
  txnSaving = signal(false);
  txnError = signal('');

  readonly currentMonth = new Date().toISOString().slice(0, 7);
  readonly currentMonthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly formatPct = formatPct;
  readonly clamp = clamp;
  readonly hexWithAlpha = hexWithAlpha;

  constructor(private ledgerService: LedgerService, public router: Router) {}

  ngOnInit() {
    this.loadAll();
  }

  private loadAll() {
    this.loading.set(true);

    this.ledgerService.listAccounts().subscribe({
      next: (data) => {
        this.accounts.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });

    this.ledgerService.getSummary(this.currentMonth).subscribe({
      next: (data) => this.summary.set(data),
      error: () => {},
    });

    this.ledgerService.listBudgets().subscribe({
      next: (data) => this.budgets.set(data),
      error: () => {},
    });

    this.ledgerService.listTransactions({ limit: 10, page: 1 }).subscribe({
      next: (data) => this.transactions.set(data),
      error: () => {},
    });
  }

  openAddTransaction() {
    this.txnError.set('');
    this.showTxnModal.set(true);
  }

  closeAddTransaction() {
    this.showTxnModal.set(false);
    this.txnError.set('');
  }

  onTxnSubmit(payload: TransactionPayload) {
    this.txnSaving.set(true);
    this.txnError.set('');
    this.ledgerService.createTransaction(payload).subscribe({
      next: () => {
        this.txnSaving.set(false);
        this.showTxnModal.set(false);
        this.loadAll();
      },
      error: () => {
        this.txnSaving.set(false);
        this.txnError.set('Failed to save transaction. Please try again.');
      },
    });
  }
}
