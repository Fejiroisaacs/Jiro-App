import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { LedgerQuickNavComponent } from '../ledger-quick-nav/ledger-quick-nav';
import { LedgerTransactionFormComponent, TransactionPayload } from '../shared/transaction-form/ledger-transaction-form';
import { intervalLabel } from '../shared/ledger-utils';
import {
  LedgerService,
  LedgerTransaction,
  LedgerAccount,
  CategoryTree,
  LedgerCategory,
  TransactionFilters,
} from '../../../core/services/ledger.service';

interface TransactionGroup {
  date: string;
  label: string;
  transactions: LedgerTransaction[];
}

interface EditForm {
  category_id: string;
  amount: number;
  description: string;
  notes: string;
  date: string;
  is_recurring: boolean;
  recurrence_interval: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | '';
}

@Component({
  selector: 'app-transaction-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    JiroButtonComponent,
    JiroModalComponent,
    LedgerQuickNavComponent,
    LedgerTransactionFormComponent,
  ],
  template: `
    <div class="transaction-log">

      <!-- ── Page Header ─────────────────────────────────────────────────────── -->
      <div class="page-header">
        <div>
          <h1>Transactions</h1>
          <p class="text-secondary">Your full financial ledger</p>
        </div>
        <div class="header-actions">
          <jiro-button variant="primary" type="button" (click)="openAddModal()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Transaction
          </jiro-button>
        </div>
      </div>

      <ledger-quick-nav />

      <!-- ── Desktop Filter Bar ──────────────────────────────────────────────── -->
      <div class="filter-bar desktop-filters">
        <div class="filter-group">
          <label class="filter-label">From</label>
          <input type="date" class="date-input" [(ngModel)]="filterFrom" (change)="applyFilters()" />
        </div>
        <div class="filter-group">
          <label class="filter-label">To</label>
          <input type="date" class="date-input" [(ngModel)]="filterTo" (change)="applyFilters()" />
        </div>
        <div class="filter-group">
          <label class="filter-label">Account</label>
          <select class="filter-select" [(ngModel)]="filterAccountId" (change)="applyFilters()">
            <option value="">All accounts</option>
            <option *ngFor="let a of accounts()" [value]="a.id">{{ a.name }}</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Category</label>
          <select class="filter-select" [(ngModel)]="filterCategoryId" (change)="applyFilters()">
            <option value="">All categories</option>
            <option *ngFor="let c of flatCategories()" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>
        <div class="filter-group type-toggle-group">
          <label class="filter-label">Type</label>
          <div class="type-toggle">
            <button
              *ngFor="let t of typeOptions"
              class="type-btn"
              [class.active]="filterType === t.value"
              (click)="setType(t.value)">
              {{ t.label }}
            </button>
          </div>
        </div>
        <div class="filter-group search-group">
          <label class="filter-label">Search</label>
          <div class="search-input-wrap">
            <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              class="search-input"
              placeholder="Search description..."
              [(ngModel)]="searchQuery" />
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-label">&nbsp;</label>
          <button class="clear-btn" (click)="clearFilters()">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
            Clear
          </button>
        </div>
      </div>

      <!-- ── Mobile Filter Toggle ────────────────────────────────────────────── -->
      <div class="mobile-filter-header">
        <button class="mobile-filter-toggle" (click)="mobileFiltersOpen.set(!mobileFiltersOpen())">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          Filters
          <span *ngIf="activeFilterCount() > 0" class="filter-badge">{{ activeFilterCount() }}</span>
        </button>
        <div class="type-toggle mobile-type-toggle">
          <button
            *ngFor="let t of typeOptions"
            class="type-btn"
            [class.active]="filterType === t.value"
            (click)="setType(t.value)">
            {{ t.label }}
          </button>
        </div>
      </div>

      <!-- Mobile collapsible filter panel -->
      <div class="mobile-filter-panel" [class.open]="mobileFiltersOpen()">
        <div class="mobile-filter-grid">
          <div class="filter-group">
            <label class="filter-label">From</label>
            <input type="date" class="date-input" [(ngModel)]="filterFrom" (change)="applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label">To</label>
            <input type="date" class="date-input" [(ngModel)]="filterTo" (change)="applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label">Account</label>
            <select class="filter-select" [(ngModel)]="filterAccountId" (change)="applyFilters()">
              <option value="">All accounts</option>
              <option *ngFor="let a of accounts()" [value]="a.id">{{ a.name }}</option>
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label">Category</label>
            <select class="filter-select" [(ngModel)]="filterCategoryId" (change)="applyFilters()">
              <option value="">All categories</option>
              <option *ngFor="let c of flatCategories()" [value]="c.id">{{ c.name }}</option>
            </select>
          </div>
          <div class="filter-group full-width">
            <label class="filter-label">Search</label>
            <div class="search-input-wrap">
              <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                class="search-input"
                placeholder="Search description..."
                [(ngModel)]="searchQuery" />
            </div>
          </div>
          <div class="filter-group full-width">
            <button class="clear-btn" (click)="clearFilters(); mobileFiltersOpen.set(false)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      <!-- ── Loading ─────────────────────────────────────────────────────────── -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading transactions...</p>
      </div>

      <!-- ── Empty state (no transactions at all) ────────────────────────────── -->
      <div *ngIf="!loading() && allTransactions().length === 0" class="state-message">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
          <rect x="2" y="5" width="20" height="14" rx="2"/>
          <line x1="2" y1="10" x2="22" y2="10"/>
        </svg>
        <h3>No transactions yet</h3>
        <p class="text-secondary">Log your first transaction to start tracking your finances.</p>
        <jiro-button variant="primary" type="button" (click)="openAddModal()">
          Log Your First Transaction
        </jiro-button>
      </div>

      <!-- ── No-results state (filters return nothing) ───────────────────────── -->
      <div *ngIf="!loading() && allTransactions().length > 0 && visibleTransactions().length === 0" class="state-message">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          <line x1="8" y1="11" x2="14" y2="11"/>
        </svg>
        <h3>No results</h3>
        <p class="text-secondary">No transactions match your current filters.</p>
        <button class="clear-btn-inline" (click)="clearFilters()">Clear filters</button>
      </div>

      <!-- ── Transaction list grouped by date ───────────────────────────────── -->
      <div *ngIf="!loading() && visibleTransactions().length > 0" class="transaction-list">
        <ng-container *ngFor="let group of groupedTransactions()">
          <!-- Date separator -->
          <div class="date-separator">
            <span class="date-label">{{ group.label }}</span>
            <span class="date-sep-line"></span>
            <span class="date-group-total" [style.color]="getGroupTotalColor(group)">
              {{ getGroupTotal(group) }}
            </span>
          </div>

          <!-- Transaction rows -->
          <div
            *ngFor="let tx of group.transactions"
            class="tx-row"
            (click)="openEditModal(tx)">

            <!-- Left side: category color bar + details -->
            <div class="tx-left">
              <div
                class="tx-type-bar"
                [style.background]="tx.category_color || getTypeColor(tx.type)">
              </div>
              <div class="tx-details">
                <div class="tx-description">
                  {{ tx.description }}
                  <!-- Recurring badge -->
                  <span *ngIf="tx.is_recurring" class="recurring-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M17 1l4 4-4 4"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <path d="M7 23l-4-4 4-4"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                    {{ intervalLabel(tx.recurrence_interval) }}
                  </span>
                </div>
                <div class="tx-meta">
                  <span
                    *ngIf="tx.category_name"
                    class="category-chip"
                    [style.background]="(tx.category_color || '#9B8F88') + '22'"
                    [style.color]="tx.category_color || 'var(--text-muted)'"
                    [style.border-color]="(tx.category_color || '#9B8F88') + '55'">
                    {{ tx.category_name }}
                  </span>
                  <span class="account-name">{{ getAccountName(tx.account_id) }}</span>
                  <span *ngIf="tx.type === 'transfer' && tx.transfer_to_account_id" class="transfer-indicator">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12,5 19,12 12,19"/>
                    </svg>
                    {{ getAccountName(tx.transfer_to_account_id) }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Right side: amount + date + chevron -->
            <div class="tx-right">
              <div
                class="tx-amount"
                [style.color]="getAmountColor(tx.type)">
                {{ formatAmount(tx.amount, tx.type) }}
              </div>
              <div class="tx-date-small">{{ formatDateShort(tx.date) }}</div>
              <svg class="tx-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </div>
          </div>
        </ng-container>

        <!-- Load more -->
        <div class="load-more-row" *ngIf="hasMore()">
          <jiro-button variant="secondary" type="button" [disabled]="loadingMore()" (click)="loadMore()">
            {{ loadingMore() ? 'Loading...' : 'Load More' }}
          </jiro-button>
        </div>
      </div>
    </div>

    <!-- ── Edit Transaction Modal ──────────────────────────────────────────── -->
    <jiro-modal
      *ngIf="editingTx()"
      title="Edit Transaction"
      maxWidth="520px"
      (close)="closeEditModal()">
      <form class="tx-form" (ngSubmit)="saveEdit()" *ngIf="editForm">

        <div class="tx-type-indicator" [style.background]="getTypeColor(editingTx()!.type) + '18'">
          <span class="tx-type-pill" [style.background]="getTypeColor(editingTx()!.type)" [style.color]="'#fff'">
            {{ editingTx()!.type | titlecase }}
          </span>
          <span class="tx-type-account">{{ getAccountName(editingTx()!.account_id) }}</span>
        </div>

        <!-- Amount — grayed out for transfers -->
        <div class="form-group">
          <label class="form-label">Amount</label>
          <input
            class="form-input"
            type="number"
            min="0"
            step="0.01"
            [(ngModel)]="editForm.amount"
            name="amount"
            placeholder="0.00"
            [disabled]="editingTx()!.type === 'transfer'"
            [class.field-disabled]="editingTx()!.type === 'transfer'" />
          <p *ngIf="editingTx()!.type === 'transfer'" class="field-hint">Amount cannot be changed on transfers.</p>
        </div>

        <!-- Category — hidden for transfers -->
        <div class="form-group" *ngIf="editingTx()!.type !== 'transfer'">
          <label class="form-label">Category</label>
          <select class="form-input" [(ngModel)]="editForm.category_id" name="category_id">
            <option value="">No category</option>
            <option *ngFor="let c of flatCategoriesByType(editingTx()!.type)" [value]="c.id">{{ c.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Description</label>
          <input
            class="form-input"
            type="text"
            [(ngModel)]="editForm.description"
            name="description"
            placeholder="What was this for?" />
        </div>

        <div class="form-group">
          <label class="form-label">Notes</label>
          <textarea
            class="form-input form-textarea"
            [(ngModel)]="editForm.notes"
            name="notes"
            rows="2"
            placeholder="Optional notes..."></textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Date</label>
          <input
            class="form-input"
            type="date"
            [(ngModel)]="editForm.date"
            name="date" />
        </div>

        <!-- Recurring toggle -->
        <div class="form-group">
          <div class="toggle-row">
            <label class="form-label" style="margin:0">Recurring</label>
            <button
              type="button"
              class="toggle-btn"
              [class.on]="editForm.is_recurring"
              (click)="editForm.is_recurring = !editForm.is_recurring">
              <span class="toggle-knob"></span>
            </button>
          </div>
        </div>

        <div class="form-group" *ngIf="editForm.is_recurring">
          <label class="form-label">Recurrence</label>
          <select class="form-input" [(ngModel)]="editForm.recurrence_interval" name="recurrence_interval">
            <option value="weekly">Weekly</option>
            <option value="biweekly">Biweekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div class="form-actions">
          <jiro-button variant="danger" type="button" [disabled]="saving() || deleting()" (click)="confirmDeleteTx()">
            {{ deleting() ? 'Deleting...' : 'Delete' }}
          </jiro-button>
          <div class="form-actions-right">
            <jiro-button variant="secondary" type="button" (click)="closeEditModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || deleting()">
              {{ saving() ? 'Saving...' : 'Save' }}
            </jiro-button>
          </div>
        </div>
      </form>
    </jiro-modal>

    <!-- Delete confirmation nested within edit context -->
    <jiro-modal
      *ngIf="confirmingDelete()"
      title="Delete Transaction?"
      maxWidth="400px"
      (close)="confirmingDelete.set(false)">
      <div class="delete-confirm">
        <p>Permanently delete <strong>{{ editingTx()?.description }}</strong>?</p>
        <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
          This action cannot be undone.
        </p>
        <div class="form-actions" style="margin-top: var(--space-lg);">
          <jiro-button variant="secondary" type="button" (click)="confirmingDelete.set(false)">Cancel</jiro-button>
          <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="executeDelete()">
            {{ deleting() ? 'Deleting...' : 'Delete' }}
          </jiro-button>
        </div>
      </div>
    </jiro-modal>

    <!-- ── Add Transaction Modal ───────────────────────────────────────────── -->
    <jiro-modal
      *ngIf="showAddModal()"
      title="Add Transaction"
      maxWidth="520px"
      (close)="closeAddModal()">
      <ledger-transaction-form
        [accounts]="accounts()"
        [saving]="saving()"
        submitLabel="Add Transaction"
        (formSubmit)="onAddSubmit($event)"
        (formCancel)="closeAddModal()">
      </ledger-transaction-form>
    </jiro-modal>
  `,
  styles: [`
    :host { display: block; }

    .transaction-log { max-width: 900px; width: 100%; }

    /* ── Header ─────────────────────────────────────────────────────────────── */

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-lg); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions { display: flex; gap: var(--space-sm); flex-shrink: 0; align-items: center; }

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    /* ── Filter bar ─────────────────────────────────────────────────────────── */

    .filter-bar {
      display: flex; align-items: flex-end; gap: var(--space-sm);
      flex-wrap: wrap;
      padding: var(--space-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      margin-bottom: var(--space-lg);
    }

    .filter-group {
      display: flex; flex-direction: column; gap: 4px;
      flex-shrink: 0;
    }

    .filter-label {
      font-size: var(--font-size-xs); font-weight: 600;
      color: var(--text-secondary); text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .date-input, .filter-select {
      padding: 7px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      cursor: pointer;
      min-height: 36px;
    }

    .date-input:focus, .filter-select:focus {
      outline: none; border-color: var(--color-primary);
    }

    .filter-select { min-width: 140px; }

    .type-toggle-group { flex-shrink: 0; }

    .type-toggle {
      display: flex; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .type-btn {
      padding: 6px 12px; background: var(--bg-surface);
      border: none; border-right: 1px solid var(--border-color);
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
      min-height: 36px;
    }

    .type-btn:last-child { border-right: none; }

    .type-btn.active {
      background: var(--color-primary); color: #fff; font-weight: 600;
    }

    .search-group { flex: 1; min-width: 160px; }

    .search-input-wrap {
      position: relative; display: flex; align-items: center;
    }

    .search-icon {
      position: absolute; left: 9px; color: var(--text-muted); pointer-events: none;
    }

    .search-input {
      padding: 7px 10px 7px 30px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      width: 100%; min-height: 36px;
    }

    .search-input:focus { outline: none; border-color: var(--color-primary); }

    .clear-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 7px 12px;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
      min-height: 36px;
    }

    .clear-btn:hover { border-color: var(--color-danger); color: var(--color-danger); background: rgba(193,88,42,0.05); }

    /* ── Mobile filter ──────────────────────────────────────────────────────── */

    .mobile-filter-header {
      display: none;
      align-items: center; gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .mobile-filter-toggle {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); cursor: pointer; transition: all 0.15s;
      min-height: 44px;
    }

    .mobile-filter-toggle:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .filter-badge {
      display: inline-flex; align-items: center; justify-content: center;
      background: var(--color-primary); color: #fff;
      font-size: 10px; font-weight: 700;
      width: 18px; height: 18px; border-radius: 50%;
    }

    .mobile-type-toggle { flex: 1; }

    .mobile-filter-panel {
      display: none;
      overflow: hidden; max-height: 0;
      transition: max-height 0.25s ease;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      margin-bottom: var(--space-md);
    }

    .mobile-filter-panel.open { max-height: 600px; }

    .mobile-filter-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: var(--space-md); padding: var(--space-md);
    }

    .full-width { grid-column: 1 / -1; }

    /* ── State messages ─────────────────────────────────────────────────────── */

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl);
      gap: var(--space-md); text-align: center;
    }

    .state-message h3 { font-size: var(--font-size-lg); font-weight: 600; }

    .state-message ::ng-deep .jiro-btn { width: auto; }

    .clear-btn-inline {
      background: none; border: none;
      color: var(--color-primary); font-size: var(--font-size-sm);
      cursor: pointer; text-decoration: underline;
    }

    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    /* ── Transaction list ───────────────────────────────────────────────────── */

    .transaction-list { display: flex; flex-direction: column; }

    .date-separator {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-sm) 0 var(--space-xs);
      margin-top: var(--space-sm);
    }

    .date-label {
      font-size: var(--font-size-xs); font-weight: 700;
      color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; white-space: nowrap;
    }

    .date-sep-line {
      flex: 1; height: 1px; background: var(--border-color);
    }

    .date-group-total {
      font-size: var(--font-size-xs); font-weight: 600; white-space: nowrap;
    }

    .tx-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-sm) var(--space-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      margin-bottom: 4px;
      cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s;
      gap: var(--space-md);
      min-height: 60px;
    }

    .tx-row:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-sm);
    }

    .tx-left {
      display: flex; align-items: center; gap: var(--space-sm);
      flex: 1; min-width: 0;
    }

    .tx-type-bar {
      width: 4px; height: 36px;
      border-radius: 2px; flex-shrink: 0;
    }

    .tx-details { flex: 1; min-width: 0; }

    .tx-description {
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      display: flex; align-items: center; gap: var(--space-xs);
    }

    .recurring-badge {
      display: inline-flex; align-items: center; gap: 3px;
      font-size: var(--font-size-xs); font-weight: 500;
      color: var(--text-muted);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: 10px; padding: 1px 7px;
      flex-shrink: 0;
    }

    .tx-meta {
      display: flex; align-items: center; gap: var(--space-xs);
      margin-top: 3px; flex-wrap: wrap;
    }

    .category-chip {
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 1px 7px; border-radius: 10px;
      border: 1px solid transparent;
      white-space: nowrap;
    }

    .account-name {
      font-size: var(--font-size-xs); color: var(--text-muted);
      white-space: nowrap;
    }

    .transfer-indicator {
      display: flex; align-items: center; gap: 3px;
      font-size: var(--font-size-xs); color: #3B82F6;
    }

    .tx-right {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: 2px; flex-shrink: 0;
    }

    .tx-amount {
      font-size: var(--font-size-md); font-weight: 700;
      white-space: nowrap;
    }

    .tx-date-small {
      font-size: var(--font-size-xs); color: var(--text-muted);
    }

    .tx-chevron { color: var(--text-muted); margin-top: 2px; }

    .load-more-row {
      display: flex; justify-content: center;
      padding: var(--space-lg) 0;
    }

    .load-more-row ::ng-deep .jiro-btn { width: auto; }

    /* ── Modal form ─────────────────────────────────────────────────────────── */

    .tx-form { display: flex; flex-direction: column; gap: 0; }

    .tx-type-indicator {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      border-radius: var(--border-radius);
      margin-bottom: var(--space-md);
    }

    .tx-type-pill {
      font-size: var(--font-size-xs); font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.4px;
      padding: 3px 10px; border-radius: 10px;
    }

    .tx-type-account {
      font-size: var(--font-size-sm); color: var(--text-secondary);
    }

    .form-group {
      display: flex; flex-direction: column; gap: var(--space-xs);
      margin-bottom: var(--space-md);
    }

    .form-label {
      font-size: var(--font-size-lg); font-weight: 600;
      color: var(--text-primary); font-family: 'Newsreader', serif;
    }

    .required-star { color: var(--color-danger); }

    .form-input {
      padding: 10px 0;
      border: none; border-bottom: 2px dashed var(--border-color);
      border-radius: 0; background: transparent;
      color: var(--text-primary); font-size: var(--font-size-md);
      outline: none; transition: border-color 0.2s;
      font-family: inherit; width: 100%; box-sizing: border-box;
    }

    .form-input:focus { border-bottom-color: var(--color-primary); }

    .form-textarea { resize: vertical; min-height: 60px; }

    .field-disabled {
      opacity: 0.5; cursor: not-allowed;
    }

    .field-hint {
      font-size: var(--font-size-xs); color: var(--text-muted);
      font-style: italic; margin: 0;
    }

    .add-type-toggle {
      border-radius: var(--border-radius); overflow: hidden;
      border: 1px solid var(--border-color);
      width: 100%;
    }

    .add-type-toggle .type-btn { flex: 1; }

    .toggle-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-xs) 0;
    }

    .toggle-btn {
      width: 44px; height: 24px;
      background: var(--border-color);
      border: none; border-radius: 12px;
      cursor: pointer; position: relative;
      transition: background 0.2s;
      flex-shrink: 0;
    }

    .toggle-btn.on { background: var(--color-accent); }

    .toggle-knob {
      position: absolute; top: 3px; left: 3px;
      width: 18px; height: 18px;
      background: #fff; border-radius: 50%;
      transition: transform 0.2s;
    }

    .toggle-btn.on .toggle-knob { transform: translateX(20px); }

    .form-actions {
      display: flex; align-items: center;
      justify-content: space-between;
      gap: var(--space-sm); margin-top: var(--space-xs);
      flex-wrap: wrap;
    }

    .form-actions-right { display: flex; gap: var(--space-sm); }

    .form-actions ::ng-deep .jiro-btn,
    .form-actions-right ::ng-deep .jiro-btn { width: auto; }

    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-xs); }

    /* ── Responsive ─────────────────────────────────────────────────────────── */

    @media (max-width: 768px) {
      .desktop-filters { display: none; }
      .mobile-filter-header { display: flex; }
      .mobile-filter-panel { display: block; }

      .page-header { flex-direction: column; }
      .header-actions { width: 100%; }
      .header-actions ::ng-deep .jiro-btn { width: 100%; }

      .tx-row { padding: var(--space-sm); min-height: 52px; }

      .tx-description { font-size: var(--font-size-sm); }

      .tx-amount { font-size: var(--font-size-sm); }

      .tx-chevron { display: none; }

      .type-btn { padding: 6px 8px; font-size: var(--font-size-xs); min-height: 44px; }
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `],
})
export class TransactionLogComponent implements OnInit {
  // ── Signals ───────────────────────────────────────────────────────────────
  allTransactions = signal<LedgerTransaction[]>([]);
  accounts = signal<LedgerAccount[]>([]);
  categories = signal<CategoryTree[]>([]);
  loading = signal(true);
  loadingMore = signal(false);
  saving = signal(false);
  deleting = signal(false);
  hasMore = signal(false);
  mobileFiltersOpen = signal(false);
  showAddModal = signal(false);
  editingTx = signal<LedgerTransaction | null>(null);
  confirmingDelete = signal(false);

