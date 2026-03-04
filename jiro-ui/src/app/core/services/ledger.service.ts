import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API = `${environment.apiUrl}/ledger`;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface LedgerAccount {
  id: string;
  user_id: string;
  name: string;
  type: 'checking' | 'savings' | 'credit' | 'investment' | 'cash';
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
  is_recurring: boolean;
  recurrence_interval: 'weekly' | 'biweekly' | 'monthly' | 'yearly' | null;
  recurrence_day: number | null;
  transfer_to_account_id: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  category_color?: string | null;
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

export interface ComparisonValue {
  a: number;
  b: number;
  delta: number;
  delta_pct: number;
}

export interface ComparisonResponse {
  period_a: { from: string; to: string };
  period_b: { from: string; to: string };
  summary: {
    income: ComparisonValue;
    expenses: ComparisonValue;
    net: ComparisonValue;
  };
  categories: {
    category_id: string;
    name: string;
    color: string | null;
    a: number;
    b: number;
    delta: number;
    delta_pct: number;
  }[];
}

export interface TransactionFilters {
  from?: string;
  to?: string;
  account_id?: string;
  category_id?: string;
  type?: string;
  page?: number;
  limit?: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LedgerService {
  constructor(private http: HttpClient) {}

  // Accounts
  createAccount(req: Partial<LedgerAccount>): Observable<LedgerAccount> {
    return this.http.post<LedgerAccount>(`${API}/accounts`, req);
  }
  listAccounts(): Observable<LedgerAccount[]> {
    return this.http.get<LedgerAccount[]>(`${API}/accounts`);
  }
  getAccount(id: string): Observable<AccountWithTransactions> {
    return this.http.get<AccountWithTransactions>(`${API}/accounts/${id}`);
  }
  updateAccount(id: string, req: Partial<LedgerAccount>): Observable<LedgerAccount> {
    return this.http.patch<LedgerAccount>(`${API}/accounts/${id}`, req);
  }
  deleteAccount(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/accounts/${id}`);
  }

  // Categories
  createCategory(req: Partial<LedgerCategory>): Observable<LedgerCategory> {
    return this.http.post<LedgerCategory>(`${API}/categories`, req);
  }
  listCategories(): Observable<CategoryTree[]> {
    return this.http.get<CategoryTree[]>(`${API}/categories`);
  }
  updateCategory(id: string, req: Partial<LedgerCategory>): Observable<LedgerCategory> {
    return this.http.patch<LedgerCategory>(`${API}/categories/${id}`, req);
  }
  deleteCategory(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/categories/${id}`);
  }

  // Transactions
  createTransaction(req: Partial<LedgerTransaction> & { date: string; amount: number }): Observable<LedgerTransaction> {
    return this.http.post<LedgerTransaction>(`${API}/transactions`, req);
  }
  listTransactions(filters: TransactionFilters = {}): Observable<LedgerTransaction[]> {
    let params = new HttpParams();
    if (filters.from) params = params.set('from', filters.from);
    if (filters.to) params = params.set('to', filters.to);
    if (filters.account_id) params = params.set('account_id', filters.account_id);
    if (filters.category_id) params = params.set('category_id', filters.category_id);
    if (filters.type) params = params.set('type', filters.type);
    if (filters.page) params = params.set('page', filters.page.toString());
    if (filters.limit) params = params.set('limit', filters.limit.toString());
    return this.http.get<LedgerTransaction[]>(`${API}/transactions`, { params });
  }
  getTransaction(id: string): Observable<LedgerTransaction> {
    return this.http.get<LedgerTransaction>(`${API}/transactions/${id}`);
  }
  updateTransaction(id: string, req: Partial<LedgerTransaction>): Observable<LedgerTransaction> {
    return this.http.patch<LedgerTransaction>(`${API}/transactions/${id}`, req);
  }
  deleteTransaction(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/transactions/${id}`);
  }

  // Budgets
  createBudget(req: Partial<LedgerBudget> & { start_date: string }): Observable<LedgerBudget> {
    return this.http.post<LedgerBudget>(`${API}/budgets`, req);
  }
  listBudgets(): Observable<BudgetWithSpend[]> {
    return this.http.get<BudgetWithSpend[]>(`${API}/budgets`);
  }
  deleteBudget(id: string): Observable<void> {
    return this.http.delete<void>(`${API}/budgets/${id}`);
  }

  // Summary
  getSummary(month: string): Observable<LedgerSummary> {
    return this.http.get<LedgerSummary>(`${API}/summary`, { params: { month } });
  }

  // Net Worth
  listSnapshots(): Observable<NetWorthSnapshot[]> {
    return this.http.get<NetWorthSnapshot[]>(`${API}/networth`);
  }
  createSnapshot(req: { assets_total: number; liabilities_total: number; snapshot_date: string }): Observable<NetWorthSnapshot> {
    return this.http.post<NetWorthSnapshot>(`${API}/networth/snapshot`, req);
  }

  // Comparison
  getComparison(aFrom: string, aTo: string, bFrom: string, bTo: string): Observable<ComparisonResponse> {
    const params = new HttpParams()
      .set('period_a_from', aFrom)
      .set('period_a_to', aTo)
      .set('period_b_from', bFrom)
      .set('period_b_to', bTo);
    return this.http.get<ComparisonResponse>(`${API}/compare`, { params });
  }
}
