import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, shareReplay, finalize } from 'rxjs';
import { environment } from '../../../environments/environment';
import { hasLocalStorage, readLocal, removeLocal, writeLocal } from '../storage';

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

  // Promise mirror of the `initialized` signal, for callers that need to *wait*
  // rather than react — chiefly the route guards. Built eagerly in a field
  // initialiser (the Promise executor runs synchronously, so `resolveInitialized`
  // is assigned before anything can read it) so that a guard which somehow runs
  // before `init()` still has a promise to await instead of missing the edge.
  private resolveInitialized!: () => void;
  private readonly initializedPromise = new Promise<void>(resolve => {
    this.resolveInitialized = resolve;
  });

  user = this.currentUser.asReadonly();
  isAuthenticated = computed(() => !!this.currentUser());
  isInitialized = this.initialized.asReadonly();

  constructor(private http: HttpClient, private router: Router) {
    // Restore from storage on init. Guarded: there is no localStorage under
    // `platform-server`, and it throws outright in some private windows.
    const stored = readLocal('jiro_user');
    const token = readLocal('jiro_token');
    if (stored && token) {
      try {
        this.currentUser.set(JSON.parse(stored));
        this.accessToken.set(token);
      } catch {
        // Corrupt `jiro_user` JSON — drop it rather than breaking construction
        // of a root service, which would take the whole app down.
        removeLocal('jiro_user');
        removeLocal('jiro_token');
      }
    }
  }

  /** Resolves once auth has settled — i.e. once `init()` has either decided
   *  there is nothing to do or finished its background refresh. Never rejects.
   *  Await this before reading `isAuthenticated()` outside a template. */
  whenInitialized(): Promise<void> {
    return this.initializedPromise;
  }

  /** The single place that opens the gate, so the signal and the promise can
   *  never disagree. Idempotent: re-resolving a promise is a no-op. */
  private markInitialized(): void {
    this.initialized.set(true);
    this.resolveInitialized();
  }

  getToken(): string | null {
    return this.accessToken();
  }

  /** Called by `provideAppInitializer`, whose promise gates bootstrap — so this
   *  returns immediately and *never* awaits the network. It used to await the
   *  refresh, which put a round-trip in front of the first paint of every page
   *  including the public landing page, against an endpoint rate-limited to
   *  5 req/min/IP.
   *
   *  Three cases:
   *   1. No browser storage at all (prerender/SSR): there is no stored session
   *      and no refresh cookie to present, so this is a pure no-op. Firing HTTP
   *      here would also stall server-side rendering waiting for the response.
   *   2. No stored token, or a token that is still valid: settle synchronously.
   *      Skipping unnecessary refreshes is what prevents sign-out on
   *      close/reopen while the token is still good.
   *   3. Stored token already expired: start the refresh in the background and
   *      return at once. `initialized` stays false until that request settles.
   *
   *  How this interleaves with `authGuard` — and why it cannot log anyone out:
   *  the guard awaits `whenInitialized()` *before* it looks at
   *  `isAuthenticated()`, and the only thing that resolves that promise is
   *  `markInitialized()`, which in case 3 is called from `finalize` — i.e. on
   *  success, on failure and on unsubscribe alike. So a user whose refresh is
   *  still in flight leaves the guard parked on an unresolved promise: the
   *  guard can never observe the mid-flight state, and therefore can never
   *  conclude "not authenticated" about a session that is about to come back.
   *  Rendering stops waiting; authorisation does not. The only thing that
   *  changed for protected routes is that the shell now paints while the guard
   *  waits, instead of the whole bootstrap blocking.
   *
   *  A 401 on refresh means the session is truly dead — clear auth so the
   *  guard redirects to login. Non-401 errors (e.g. offline) keep cached
   *  state so the interceptor can retry lazily once connectivity is restored. */
  init(): Promise<void> {
    if (!hasLocalStorage()) {
      this.markInitialized();
      return Promise.resolve();
    }
    const token = this.accessToken();
    if (!token || !this.isTokenExpired(token)) {
      this.markInitialized();
      return Promise.resolve();
    }
    // Fire-and-forget: deliberately neither awaited nor returned. Routed
    // through the shared `refreshing$` slot so that a request from a public
    // page which 401s while this is in flight latches onto this same request
    // instead of firing a second POST /auth/refresh — the refresh cookie
    // rotates on use, so two concurrent refreshes race and one loses, which
    // would sign out a user who has a perfectly live session.
    this.startRefresh(false)
      .pipe(finalize(() => this.markInitialized()))
      .subscribe();
    return Promise.resolve();
  }

  private isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp * 1000 < Date.now();
    } catch {
      return true;
    }
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
    // The 401 interceptor's entry point: any failed refresh means a dead session.
    return this.startRefresh(true);
  }

  /** Share a single in-flight refresh across all concurrent callers.
   *  Without this, multiple simultaneous 401s each fire their own refresh,
   *  which causes token-rotation failures and silent API hangs.
   *
   *  `clearOnAnyError` is the one thing the two entry points disagree about:
   *  the interceptor treats any failed refresh as a dead session, while
   *  startup (`init()`) only clears on an actual 401, so an offline reload
   *  keeps the cached user and can retry later. */
  private startRefresh(clearOnAnyError: boolean): Observable<AuthResponse | null> {
    if (this.refreshing$) return this.refreshing$;
    this.refreshing$ = this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(res => this.handleAuth(res)),
        catchError((err) => {
          if (clearOnAnyError || err?.status === 401) this.clearAuth();
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
        writeLocal('jiro_user', JSON.stringify(user));
      }));
  }

  updateProfile(profile: { username?: string; display_name?: string; bio?: string }) {
    return this.http.patch<User>(`${API_URL}/user/me`, profile)
      .pipe(tap(user => {
        this.currentUser.set(user);
        writeLocal('jiro_user', JSON.stringify(user));
      }));
  }

  updateAvatar(avatarUrl: string) {
    const user = this.currentUser();
    if (user) {
      const updated = { ...user, avatar_url: avatarUrl };
      this.currentUser.set(updated);
      writeLocal('jiro_user', JSON.stringify(updated));
    }
  }

  clearAvatar() {
    const user = this.currentUser();
    if (user) {
      const updated = { ...user, avatar_url: undefined };
      this.currentUser.set(updated);
      writeLocal('jiro_user', JSON.stringify(updated));
    }
  }

  verifyEmail(token: string) {
    return this.http.post<{ message: string }>(`${API_URL}/auth/verify-email`, { token })
      .pipe(tap(() => {
        const user = this.currentUser();
        if (user) {
          const updated = { ...user, email_verified: true };
          this.currentUser.set(updated);
          writeLocal('jiro_user', JSON.stringify(updated));
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
    writeLocal('jiro_token', res.access_token);
    writeLocal('jiro_user', JSON.stringify(res.user));
  }

  private clearAuth() {
    this.accessToken.set(null);
    this.currentUser.set(null);
    removeLocal('jiro_token');
    removeLocal('jiro_user');
  }
}
