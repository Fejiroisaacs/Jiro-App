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
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { LedgerTransactionFormComponent, TransactionPayload } from '../shared/transaction-form/ledger-transaction-form';
import { formatCurrency, formatSignedCurrency, formatDate, formatPct, clamp, hexWithAlpha } from '../shared/ledger-utils';

@Component({
  selector: 'app-ledger-hub',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    JiroButtonComponent,
    JiroModalComponent,
    JiroIconComponent,
    JiroPageHeaderComponent,
    JiroEmptyStateComponent,
    LedgerTransactionFormComponent,
  ],
  template: `
    <div class="ledger-hub">

      <!-- ── Page Header ── -->
      <jiro-page-header heading="Ledger" [subtitle]="currentMonthLabel + ' overview'">
        <jiro-button actions type="button" (click)="openAddTransaction()">
          <jiro-icon name="plus" [size]="14" />
          Log transaction
        </jiro-button>
      </jiro-page-header>

      <!-- ── Loading ── -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- ── No Accounts Empty State ── -->
      @if (!loading() && accounts().length === 0) {
        <jiro-empty-state
          icon="bank"
          heading="No accounts yet"
          message="Add your first account to start tracking your finances.">
          <jiro-button type="button" (click)="router.navigate(['/ledger/accounts'])">
            Add your first account
          </jiro-button>
        </jiro-empty-state>
      }

      <!-- ── Main content (accounts exist) ── -->
      @if (!loading() && accounts().length > 0) {


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
            @if (budgets().length === 0) {
<div class="mini-empty">
              <jiro-empty-state compact heading="No budgets yet" message="Set a limit on a category to track it here.">
                <jiro-button size="sm" variant="secondary" routerLink="/ledger/budgets">Create a budget</jiro-button>
              </jiro-empty-state>
            </div>
}

            <!-- Budgets grid (desktop) / horizontal scroll (mobile) -->
            @if (budgets().length > 0) {
<div class="budgets-grid">
              @for (b of budgets(); track b) {
<div class="budget-card">
                <div class="budget-card-top">
                  <span class="budget-cat-dot" [style.background]="b.category_color || 'var(--text-muted)'"></span>
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
}
            </div>
}
          </div>

          <!-- Right: Recent Transactions -->
          <div class="hub-right">
            <div class="section-header">
              <h2 class="section-title">Recent Transactions</h2>
              <a routerLink="/ledger/transactions" class="section-link">All →</a>
            </div>

            <!-- Transactions empty -->
            @if (transactions().length === 0) {
<div class="mini-empty">
              <jiro-empty-state compact heading="Nothing logged this month" message="Your recent transactions show up here.">
                <jiro-button size="sm" variant="secondary" type="button" (click)="openAddTransaction()">Log a transaction</jiro-button>
              </jiro-empty-state>
            </div>
}

            <!-- Transactions list -->
            @if (transactions().length > 0) {
<div class="txn-list">
              @for (t of transactions(); track t) {
<div class="txn-row">
                <div class="txn-left">
                  <span class="txn-desc">{{ t.description || 'Untitled' }}</span>
                  @if (t.category_name) {
<span class="cat-chip" [style.background]="hexWithAlpha(t.category_color, 0.12)" [style.color]="t.category_color || 'var(--text-muted)'">
                    {{ t.category_name }}
                  </span>
}
                </div>
                <div class="txn-right">
                  <span class="txn-amount" [class.amount-pos]="t.type === 'income'" [class.amount-neg]="t.type === 'expense'">
                    {{ formatSignedCurrency(t.amount, 'USD', t.type === 'transfer' ? 'never' : 'exceptZero') }}
                  </span>
                  <span class="txn-date text-muted">{{ formatDate(t.date) }}</span>
                </div>
              </div>
}
            </div>
}
          </div>

        </div>
      
}

      <!-- ── Add Transaction Modal ── -->
      @if (showTxnModal()) {
<jiro-modal title="Log Transaction" maxWidth="520px" (close)="closeAddTransaction()">
        <ledger-transaction-form
          [accounts]="accounts()"
          [saving]="txnSaving()"
          [error]="txnError()"
          submitLabel="Log Transaction"
          (formSubmit)="onTxnSubmit($event)"
          (formCancel)="closeAddTransaction()">
        </ledger-transaction-form>
      </jiro-modal>
}

    </div>
  `,
  styles: [`
    :host { display: block; }

    .ledger-hub { max-width: 1100px; width: 100%; }

    /* ── Header ── */


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
    .pct-warn { color: var(--color-warning); }
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
    .bar-warn { background: var(--color-warning); }
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




    /* ── Spinner ── */
    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }


    /* ── FAB ── */


    /* ── Responsive ── */
    @media (max-width: 768px) {

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

    }

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
  readonly formatSignedCurrency = formatSignedCurrency;
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
