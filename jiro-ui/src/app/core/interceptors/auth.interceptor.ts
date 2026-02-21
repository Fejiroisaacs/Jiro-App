import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError, EMPTY } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  // Don't add auth header to public auth endpoints
  const publicAuthPaths = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout', '/auth/verify-email', '/auth/forgot-password', '/auth/reset-password'];
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
      if (error.status === 401) {
        if (token) {
          // Token expired — try to refresh
          return authService.refresh().pipe(
            switchMap(res => {
              if (res) {
                const newReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${res.access_token}` },
                });
                return next(newReq);
              }
              // Refresh returned null — session is dead
              authService.logout();
              return EMPTY;
            }),
            catchError(() => {
              // Refresh request itself failed
              authService.logout();
              return EMPTY;
            })
          );
        }
        // No token at all — kick to login
        authService.logout();
        return EMPTY;
      }
      return throwError(() => error);
    })
  );
};

