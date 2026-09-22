import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling, TitleStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideClientHydration } from '@angular/platform-browser';
import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';
import { JiroTitleStrategy } from './core/title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),
    // useExisting so the router and the layout share one instance (its `current` signal).
    { provide: TitleStrategy, useExisting: JiroTitleStrategy },
    provideHttpClient(withInterceptors([authInterceptor])),
    provideAppInitializer(() => inject(AuthService).init()),
    // Reconciles the prerendered/SSR'd DOM on the five indexable routes
    // (app.routes.server.ts) instead of discarding and re-rendering it.
    // No withEventReplay(): it injects an inline bootstrap <script> whose
    // content (and hash) varies per page with which event types that page's
    // components bind, which the CSP's script-src can't allowlist by a fixed
    // hash - it was silently blocked in production, eating the first click
    // on interactive elements (e.g. the dark-mode toggle) during the gap
    // between paint and hydration completing.
    provideClientHydration(),
  ],
};
