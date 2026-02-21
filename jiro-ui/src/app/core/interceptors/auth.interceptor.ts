import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
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
      if (error.status === 401 && token) {
        // Try to refresh
        return authService.refresh().pipe(
          switchMap(res => {
            if (res) {
              const newReq = req.clone({
                setHeaders: { Authorization: `Bearer ${res.access_token}` },
              });
              return next(newReq);
            }
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
