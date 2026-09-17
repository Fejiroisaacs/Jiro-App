import { Component, PLATFORM_ID, effect, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { SettingsService, THEMES } from './core/services/settings.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class App {
  constructor() {
    // Everything this constructor does is a browser-only side effect: scroll
    // position and classes/meta on the live document. Under `platform-server`
    // (prerender) there is nothing to scroll and no browser chrome to colour.
    //
    // `isPlatformBrowser` rather than `typeof document === 'undefined'`: the
    // server render ships a DOM shim, so `document` *does* exist there while
    // `window.scrollTo` and `getComputedStyle` do not — a typeof check on
    // `document` would pass and then throw on the first real call. A
    // prerendered page also has no session, so the theme resolves to the
    // default and there would be no classes to apply anyway.
    if (!isPlatformBrowser(inject(PLATFORM_ID))) return;

    const router = inject(Router);
    router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      // Force scroll to top explicitly for mobile browsers
      window.scrollTo(0, 0);
      document.body.scrollTop = 0;
      document.documentElement.scrollTop = 0;
    });

    // Theme and dark-mode classes live on <html> so every route (landing,
    // auth, admin, main layout) is themed. index.html pre-applies `.dark`
    // from localStorage before this runs to avoid a light flash.
    const settings = inject(SettingsService);
    effect(() => {
      const theme = settings.theme();
      const dark = settings.darkMode();
      const root = document.documentElement;
      for (const t of THEMES) root.classList.toggle(`theme-${t}`, t === theme && t !== 'earth');
      root.classList.toggle('dark', dark);

      // Browser chrome (PWA status bar) follows the app's page colour.
      const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
      const pageBg = getComputedStyle(root).getPropertyValue('--bg-page').trim();
      if (meta && pageBg) meta.content = pageBg;
    });
  }
}
