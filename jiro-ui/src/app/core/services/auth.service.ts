import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, of, shareReplay, finalize, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { hasLocalStorage, readLocal, removeLocal, writeLocal } from '../storage';

export interface User {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  email_verified: boolean;
  is_admin: boolean;
  /** The shared, look-only sample account behind "Try the demo". */
  is_demo?: boolean;
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
  /** ISO 4217 code for every Ledger amount (default USD). */
  currency?: string;
  /** Dashboard widget order and visibility. Absent means the default layout; send null to reset. */
  dashboard?: StoredDashboardLayout | null;
}

export interface StoredDashboardLayout {
  v: number;
  widgets: { id: string; visible: boolean }[];
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
  /** Signed in to the demo: every write is refused (403 DEMO_READ_ONLY). */
  isDemo = computed(() => this.currentUser()?.is_demo === true);
  isInitialized = this.initialized.asReadonly();

  constructor(private http: HttpClient, private router: Router) {
    // The access token itself is never persisted (see handleAuth) — only
    // this non-sensitive profile object is, purely as the cheap signal
    // "this browser was logged in" that init() uses to decide whether a
    // reload is worth a refresh call at all. Guarded: there is no
    // localStorage under `platform-server`, and it throws outright in some
    // private windows.
    const stored = readLocal('jiro_user');
    if (stored) {
      try {
        this.currentUser.set(JSON.parse(stored));
      } catch {
        // Corrupt JSON — drop it rather than breaking construction of a
        // root service, which would take the whole app down.
        removeLocal('jiro_user');
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
   *  The access token is never persisted (see handleAuth), so on every fresh
   *  boot there is no in-memory token regardless of whether the session is
   *  actually still live — only the httpOnly refresh cookie knows that. Three
   *  cases:
   *   1. No browser storage at all (prerender/SSR): there is no cached user
   *      and no refresh cookie to present, so this is a pure no-op. Firing
   *      HTTP here would also stall server-side rendering waiting on it.
   *   2. No cached `jiro_user`: this browser was never logged in (or logged
   *      out). Settle synchronously with no network call — the landing page
   *      and the discover routes are public, prerendered and crawled, so
   *      this path must not fire a refresh on every anonymous pageview.
   *   3. A cached user exists: start the refresh in the background and
   *      return at once. `initialized` stays false until that request
   *      settles, so a real returning session gets exactly one refresh per
   *      reload instead of the old "skip while the cached token still looks
   *      valid" shortcut, which no longer has a token to check.
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
   *  A 401 on refresh means the session is truly dead: auth is cleared so the
   *  guard redirects to login. Anything else (offline, a 429, a 5xx) keeps the
   *  cached user, and the interceptor tries the refresh again on the next call. */
  init(): Promise<void> {
    if (!hasLocalStorage() || !this.currentUser()) {
      this.markInitialized();
      return Promise.resolve();
    }
    // Fire-and-forget: deliberately neither awaited nor returned. Routed
    // through the shared `refreshing$` slot so that a request from a public
    // page which 401s while this is in flight latches onto this same request
    // instead of firing a second POST /auth/refresh — the refresh cookie
    // rotates on use, so two concurrent refreshes race and one loses, which
    // would sign out a user who has a perfectly live session.
    this.startRefresh()
      .pipe(
        catchError(() => of(null)),
        finalize(() => this.markInitialized()),
      )
      .subscribe();
    return Promise.resolve();
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

  /** Signs in to the shared look-only demo; only called from a click, so never during prerender. */
  demoLogin() {
    return this.http.post<AuthResponse>(`${API_URL}/auth/demo`, {}, { withCredentials: true })
      .pipe(tap(res => this.handleAuth(res)));
  }

  /** Emits the new session, or null if the server said the session is dead
   *  (401, auth already cleared). Errors on anything else (offline, 429, 5xx):
   *  a failure to reach the server is not a reason to sign someone out. */
  refresh(): Observable<AuthResponse | null> {
    return this.startRefresh();
  }

  /** Share a single in-flight refresh across all concurrent callers.
   *  Without this, multiple simultaneous 401s each fire their own refresh,
   *  which causes token-rotation failures and silent API hangs. */
  private startRefresh(): Observable<AuthResponse | null> {
    if (this.refreshing$) return this.refreshing$;
    this.refreshing$ = this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(res => this.handleAuth(res)),
        catchError((err) => {
          if (err?.status !== 401) return throwError(() => err);
          this.clearAuth();
          return of(null);
        }),
        finalize(() => { this.refreshing$ = null; }),
        shareReplay(1),
      );
    return this.refreshing$;
  }

  logout(redirectTo = '/login') {
    if (!this.currentUser()) return; // already logged out — prevent duplicate navigation
    this.http.post(`${API_URL}/auth/logout`, {}, { withCredentials: true }).subscribe();
    this.clearAuth();
    this.router.navigateByUrl(redirectTo);
  }

  updateSettings(settings: Partial<UserSettings>) {
    // The demo can't write, so auto-saved preferences apply locally instead of raising a look-only toast.
    const user = this.currentUser();
    if (user?.is_demo && !('dashboard' in settings)) {
      const current = typeof user.settings === 'string' ? JSON.parse(user.settings) : (user.settings ?? {});
      const updated: User = { ...user, settings: { ...current, ...settings } };
      this.currentUser.set(updated);
      writeLocal('jiro_user', JSON.stringify(updated));
      return of(updated);
    }
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
    // The access token lives in this signal only — never persisted, so an
    // attacker with script execution can't read it out of localStorage; it
    // dies with the tab/reload and init() re-derives a fresh one from the
    // httpOnly refresh cookie, which JS can never read at all.
    this.accessToken.set(res.access_token);
    this.currentUser.set(res.user);
    writeLocal('jiro_user', JSON.stringify(res.user));
  }

  private clearAuth() {
    this.accessToken.set(null);
    this.currentUser.set(null);
    removeLocal('jiro_user');
  }
}

/** What to show inline when "Try the demo" fails. */
export function demoLoginErrorMessage(err: unknown): string {
  const status = (err as { status?: number } | null)?.status;
  if (status === 429) return 'Too many demo sign-ins from your network. Try again in a minute.';
  if (status === 0) return 'Could not reach Jiro. Check your connection and try again.';
  return 'The demo could not be opened right now. Try again in a minute.';
}
