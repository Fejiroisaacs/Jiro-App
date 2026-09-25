import { Component, OnInit, inject, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import {
  LedgerService,
  LedgerAccount,
  AccountWithTransactions,
  LedgerTransaction,
} from '../../../core/services/ledger.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroMenuComponent, JiroMenuItem } from '../../../shared/components/jiro-menu/jiro-menu';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { SettingsService } from '../../../core/services/settings.service';
import { currencySymbol, formatCurrency, formatSignedCurrency, formatDate, hexWithAlpha, netWorthTotals } from '../shared/ledger-utils';

type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash';

@Component({
  selector: 'app-accounts-page',
  standalone: true,
  imports: [
    FormsModule,
    JiroCardComponent,
    JiroButtonComponent,
    JiroModalComponent,
    JiroIconComponent,
    JiroMenuComponent,
    JiroPageHeaderComponent,
    JiroEmptyStateComponent,
  ],
  template: `
    <div class="accounts-page">

      <!-- ── Header ── -->
      <jiro-page-header heading="Accounts" subtitle="Manage your financial accounts">
        <jiro-button actions type="button" (click)="openAddAccount()">
          <jiro-icon name="plus" [size]="14" />
          Add account
        </jiro-button>
      </jiro-page-header>

      <!-- ── Loading ── -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- ── Empty State ── -->
      @if (!loading() && accounts().length === 0) {
        <jiro-empty-state
          icon="bank"
          heading="No accounts yet"
          message="Add your first account to start tracking your finances and net worth.">
          <jiro-button type="button" (click)="openAddAccount()">Add your first account</jiro-button>
        </jiro-empty-state>
      }

      <!-- ── Accounts Grid ── -->
      @if (!loading() && accounts().length > 0) {


        <div class="accounts-grid">
          @for (account of accounts(); track account) {
<jiro-card>
            <div class="acct-card">

              <!-- Top row: icon + badge -->
              <div class="acct-top">
                <div class="acct-icon-wrap" [class]="'acct-type-' + account.type">
                  
@switch (account.type) {

                    <!-- Checking: bank -->
                    @case ('checking') {
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="3" y1="22" x2="21" y2="22"/>
                      <rect x="2" y="8" width="20" height="14"/>
                      <path d="M12 2L2 8h20L12 2z"/>
                      <rect x="9" y="12" width="2" height="6"/>
                      <rect x="13" y="12" width="2" height="6"/>
                    </svg>
}

                    <!-- Savings: piggy bank -->
                    @case ('savings') {
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M19 11c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8c1 0 2 .2 2.9.5"/>
                      <path d="M19 11h2l1 3-2 1"/>
                      <circle cx="9" cy="11" r="1" fill="currentColor"/>
                      <path d="M7 19v2M13 19v2"/>
                    </svg>
}

                    <!-- Credit: credit card -->
                    @case ('credit') {
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>
}

                    <!-- Investment: trending up -->
                    @case ('investment') {
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      <polyline points="17 6 23 6 23 12"/>
                    </svg>
}

                    <!-- Cash: banknotes -->
                    @default {
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="1" y="6" width="22" height="12" rx="2"/>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M5 12h.01M19 12h.01"/>
                    </svg>
}
                  }

                </div>

                <div class="acct-badges">
                  <span class="type-label">{{ formatAccountType(account.type) }}</span>
                  @if (!account.is_active) {
<span class="inactive-badge">Inactive</span>
}
                </div>
              </div>

              <!-- Name + Balance -->
              <div class="acct-body">
                <h2 class="acct-name">{{ account.name }}</h2>
                <div class="acct-balance-row">
                  <span class="acct-balance"
                    [class.balance-asset]="account.type !== 'credit'"
                    [class.balance-liability]="account.type === 'credit'">
                    {{ money(account.balance) }}
                  </span>
                </div>
              </div>

              <!-- Actions row -->
              <div class="acct-actions">
                <button
                  class="acct-disclosure"
                  type="button"
                  [attr.aria-expanded]="selectedAccountId() === account.id"
                  [attr.aria-controls]="'acct-panel-' + account.id"
                  (click)="toggleDetail(account)">
                  {{ selectedAccountId() === account.id ? 'Hide' : 'Recent transactions' }}
                  <jiro-icon [name]="selectedAccountId() === account.id ? 'caret-up' : 'caret-down'" [size]="14" />
                </button>
                <jiro-menu
                  [items]="rowActions"
                  [label]="'More actions for ' + account.name"
                  (select)="onRowAction(account, $event)" />
              </div>
            </div>

            <!-- ── Detail Panel (expanded) ── -->
            @if (selectedAccountId() === account.id) {
<div class="detail-panel" [id]="'acct-panel-' + account.id">
              <div class="detail-header">
                <span class="detail-title">Recent transactions</span>
              </div>
              @if (detailLoading()) {
<div class="detail-loading">
                <span class="spinner spinner--sm"></span>
              </div>
}
              @if (!detailLoading() && selectedAccountDetail()?.recent_transactions?.length === 0) {
<div class="detail-empty">
                <p class="text-muted">No transactions yet.</p>
              </div>
}
              @if (!detailLoading() && (selectedAccountDetail()?.recent_transactions?.length ?? 0) > 0) {
<div class="detail-txn-list">
                @for (t of selectedAccountDetail()!.recent_transactions; track t.id) {
<div class="detail-txn-row">
                  <div class="detail-txn-left">
                    <span class="detail-txn-desc">{{ t.description || 'Untitled' }}</span>
                    @if (t.type === 'transfer') {
                      <span class="detail-txn-sub">{{ transferLabel(t) }}</span>
                    } @else if (t.category_name) {
<span class="cat-chip"
                      [style.background]="hexWithAlpha(t.category_color, 0.12)"
                      [style.color]="t.category_color || 'var(--text-muted)'">
                      {{ t.category_name }}
                    </span>
}
                  </div>
                  <div class="detail-txn-right">
                    <!-- Signed for this account: a transfer out is minus, one in is plus. -->
                    <span class="detail-txn-amount"
                      [class.amount-pos]="t.type === 'income'"
                      [class.amount-neg]="t.type === 'expense'">
                      {{ signed(t.amount) }}
                    </span>
                    <span class="detail-txn-date text-muted">{{ formatDate(t.date) }}</span>
                  </div>
                </div>
}
              </div>
}
              <button class="acct-collapse" type="button" (click)="toggleDetail(account)">Collapse</button>
            </div>
}
          </jiro-card>
}
        </div>

        <!-- ── Net Worth Bar: every account, inactive too, at its signed balance ── -->
        <section class="net-worth-bar" aria-label="Net worth from your accounts">
          <div class="nw-item">
            <span class="nw-label">Assets</span>
            <span class="nw-value nw-asset">{{ money(totals().assets) }}</span>
          </div>
          <span class="nw-op" aria-hidden="true">-</span>
          <div class="nw-item">
            <span class="nw-label">Liabilities</span>
            <span class="nw-value nw-liability">{{ money(totals().liabilities) }}</span>
          </div>
          <span class="nw-op" aria-hidden="true">=</span>
          <div class="nw-item">
            <span class="nw-label">Net worth</span>
            <span class="nw-value"
              [class.nw-pos]="totals().net >= 0"
              [class.nw-neg]="totals().net < 0">
              {{ money(totals().net) }}
            </span>
          </div>
        </section>
        <p class="nw-note">Every account counts, inactive ones too: a positive balance is an asset, a negative one (such as a card you owe on) a liability. Take snapshot on Net worth uses the same totals.</p>

      
}

      <!-- ── Add Account Modal ── -->
      @if (showAddModal()) {
<jiro-modal title="Add Account" maxWidth="480px" (close)="closeAddModal()">
        <form class="modal-form" (ngSubmit)="submitAddAccount()">
          <div class="form-group">
            <label class="form-label" for="acct-add-name">Account name</label>
            <input
              id="acct-add-name"
              class="form-input"
              type="text"
              [(ngModel)]="addForm.name"
              name="name"
              placeholder="e.g. Chase Checking"
              required />
          </div>
          <div class="form-group">
            <label class="form-label" for="acct-add-type">Type</label>
            <select id="acct-add-type" class="form-input" [(ngModel)]="addForm.type" name="type" required>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="acct-add-balance">Opening balance ({{ symbol() }})</label>
            <input
              id="acct-add-balance"
              class="form-input"
              type="number"
              step="0.01"
              inputmode="decimal"
              aria-describedby="acct-add-balance-hint"
              [(ngModel)]="addForm.balance"
              name="balance"
              placeholder="0.00" />
            <p class="field-hint" id="acct-add-balance-hint">
              For a card or loan you owe on, enter a negative amount. Amounts are in {{ currency() }}, your currency in Settings.
            </p>
          </div>
          @if (addError()) {
<p class="form-error">{{ addError() }}</p>
}
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeAddModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="addSaving() || !addForm.name.trim()">
              {{ addSaving() ? 'Saving...' : 'Add Account' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>
}

      <!-- ── Edit Account Modal ── -->
      @if (showEditModal()) {
<jiro-modal title="Edit Account" maxWidth="480px" (close)="closeEditModal()">
        <form class="modal-form" (ngSubmit)="submitEditAccount()">
          <div class="form-group">
            <label class="form-label" for="acct-edit-name">Account name</label>
            <input
              id="acct-edit-name"
              class="form-input"
              type="text"
              [(ngModel)]="editForm.name"
              name="name"
              placeholder="Account name"
              required />
          </div>
          <div class="form-group">
            <label class="form-label" for="acct-edit-type">Type</label>
            <select id="acct-edit-type" class="form-input" [(ngModel)]="editForm.type" name="type">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div class="form-group">
            <div class="toggle-row">
              <span class="form-label" id="acct-edit-active">Active</span>
              <button
                type="button"
                class="toggle-btn"
                role="switch"
                aria-labelledby="acct-edit-active"
                aria-describedby="acct-edit-active-hint"
                [attr.aria-checked]="editForm.is_active"
                [class.toggle-on]="editForm.is_active"
                (click)="editForm.is_active = !editForm.is_active">
                <span class="toggle-knob"></span>
              </button>
            </div>
            <p class="field-hint" id="acct-edit-active-hint">An inactive account keeps its history and still counts toward net worth.</p>
          </div>
          @if (editError()) {
<p class="form-error">{{ editError() }}</p>
}
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeEditModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="editSaving() || !editForm.name.trim()">
              {{ editSaving() ? 'Saving...' : 'Save Changes' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>
}

    </div>
  `,
  styles: [`
    :host { display: block; }

    .accounts-page { max-width: 1100px; width: 100%; }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions { display: flex; gap: var(--space-sm); align-items: center; flex-shrink: 0; }


    /* ── Empty state ── */


    /* ── Loading ── */

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

    /* ── Accounts grid ── */
    .accounts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-lg);
      margin-bottom: var(--space-xl);
    }

    /* ── Account card ── */
    .acct-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

    .acct-top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
    }

    .acct-icon-wrap {
      width: 40px;
      height: 40px;
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .acct-type-checking  { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-accent); }
    .acct-type-savings   { background: rgba(var(--color-accent-rgb), 0.20); color: var(--color-accent); }
    .acct-type-credit    { background: rgba(var(--color-danger-rgb), 0.12);  color: var(--color-danger); }
    .acct-type-investment{ background: rgba(var(--color-primary-rgb), 0.12);  color: var(--color-primary); }
    .acct-type-cash      { background: rgba(var(--shadow-rgb), 0.12);  color: var(--text-secondary); }

    .acct-badges {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .type-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .inactive-badge {
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      background: rgba(var(--shadow-rgb), 0.15);
      color: var(--text-muted);
    }

    .acct-body {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .acct-name {
      font-size: var(--font-size-lg);
      font-weight: 600;
      overflow-wrap: anywhere;
    }

    .acct-balance-row {
      display: flex;
      align-items: baseline;
      gap: var(--space-xs);
    }

    .acct-balance {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      overflow-wrap: anywhere;
    }

    .balance-asset { color: var(--color-accent); }
    .balance-liability { color: var(--color-danger); }

    .field-hint { font-size: var(--font-size-xs); color: var(--text-muted); margin: 0; line-height: 1.5; }

    .nw-note { font-size: var(--font-size-xs); color: var(--text-muted); margin: var(--space-sm) 0 0; line-height: 1.5; }

    .detail-txn-sub {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Card action buttons ── */
    .acct-actions {
      display: flex;
      gap: var(--space-xs);
      justify-content: flex-end;
      margin-top: var(--space-xs);
      padding-top: var(--space-sm);
      border-top: 1px solid var(--border-color);
    }

    .acct-actions { align-items: center; justify-content: space-between; }

    .acct-disclosure {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-height: 40px;
      padding: 0 4px;
      border: none;
      background: none;
      color: var(--text-secondary);
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      border-radius: var(--border-radius-sm);
    }
    .acct-disclosure:hover { color: var(--color-primary); }

    .acct-collapse {
      display: block;
      width: 100%;
      min-height: 40px;
      margin-top: var(--space-sm);
      border: none;
      border-top: 1px solid var(--border-color);
      background: none;
      color: var(--text-muted);
      font: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
    .acct-collapse:hover { color: var(--color-primary); }


    /* ── Detail panel ── */
    .detail-panel {
      margin-top: var(--space-md);
      padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
    }

    .detail-header {
      margin-bottom: var(--space-sm);
    }

    .detail-title {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .detail-loading {
      display: flex;
      justify-content: center;
      padding: var(--space-lg);
    }

    .detail-empty {
      text-align: center;
      padding: var(--space-md);
    }

    .detail-txn-list {
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .detail-txn-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: var(--space-sm) 0;
      border-bottom: 1px solid var(--border-color);
    }

    .detail-txn-row:last-child { border-bottom: none; }

    .detail-txn-left {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }

    .detail-txn-desc {
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
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .detail-txn-right {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      flex-shrink: 0;
    }

    .detail-txn-amount {
      font-size: var(--font-size-sm);
      font-weight: 700;
    }

    .amount-pos { color: var(--color-accent); }
    .amount-neg { color: var(--color-danger); }

    .detail-txn-date { font-size: var(--font-size-xs); }

    /* ── Net worth bar ── */
    .net-worth-bar {
      display: flex;
      align-items: center;
      gap: var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg) var(--space-xl);
      box-shadow: var(--shadow-sm);
      flex-wrap: wrap;
    }

    .nw-item {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .nw-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    .nw-value {
      font-size: var(--font-size-xl);
      font-weight: 700;
    }

    .nw-asset { color: var(--color-accent); }
    .nw-liability { color: var(--color-danger); }
    .nw-pos { color: var(--color-accent); }
    .nw-neg { color: var(--color-danger); }

    .nw-op {
      font-size: var(--font-size-xl);
      color: var(--text-muted);
      font-weight: 300;
    }

    /* ── Modal form ── */
    .modal-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label {
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-secondary);
    }

    .form-input {
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
      box-sizing: border-box;
    }

    .form-input:focus {
      border-color: var(--color-primary);
      box-shadow: 2px 2px 0px var(--color-primary);
      transform: translate(-1px, -1px);
    }

    select.form-input { appearance: none; cursor: pointer; }

    /* ── Toggle ── */
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .toggle-btn {
      width: 44px;
      height: 24px;
      border-radius: 12px;
      background: var(--border-color);
      border: none;
      cursor: pointer;
      position: relative;
      transition: background 0.2s;
      padding: 0;
    }

    .toggle-btn.toggle-on { background: var(--color-accent); }

    .toggle-knob {
      position: absolute;
      top: 2px;
      left: 2px;
      width: 20px;
      height: 20px;
      background: var(--bg-surface);
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(var(--shadow-rgb), 0.2);
    }

    .toggle-btn.toggle-on .toggle-knob { transform: translateX(20px); }

    .form-error {
      font-size: var(--font-size-sm);
      color: var(--color-danger);
      margin: 0;
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      margin-top: var(--space-xs);
    }



    /* ── Responsive ── */
    @media (max-width: 768px) {

      .accounts-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .net-worth-bar {
        padding: var(--space-md) var(--space-lg);
        gap: var(--space-md);
      }

      .nw-value { font-size: var(--font-size-lg); }
    }

  `],
})
export class AccountsPageComponent implements OnInit {
  private readonly settings = inject(SettingsService);
  readonly currency = this.settings.currency;
  readonly symbol = computed(() => currencySymbol(this.settings.currency()));
  readonly formatDate = formatDate;
  readonly hexWithAlpha = hexWithAlpha;

  accounts = signal<LedgerAccount[]>([]);
  loading = signal(true);

  selectedAccountId = signal<string | null>(null);
  selectedAccountDetail = signal<AccountWithTransactions | null>(null);
  detailLoading = signal(false);

  /** Net worth from every account (inactive too) at its signed balance; the snapshot uses the same rule. */
  totals = computed(() => netWorthTotals(this.accounts()));

  // Add modal
  showAddModal = signal(false);
  addSaving = signal(false);
  addError = signal('');
  addForm: { name: string; type: AccountType; balance: number } = {
    name: '',
    type: 'checking',
    balance: 0,
  };

  // Edit modal
  showEditModal = signal(false);
  editSaving = signal(false);
  editError = signal('');
  editingAccountId = signal<string | null>(null);
  editForm: { name: string; type: AccountType; is_active: boolean } = {
    name: '',
    type: 'checking',
    is_active: true,
  };

  // Delete
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly rowActions: JiroMenuItem[] = [
    { id: 'edit', label: 'Edit', icon: 'pencil-simple' },
    { id: 'delete', label: 'Delete', icon: 'trash', danger: true },
  ];

  constructor(private ledgerService: LedgerService) {}

  ngOnInit() {
    this.loadAccounts();
  }

  private loadAccounts() {
    this.loading.set(true);
    this.ledgerService.listAccounts().subscribe({
      next: (data) => {
        this.accounts.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  toggleDetail(account: LedgerAccount) {
    if (this.selectedAccountId() === account.id) {
      this.selectedAccountId.set(null);
      this.selectedAccountDetail.set(null);
      return;
    }
    this.selectedAccountId.set(account.id);
    this.selectedAccountDetail.set(null);
    this.detailLoading.set(true);
    this.ledgerService.getAccount(account.id).subscribe({
      next: (detail) => {
        this.selectedAccountDetail.set(detail);
        this.detailLoading.set(false);
      },
      error: () => this.detailLoading.set(false),
    });
  }

  // ── Add ──
  openAddAccount() {
    this.addForm = { name: '', type: 'checking', balance: 0 };
    this.addError.set('');
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
    this.addError.set('');
  }

  submitAddAccount() {
    if (!this.addForm.name.trim()) return;
    this.addSaving.set(true);
    this.addError.set('');
    this.ledgerService
      .createAccount({
        name: this.addForm.name.trim(),
        type: this.addForm.type,
        balance: this.addForm.balance ?? 0,
      })
      .subscribe({
        next: () => {
          this.addSaving.set(false);
          this.showAddModal.set(false);
          this.loadAccounts();
        },
        error: (err) => {
          this.addSaving.set(false);
          this.addError.set(err?.error?.error?.message ?? 'Failed to create account. Please try again.');
        },
      });
  }

  // ── Edit ──
  openEditAccount(account: LedgerAccount) {
    this.editingAccountId.set(account.id);
    this.editForm = {
      name: account.name,
      type: account.type,
      is_active: account.is_active,
    };
    this.editError.set('');
    this.showEditModal.set(true);
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editError.set('');
    this.editingAccountId.set(null);
  }

  submitEditAccount() {
    const id = this.editingAccountId();
    if (!id || !this.editForm.name.trim()) return;
    this.editSaving.set(true);
    this.editError.set('');
    this.ledgerService
      .updateAccount(id, {
        name: this.editForm.name.trim(),
        type: this.editForm.type,
        is_active: this.editForm.is_active,
      })
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.showEditModal.set(false);
          this.editingAccountId.set(null);
          this.loadAccounts();
        },
        error: (err) => {
          this.editSaving.set(false);
          this.editError.set(err?.error?.error?.message ?? 'Failed to update account. Please try again.');
        },
      });
  }

  // ── Row menu ──
  onRowAction(account: LedgerAccount, action: string) {
    if (action === 'edit') this.openEditAccount(account);
    else if (action === 'delete') this.deleteAccount(account);
  }

  // ── Delete ──
  async deleteAccount(account: LedgerAccount) {
    const ok = await this.confirmService.confirm({
      title: `Delete ${account.name}?`,
      message: 'An account with transactions linked to it cannot be deleted. Move or remove them first.',
      confirmLabel: 'Delete account',
      danger: true,
    });
    if (!ok) return;
    this.ledgerService.deleteAccount(account.id).subscribe({
      next: () => {
        if (this.selectedAccountId() === account.id) {
          this.selectedAccountId.set(null);
          this.selectedAccountDetail.set(null);
        }
        this.loadAccounts();
        this.toast.success(`${account.name} deleted`);
      },
      error: () => {
        this.toast.error('Could not delete the account. It may still have transactions linked to it.');
      },
    });
  }

  money(v: number): string {
    return formatCurrency(v, this.settings.currency());
  }

  signed(v: number): string {
    return formatSignedCurrency(v, this.settings.currency());
  }

  /** From this account's side: "To Savings" for money out, "From Checking" for money in. */
  transferLabel(t: LedgerTransaction): string {
    const other = this.accounts().find(a => a.id === t.transfer_to_account_id)?.name ?? 'a deleted account';
    return t.amount < 0 ? `Transfer to ${other}` : `Transfer from ${other}`;
  }

  formatAccountType(type: AccountType): string {
    const labels: Record<AccountType, string> = {
      checking: 'Checking',
      savings: 'Savings',
      credit: 'Credit Card',
      investment: 'Investment',
      cash: 'Cash',
    };
    return labels[type] ?? type;
  }

}
