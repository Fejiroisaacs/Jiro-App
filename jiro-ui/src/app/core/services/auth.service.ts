import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap, catchError, of } from 'rxjs';

export interface User {
  id: string;
  email: string;
  settings: UserSettings;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  theme?: string;
  avatar_url?: string;
  weight_unit?: string;
  timezone?: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

const API_URL = 'http://localhost:8080/api/v1';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser = signal<User | null>(null);
  private accessToken = signal<string | null>(null);

  user = this.currentUser.asReadonly();
  isAuthenticated = computed(() => !!this.currentUser());

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

  register(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/register`, { email, password }, { withCredentials: true })
      .pipe(tap(res => this.handleAuth(res)));
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${API_URL}/auth/login`, { email, password }, { withCredentials: true })
      .pipe(tap(res => this.handleAuth(res)));
  }

  refresh() {
    return this.http.post<AuthResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap(res => this.handleAuth(res)),
        catchError(() => {
          this.clearAuth();
          return of(null);
        })
      );
  }

  logout() {
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
