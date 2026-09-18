/**
 * Generate public/sitemap.xml.
 *
 * The route list has two possible sources, and the order matters:
 *
 *   1. dist/jiro-ui/prerendered-routes.json, when a production build has run.
 *      That file records what the builder actually emitted, so a sitemap built
 *      from it cannot promise a URL the build did not produce.
 *   2. PUBLIC_ROUTES in src/app/core/site.config.ts otherwise, so this is
 *      useful before the first prerender build and while prerendering is still
 *      being wired up.
 *
 * ORIGIN is read from the same config file rather than duplicated here, so
 * pointing a custom domain stays a one-line change in one place.
 *
 * Run with: npm run build:sitemap
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const configPath = join(here, '..', 'src', 'app', 'core', 'site.config.ts');
const prerenderPath = join(here, '..', 'dist', 'jiro-ui', 'prerendered-routes.json');
const outPath = join(here, '..', 'public', 'sitemap.xml');

const config = readFileSync(configPath, 'utf8');

const originMatch = config.match(/export const ORIGIN\s*=\s*'([^']+)'/);
if (!originMatch) {
  throw new Error(`Could not read ORIGIN from ${configPath}. Has the export been renamed?`);
}
const origin = originMatch[1].replace(/\/$/, '');

function routesFromConfig() {
  const block = config.match(/export const PUBLIC_ROUTES[^=]*=\s*\[([\s\S]*?)\]/);
  if (!block) {
    throw new Error(`Could not read PUBLIC_ROUTES from ${configPath}.`);
  }
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

function routesFromBuild() {
  try {
    const parsed = JSON.parse(readFileSync(prerenderPath, 'utf8'));
    const routes = Object.keys(parsed.routes ?? {});
    return routes.length ? routes : null;
  } catch {
    return null;
  }
}

const built = existsSync(prerenderPath) ? routesFromBuild() : null;
const routes = built ?? routesFromConfig();
const source = built ? 'the prerender output' : 'PUBLIC_ROUTES (no prerender output yet)';

const lastmod = new Date().toISOString().slice(0, 10);
const urls = routes
  .map(r => (r.startsWith('/') ? r : `/${r}`))
  .sort()
  .map(r => `  <url>\n    <loc>${origin}${r === '/' ? '/' : r}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`)
  .join('\n');

// No priority or changefreq: Google ignores both, and inventing numbers would
// only make this file look more authoritative than it is.
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

writeFileSync(outPath, xml, 'utf8');
console.log(`sitemap: ${routes.length} urls from ${source}`);
console.log(`origin:  ${origin}`);
console.log(`wrote:   ${outPath}`);
