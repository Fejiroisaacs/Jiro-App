import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { SeoService } from './seo.service';
import { SITE_NAME } from './site.config';

/**
 * Sets the document title from the route's `title` ("Transactions · Jiro")
 * and exposes the bare page title so the mobile top bar can show it.
 *
 * Also the single hook the router gives us that fires once per completed
 * navigation, so it drives `SeoService` for the rest of the head.
 */
@Injectable({ providedIn: 'root' })
export class JiroTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly seo = inject(SeoService);
  readonly current = signal('');

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot) ?? '';
    this.current.set(page);
    const documentTitle = page ? `${page} · ${SITE_NAME}` : SITE_NAME;
    this.title.setTitle(documentTitle);

    // The leaf route holds the SEO data; the service merges it down the chain.
    let route: ActivatedRouteSnapshot = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    this.seo.update(route, documentTitle);
  }
}
