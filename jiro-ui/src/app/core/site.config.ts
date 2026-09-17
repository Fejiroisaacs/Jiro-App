/**
 * One place for everything that depends on where the app is served from.
 *
 * Pointing a custom domain at Jiro should be a one-line change here plus a
 * redeploy: canonical tags, Open Graph URLs and the sitemap all read ORIGIN,
 * and nothing else in the app hardcodes a host.
 */

/** No trailing slash. Absolute URLs are built as `ORIGIN + path`. */
export const ORIGIN = 'https://jiro-app-3e88c.web.app';

export const SITE_NAME = 'Jiro';

/** The social card. Absolute, because scrapers do not resolve relative URLs. */
export const OG_IMAGE_PATH = '/images/og/jiro-og.png';

/**
 * The routes an anonymous visitor can load and a crawler may index.
 *
 * Single source of truth: the prerender route list and the sitemap generator
 * both derive from this, so the two cannot drift apart. Every other route in
 * the app is noindex, which is why this list is short and explicit rather than
 * something computed by walking the router.
 *
 * Tokenised share links are deliberately absent. An unlisted link someone sent
 * to a friend is not a public page, and indexing one would put private content
 * in search results.
 */
export const PUBLIC_ROUTES: readonly string[] = [
  '/',
  '/login',
  '/register',
  '/culinara/discover',
  '/jym/discover',
];

/**
 * Route data for a page behind the login.
 *
 * `index` is deliberately opt-in rather than opt-out: a new route added without
 * thinking about SEO is noindex by default, which is the safe direction to fail
 * for an app that is mostly someone's private records. Spread this into `data`
 * and add the page's own keys after it.
 */
export const PRIVATE_PAGE = {
  index: false,
  description: 'A private page in your Jiro account.',
} as const;
