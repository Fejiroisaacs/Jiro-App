import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsService } from './settings.service';

const API = `${environment.apiUrl}/ledger`;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LedgerAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
  /** Legacy column: every amount is shown in the user's one currency (SettingsService.currency). */
  currency: string;
  balance: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AccountWithTransactions extends LedgerAccount {
  recent_transactions: LedgerTransaction[];
}

export interface LedgerCategory {
  id: string;
  user_id: string;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  parent_id: string | null;
  created_at: string;
}

export interface CategoryTree extends LedgerCategory {
  children: LedgerCategory[];
}

export interface CategoryDeleteResult {
  moved: number;
  budgets_removed: number;
}

export type RecurrenceInterval = 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export interface LedgerTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: 'income' | 'expense' | 'transfer';
  amount: number;
  description: string;
  notes: string | null;
  date: string;
  /** True on the transaction that heads a repeating series. */
  is_recurring: boolean;
  recurrence_interval: RecurrenceInterval | null;
  recurrence_day: number | null;
  transfer_to_account_id: string | null;
  /** Head of a live series: the next date Ledger adds a copy on. */
  recurrence_next_date: string | null;
  /** A copy Ledger added: the id of the series' head. */
  recurrence_source_id: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  category_color?: string | null;
  /** The series this row belongs to (its own, or its head's); null when none or stopped. */
  series_interval: RecurrenceInterval | null;
  series_next_date: string | null;
}

/** An edit: fields left out stay as they are; category_id null uncategorises, notes '' clears. */
export interface TransactionUpdate {
  account_id?: string;
  transfer_to_account_id?: string;
  category_id?: string | null;
  amount?: number;
  description?: string;
  notes?: string;
  date?: string;
  is_recurring?: boolean;
  recurrence_interval?: RecurrenceInterval | null;
}

export interface LedgerBudget {
  id: string;
  user_id: string;
  category_id: string;
  amount: number;
  period: 'monthly' | 'weekly' | 'yearly';
  start_date: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetWithSpend extends LedgerBudget {
  category_name: string;
  category_color: string | null;
  spent: number;
  remaining: number;
  pct_used: number;
}

export interface NetWorthSnapshot {
  id: string;
  user_id: string;
  assets_total: number;
  liabilities_total: number;
  net_worth: number;
  snapshot_date: string;
}

export interface LedgerSummary {
  month: string;
  income: number;
  expenses: number;
  net: number;
  savings_rate: number;
}

/** Period B against period A (the base): delta = b - a; delta_pct is null when a is 0. */
export interface ComparisonValue {
  a: number;
  b: number;
  delta: number;
  delta_pct: number | null;
}

/** One category's income or spending in each period, as positive amounts. */
export interface ComparisonCategory {
  /** null for uncategorised transactions. */
  category_id: string | null;
  name: string;
  type: 'income' | 'expense';
  color: string | null;
  a: number;
  b: number;
  delta: number;
  delta_pct: number | null;
}

export interface ComparisonResponse {
  period_a: { from: string; to: string };
  period_b: { from: string; to: string };
  summary: {
    income: ComparisonValue;
    expenses: ComparisonValue;
    net: ComparisonValue;
  };
  categories: ComparisonCategory[];
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  account_id?: string;
  category_id?: string;
  type?: string;
  /** Free-text search over the description and the notes. */
  q?: string;
  page?: number;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LedgerService {
  constructor(private http: HttpClient) {}

  private readonly settings = inject(SettingsService);

  /** The user's zone, the API's fallback for an account with no timezone setting. */
  private tz(params = new HttpParams()): HttpParams {
    return params.set('tz', this.settings.timezone());
  }

  // Accounts
  createAccount(req: { name: string; type: LedgerAccount['type']; balance: number }): Observable<LedgerAccount> {
    return this.http.post<LedgerAccount>(`${API}/accounts`, req);
  }
  listAccounts(): Observable<LedgerAccount[]> {
    return this.http.get<LedgerAccount[]>(`${API}/accounts`, { params: this.tz() });
  }
  getAccount(id: string): Observable<AccountWithTransactions> {
    return this.http.get<AccountWithTransactions>(`${API}/accounts/${id}`, { params: this.tz() });
  }
  updateAccount(id: string, req: Partial<LedgerAccount>): Observable<LedgerAccount> {
    return this.http.patch<LedgerAccount>(`${API}/accounts/${id}`, req);
  }
  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/accounts/${id}`);
  }

  // Categories
  createCategory(req: { name: string; type: 'income' | 'expense'; color?: string }): Observable<LedgerCategory> {
    return this.http.post<LedgerCategory>(`${API}/categories`, req);
  }
  listCategories(): Observable<CategoryTree[]> {
    return this.http.get<CategoryTree[]>(`${API}/categories`);
  }
  updateCategory(id: string, req: { name?: string; color?: string }): Observable<LedgerCategory> {
    return this.http.patch<LedgerCategory>(`${API}/categories/${id}`, req);
  }
  /** Deletes a category; its transactions move to moveTo (same type) or become uncategorised. */
  deleteCategory(id: string, moveTo: string | null = null): Observable<CategoryDeleteResult> {
    let params = new HttpParams();
    if (moveTo) params = params.set('move_to', moveTo);
    return this.http.delete<CategoryDeleteResult>(`${API}/categories/${id}`, { params });
  }

  // Transactions
  createTransaction(req: Partial<LedgerTransaction> & { date: string; amount: number }): Observable<LedgerTransaction> {
    return this.http.post<LedgerTransaction>(`${API}/transactions`, req);
  }
  listTransactions(filters: TransactionFilters = {}): Observable<LedgerTransaction[]> {
    let params = this.tz();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.account_id) params = params.set('account_id', filters.account_id);
    if (filters.category_id) params = params.set('category_id', filters.category_id);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.q) params = params.set('q', filters.q);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<LedgerTransaction[]>(`${API}/transactions`, { params });
  }
  getTransaction(id: string): Observable<LedgerTransaction> {
    return this.http.get<LedgerTransaction>(`${API}/transactions/${id}`);
  }
  updateTransaction(id: string, req: TransactionUpdate): Observable<LedgerTransaction> {
    return this.http.patch<LedgerTransaction>(`${API}/transactions/${id}`, req);
  }
  /** Stops the series this transaction heads or was added by. Copies already added stay. */
  stopRecurring(id: string): Observable<LedgerTransaction> {
    return this.http.post<LedgerTransaction>(`${API}/transactions/${id}/stop-recurring`, {});
  }
  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/transactions/${id}`);
  }

