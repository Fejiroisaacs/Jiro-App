import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

// Every guard here calls `inject()` before its first `await` — the injection
// context is only available synchronously.
//
// The user guards wait on `AuthService.whenInitialized()`, which resolves once
// `init()` has settled: either immediately (no stored session, a still-valid
// token, or no browser storage at all) or when the background refresh of an
// expired token finishes, success or failure. Bootstrap no longer blocks on
// that refresh, so this wait is what keeps protected routes protected: a user
// whose refresh is in flight parks here rather than being read as anonymous.

export const authGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenInitialized();
  return authService.isAuthenticated() || router.createUrlTree(['/login']);
};

export const guestGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenInitialized();
  return !authService.isAuthenticated() || router.createUrlTree(['/dashboard']);
};

/** Renders the admin shell only for a user whose is_admin is set. Waits for
 *  `whenInitialized()` for the same reason authGuard does: mid-refresh, the user
 *  signal is briefly null and would otherwise read as "not an admin".
 *
 *  This gates rendering only. The API re-checks is_admin on every admin route
 *  and 404s otherwise, so editing `jiro_user` in devtools buys an empty shell. */
export const adminGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenInitialized();
  return authService.user()?.is_admin === true || router.createUrlTree(['/dashboard']);
};
