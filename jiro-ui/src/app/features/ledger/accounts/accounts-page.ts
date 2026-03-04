import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
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
import { LedgerQuickNavComponent } from '../ledger-quick-nav/ledger-quick-nav';
import { formatCurrency, formatDate, hexWithAlpha } from '../shared/ledger-utils';

type AccountType = 'checking' | 'savings' | 'credit' | 'investment' | 'cash';

@Component({
  selector: 'app-accounts-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JiroCardComponent,
    JiroButtonComponent,
    JiroModalComponent,
    LedgerQuickNavComponent,
  ],
  template: `
    <div class="accounts-page">

      <!-- ── Header ── -->
      <div class="page-header">
        <div>
          <h1>Accounts</h1>
          <p class="text-secondary">Manage your financial accounts</p>
        </div>
        <div class="header-actions">
          <jiro-button variant="primary" type="button" (click)="openAddAccount()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Account
          </jiro-button>
        </div>
      </div>

      <ledger-quick-nav />

      <!-- ── Loading ── -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p class="text-secondary">Loading accounts...</p>
      </div>

      <!-- ── Empty State ── -->
      <div *ngIf="!loading() && accounts().length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="5" width="20" height="14" rx="2"/>
            <line x1="2" y1="10" x2="22" y2="10"/>
            <line x1="6" y1="15" x2="10" y2="15"/>
          </svg>
        </div>
        <h3>No accounts yet</h3>
        <p class="text-secondary">Add your first account to start tracking your finances and net worth.</p>
        <div class="empty-action">
          <jiro-button variant="primary" type="button" (click)="openAddAccount()">
            Add your first account
          </jiro-button>
        </div>
      </div>

      <!-- ── Accounts Grid ── -->
      <ng-container *ngIf="!loading() && accounts().length > 0">

        <div class="accounts-grid">
          <jiro-card *ngFor="let account of accounts()" [clickable]="true" (click)="toggleDetail(account)">
            <div class="acct-card">

              <!-- Top row: icon + badge -->
              <div class="acct-top">
                <div class="acct-icon-wrap" [class]="'acct-type-' + account.type">
                  <ng-container [ngSwitch]="account.type">

                    <!-- Checking: bank -->
                    <svg *ngSwitchCase="'checking'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="3" y1="22" x2="21" y2="22"/>
                      <rect x="2" y="8" width="20" height="14"/>
                      <path d="M12 2L2 8h20L12 2z"/>
                      <rect x="9" y="12" width="2" height="6"/>
                      <rect x="13" y="12" width="2" height="6"/>
                    </svg>

                    <!-- Savings: piggy bank -->
                    <svg *ngSwitchCase="'savings'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M19 11c0 4.4-3.6 8-8 8s-8-3.6-8-8 3.6-8 8-8c1 0 2 .2 2.9.5"/>
                      <path d="M19 11h2l1 3-2 1"/>
                      <circle cx="9" cy="11" r="1" fill="currentColor"/>
                      <path d="M7 19v2M13 19v2"/>
                    </svg>

                    <!-- Credit: credit card -->
                    <svg *ngSwitchCase="'credit'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2"/>
                      <line x1="1" y1="10" x2="23" y2="10"/>
                    </svg>

                    <!-- Investment: trending up -->
                    <svg *ngSwitchCase="'investment'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                      <polyline points="17 6 23 6 23 12"/>
                    </svg>

                    <!-- Cash: banknotes -->
                    <svg *ngSwitchDefault width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="1" y="6" width="22" height="12" rx="2"/>
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M5 12h.01M19 12h.01"/>
                    </svg>
                  </ng-container>
                </div>

                <div class="acct-badges">
                  <span class="type-label">{{ formatAccountType(account.type) }}</span>
                  <span *ngIf="!account.is_active" class="inactive-badge">Inactive</span>
                </div>
              </div>

              <!-- Name + Balance -->
              <div class="acct-body">
                <h3 class="acct-name">{{ account.name }}</h3>
                <div class="acct-balance-row">
                  <span class="acct-balance"
                    [class.balance-asset]="account.type !== 'credit'"
                    [class.balance-liability]="account.type === 'credit'">
                    {{ formatCurrency(account.balance, account.currency) }}
                  </span>
                  <span class="acct-currency">{{ account.currency }}</span>
                </div>
              </div>

              <!-- Actions row -->
              <div class="acct-actions" (click)="$event.stopPropagation()">
                <button class="icon-btn" title="Edit account" (click)="openEditAccount(account)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-btn icon-btn--danger" title="Delete account" (click)="openDeleteAccount(account)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                    <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
                  </svg>
                </button>
              </div>
            </div>

            <!-- ── Detail Panel (expanded) ── -->
            <div *ngIf="selectedAccountId() === account.id" class="detail-panel" (click)="$event.stopPropagation()">
              <div class="detail-header">
                <span class="detail-title">Recent Transactions</span>
              </div>
              <div *ngIf="detailLoading()" class="detail-loading">
                <div class="spinner-sm"></div>
              </div>
              <div *ngIf="!detailLoading() && selectedAccountDetail()?.recent_transactions?.length === 0" class="detail-empty">
                <p class="text-muted">No transactions yet.</p>
              </div>
              <div *ngIf="!detailLoading() && (selectedAccountDetail()?.recent_transactions?.length ?? 0) > 0" class="detail-txn-list">
                <div *ngFor="let t of selectedAccountDetail()!.recent_transactions" class="detail-txn-row">
                  <div class="detail-txn-left">
                    <span class="detail-txn-desc">{{ t.description || 'Untitled' }}</span>
                    <span *ngIf="t.category_name" class="cat-chip"
                      [style.background]="hexWithAlpha(t.category_color, 0.12)"
                      [style.color]="t.category_color || 'var(--text-muted)'">
                      {{ t.category_name }}
                    </span>
                  </div>
                  <div class="detail-txn-right">
                    <span class="detail-txn-amount"
                      [class.amount-pos]="t.type === 'income'"
                      [class.amount-neg]="t.type === 'expense'">
                      {{ t.type === 'expense' ? '-' : '+' }}{{ formatCurrency(t.amount, account.currency) }}
                    </span>
                    <span class="detail-txn-date text-muted">{{ formatDate(t.date) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </jiro-card>
        </div>

        <!-- ── Net Worth Bar ── -->
        <div class="net-worth-bar">
          <div class="nw-item">
            <span class="nw-label">Assets</span>
            <span class="nw-value nw-asset">{{ formatCurrency(totalAssets()) }}</span>
          </div>
          <span class="nw-op">-</span>
          <div class="nw-item">
            <span class="nw-label">Liabilities</span>
            <span class="nw-value nw-liability">{{ formatCurrency(totalLiabilities()) }}</span>
          </div>
          <span class="nw-op">=</span>
          <div class="nw-item">
            <span class="nw-label">Net Worth</span>
            <span class="nw-value"
              [class.nw-pos]="netWorth() >= 0"
              [class.nw-neg]="netWorth() < 0">
              {{ formatCurrency(netWorth()) }}
            </span>
          </div>
        </div>

      </ng-container>

      <!-- ── Add Account Modal ── -->
      <jiro-modal *ngIf="showAddModal()" title="Add Account" maxWidth="480px" (close)="closeAddModal()">
        <form class="modal-form" (ngSubmit)="submitAddAccount()">
          <div class="form-group">
            <label class="form-label">Account Name</label>
            <input
              class="form-input"
              type="text"
              [(ngModel)]="addForm.name"
              name="name"
              placeholder="e.g. Chase Checking"
              required />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-input" [(ngModel)]="addForm.type" name="type" required>
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Currency</label>
            <input
              class="form-input"
              type="text"
              [(ngModel)]="addForm.currency"
              name="currency"
              placeholder="USD"
              maxlength="3" />
          </div>
          <div class="form-group">
            <label class="form-label">Opening Balance</label>
            <input
              class="form-input"
              type="number"
              step="0.01"
              [(ngModel)]="addForm.balance"
              name="balance"
              placeholder="0.00" />
          </div>
          <p *ngIf="addError()" class="form-error">{{ addError() }}</p>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeAddModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="addSaving() || !addForm.name.trim()">
              {{ addSaving() ? 'Saving...' : 'Add Account' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- ── Edit Account Modal ── -->
      <jiro-modal *ngIf="showEditModal()" title="Edit Account" maxWidth="480px" (close)="closeEditModal()">
        <form class="modal-form" (ngSubmit)="submitEditAccount()">
          <div class="form-group">
            <label class="form-label">Account Name</label>
            <input
              class="form-input"
              type="text"
              [(ngModel)]="editForm.name"
              name="name"
              placeholder="Account name"
              required />
          </div>
          <div class="form-group">
            <label class="form-label">Type</label>
            <select class="form-input" [(ngModel)]="editForm.type" name="type">
              <option value="checking">Checking</option>
              <option value="savings">Savings</option>
              <option value="credit">Credit Card</option>
              <option value="investment">Investment</option>
              <option value="cash">Cash</option>
            </select>
          </div>
          <div class="form-group">
            <div class="toggle-row">
              <span class="form-label">Active</span>
              <button
                type="button"
                class="toggle-btn"
                [class.toggle-on]="editForm.is_active"
                (click)="editForm.is_active = !editForm.is_active">
                <span class="toggle-knob"></span>
              </button>
            </div>
          </div>
          <p *ngIf="editError()" class="form-error">{{ editError() }}</p>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeEditModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="editSaving() || !editForm.name.trim()">
              {{ editSaving() ? 'Saving...' : 'Save Changes' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- ── Delete Confirmation Modal ── -->
      <jiro-modal *ngIf="deletingAccount()" title="Delete Account?" maxWidth="420px" (close)="deletingAccount.set(null)">
        <div class="delete-confirm">
          <p>Delete <strong>{{ deletingAccount()!.name }}</strong>?</p>
          <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
            This action cannot be undone. If the account has transactions linked to it, deletion will fail.
          </p>
          <p *ngIf="deleteError()" class="form-error" style="margin-top: var(--space-sm);">{{ deleteError() }}</p>
          <div class="form-actions" style="margin-top: var(--space-lg);">
            <jiro-button variant="secondary" type="button" (click)="cancelDelete()">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="deleteSaving()" (click)="confirmDelete()">
              {{ deleteSaving() ? 'Deleting...' : 'Delete Account' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>

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

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-2xl) var(--space-lg);
      text-align: center;
    }

    .empty-icon { color: var(--text-muted); opacity: 0.45; }

    .empty-state h3 { font-size: var(--font-size-xl); font-weight: 600; }

    .empty-action ::ng-deep .jiro-btn { width: auto; }

    /* ── Loading ── */
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

    .spinner-sm {
      width: 24px;
      height: 24px;
      border: 2px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

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

    .acct-type-checking  { background: rgba(74,103,65,0.12);  color: #4A6741; }
    .acct-type-savings   { background: rgba(74,103,65,0.18);  color: #3d7a33; }
    .acct-type-credit    { background: rgba(193,88,42,0.12);  color: var(--color-danger); }
    .acct-type-investment{ background: rgba(122,59,46,0.12);  color: var(--color-primary); }
    .acct-type-cash      { background: rgba(107,94,87,0.12);  color: var(--text-secondary); }

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
      background: rgba(155,143,136,0.15);
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
    }

    .acct-balance-row {
      display: flex;
      align-items: baseline;
      gap: var(--space-xs);
    }

    .acct-balance {
      font-size: var(--font-size-2xl);
      font-weight: 700;
    }

    .balance-asset { color: var(--color-accent); }
    .balance-liability { color: var(--color-danger); }

    .acct-currency {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
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

    .icon-btn {
      width: 34px;
      height: 34px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: none;
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.15s;
    }

    .icon-btn:hover {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: rgba(122,59,46,0.06);
    }

    .icon-btn--danger:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
      background: rgba(193,88,42,0.06);
    }

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
      outline: none;
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
      background: #fff;
      border-radius: 50%;
      transition: transform 0.2s;
      box-shadow: 0 1px 3px rgba(0,0,0,0.2);
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

    .form-actions ::ng-deep .jiro-btn { width: auto; }

    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-xs); }

    /* ── Responsive ── */
    @media (max-width: 768px) {
      .page-header { flex-direction: column; }

      .accounts-grid {
        grid-template-columns: 1fr;
      }

      .net-worth-bar {
        padding: var(--space-md) var(--space-lg);
        gap: var(--space-md);
      }

      .nw-value { font-size: var(--font-size-lg); }
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class AccountsPageComponent implements OnInit {
  readonly formatCurrency = formatCurrency;
  readonly formatDate = formatDate;
  readonly hexWithAlpha = hexWithAlpha;

  accounts = signal<LedgerAccount[]>([]);
  loading = signal(true);

  selectedAccountId = signal<string | null>(null);
  selectedAccountDetail = signal<AccountWithTransactions | null>(null);
  detailLoading = signal(false);

  // Computed net worth
  totalAssets = computed(() =>
    this.accounts()
      .filter((a) => a.type !== 'credit')
      .reduce((sum, a) => sum + a.balance, 0)
  );

  totalLiabilities = computed(() =>
    this.accounts()
      .filter((a) => a.type === 'credit')
      .reduce((sum, a) => sum + Math.abs(a.balance), 0)
  );

  netWorth = computed(() => this.totalAssets() - this.totalLiabilities());

  // Add modal
  showAddModal = signal(false);
  addSaving = signal(false);
  addError = signal('');
  addForm: { name: string; type: AccountType; currency: string; balance: number } = {
    name: '',
    type: 'checking',
    currency: 'USD',
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
  deletingAccount = signal<LedgerAccount | null>(null);
  deleteSaving = signal(false);
  deleteError = signal('');

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
    this.addForm = { name: '', type: 'checking', currency: 'USD', balance: 0 };
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
        currency: this.addForm.currency.toUpperCase() || 'USD',
        balance: this.addForm.balance ?? 0,
      })
      .subscribe({
        next: () => {
          this.addSaving.set(false);
          this.showAddModal.set(false);
          this.loadAccounts();
        },
        error: () => {
          this.addSaving.set(false);
          this.addError.set('Failed to create account. Please try again.');
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
        error: () => {
          this.editSaving.set(false);
          this.editError.set('Failed to update account. Please try again.');
        },
      });
  }

  // ── Delete ──
  openDeleteAccount(account: LedgerAccount) {
    this.deletingAccount.set(account);
    this.deleteError.set('');
  }

  cancelDelete() {
    this.deletingAccount.set(null);
    this.deleteError.set('');
    this.deleteSaving.set(false);
  }

  confirmDelete() {
    const account = this.deletingAccount();
    if (!account) return;
    this.deleteSaving.set(true);
    this.deleteError.set('');
    this.ledgerService.deleteAccount(account.id).subscribe({
      next: () => {
        this.deleteSaving.set(false);
        this.deletingAccount.set(null);
        if (this.selectedAccountId() === account.id) {
          this.selectedAccountId.set(null);
          this.selectedAccountDetail.set(null);
        }
        this.loadAccounts();
      },
      error: () => {
        this.deleteSaving.set(false);
        this.deleteError.set(
          'Cannot delete this account — it may have transactions linked to it.'
        );
      },
    });
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
