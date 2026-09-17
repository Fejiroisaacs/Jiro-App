import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AdminService } from '../services/admin.service';
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

/** Admin auth is a separate mechanism from the user JWT: `admin-login` posts a
 *  secret, and on the first accepted `/admin/stats` call `AdminService` keeps it
 *  in sessionStorage (`jiro_admin_secret`) and exposes it as the `secret`
 *  signal, sent as the `X-Admin-Secret` header. So there is nothing async to
 *  wait for here and nothing to do with `AuthService`.
 *
 *  `isAuthenticated()` is `secret() !== null`, not a truthiness test, because a
 *  blank secret is a valid credential in local dev — `null` is the only thing
 *  that means "this tab never went through the login". Under prerender there is
 *  no sessionStorage, so the signal is null and the admin shell is never
 *  rendered statically.
 *
 *  This only gates *rendering* the shell; the API is the real authority and
 *  rejects a bad or missing secret with 401 regardless. */
export const adminGuard: CanActivateFn = () => {
  const adminService = inject(AdminService);
  const router = inject(Router);

  // '/admin' is the admin login route, mirroring authGuard's redirect to '/login'.
  return adminService.isAuthenticated() || router.createUrlTree(['/admin']);
};
