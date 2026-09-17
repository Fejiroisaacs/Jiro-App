import { Injectable, computed, signal } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { readSession, removeSession, writeSession } from '../storage';

export interface AdminStats {
  total_users: number;
  total_sessions: number;
  total_recipes: number;
  events_by_day: EventDayStat[];
}

export interface EventDayStat {
  date: string;
  event: string;
  count: number;
}

export interface AdminUser {
  id: string;
  email: string;
  username: string | null;
  display_name: string | null;
  email_verified: boolean;
  session_count: number;
  recipe_count: number;
  split_count: number;
  created_at: string;
  last_login_at: string | null;
}

export interface AdminUserDetail extends AdminUser {
  last_session_at: string | null;
}

export interface AnalyticsEvent {
  id: string;
  user_id: string | null;
  user_email: string | null;
  username: string | null;
  event: string;
  properties: Record<string, unknown> | null;
  occurred_at: string;
}

const SESSION_KEY = 'jiro_admin_secret';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly base = `${environment.apiUrl}/admin`;

  /** The admin credential, restored from sessionStorage so a refresh inside the
   *  panel does not ask again. `null` means "no admin login in this tab" and is
   *  meaningfully different from `''`: a blank secret is a *valid* credential in
   *  local dev (see admin-login's placeholder), so emptiness cannot stand in for
   *  absence. Guarded storage access — there is none under `platform-server`,
   *  where this stays null and the panel is never rendered statically. */
  secret = signal<string | null>(readSession(SESSION_KEY));

  /** Whether this tab has been through the admin login. What `adminGuard` asks. */
  isAuthenticated = computed(() => this.secret() !== null);

  constructor(private http: HttpClient) {}

  setSecret(s: string) {
    this.secret.set(s);
    writeSession(SESSION_KEY, s);
  }

  clearSecret() {
    this.secret.set(null);
    removeSession(SESSION_KEY);
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({ 'X-Admin-Secret': this.secret() ?? '' });
  }

  getStats(): Observable<AdminStats> {
    return this.http.get<AdminStats>(`${this.base}/stats`, { headers: this.headers() });
  }

  listUsers(search = '', page = 1): Observable<AdminUser[]> {
    const params = new HttpParams()
      .set('q', search)
      .set('page', page.toString());
    return this.http.get<AdminUser[]>(`${this.base}/users`, { headers: this.headers(), params });
  }

  getUser(id: string): Observable<AdminUserDetail> {
    return this.http.get<AdminUserDetail>(`${this.base}/users/${id}`, { headers: this.headers() });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/users/${id}`, { headers: this.headers() });
  }

  sendPasswordReset(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/users/${id}/send-password-reset`, {}, { headers: this.headers() });
  }

  revokeSessions(id: string): Observable<void> {
    return this.http.post<void>(`${this.base}/users/${id}/revoke-sessions`, {}, { headers: this.headers() });
  }

  listEvents(event = '', userId = '', page = 1): Observable<AnalyticsEvent[]> {
    let params = new HttpParams().set('page', page.toString());
    if (event) params = params.set('event', event);
    if (userId) params = params.set('user_id', userId);
    return this.http.get<AnalyticsEvent[]>(`${this.base}/events`, { headers: this.headers(), params });
  }

  listFeedback(offset = 0): Observable<FeedbackItem[]> {
    const params = new HttpParams().set('limit', '20').set('offset', offset.toString());
    return this.http.get<FeedbackItem[]>(`${this.base}/feedback`, { headers: this.headers(), params });
  }

  deleteFeedback(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/feedback/${id}`, { headers: this.headers() });
  }
}

export interface FeedbackItem {
  id: string;
  user_id: string;
  type: string;
  message: string;
  created_at: string;
  username: string;
  email: string;
}
