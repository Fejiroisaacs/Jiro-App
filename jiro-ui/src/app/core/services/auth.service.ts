import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, shareReplay, finalize, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  email_verified: boolean;
  bio?: string;
  avatar_url?: string;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  theme?: string;
  weight_unit?: string;
  timezone?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

const API_URL = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<User | null>(null);
  private accessToken = signal<string | null>(null);
  private initialized = signal<boolean>(false);
  private refreshing$: Observable<AuthResponse | null> | null = null;

  user = this.currentUser.asReadonly();
  isAuthenticated = computed(() => !!this.currentUser());
  isInitialized = this.initialized.asReadonly();

  constructor(private http: HttpClient, private router: Router) {
    // Restore from localStorage on init
    const stored = localStorage.getItem('jiro_user');
    const token = localStorage.getItem('jiro_token');
    if (stored && token) {
      this.currentUser.set(JSON.parse(stored));
      this.accessToken.set(token);
    }
  }

  getToken(): string | null {
    return this.accessToken();
  }

  /** Called by APP_INITIALIZER. Validates the stored session with the server
   *  before any route guard runs, so `isAuthenticated` reflects server truth. */
  async init(): Promise<void> {
    if (!this.accessToken()) {
      this.initialized.set(true);
      return;
    }
    await firstValueFrom(this.refresh()).catch(() => {});
    this.initialized.set(true);
  }

  register(email: string, password: string, displayName: string, username?: string) {
    const body: Record<string, string> = { email, password, display_name: displayName };
    if (username) body['username'] = username;
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, body, { withCredentials: true })
      .pipe(tap(res => this.handleAuth(res)));
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap(res => this.handleAuth(res)));
  }

  refresh(): Observable<AuthResponse | null> {
    // Share a single in-flight refresh across all concurrent callers.
    // Without this, multiple simultaneous 401s each fire their own refresh,
    // which causes token-rotation failures and silent API hangs.
    if (this.refreshing$) return this.refreshing$;
    this.refreshing$ = this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(res => this.handleAuth(res)),
        catchError(() => {
          this.clearAuth();
          return of(null);
        }),
        finalize(() => { this.refreshing$ = null; }),
        shareReplay(1),
      );
    return this.refreshing$;
  }

  logout() {
    if (!this.currentUser()) return; // already logged out — prevent duplicate navigation
    this.http.post(`${API_URL}/auth/logout`, {}, { withCredentials: true }).subscribe();
    this.clearAuth();
    this.router.navigate(['/login']);
  }

  updateSettings(settings: Partial<UserSettings>) {
    return this.http.patch<User>(`${API_URL}/user/me`, settings)
      .pipe(tap(user => {
        this.currentUser.set(user);
        localStorage.setItem('jiro_user', JSON.stringify(user));
      }));
  }

  updateProfile(profile: { username?: string; display_name?: string; bio?: string }) {
    return this.http.patch<User>(`${API_URL}/user/me`, profile)
      .pipe(tap(user => {
        this.currentUser.set(user);
        localStorage.setItem('jiro_user', JSON.stringify(user));
      }));
  }

  updateAvatar(avatarUrl: string) {
    const user = this.currentUser();
    if (user) {
      const updated = { ...user, avatar_url: avatarUrl };
      this.currentUser.set(updated);
      localStorage.setItem('jiro_user', JSON.stringify(updated));
    }
  }

  clearAvatar() {
    const user = this.currentUser();
    if (user) {
      const updated = { ...user, avatar_url: undefined };
      this.currentUser.set(updated);
      localStorage.setItem('jiro_user', JSON.stringify(updated));
    }
  }

  verifyEmail(token: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/verify-email`, { token })
      .pipe(tap(() => {
        const user = this.currentUser();
        if (user) {
          const updated = { ...user, email_verified: true };
          this.currentUser.set(updated);
          localStorage.setItem('jiro_user', JSON.stringify(updated));
        }
      }));
  }

  resendVerification() {
    return this.http.post<{ message: string }>(`${API_URL}/auth/resend-verification`, {});
  }

  forgotPassword(email: string) {
    return this.http.post<void>(`${API_URL}/auth/forgot-password`, { email });
  }

  resetPassword(token: string, password: string) {
    return this.http.post<void>(`${API_URL}/auth/reset-password`, { token, password });
  }

  private handleAuth(res: AuthResponse) {
    this.accessToken.set(res.access_token);
    this.currentUser.set(res.user);
    localStorage.setItem('jiro_token', res.access_token);
    localStorage.setItem('jiro_user', JSON.stringify(res.user));
  }

  private clearAuth() {
    this.accessToken.set(null);
    this.currentUser.set(null);
    localStorage.removeItem('jiro_token');
    localStorage.removeItem('jiro_user');
  }
}
