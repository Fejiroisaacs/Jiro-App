/**
 * Web-storage access that is safe to call anywhere.
 *
 * Deliberately plain module functions rather than an Angular service, so they
 * can be used from field initialisers and constructors that run before any
 * injection context exists. It generalises the pattern `SettingsService`
 * already uses inline:
 *
 *   typeof localStorage !== 'undefined' && localStorage.getItem('jiro_dark') === '1'
 *
 * Both layers of protection are load-bearing — the `try`/`catch` is *not*
 * redundant with the `typeof` check:
 *
 *  - `typeof … !== 'undefined'` covers the environment where the global is
 *    absent altogether: `platform-server` prerendering, unit tests, workers.
 *    (Note this only works for storage. The server render ships a DOM shim, so
 *    `typeof document` is a useless test there — use `isPlatformBrowser` when
 *    you need to know whether you are in a real browser.)
 *  - `try`/`catch` covers the browsers where the global *exists* but throws:
 *    Safari private windows, Firefox/Chrome with "block all cookies" or site
 *    data blocked, a sandboxed or partitioned iframe, and `setItem` when the
 *    origin is over quota. Storage throwing is a normal-browser condition, not
 *    just an off-browser one.
 *
 * Every accessor fails soft: reads return `null`, writes and removes no-op.
 */

type StorageKind = 'local' | 'session';

/** Resolve the backing store, or `null` when this environment has none.
 *  Only ever called from inside a `try` — merely touching the global can throw. */
function store(kind: StorageKind): Storage | null {
  if (kind === 'local') return typeof localStorage !== 'undefined' ? localStorage : null;
  return typeof sessionStorage !== 'undefined' ? sessionStorage : null;
}

function read(kind: StorageKind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function write(kind: StorageKind, key: string, value: string): void {
  try {
    store(kind)?.setItem(key, value);
  } catch {
    // Unavailable, blocked, or over quota — the value is simply not persisted.
  }
}

function remove(kind: StorageKind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // Nothing to do: if we cannot reach storage there is nothing stored either.
  }
}

// ── localStorage: survives tab close (auth session, theme preference) ───────

export function readLocal(key: string): string | null {
  return read('local', key);
}

export function writeLocal(key: string, value: string): void {
  write('local', key, value);
}

export function removeLocal(key: string): void {
  remove('local', key);
}

// ── sessionStorage: dies with the tab (the admin secret, deliberately) ──────

export function readSession(key: string): string | null {
  return read('session', key);
}

export function writeSession(key: string, value: string): void {
  write('session', key, value);
}

export function removeSession(key: string): void {
  remove('session', key);
}

/** True when persistent browser storage exists at all. Lets callers ask "could
 *  there be a stored session here?" without probing for a particular key —
 *  a prerender answers `false`, so it can skip session work entirely. */
export function hasLocalStorage(): boolean {
  try {
    return store('local') !== null;
  } catch {
    return false;
  }
}
