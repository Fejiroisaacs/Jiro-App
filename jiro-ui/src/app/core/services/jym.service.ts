import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

const API_URL = `${environment.apiUrl}/jym`;

// ─── Exercises ────────────────────────────────────────────────────────────────

export interface Exercise {
  id: string;
  user_id: string;
  name: string;
  muscle_group: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SetHistory {
  session_id: string;
  date: string;
  weight: number;
  reps: number;
  est_1rm: number;
  is_pr: boolean;
  session_type: string;
}

export interface ExerciseWithHistory extends Exercise {
  best_weight: number;
  est_1rm: number;
  history: SetHistory[];
}

export interface ExercisePR {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
  weight: number;
  reps: number;
  est_1rm: number;
  date: string;
}

// ─── Splits ───────────────────────────────────────────────────────────────────

export interface Split {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  routine_count: number;
  created_at: string;
  updated_at: string;
}

export interface RoutineItem {
  id: string;
  routine_id: string;
  exercise_id: string;
  target_sets: number;
  target_reps: number;
  order_index: number;
  exercise_name: string;
  muscle_group: string | null;
}

export interface Routine {
  id: string;
  split_id: string;
  name: string;
  day_order: number;
  created_at: string;
  items: RoutineItem[];
}

export interface SplitWithRoutines extends Split {
  routines: Routine[];
}

// ─── Body Weight ──────────────────────────────────────────────────────────────

export interface BodyWeight {
  id: string;
  user_id: string;
  recorded_at: string;
  weight_kg: number;
  created_at: string;
}

// ─── Series ───────────────────────────────────────────────────────────────────

export interface SplitSeries {
  id: string;
  user_id: string;
  split_id: string;
  name: string;
  duration_type: 'weeks' | 'sessions' | 'open';
  target_weeks: number | null;
  target_sessions: number | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface SplitSeriesSummary extends SplitSeries {
  split_name: string;
  session_count: number;
}

export interface SeriesSessionPoint {
  session_id: string;
  date: string;
  session_type: string;
  total_volume: number;
  set_count: number;
}

export interface ProgressionPoint {
  session_id: string;
  date: string;
  best_est_1rm: number;
}

export interface ExerciseProgression {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  points: ProgressionPoint[];
}

export interface SplitSeriesDetail extends SplitSeriesSummary {
  sessions: SeriesSessionPoint[];
  exercise_progressions: ExerciseProgression[];
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  user_id: string;
  routine_id: string | null;
  series_id: string | null;
  session_type: string;
  started_at: string;
  ended_at: string | null;
  notes: string | null;
}

export interface SessionSummary extends Session {
  routine_name: string | null;
  set_count: number;
  total_volume: number;
  muscle_groups: string[];
}

export interface SessionSet {
  id: string;
  session_id: string;
  exercise_id: string;
  set_number: number;
  weight: number;
  reps_performed: number;
  rpe: number | null;
  is_pr: boolean;
  is_warmup: boolean;
  exercise_note: string | null;
  created_at: string;
  exercise_name: string;
  muscle_group: string | null;
}

export interface SessionWithSets extends Session {
  routine_name: string | null;
  sets: SessionSet[];
}

export interface StartSessionResponse extends Session {
  targets: RoutineItem[];
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface CreateExerciseRequest { name: string; muscle_group?: string; notes?: string; }
export interface UpdateExerciseRequest { name?: string; muscle_group?: string; notes?: string; }
export interface CreateSplitRequest { name: string; description?: string; }
export interface UpdateSplitRequest { name?: string; description?: string; }
export interface CreateRoutineRequest { name: string; day_order?: number; }
export interface UpdateRoutineRequest { name?: string; day_order?: number; }
export interface ReplaceItemEntry { exercise_id: string; target_sets: number; target_reps: number; }
export interface CreateSessionRequest { routine_id?: string; series_id?: string; }
export interface UpdateSessionRequest { ended_at?: string; notes?: string; session_type?: string; }
export interface CreateSetRequest { exercise_id: string; set_number: number; weight: number; reps_performed: number; rpe?: number; is_warmup?: boolean; exercise_note?: string; }
export interface UpdateSetRequest { weight?: number; reps_performed?: number; rpe?: number; is_warmup?: boolean; exercise_note?: string; }
export interface CreateSeriesRequest { split_id: string; name: string; duration_type: 'weeks' | 'sessions' | 'open'; target_weeks?: number; target_sessions?: number; }
export interface UpdateSeriesRequest { name?: string; ended_at?: string; }

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class JymService {
  constructor(private http: HttpClient) {}

  // Exercises
  listExercises(q?: string, mg?: string): Observable<Exercise[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (mg) params = params.set('mg', mg);
    return this.http.get<Exercise[]>(`${API_URL}/exercises`, { params });
  }

  getExercise(id: string): Observable<ExerciseWithHistory> {
    return this.http.get<ExerciseWithHistory>(`${API_URL}/exercises/${id}`);
  }

  createExercise(req: CreateExerciseRequest): Observable<Exercise> {
    return this.http.post<Exercise>(`${API_URL}/exercises`, req);
  }

  updateExercise(id: string, req: UpdateExerciseRequest): Observable<Exercise> {
    return this.http.put<Exercise>(`${API_URL}/exercises/${id}`, req);
  }

  deleteExercise(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/exercises/${id}`);
  }

  getPRs(): Observable<ExercisePR[]> {
    return this.http.get<ExercisePR[]>(`${API_URL}/prs`);
  }

  // Splits
  listSplits(): Observable<Split[]> {
    return this.http.get<Split[]>(`${API_URL}/splits`);
  }

  getSplit(id: string): Observable<SplitWithRoutines> {
    return this.http.get<SplitWithRoutines>(`${API_URL}/splits/${id}`);
  }

  createSplit(req: CreateSplitRequest): Observable<Split> {
    return this.http.post<Split>(`${API_URL}/splits`, req);
  }

  updateSplit(id: string, req: UpdateSplitRequest): Observable<Split> {
    return this.http.put<Split>(`${API_URL}/splits/${id}`, req);
  }

  deleteSplit(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/splits/${id}`);
  }

