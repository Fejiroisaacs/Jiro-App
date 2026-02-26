import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig)
  .then(() => {
    if ('serviceWorker' in navigator) {
      if (environment.production) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      } else {
        // Unregister any stale SW in dev so it doesn't cache stale chunks
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        });
      }
    }
  })
  .catch((err) => console.error(err));
