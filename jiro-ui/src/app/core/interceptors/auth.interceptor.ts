import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toast = inject(ToastService);
  const token = authService.getToken();

  // Don't add auth header to public auth endpoints
  const publicAuthPaths = ['/auth/login', '/auth/demo', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/verify-email', '/auth/forgot-password', '/auth/reset-password'];
  if (publicAuthPaths.some(path => req.url.includes(path))) {
    return next(req);
  }

  if (token) {
    req = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // A write from the look-only demo. Say why once, here, rather than in
      // every component; the caller still gets the error to reset its state.
      // Never a reason to refresh or sign out.
      if (error.status === 403 && error.error?.error?.code === 'DEMO_READ_ONLY') {
        toast.readOnlyNotice(error.error.error.message);
        return throwError(() => error);
      }
      if (error.status !== 401) return throwError(() => error);

      // Never signed in on this browser: nothing to refresh.
      if (!token && !authService.isAuthenticated()) {
        authService.logout();
        return EMPTY;
      }

      // Expired token, or a cached session whose startup refresh failed (offline,
      // rate limited): refresh and retry once.
      return authService.refresh().pipe(
        // Only a failure of the refresh itself lands here, and it is transient
        // (a dead session comes back as null, below). Stay signed in and let the
        // caller show its error; the next request tries again.
        catchError(() => throwError(() => error)),
        switchMap(res => {
          if (!res) {
            authService.logout();
            return EMPTY;
          }
          // Errors from the retried request propagate to the caller as normal:
          // a 404 or 500 after a refresh is not a reason to sign out.
          return next(req.clone({ setHeaders: { Authorization: `Bearer ${res.access_token}` } }));
        }),
      );
    })
  );
};