  // Routines
  createRoutine(splitId: string, req: CreateRoutineRequest): Observable<Routine> {
    return this.http.post<Routine>(`${API_URL}/splits/${splitId}/routines`, req);
  }

  updateRoutine(id: string, req: UpdateRoutineRequest): Observable<Routine> {
    return this.http.put<Routine>(`${API_URL}/routines/${id}`, req);
  }

  deleteRoutine(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/routines/${id}`);
  }

  replaceRoutineItems(routineId: string, items: ReplaceItemEntry[]): Observable<RoutineItem[]> {
    return this.http.put<RoutineItem[]>(`${API_URL}/routines/${routineId}/items`, items);
  }

  // Sessions
  startSession(req: CreateSessionRequest): Observable<StartSessionResponse> {
    return this.http.post<StartSessionResponse>(`${API_URL}/sessions`, req);
  }

  listSessions(): Observable<SessionSummary[]> {
    return this.http.get<SessionSummary[]>(`${API_URL}/sessions`);
  }

  getSession(id: string): Observable<SessionWithSets> {
    return this.http.get<SessionWithSets>(`${API_URL}/sessions/${id}`);
  }

  updateSession(id: string, req: UpdateSessionRequest): Observable<Session> {
    return this.http.patch<Session>(`${API_URL}/sessions/${id}`, req);
  }

  deleteSession(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/sessions/${id}`);
  }

  // Sets
  logSet(sessionId: string, req: CreateSetRequest): Observable<SessionSet> {
    return this.http.post<SessionSet>(`${API_URL}/sessions/${sessionId}/sets`, req);
  }

  updateSet(id: string, req: UpdateSetRequest): Observable<SessionSet> {
    return this.http.put<SessionSet>(`${API_URL}/sets/${id}`, req);
  }

  deleteSet(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/sets/${id}`);
  }

  // Body weights
  logBodyWeight(req: { recorded_at: string; weight_kg: number }): Observable<BodyWeight> {
    return this.http.post<BodyWeight>(`${API_URL}/bodyweights`, req);
  }

  listBodyWeights(): Observable<BodyWeight[]> {
    return this.http.get<BodyWeight[]>(`${API_URL}/bodyweights`);
  }

  deleteBodyWeight(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/bodyweights/${id}`);
  }

  // Series
  createSeries(req: CreateSeriesRequest): Observable<SplitSeriesSummary> {
    return this.http.post<SplitSeriesSummary>(`${API_URL}/series`, req);
  }

  listSeries(): Observable<SplitSeriesSummary[]> {
    return this.http.get<SplitSeriesSummary[]>(`${API_URL}/series`);
  }

  getSeries(id: string): Observable<SplitSeriesDetail> {
    return this.http.get<SplitSeriesDetail>(`${API_URL}/series/${id}`);
  }

  updateSeries(id: string, req: UpdateSeriesRequest): Observable<SplitSeriesSummary> {
    return this.http.patch<SplitSeriesSummary>(`${API_URL}/series/${id}`, req);
  }

  deleteSeries(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/series/${id}`);
  }

  // CSV Export
  exportSessionsCSV(from?: string, to?: string): Observable<Blob> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get(`${API_URL}/export/sessions.csv`, { responseType: 'blob', params });
  }
}
