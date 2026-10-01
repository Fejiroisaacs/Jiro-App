import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsService } from './settings.service';

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
  /** Only populated by listExercises(); null elsewhere and when never performed. */
  last_performed_at: string | null;
}

export interface SetHistory {
  session_id: string;
  date: string;
  /** The session's end; null while it is still in progress. */
  ended_at: string | null;
  set_number: number;
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  est_1rm: number;
  is_pr: boolean;
  session_type: string;
  exercise_note: string | null;
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

/** One set with its estimated 1RM, in kg; `date` is its workout's start, given for last time. */
export interface SetRef {
  weight: number;
  reps: number;
  est_1rm: number;
  date?: string;
}

export interface ExerciseReport {
  exercise_id: string;
  name: string;
  muscle_group: string | null;
  /** Working sets. */
  sets: number;
  volume: number;
  is_pr: boolean;
  /** The best record set if the lift set a record, otherwise the best working set. */
  best: SetRef | null;
  /** The best set of the latest finished normal workout before this one. */
  previous: SetRef | null;
}

/** A workout's summary, by the same rules as every session list. */
export interface SessionReport extends SessionSummary {
  exercises: ExerciseReport[];
  muscles: { muscle_group: string; sets: number }[];
}

// ─── Splits ───────────────────────────────────────────────────────────────────

export interface Split {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  visibility: string;
  tags: string[];
  routine_count: number;
  created_at: string;
  updated_at: string;
}

export interface PublicSplitSummary {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  routine_count: number;
  created_at: string;
}

export interface PublicSplitDetail {
  split_id: string;
  split_name: string;
  tags: string[];
  routines: ShareRoutinePreview[];
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
  user_id: string;
  split_id: string | null;
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
  /** The day to train next in an active series. */
  next_routine: { id: string; name: string; day_order: number } | null;
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
  /** Working sets; warm-ups are left out. */
  set_count: number;
  /** Lifts with a new record in this session. */
  pr_count: number;
  /** Weight × reps over working sets, in kg. */
  total_volume: number;
  muscle_groups: string[];
  /** When the first and last sets (warm-ups included) were logged, by the server's clock; null with no sets. */
  first_set_at: string | null;
  last_set_at: string | null;
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

export interface SessionAttachment {
  id: string;
  session_id: string;
  user_id: string;
  exercise_id: string | null;
  object_key: string;
  file_url: string;
  file_type: string;
  label: string | null;
  created_at: string;
}

export interface ExerciseFormCheck extends SessionAttachment {
  session_date: string;
}

/** One exercise in a workout's own list; targets are the plan's when it started, null outside it. */
export interface SessionExercise {
  exercise_id: string;
  exercise_name: string;
  muscle_group: string | null;
  position: number;
  target_sets: number | null;
  target_reps: number | null;
}

export interface SessionWithSets extends Session {
  routine_name: string | null;
  sets: SessionSet[];
  attachments: SessionAttachment[];
  /** The routine's live plan, kept for older app versions; the player reads `exercises`. */
  targets: RoutineItem[];
  /** The workout's own list, in order. */
  exercises: SessionExercise[];
}

export interface StartSessionResponse extends Session {
  targets: RoutineItem[];
  exercises: SessionExercise[];
}

// ─── Requests ─────────────────────────────────────────────────────────────────

export interface CreateExerciseRequest { name: string; muscle_group?: string; notes?: string; }
export interface UpdateExerciseRequest { name?: string; muscle_group?: string; notes?: string; }
export interface CreateSplitRequest { name: string; description?: string; tags?: string[]; }
export interface UpdateSplitRequest { name?: string; description?: string; visibility?: string; tags?: string[]; }
export interface CreateRoutineRequest { name: string; day_order?: number; }
export interface UpdateRoutineRequest { name?: string; day_order?: number; }
export interface ReplaceItemEntry { exercise_id: string; target_sets: number; target_reps: number; }
export interface RoutineItemsEntry { routine_id: string; items: ReplaceItemEntry[]; }
export interface RoutineItemsResult { routine_id: string; items: RoutineItem[]; }
export interface CreateSessionRequest {
  routine_id?: string; series_id?: string; session_type?: 'normal' | 'deload' | 'test';
  /** Start even though another workout is open. */ force?: boolean;
  /** Both together log a past workout, created finished. */ started_at?: string; ended_at?: string;
  /** The workout's exercises in order (Repeat); omitted, the routine's items. */ exercise_ids?: string[];
}
export interface UpdateSessionRequest { ended_at?: string; notes?: string; session_type?: string; }
/** A finished workout's new start or end; a field left out keeps its value. */
export interface UpdateSessionTimesRequest { started_at?: string; ended_at?: string; }
export interface CreateSetRequest {
  exercise_id: string; set_number: number; weight: number; reps_performed: number; rpe?: number; is_warmup?: boolean; exercise_note?: string;
  /** Adds the set to a finished workout; the server times it inside that workout. */ fix?: boolean;
}
export interface UpdateSetRequest { weight?: number; reps_performed?: number; rpe?: number; is_warmup?: boolean; exercise_note?: string; }
export interface CreateSeriesRequest { split_id: string; name: string; duration_type: 'weeks' | 'sessions' | 'open'; target_weeks?: number; target_sessions?: number; }
export interface UpdateSeriesRequest { name?: string; ended_at?: string; }

// ─── Shares ───────────────────────────────────────────────────────────────────

export interface ShareExercisePreview {
  name: string;
  muscle_group: string | null;
  target_sets: number;
  target_reps: number;
}

export interface ShareRoutinePreview {
  name: string;
  day_order: number;
  exercises: ShareExercisePreview[];
}

export interface SharePreview {
  share_id: string;
  split_name: string;
  routines: ShareRoutinePreview[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class JymService {
  constructor(private http: HttpClient) {}

  private readonly settings = inject(SettingsService);

  // Exercises
  listExercises(q?: string, mg?: string): Observable<Exercise[]> {
    let params = new HttpParams();
    if (q) params = params.set('q', q);
    if (mg) params = params.set('mg', mg);
    return this.http.get<Exercise[]>(`${API_URL}/exercises`, { params });
  }

  /** Every logged set by default; `limit` keeps only the latest ones. */
  getExercise(id: string, opts: { limit?: number } = {}): Observable<ExerciseWithHistory> {
    const params = opts.limit ? new HttpParams().set('limit', String(opts.limit)) : undefined;
    return this.http.get<ExerciseWithHistory>(`${API_URL}/exercises/${id}`, { params });
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

  /** Saves several days of one split in one transaction (a move between days). */
  replaceSplitItems(splitId: string, routines: RoutineItemsEntry[]): Observable<RoutineItemsResult[]> {
    return this.http.put<RoutineItemsResult[]>(`${API_URL}/splits/${splitId}/items`, { routines });
  }

  // Sessions
  startSession(req: CreateSessionRequest): Observable<StartSessionResponse> {
    return this.http.post<StartSessionResponse>(`${API_URL}/sessions`, req);
  }

  /** Newest 50 by default. `from` (YYYY-MM-DD) returns every session since that day plus unfinished ones; `before` pages back. */
  listSessions(opts: { from?: string; before?: string; beforeId?: string; limit?: number } = {}): Observable<SessionSummary[]> {
    let params = new HttpParams();
    // tz is the API's fallback when the account has no timezone.
    if (opts.from) params = params.set('from', opts.from).set('tz', this.settings.timezone());
    if (opts.before) params = params.set('before', opts.before);
    if (opts.beforeId) params = params.set('before_id', opts.beforeId);
    if (opts.limit) params = params.set('limit', String(opts.limit));
    return this.http.get<SessionSummary[]>(`${API_URL}/sessions`, { params });
  }

  getSession(id: string): Observable<SessionWithSets> {
    return this.http.get<SessionWithSets>(`${API_URL}/sessions/${id}`);
  }

  updateSession(id: string, req: UpdateSessionRequest): Observable<Session> {
    return this.http.patch<Session>(`${API_URL}/sessions/${id}`, req);
  }

  /** Moves a finished workout's start or end; the times must still hold every logged set. */
  updateSessionTimes(id: string, req: UpdateSessionTimesRequest): Observable<Session> {
    return this.http.patch<Session>(`${API_URL}/sessions/${id}/times`, req);
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

  /** Puts an exercise on a workout's list, last; one already there stays where it is. */
  addSessionExercise(sessionId: string, exerciseId: string): Observable<SessionExercise> {
    return this.http.post<SessionExercise>(`${API_URL}/sessions/${sessionId}/exercises`, { exercise_id: exerciseId });
  }

  /** Sets a workout's order; the list names each of its exercises once. */
  reorderSessionExercises(sessionId: string, exerciseIds: string[]): Observable<void> {
    return this.http.put<void>(`${API_URL}/sessions/${sessionId}/exercises/order`, { exercise_ids: exerciseIds });
  }

  /** Removes an entire exercise block from a session — every logged set for it, in one call. */
  deleteSessionExercise(sessionId: string, exerciseId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/sessions/${sessionId}/exercises/${exerciseId}`);
  }

  /** A workout's summary: totals, each lift's best set against last time, and sets per muscle. */
  getSessionReport(sessionId: string): Observable<SessionReport> {
    return this.http.get<SessionReport>(`${API_URL}/sessions/${sessionId}/summary`);
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
    // from, to and date are the user's days; tz is the API's fallback when the account has no timezone.
    let params = new HttpParams().set('tz', this.settings.timezone());
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return this.http.get(`${API_URL}/export/sessions.csv`, { responseType: 'blob', params });
  }

  // Split shares
  createShare(splitId: string): Observable<{ share_id: string; url: string; expires_at: string }> {
    return this.http.post<{ share_id: string; url: string; expires_at: string }>(`${API_URL}/splits/${splitId}/share`, {});
  }

  /** The split's live share links, newest first; expires_at is null for old links that never expire. */
  listShares(splitId: string): Observable<{ share_id: string; url: string; expires_at: string | null }[]> {
    return this.http.get<{ share_id: string; url: string; expires_at: string | null }[]>(`${API_URL}/splits/${splitId}/shares`);
  }

  revokeShare(shareId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/shares/${shareId}`);
  }

  getSharePreview(shareId: string): Observable<SharePreview> {
    return this.http.get<SharePreview>(`${API_URL}/shares/${shareId}`);
  }

  importShare(shareId: string): Observable<{ split_id: string }> {
    return this.http.post<{ split_id: string }>(`${API_URL}/shares/${shareId}/import`, {});
  }

  // Public split discovery
  listPublicSplits(search = '', tag = '', muscleGroup = '', page = 1): Observable<PublicSplitSummary[]> {
    let params = new HttpParams().set('page', page.toString());
    if (search) params = params.set('search', search);
    if (tag) params = params.set('tag', tag);
    if (muscleGroup) params = params.set('muscle_group', muscleGroup);
    return this.http.get<PublicSplitSummary[]>(`${environment.apiUrl}/jym/public-splits`, { params });
  }

  getPublicSplit(splitId: string): Observable<PublicSplitDetail> {
    return this.http.get<PublicSplitDetail>(`${environment.apiUrl}/jym/public-splits/${splitId}`);
  }

  importPublicSplit(splitId: string): Observable<{ split_id: string }> {
    return this.http.post<{ split_id: string }>(`${API_URL}/public-splits/${splitId}/import`, {});
  }

  // ── Templates ──────────────────────────────────────────────────────────────
  listTemplates(): Observable<Routine[]> {
    return this.http.get<Routine[]>(`${API_URL}/templates`);
  }

  createTemplateFromSession(sessionId: string, name: string): Observable<Routine> {
    return this.http.post<Routine>(`${API_URL}/sessions/${sessionId}/template`, { name });
  }

  deleteTemplate(routineId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/routines/${routineId}`);
  }

  // ── Form Checks ────────────────────────────────────────────────────────────
  listExerciseFormChecks(exerciseId: string): Observable<ExerciseFormCheck[]> {
    return this.http.get<ExerciseFormCheck[]>(`${API_URL}/exercises/${exerciseId}/form-checks`);
  }
}