  // Budgets
  createBudget(req: { category_id: string; amount: number; period: LedgerBudget['period'] }): Observable<LedgerBudget> {
    return this.http.post<LedgerBudget>(`${API}/budgets`, req, { params: this.tz() });
  }
  updateBudget(id: string, req: { amount?: number; period?: LedgerBudget['period'] }): Observable<LedgerBudget> {
    return this.http.patch<LedgerBudget>(`${API}/budgets/${id}`, req);
  }
  listBudgets(): Observable<BudgetWithSpend[]> {
    // The current period is cut in the user's zone.
    return this.http.get<BudgetWithSpend[]>(`${API}/budgets`, { params: this.tz() });
  }
  deleteBudget(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/budgets/${id}`);
  }

  // Summary
  /** month is YYYY-MM: the user's month (todayKey(settings.timezone()).slice(0, 7)), not the browser's UTC one. */
  getSummary(month: string): Observable<LedgerSummary> {
    return this.http.get<LedgerSummary>(`${API}/summary`, { params: this.tz().set('month', month) });
  }

  // Net Worth
  listSnapshots(): Observable<NetWorthSnapshot[]> {
    return this.http.get<NetWorthSnapshot[]>(`${API}/networth`);
  }
  createSnapshot(req: { assets_total: number; liabilities_total: number; snapshot_date: string }): Observable<NetWorthSnapshot> {
    return this.http.post<NetWorthSnapshot>(`${API}/networth/snapshot`, req);
  }

  // Comparison: period B against period A (the base).
  getComparison(aFrom: string, aTo: string, bFrom: string, bTo: string): Observable<ComparisonResponse> {
    const params = this.tz()
      .set('period_a_from', aFrom)
      .set('period_a_to', aTo)
      .set('period_b_from', bFrom)
      .set('period_b_to', bTo);
    return this.http.get<ComparisonResponse>(`${API}/compare`, { params });
  }
}