  // ── Flat category list derived from tree ──────────────────────────────────
  flatCategories = computed<LedgerCategory[]>(() => {
    const result: LedgerCategory[] = [];
    for (const tree of this.categories()) {
      result.push(tree);
      for (const child of tree.children) {
        result.push(child);
      }
    }
    return result;
  });

  // ── Filter state ──────────────────────────────────────────────────────────
  filterFrom = '';
  filterTo = '';
  filterAccountId = '';
  filterCategoryId = '';
  filterType = '';
  searchQuery = '';
  private currentPage = 1;
  private readonly PAGE_LIMIT = 50;

  readonly typeOptions = [
    { label: 'All', value: '' },
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Transfer', value: 'transfer' },
  ];

  activeFilterCount = computed(() => {
    let count = 0;
    if (this.filterFrom) count++;
    if (this.filterTo) count++;
    if (this.filterAccountId) count++;
    if (this.filterCategoryId) count++;
    if (this.filterType) count++;
    if (this.searchQuery) count++;
    return count;
  });

  // ── Client-side search filter ─────────────────────────────────────────────
  visibleTransactions = computed<LedgerTransaction[]>(() => {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.allTransactions();
    return this.allTransactions().filter(tx =>
      tx.description.toLowerCase().includes(q) ||
      (tx.notes && tx.notes.toLowerCase().includes(q))
    );
  });

