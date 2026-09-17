import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { toObservable } from '@angular/core/rxjs-interop';
import { filter, take, map } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AdminService } from '../services/admin.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.isInitialized).pipe(
    filter(ready => ready),
    take(1),
    map(() => authService.isAuthenticated() || router.createUrlTree(['/login']))
  );
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return toObservable(authService.isInitialized).pipe(
    filter(ready => ready),
    take(1),
    map(() => !authService.isAuthenticated() || router.createUrlTree(['/dashboard']))
  );
};

/**
 * The admin tree had no guard at all, so an anonymous visitor could load and
 * render the admin shell; only the data fetch failed. Admin auth is a separate
 * secret held in sessionStorage, not the user JWT, so this checks that.
 */
export const adminGuard: CanActivateFn = () => {
  const adminService = inject(AdminService);
  const router = inject(Router);

  // '/admin' is the admin login route, mirroring authGuard's redirect to '/login'.
  return adminService.isAuthenticated() || router.createUrlTree(['/admin']);
};
