import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SessionSummary } from './jym.service';

/** GET /day: one calendar day across the four modules. Every list is always present. */
export interface DayView {
  /** YYYY-MM-DD in `timezone`. */
  date: string;
  timezone: string;
  is_today: boolean;
  jym: {
    sessions: SessionSummary[];
    body_weight: { id: string; weight_kg: number } | null;
    weight_unit: string;
  };
  culinara: {
    cooked: DayCooked[];
    planned: DayPlanned[];
  };
  journal: { entries: DayJournalEntry[] };
  ledger: {
    transactions: DayTransaction[];
    spent: number;
    income: number;
  };
}

export interface DayCooked {
  trial_id: string;
  recipe_id: string;
  recipe_title: string;
  rating: number | null;
  notes: string | null;
  date_cooked: string;
}

export interface DayPlanned {
  id: string;
  meal_slot: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  recipe_id: string | null;
  recipe_title: string | null;
  custom_label: string | null;
}

export interface DayJournalEntry {
  id: string;
  title: string | null;
  excerpt: string;
  mood: string | null;
  tags: string[];
  created_at: string;
}

export interface DayTransaction {
  id: string;
  type: 'income' | 'expense' | 'transfer';
  /** Signed as stored: expenses negative. A transfer appears once, by its outgoing leg. */
  amount: number;
  description: string;
  account_id: string;
  account_name: string;
  currency: string;
  transfer_to_account_name: string | null;
  category_id: string | null;
  category_name: string | null;
  category_color: string | null;
}

@Injectable({ providedIn: 'root' })
export class DayService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/day`;

  /**
   * `timeZone` is only a fallback for an account with no timezone setting, so
   * the API cuts the day where this browser does.
   */
  getDay(date: string, timeZone: string): Observable<DayView> {
    const params = new HttpParams().set('date', date).set('tz', timeZone);
    return this.http.get<DayView>(this.apiUrl, { params });
  }
}