  // ── Grouped by date ───────────────────────────────────────────────────────
  groupedTransactions = computed<TransactionGroup[]>(() => {
    const groups = new Map<string, LedgerTransaction[]>();
    for (const tx of this.visibleTransactions()) {
      const d = tx.date.slice(0, 10);
      if (!groups.has(d)) groups.set(d, []);
      groups.get(d)!.push(tx);
    }
    return Array.from(groups.entries()).map(([date, transactions]) => ({
      date,
      label: this.formatDateSeparator(date),
      transactions,
    }));
  });

  readonly intervalLabel = intervalLabel;

  // ── Form state ────────────────────────────────────────────────────────────
  editForm: EditForm | null = null;

  constructor(private ledgerService: LedgerService) {}

  ngOnInit() {
    this.loadAccounts();
    this.loadCategories();
    this.loadTransactions();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private loadAccounts() {
    this.ledgerService.listAccounts().subscribe({
      next: accounts => this.accounts.set(accounts),
    });
  }

  private loadCategories() {
    this.ledgerService.listCategories().subscribe({
      next: cats => this.categories.set(cats),
    });
  }

  private loadTransactions(append = false) {
    if (!append) {
      this.loading.set(true);
      this.currentPage = 1;
    } else {
      this.loadingMore.set(true);
    }

    const filters: TransactionFilters = {
      page: this.currentPage,
      limit: this.PAGE_LIMIT,
    };
    if (this.filterFrom) filters.from = this.filterFrom;
    if (this.filterTo) filters.to = this.filterTo;
    if (this.filterAccountId) filters.account_id = this.filterAccountId;
    if (this.filterCategoryId) filters.category_id = this.filterCategoryId;
    if (this.filterType) filters.type = this.filterType;

    this.ledgerService.listTransactions(filters).subscribe({
      next: txs => {
        if (append) {
          this.allTransactions.update(prev => [...prev, ...txs]);
        } else {
          this.allTransactions.set(txs);
        }
        this.hasMore.set(txs.length === this.PAGE_LIMIT);
        this.loading.set(false);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadingMore.set(false);
      },
    });
  }

  applyFilters() {
    this.loadTransactions();
  }

  setType(value: string) {
    this.filterType = value;
    this.applyFilters();
  }

  clearFilters() {
    this.filterFrom = '';
    this.filterTo = '';
    this.filterAccountId = '';
    this.filterCategoryId = '';
    this.filterType = '';
    this.searchQuery = '';
    this.applyFilters();
  }

  loadMore() {
    this.currentPage++;
    this.loadTransactions(true);
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  openEditModal(tx: LedgerTransaction) {
    this.editingTx.set(tx);
    this.confirmingDelete.set(false);
    this.editForm = {
      category_id: tx.category_id ?? '',
      amount: Math.abs(tx.amount),
      description: tx.description,
      notes: tx.notes ?? '',
      date: tx.date.slice(0, 10),
      is_recurring: tx.is_recurring,
      recurrence_interval: tx.recurrence_interval ?? '',
    };
  }

  closeEditModal() {
    this.editingTx.set(null);
    this.editForm = null;
    this.confirmingDelete.set(false);
  }

  saveEdit() {
    const tx = this.editingTx();
    if (!tx || !this.editForm) return;
    this.saving.set(true);

    const req: Partial<LedgerTransaction> = {
      description: this.editForm.description,
      notes: this.editForm.notes || null,
      date: this.editForm.date,
      is_recurring: this.editForm.is_recurring,
      recurrence_interval: this.editForm.is_recurring && this.editForm.recurrence_interval
        ? this.editForm.recurrence_interval as LedgerTransaction['recurrence_interval']
        : null,
    };

    if (tx.type !== 'transfer') {
      req.category_id = this.editForm.category_id || null;
      req.amount = this.editForm.amount;
    }

    this.ledgerService.updateTransaction(tx.id, req).subscribe({
      next: updated => {
        this.allTransactions.update(list =>
          list.map(t => t.id === updated.id ? updated : t)
        );
        this.saving.set(false);
        this.closeEditModal();
      },
      error: () => this.saving.set(false),
    });
  }

  confirmDeleteTx() {
    this.confirmingDelete.set(true);
  }

  executeDelete() {
    const tx = this.editingTx();
    if (!tx) return;
    this.deleting.set(true);
    this.ledgerService.deleteTransaction(tx.id).subscribe({
      next: () => {
        this.allTransactions.update(list => list.filter(t => t.id !== tx.id));
        this.deleting.set(false);
        this.closeEditModal();
      },
      error: () => this.deleting.set(false),
    });
  }

  // ── Add modal ─────────────────────────────────────────────────────────────

  openAddModal() {
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
  }

  onAddSubmit(payload: TransactionPayload) {
    this.saving.set(true);
    this.ledgerService.createTransaction(payload).subscribe({
      next: created => {
        this.allTransactions.update(list => [created, ...list]);
        this.saving.set(false);
        this.closeAddModal();
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  formatAmount(amount: number, type: string): string {
    const abs = Math.abs(amount).toFixed(2);
    if (type === 'income') return `+$${abs}`;
    if (type === 'expense') return `-$${abs}`;
    return `$${abs}`;
  }

  getAmountColor(type: string): string {
    if (type === 'income') return 'var(--color-accent)';
    if (type === 'expense') return 'var(--color-danger)';
    return '#3B82F6';
  }

  getTypeColor(type: string): string {
    if (type === 'income') return 'var(--color-accent)';
    if (type === 'expense') return 'var(--color-danger)';
    return '#3B82F6';
  }

  getAccountName(accountId: string | null): string {
    if (!accountId) return '';
    return this.accounts().find(a => a.id === accountId)?.name ?? '';
  }

  formatDateSeparator(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const isToday = d.toDateString() === today.toDateString();
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) return 'Today';
    if (isYesterday) return 'Yesterday';
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatDateShort(dateStr: string): string {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  getGroupTotal(group: TransactionGroup): string {
    const net = group.transactions.reduce((sum, tx) => {
      if (tx.type === 'income') return sum + Math.abs(tx.amount);
      if (tx.type === 'expense') return sum - Math.abs(tx.amount);
      return sum;
    }, 0);
    const abs = Math.abs(net).toFixed(2);
    if (net > 0) return `+$${abs}`;
    if (net < 0) return `-$${abs}`;
    return `$${abs}`;
  }

  getGroupTotalColor(group: TransactionGroup): string {
    const net = group.transactions.reduce((sum, tx) => {
      if (tx.type === 'income') return sum + Math.abs(tx.amount);
      if (tx.type === 'expense') return sum - Math.abs(tx.amount);
      return sum;
    }, 0);
    if (net > 0) return 'var(--color-accent)';
    if (net < 0) return 'var(--color-danger)';
    return 'var(--text-muted)';
  }

  flatCategoriesByType(type: string): LedgerCategory[] {
    if (type === 'transfer') return [];
    return this.flatCategories().filter(c => c.type === type);
  }
}
