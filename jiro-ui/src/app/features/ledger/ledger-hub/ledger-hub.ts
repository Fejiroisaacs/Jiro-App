import { Component, OnInit, computed, inject, signal } from '@angular/core';
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
import { formatCurrency, formatSignedCurrency, formatDate, formatPct, clamp, hexWithAlpha, parseDateOnly } from '../shared/ledger-utils';
import { SettingsService } from '../../../core/services/settings.service';
import { ToastService } from '../../../core/services/toast.service';
import { todayKey } from '../../../core/utils/day';

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
      <jiro-page-header heading="Ledger" [subtitle]="currentMonthLabel() + ' overview'">
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
        <section class="summary-bar" [attr.aria-label]="currentMonthLabel() + ' summary'">
          <div class="summary-item">
            <span class="summary-label">Income</span>
            <span class="summary-value income">{{ money(summary()?.income ?? 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Expenses</span>
            <span class="summary-value expense">{{ money(summary()?.expenses ?? 0) }}</span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Net</span>
            <span class="summary-value" [class.income]="(summary()?.net ?? 0) >= 0" [class.expense]="(summary()?.net ?? 0) < 0">
              {{ money(summary()?.net ?? 0) }}
            </span>
          </div>
          <div class="summary-item">
            <span class="summary-label">Savings rate</span>
            <span class="summary-value savings">{{ formatPct(summary()?.savings_rate ?? 0) }}</span>
          </div>
        </section>

        <!-- ── Two-column body ── -->
        <div class="hub-body">

          <!-- Left: Budgets -->
          <div class="hub-left">
            <div class="section-header">
              <h2 class="section-title">Budgets</h2>
              <a routerLink="/ledger/budgets" class="section-link">Manage budgets</a>
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
              @for (b of budgets(); track b.id) {
<div class="budget-card">
                <div class="budget-card-top">
                  <span class="budget-cat-dot" aria-hidden="true" [style.background]="b.category_color || 'var(--text-muted)'"></span>
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
                  <span class="text-secondary">{{ money(b.spent) }} spent</span>
                  <span class="text-muted">of {{ money(b.amount) }}</span>
                </div>
              </div>
}
            </div>
}
          </div>

          <!-- Right: Recent Transactions -->
          <div class="hub-right">
            <div class="section-header">
              <h2 class="section-title">Recent transactions</h2>
              <a routerLink="/ledger/transactions" class="section-link">All transactions</a>
            </div>

            <!-- Transactions empty -->
            @if (transactions().length === 0) {
<div class="mini-empty">
              <jiro-empty-state compact heading="No transactions yet" message="Your ten latest transactions show up here.">
                <jiro-button size="sm" variant="secondary" type="button" (click)="openAddTransaction()">Log a transaction</jiro-button>
              </jiro-empty-state>
            </div>
}

            <!-- Transactions list -->
            @if (transactions().length > 0) {
<ul class="txn-list">
              @for (t of transactions(); track t.id) {
                <li>
                  <!-- Opens the transaction in the full list, ready to edit. -->
                  <a class="txn-row" routerLink="/ledger/transactions" [queryParams]="{ tx: t.id }">
                    <span class="txn-left">
                      <span class="txn-desc">{{ t.description || 'Untitled' }}</span>
                      @if (t.type === 'transfer') {
                        <span class="txn-sub">{{ transferLabel(t) }}</span>
                      } @else if (t.category_name) {
                        <span class="cat-chip" [style.background]="hexWithAlpha(t.category_color, 0.12)" [style.color]="t.category_color || 'var(--text-muted)'">
                          {{ t.category_name }}
                        </span>
                      }
                    </span>
                    <span class="txn-right">
                      <span class="txn-amount" [class.amount-pos]="t.type === 'income'" [class.amount-neg]="t.type === 'expense'">
                        {{ signed(t) }}
                      </span>
                      <span class="txn-date text-muted">{{ formatDate(t.date) }}</span>
                    </span>
                  </a>
                </li>
              }
            </ul>
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
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg) var(--space-md);
      margin-bottom: var(--space-xl);
      box-shadow: var(--shadow-sm);
    }

    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-xs);
      min-width: 0;
      padding: 0 var(--space-md);
      text-align: center;
    }

    .summary-item + .summary-item { border-left: 1px solid var(--border-color); }

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
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .summary-value.income { color: var(--color-accent); }

    .summary-value.expense { color: var(--color-danger); }

    .summary-value.savings { color: var(--color-primary); }


    /* ── Hub body ── */
    .hub-body {
      display: grid;
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      gap: var(--space-xl);
      align-items: start;
    }

    .hub-left, .hub-right { min-width: 0; }

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
      list-style: none;
      margin: 0;
      padding: 0;
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
      color: inherit;
      text-decoration: none;
      min-height: 56px;
    }

    .txn-list li + li .txn-row { border-top: 1px solid var(--border-color); }
    .txn-row:hover { background: var(--bg-canvas); }
    .txn-row:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }

    .txn-sub {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

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
      max-width: 100%;
      width: max-content;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
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

      /* Two by two on a phone, so every figure has room. */
      .summary-bar {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        row-gap: var(--space-md);
        padding: var(--space-md) var(--space-sm);
        margin-bottom: var(--space-lg);
      }
      .summary-item + .summary-item { border-left: none; }
      .summary-item:nth-child(even) { border-left: 1px solid var(--border-color); }

      .summary-value { font-size: var(--font-size-lg); }

      .hub-body {
        grid-template-columns: minmax(0, 1fr);
        gap: var(--space-lg);
      }

      .budgets-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }

      .txn-row { padding: var(--space-sm) var(--space-md); }

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

  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);

  /** This month in the user's timezone (settings), as YYYY-MM: the API's summary month. */
  readonly currentMonth = computed(() => todayKey(this.settings.timezone()).slice(0, 7));
  readonly currentMonthLabel = computed(() =>
    parseDateOnly(this.currentMonth() + '-01').toLocaleString('en-US', { month: 'long', year: 'numeric' }));

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

    this.ledgerService.getSummary(this.currentMonth()).subscribe({
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
        this.toast.success('Transaction logged');
        this.loadAll();
      },
      error: err => {
        this.txnSaving.set(false);
        this.txnError.set(err?.error?.error?.message ?? 'Failed to save transaction. Please try again.');
      },
    });
  }

  money(v: number): string {
    return formatCurrency(v, this.settings.currency());
  }

  signed(t: LedgerTransaction): string {
    return formatSignedCurrency(t.amount, this.settings.currency(), t.type === 'transfer' ? 'never' : 'exceptZero');
  }

  /** "Checking → Savings": a transfer is listed once, with its direction. */
  transferLabel(t: LedgerTransaction): string {
    const name = (id: string | null) => this.accounts().find(a => a.id === id)?.name;
    return `${name(t.account_id) ?? 'Unknown account'} → ${name(t.transfer_to_account_id) ?? 'a deleted account'}`;
  }
}
