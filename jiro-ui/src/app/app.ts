import { Component, effect, inject } from '@angular/core';
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
