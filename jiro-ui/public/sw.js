// Jiro service worker.
//
// Navigation is network-first with the shell as an offline fallback. Assets are
// split by whether their filename can go stale:
//
//   * The production build sets outputHashing: "all", so JS and CSS filenames
//     contain a content hash. A hashed name can never point at different bytes,
//     so cache-first is safe forever.
//   * Everything else (images, icons, the manifest) keeps its filename across
//     deploys, so cache-first alone would pin a visitor to an old file with no
//     way out. Those use stale-while-revalidate: the cached copy is served
//     immediately, a fresh one is fetched in the background, and the next visit
//     gets the new bytes. No version bookkeeping, and nothing goes permanently
//     stale.
//
// The version below only needs bumping to force every client to discard its
// whole cache at once; ordinary deploys no longer require it.
const CACHE = 'jiro-shell-v2';
const SHELL = ['/index.html'];

/** Content-hashed by the Angular build, e.g. main-GYMW7TZH.js */
const HASHED = /-[A-Z0-9]{8}\.(?:js|css)$/;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function put(request, response) {
  if (!response || !response.ok) return response;
  const clone = response.clone();
  caches.open(CACHE).then(c => c.put(request, clone));
  return response;
}

self.addEventListener('fetch', e => {
  const { request } = e;

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;

  // API calls: always network, never cache
  if (request.url.includes('/api/')) return;

  // Navigation: network-first, fall back to index.html for SPA routing
  if (request.mode === 'navigate') {
    e.respondWith(fetch(request).catch(() => caches.match('/index.html')));
    return;
  }

  // Hashed filenames cannot change meaning: cache-first, and never refetch.
  if (HASHED.test(new URL(request.url).pathname)) {
    e.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => put(request, res)))
    );
    return;
  }

  // Everything else: serve the cached copy at once, refresh it behind the
  // scenes. A failed background fetch is ignored, so being offline still
  // returns whatever was cached.
  e.respondWith(
    caches.match(request).then(cached => {
      const fresh = fetch(request).then(res => put(request, res)).catch(() => cached);
      return cached || fresh;
    })
  );
});
