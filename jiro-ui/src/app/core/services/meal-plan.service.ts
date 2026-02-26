import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface MealPlanEntry {
  id: string;
  meal_plan_id: string;
  recipe_id: string | null;
  recipe_title: string | null;
  day_of_week: number; // 0=Mon … 6=Sun
  meal_slot: MealSlot;
  custom_label: string | null;
  position: number;
  created_at: string;
}

export interface MealPlan {
  id: string;
  user_id: string;
  week_start: string; // ISO date
  entries: MealPlanEntry[];
  created_at: string;
  updated_at: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface AddEntryRequest {
  recipe_id?: string;
  day_of_week: number;
  meal_slot: MealSlot;
  custom_label?: string;
}

const API = `${environment.apiUrl}/culinara`;

@Injectable({ providedIn: 'root' })
export class MealPlanService {
  constructor(private http: HttpClient) {}

  getMealPlan(weekStart?: string): Observable<MealPlan> {
    const params = weekStart ? `?week=${weekStart}` : '';
    return this.http.get<MealPlan>(`${API}/meal-plan${params}`);
  }

  addEntry(planId: string, req: AddEntryRequest): Observable<MealPlanEntry> {
    return this.http.post<MealPlanEntry>(`${API}/meal-plan/${planId}/entries`, req);
  }

  removeEntry(entryId: string): Observable<void> {
    return this.http.delete<void>(`${API}/meal-plan/entries/${entryId}`);
  }
}
