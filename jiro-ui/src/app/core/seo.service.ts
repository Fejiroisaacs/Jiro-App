import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Meta } from '@angular/platform-browser';
import { ActivatedRouteSnapshot } from '@angular/router';
import { OG_IMAGE_PATH, ORIGIN, SITE_NAME } from './site.config';

/** Schema.org entity types a page may emit. Routes opt in via `data.schema`. */
export type SeoSchemaType = 'Recipe' | 'ExercisePlan';

/**
 * The SEO half of a route's `data`. Every route in `app.routes.ts` carries a
 * `description` and an `index`; the rest are set only where a route differs
 * from the default.
 */
export interface SeoRouteData {
  /** One sentence, under ~160 characters. Feeds description, og and twitter. */
  description?: string;
  /** `true` only on the handful of routes that should be crawled. */
  index?: boolean;
  /** 'website' (default) or 'article'. */
  ogType?: string;
  /** Absolute path, set only where a route must point at a different URL. */
  canonical?: string;
  /** Emit JSON-LD for this entity type; the page component supplies the fields. */
  schema?: SeoSchemaType;
}

const OG_IMAGE = ORIGIN + OG_IMAGE_PATH;

/** Raster logo for the Organization entity; schema.org consumers prefer it over SVG. */
const LOGO = `${ORIGIN}/icons/apple-touch-icon.png`;
const OG_LOCALE = 'en_US';

/** Id on our own JSON-LD script, so we never touch anyone else's. */
const LD_ID = 'jiro-jsonld';

/** Deepest-last shallow merge of `data` along the route chain, so a child wins. */
function mergeRouteData(route: ActivatedRouteSnapshot): SeoRouteData {
  return route.pathFromRoot.reduce<SeoRouteData>((acc, r) => ({ ...acc, ...r.data }), {});
}

/**
 * The activated route's path, with no query string and no fragment — built from
 * the matched URL segments rather than `location`, so it is identical during
 * prerendering, where there is no `window`.
 */
function routePath(route: ActivatedRouteSnapshot): string {
  const segments = route.pathFromRoot.flatMap(r => r.url.map(s => s.path));
  return '/' + segments.join('/');
}

/**
 * Owns everything in `<head>` that changes per route: description, canonical,
 * robots, Open Graph, Twitter cards and JSON-LD.
 *
 * `JiroTitleStrategy` drives it — `update()` runs on every navigation. Page
 * components only ever call `setSchemaEntity()`, and only on routes whose
 * `data.schema` asked for it.
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly doc = inject(DOCUMENT);

  /**
   * Cached singletons. `update()` is called on every navigation, so creating
   * elements unconditionally is how this kind of service ends up with a dozen
   * canonical links in the head. Each is looked up once and then mutated.
   */
  private canonicalEl: HTMLLinkElement | null = null;
  private ldEl: HTMLScriptElement | null = null;

  /** The schema type the active route declared, if any. */
  private schemaType: SeoSchemaType | null = null;

  /**
   * The static description from index.html, captured before any navigation has
   * overwritten it. Used if a route somehow ships without one — a true sentence
   * about the app beats the previous page's description leaking across.
   */
  private readonly fallbackDescription =
    this.meta.getTag('name="description"')?.content ?? '';

  /**
   * Apply the head for one navigation.
   *
   * @param route the deepest activated route snapshot
   * @param documentTitle the composed title ("Dashboard · Jiro"), reused as og:title
   */
  update(route: ActivatedRouteSnapshot, documentTitle: string): void {
    const data = mergeRouteData(route);
    const path = routePath(route);
    const description = data.description?.trim() || this.fallbackDescription;
    const url = ORIGIN + (data.canonical ?? path);

    this.meta.updateTag({ name: 'description', content: description });

    // Removed rather than set to "index", so navigating from a private page to a
    // public one cannot leave a stale noindex behind.
    if (data.index) {
      this.meta.removeTag('name="robots"');
    } else {
      this.meta.updateTag({ name: 'robots', content: 'noindex, nofollow' });
    }

    this.setCanonical(url);

    this.meta.updateTag({ property: 'og:title', content: documentTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: url });
    this.meta.updateTag({ property: 'og:type', content: data.ogType ?? 'website' });
    this.meta.updateTag({ property: 'og:image', content: OG_IMAGE });
    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:locale', content: OG_LOCALE });

    this.meta.updateTag({ name: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: documentTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: OG_IMAGE });

    this.schemaType = data.schema ?? null;
    if (this.schemaType) {
      // The page component owns the fields. Clear the previous route's entity so
      // a recipe's JSON-LD can never be served against a different recipe.
      this.removeJsonLd();
    } else if (path === '/') {
      this.writeJsonLd(this.siteGraph(description));
    } else {
      this.removeJsonLd();
    }
  }

  /**
   * Supply the entity fields for a route that declared `data.schema`. Call it
   * once the page has its data:
   *
   * ```ts
   * this.seo.setSchemaEntity({ name: recipe.title, recipeIngredient: [...] });
   * ```
   *
   * No-ops when the active route declared no schema, so a page cannot invent
   * structured data the route did not ask for.
   */
  setSchemaEntity(fields: Record<string, unknown>): void {
    if (!this.schemaType) return;
    this.writeJsonLd({
      '@context': 'https://schema.org',
      '@type': this.schemaType,
      ...fields,
    });
  }

  /** Organization + WebSite, emitted on the landing route only. */
  private siteGraph(description: string): unknown {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': `${ORIGIN}/#organization`,
          name: SITE_NAME,
          url: ORIGIN,
          logo: LOGO,
        },
        {
          '@type': 'WebSite',
          '@id': `${ORIGIN}/#website`,
          name: SITE_NAME,
          url: ORIGIN,
          description,
          inLanguage: 'en',
          publisher: { '@id': `${ORIGIN}/#organization` },
        },
      ],
    };
  }

  private setCanonical(href: string): void {
    const head = this.doc?.head;
    if (!head) return;

    // Reuse in this order: the element we created earlier, then one the
    // prerendered HTML already shipped, and only create if neither exists.
    // Without the querySelector step, hydration appends a second canonical.
    this.canonicalEl ??= head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!this.canonicalEl) {
      const link = this.doc.createElement('link');
      link.setAttribute('rel', 'canonical');
      head.appendChild(link);
      this.canonicalEl = link;
    }
    this.canonicalEl.setAttribute('href', href);
  }

  private writeJsonLd(payload: unknown): void {
    const head = this.doc?.head;
    if (!head) return;

    this.ldEl ??= head.querySelector<HTMLScriptElement>(`script#${LD_ID}`);
    if (!this.ldEl) {
      const script = this.doc.createElement('script');
      script.setAttribute('type', 'application/ld+json');
      script.id = LD_ID;
      head.appendChild(script);
      this.ldEl = script;
    }
    this.ldEl.textContent = JSON.stringify(payload);
  }

  private removeJsonLd(): void {
    const head = this.doc?.head;
    if (!head) return;

    // Adopt a prerendered script before dropping it, so nothing is orphaned.
    this.ldEl ??= head.querySelector<HTMLScriptElement>(`script#${LD_ID}`);
    this.ldEl?.remove();
    this.ldEl = null;
  }
}
