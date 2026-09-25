import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SettingsService } from '../../../core/services/settings.service';
import { isDayKey, relativeDayName, todayKey } from '../../../core/utils/day';
import { ToastService } from '../../../core/services/toast.service';
import { LedgerTransactionFormComponent, TransactionPayload } from '../shared/transaction-form/ledger-transaction-form';
import { intervalLabel, parseDateOnly, formatSignedCurrency, transactionColor } from '../shared/ledger-utils';
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

@Component({
  selector: 'app-transaction-log',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    JiroButtonComponent,
    JiroModalComponent,
    JiroIconComponent,
    JiroPageHeaderComponent,
    JiroEmptyStateComponent,
    JiroSkeletonComponent,
    LedgerTransactionFormComponent,
  ],
  template: `
    <div class="transaction-log">

      <!-- ── Page Header ─────────────────────────────────────────────────────── -->
      <jiro-page-header heading="Transactions" subtitle="Your full financial ledger">
        <jiro-button actions type="button" (click)="openAddModal()">
          <jiro-icon name="plus" [size]="14" />
          Log transaction
        </jiro-button>
      </jiro-page-header>

      <!-- ── Desktop Filter Bar ──────────────────────────────────────────────── -->
      <div class="filter-bar desktop-filters">
        <div class="filter-group">
          <label class="filter-label" for="tx-from">From</label>
          <input id="tx-from" type="date" class="date-input" [ngModel]="filterFrom()" (ngModelChange)="filterFrom.set($event)" (change)="applyFilters()" />
        </div>
        <div class="filter-group">
          <label class="filter-label" for="tx-to">To</label>
          <input id="tx-to" type="date" class="date-input" [ngModel]="filterTo()" (ngModelChange)="filterTo.set($event)" (change)="applyFilters()" />
        </div>
        <div class="filter-group">
          <label class="filter-label" for="tx-account">Account</label>
          <select id="tx-account" class="filter-select" [ngModel]="filterAccountId()" (ngModelChange)="filterAccountId.set($event)" (change)="applyFilters()">
            <option value="">All accounts</option>
            @for (a of accounts(); track a) {
<option [value]="a.id">{{ a.name }}</option>
}
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label" for="tx-category">Category</label>
          <select id="tx-category" class="filter-select" [ngModel]="filterCategoryId()" (ngModelChange)="filterCategoryId.set($event)" (change)="applyFilters()">
            <option value="">All categories</option>
            @for (c of flatCategories(); track c) {
<option [value]="c.id">{{ c.name }}</option>
}
          </select>
        </div>
        <div class="filter-group type-toggle-group">
          <label class="filter-label">Type</label>
          <div class="type-toggle">
            @for (t of typeOptions; track t) {
<button
             
              class="type-btn"
              type="button"
              [attr.aria-pressed]="filterType() === t.value"
              [class.active]="filterType() === t.value"
              (click)="setType(t.value)">
              {{ t.label }}
            </button>
}
          </div>
        </div>
        <div class="filter-group search-group">
          <label class="filter-label" for="tx-search">Search</label>
          <div class="search-input-wrap">
            <jiro-icon class="search-icon" name="magnifying-glass" [size]="14" />
            <input
              id="tx-search"
              type="search"
              class="search-input"
              placeholder="Search description or notes..."
              [ngModel]="searchQuery()"
              (ngModelChange)="onSearchChange($event)" />
          </div>
        </div>
        <div class="filter-group">
          <label class="filter-label">&nbsp;</label>
          <button class="clear-btn" type="button" (click)="clearFilters()">
            <jiro-icon name="x" [size]="12" />
            Clear
          </button>
        </div>
      </div>

      <!-- ── Mobile Filter Toggle ────────────────────────────────────────────── -->
      <div class="mobile-filter-header">
        <button class="mobile-filter-toggle" type="button" [attr.aria-expanded]="mobileFiltersOpen()" (click)="mobileFiltersOpen.set(!mobileFiltersOpen())">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <line x1="4" y1="6" x2="20" y2="6"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="10" y1="18" x2="14" y2="18"/>
          </svg>
          Filters
          @if (activeFilterCount() > 0) {
<span class="filter-badge">{{ activeFilterCount() }}</span>
}
        </button>
        <div class="type-toggle mobile-type-toggle">
          @for (t of typeOptions; track t) {
<button
           
            class="type-btn"
            type="button"
            [attr.aria-pressed]="filterType() === t.value"
            [class.active]="filterType() === t.value"
            (click)="setType(t.value)">
            {{ t.label }}
          </button>
}
        </div>
      </div>

      <!-- Mobile collapsible filter panel -->
      <div class="mobile-filter-panel" [class.open]="mobileFiltersOpen()">
        <div class="mobile-filter-grid">
          <div class="filter-group">
            <label class="filter-label" for="tx-from-m">From</label>
            <input id="tx-from-m" type="date" class="date-input" [ngModel]="filterFrom()" (ngModelChange)="filterFrom.set($event)" (change)="applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="tx-to-m">To</label>
            <input id="tx-to-m" type="date" class="date-input" [ngModel]="filterTo()" (ngModelChange)="filterTo.set($event)" (change)="applyFilters()" />
          </div>
          <div class="filter-group">
            <label class="filter-label" for="tx-account-m">Account</label>
            <select id="tx-account-m" class="filter-select" [ngModel]="filterAccountId()" (ngModelChange)="filterAccountId.set($event)" (change)="applyFilters()">
              <option value="">All accounts</option>
              @for (a of accounts(); track a) {
<option [value]="a.id">{{ a.name }}</option>
}
            </select>
          </div>
          <div class="filter-group">
            <label class="filter-label" for="tx-category-m">Category</label>
            <select id="tx-category-m" class="filter-select" [ngModel]="filterCategoryId()" (ngModelChange)="filterCategoryId.set($event)" (change)="applyFilters()">
              <option value="">All categories</option>
              @for (c of flatCategories(); track c) {
<option [value]="c.id">{{ c.name }}</option>
}
            </select>
          </div>
          <div class="filter-group full-width">
            <label class="filter-label" for="tx-search-m">Search</label>
            <div class="search-input-wrap">
              <jiro-icon class="search-icon" name="magnifying-glass" [size]="14" />
              <input
                id="tx-search-m"
                type="search"
                class="search-input"
                placeholder="Search description or notes..."
                [ngModel]="searchQuery()"
                (ngModelChange)="onSearchChange($event)" />
            </div>
          </div>
          <div class="filter-group full-width">
            <button class="clear-btn" type="button" (click)="clearFilters(); mobileFiltersOpen.set(false)">
              <jiro-icon name="x" [size]="12" />
              Clear filters
            </button>
          </div>
        </div>
      </div>

      <!-- ── Loading ─────────────────────────────────────────────────────────── -->
      @if (loading()) {
        <div class="tx-loading" aria-busy="true" aria-label="Loading transactions">
          <jiro-skeleton [lines]="8" height="56px" />
        </div>
      }

      <!-- ── Empty and no-result states ──────────────────────────────────────── -->
      @if (!loading() && allTransactions().length === 0) {
        @if (activeFilterCount() > 0) {
          <jiro-empty-state
            icon="magnifying-glass"
            heading="No matching transactions"
            message="Nothing in your ledger matches these filters.">
            <jiro-button variant="secondary" type="button" (click)="clearFilters()">Clear filters</jiro-button>
          </jiro-empty-state>
        } @else {
          <jiro-empty-state
            icon="receipt"
            heading="No transactions yet"
            message="Log your first transaction to start tracking where your money goes.">
            <jiro-button type="button" (click)="openAddModal()">Log your first transaction</jiro-button>
          </jiro-empty-state>
        }
      }

      <!-- ── Transaction list grouped by date ───────────────────────────────── -->
      @if (!loading() && allTransactions().length > 0) {
<div class="transaction-list">
        @for (group of groupedTransactions(); track group) {

          <!-- Date separator -->
          <div class="date-separator">
            <span class="date-label">{{ group.label }}</span>
            <span class="date-sep-line"></span>
            <span class="date-group-total" [style.color]="getGroupTotalColor(group)">
              {{ getGroupTotal(group) }}
            </span>
          </div>

          <!-- Transaction rows -->
          @for (tx of group.transactions; track tx) {
<div
           
            class="tx-row"
            (click)="openEditModal(tx)">

            <!-- Left side: category color bar + details -->
            <div class="tx-left">
              <div
                class="tx-type-bar"
                [style.background]="tx.category_color || transactionColor(tx.type)">
              </div>
              <div class="tx-details">
                <div class="tx-description">
                  {{ tx.description }}
                  <!-- Recurring badge -->
                  @if (tx.is_recurring) {
<span class="recurring-badge">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <path d="M17 1l4 4-4 4"/>
                      <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                      <path d="M7 23l-4-4 4-4"/>
                      <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                    </svg>
                    {{ intervalLabel(tx.recurrence_interval) }}
                  </span>
}
                </div>
                <div class="tx-meta">
                  @if (tx.category_name) {
<span
                   
                    class="category-chip"
                    [style.background]="(tx.category_color || 'var(--text-muted)') + '22'"
                    [style.color]="tx.category_color || 'var(--text-muted)'"
                    [style.border-color]="(tx.category_color || 'var(--text-muted)') + '55'">
                    {{ tx.category_name }}
                  </span>
}
                  <span class="account-name">{{ getAccountName(tx.account_id) }}</span>
                  @if (tx.type === 'transfer' && tx.transfer_to_account_id) {
<span class="transfer-indicator">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"/>
                      <polyline points="12,5 19,12 12,19"/>
                    </svg>
                    {{ getAccountName(tx.transfer_to_account_id) }}
                  </span>
}
                </div>
              </div>
            </div>

            <!-- Right side: amount + date + chevron -->
            <div class="tx-right">
              <div
                class="tx-amount"
                [style.color]="transactionColor(tx.type)">
                {{ formatAmount(tx.amount, tx.type) }}
              </div>
              <div class="tx-date-small">{{ formatDateShort(tx.date) }}</div>
              <svg class="tx-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </div>
          </div>
}
        
}

        <!-- Load more -->
        @if (hasMore()) {
<div class="load-more-row">
          <jiro-button variant="secondary" type="button" [loading]="loadingMore()" (click)="loadMore()">
            Load more
          </jiro-button>
        </div>
}
      </div>
}
    </div>

    <!-- ── Edit Transaction Modal ──────────────────────────────────────────── -->
    @if (editingTx(); as tx) {
      <jiro-modal title="Edit transaction" maxWidth="520px" (close)="closeEditModal()">
        <ledger-transaction-form
          [accounts]="accounts()"
          [saving]="saving()"
          [initial]="editInitial()"
          [lockType]="true"
          submitLabel="Save changes"
          (formSubmit)="saveEdit($event)"
          (formCancel)="closeEditModal()">
        </ledger-transaction-form>
        @if (tx.type === 'transfer') {
          <p class="field-hint">Account and amount cannot be changed on a transfer. Delete it and log it again instead.</p>
        }
        @if (txDay(tx); as day) {
          <a class="day-link" [routerLink]="['/day', day]">See this day</a>
        }
        <div class="danger-row">
          <jiro-button variant="danger" size="sm" type="button" (click)="deleteTransaction(tx)">
            Delete transaction
          </jiro-button>
        </div>
      </jiro-modal>
    }

    <!-- ── Add Transaction Modal ───────────────────────────────────────────── -->
    @if (showAddModal()) {
<jiro-modal
     
      title="Log transaction"
      maxWidth="520px"
      (close)="closeAddModal()">
      <ledger-transaction-form
        [accounts]="accounts()"
        [saving]="saving()"
        [initial]="addInitial()"
        submitLabel="Log transaction"
        (formSubmit)="onAddSubmit($event)"
        (formCancel)="closeAddModal()">
      </ledger-transaction-form>
    </jiro-modal>
}
  `,
  styles: [`
    :host { display: block; }

    .transaction-log { max-width: 900px; width: 100%; }

    /* ── Header ─────────────────────────────────────────────────────────────── */

    .tx-loading { display: block; margin-top: var(--space-lg); }

    .danger-row {
      display: flex; justify-content: flex-start;
      margin-top: var(--space-lg); padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
    }


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
 border-color: var(--color-primary);
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
      background: var(--color-primary); color: var(--text-on-primary); font-weight: 600;
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

    .search-input:focus { border-color: var(--color-primary); }

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

    .clear-btn:hover { border-color: var(--color-danger); color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.05); }

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
      background: var(--color-primary); color: var(--text-on-primary);
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

    /* ── Transaction list ───────────────────────────────────────────────────── */

    .transaction-list { display: flex; flex-direction: column; }

    .day-link {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      margin-top: var(--space-sm);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
    }

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
      font-size: var(--font-size-xs); color: var(--color-info);
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
 transition: border-color 0.2s;
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
      background: var(--bg-surface); border-radius: 50%;
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

    /* ── Responsive ─────────────────────────────────────────────────────────── */

    @media (max-width: 768px) {
      .desktop-filters { display: none; }
      .mobile-filter-header { display: flex; }
      .mobile-filter-panel { display: block; }

      .page-header { flex-direction: column; }
      .header-actions { width: 100%; }
      .header-actions { --jiro-btn-width: 100%; }

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
  // Signals, so the mobile filter badge recomputes the moment a filter changes.
  filterFrom = signal('');
  filterTo = signal('');
  filterAccountId = signal('');
  filterCategoryId = signal('');
  filterType = signal('');
  searchQuery = signal('');
  private currentPage = 1;
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly PAGE_LIMIT = 50;

  private readonly confirmService = inject(ConfirmService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly settings = inject(SettingsService);
  /** A date to pre-fill when the add dialog was opened for a given day (?new=1&date=). */
  addInitial = signal<Partial<TransactionPayload> | null>(null);
  private readonly toast = inject(ToastService);
  readonly transactionColor = transactionColor;

  readonly typeOptions = [
    { label: 'All', value: '' },
    { label: 'Income', value: 'income' },
    { label: 'Expense', value: 'expense' },
    { label: 'Transfer', value: 'transfer' },
  ];

  activeFilterCount = computed(() =>
    [
      this.filterFrom(), this.filterTo(), this.filterAccountId(),
      this.filterCategoryId(), this.filterType(), this.searchQuery().trim(),
    ].filter(Boolean).length
  );

  /** Pre-fills the edit form from the transaction being edited. */
  editInitial = computed<Partial<TransactionPayload> | null>(() => {
    const tx = this.editingTx();
    if (!tx) return null;
    return {
      type: tx.type as TransactionPayload['type'],
      account_id: tx.account_id,
      transfer_to_account_id: tx.transfer_to_account_id,
      category_id: tx.category_id,
      amount: Math.abs(tx.amount),
      description: tx.description,
      notes: tx.notes,
      is_recurring: tx.is_recurring,
      recurrence_interval: tx.recurrence_interval as TransactionPayload['recurrence_interval'],
      date: tx.date.slice(0, 10),
    };
  });

  // ── Grouped by date ───────────────────────────────────────────────────────
  groupedTransactions = computed<TransactionGroup[]>(() => {
    const groups = new Map<string, LedgerTransaction[]>();
    for (const tx of this.allTransactions()) {
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
  constructor(private ledgerService: LedgerService) {}

  ngOnInit() {
    this.loadAccounts();
    this.loadCategories();
    this.loadTransactions();
    this.openFromUrl();
  }

  /**
   * Deep links from the day view: ?tx=<id> opens that transaction's edit
   * dialog, ?new=1&date=YYYY-MM-DD opens Log transaction for that day. The
   * params are dropped when the dialog closes so a reload does not reopen it.
   */
  private openFromUrl() {
    const q = this.route.snapshot.queryParamMap;
    const txId = q.get('tx');
    if (txId) {
      this.ledgerService.getTransaction(txId).subscribe({
        next: tx => this.openEditModal(tx),
        error: () => {
          this.clearDeepLink();
          this.toast.error('Could not open that transaction.');
        },
      });
    } else if (q.get('new') === '1') {
      const date = q.get('date');
      this.addInitial.set(isDayKey(date) ? { date } : null);
      this.showAddModal.set(true);
    }
  }

  private clearDeepLink() {
    const q = this.route.snapshot.queryParamMap;
    if (!q.has('tx') && !q.has('new') && !q.has('date')) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tx: null, new: null, date: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  /** The transaction's date, when the day view can show it (not a future day). */
  txDay(tx: LedgerTransaction): string | null {
    const day = tx.date.slice(0, 10);
    return day <= todayKey(this.settings.timezone()) ? day : null;
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
    if (this.filterFrom()) filters.from = this.filterFrom();
    if (this.filterTo()) filters.to = this.filterTo();
    if (this.filterAccountId()) filters.account_id = this.filterAccountId();
    if (this.filterCategoryId()) filters.category_id = this.filterCategoryId();
    if (this.filterType()) filters.type = this.filterType();
    if (this.searchQuery().trim()) filters.q = this.searchQuery().trim();

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
        this.toast.error('Could not load your transactions.');
      },
    });
  }

  applyFilters() {
    this.loadTransactions();
  }

  /** Search runs on the server, so debounce before asking for a new page 1. */
  onSearchChange(value: string) {
    this.searchQuery.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 300);
  }

  setType(value: string) {
    this.filterType.set(value);
    this.applyFilters();
  }

  clearFilters() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.filterFrom.set('');
    this.filterTo.set('');
    this.filterAccountId.set('');
    this.filterCategoryId.set('');
    this.filterType.set('');
    this.searchQuery.set('');
    this.applyFilters();
  }

  loadMore() {
    this.currentPage++;
    this.loadTransactions(true);
  }

  // ── Edit modal ────────────────────────────────────────────────────────────

  openEditModal(tx: LedgerTransaction) {
    this.editingTx.set(tx);
  }

  closeEditModal() {
    this.editingTx.set(null);
    this.clearDeepLink();
  }

  saveEdit(payload: TransactionPayload) {
    const tx = this.editingTx();
    if (!tx) return;
    this.saving.set(true);

    const req: Partial<LedgerTransaction> = {
      description: payload.description,
      notes: payload.notes || null,
      date: payload.date,
      is_recurring: payload.is_recurring,
      recurrence_interval: payload.is_recurring ? payload.recurrence_interval : null,
    };

    // A transfer writes two rows, so its account and amount are fixed once logged.
    if (tx.type !== 'transfer') {
      req.category_id = payload.category_id || null;
      req.amount = payload.amount;
    }

    this.ledgerService.updateTransaction(tx.id, req).subscribe({
      next: updated => {
        this.allTransactions.update(list =>
          list.map(t => t.id === updated.id ? updated : t)
        );
        this.saving.set(false);
        this.closeEditModal();
        this.toast.success('Transaction saved');
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Could not save the transaction.');
      },
    });
  }

  async deleteTransaction(tx: LedgerTransaction) {
    const ok = await this.confirmService.confirm({
      title: `Delete ${tx.description || 'this transaction'}?`,
      message: tx.type === 'transfer'
        ? 'Both sides of the transfer are removed and the account balances are corrected.'
        : 'The transaction is removed and the account balance is corrected. This cannot be undone.',
      confirmLabel: 'Delete transaction',
      danger: true,
    });
    if (!ok) return;
    this.ledgerService.deleteTransaction(tx.id).subscribe({
      next: () => {
        this.allTransactions.update(list => list.filter(t => t.id !== tx.id));
        this.closeEditModal();
        this.toast.success('Transaction deleted');
      },
      error: () => this.toast.error('Could not delete the transaction.'),
    });
  }

  // ── Add modal ─────────────────────────────────────────────────────────────

  openAddModal() {
    this.addInitial.set(null);
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
    this.clearDeepLink();
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
    if (type === 'transfer') return formatSignedCurrency(amount, 'USD', 'never');
    // Stored sign is authoritative (expenses are negative); normalise by type
    // in case an older row was stored unsigned.
    const signed = type === 'expense' ? -Math.abs(amount) : Math.abs(amount);
    return formatSignedCurrency(signed);
  }

  getAccountName(accountId: string | null): string {
    if (!accountId) return '';
    return this.accounts().find(a => a.id === accountId)?.name ?? '';
  }

  formatDateSeparator(dateStr: string): string {
    const d = parseDateOnly(dateStr);
    // "Today" is the user's day (settings zone), as everywhere else.
    const rel = relativeDayName(dateStr.slice(0, 10), todayKey(this.settings.timezone()));
    if (rel) return rel;
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }

  formatDateShort(dateStr: string): string {
    return parseDateOnly(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  getGroupTotal(group: TransactionGroup): string {
    const net = group.transactions.reduce((sum, tx) => {
      if (tx.type === 'income') return sum + Math.abs(tx.amount);
      if (tx.type === 'expense') return sum - Math.abs(tx.amount);
      return sum;
    }, 0);
    return formatSignedCurrency(net);
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
