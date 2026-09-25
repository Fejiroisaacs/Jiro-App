/**
 * Calendar-day helpers in the user's own timezone. A "day key" is a calendar
 * date as YYYY-MM-DD, the same string the day view puts in its URL and the
 * API's GET /day takes. Every helper that turns an instant into a day takes
 * the IANA zone explicitly, so the dashboard strip and the day page (and the
 * API, which cuts days in the settings zone too) always agree.
 */

const DAY_KEY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The browser's zone, or UTC where Intl cannot say. */
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/** The settings zone when it is one this browser knows, else the browser's own. */
export function resolveTimeZone(setting: string | null | undefined): string {
  if (setting) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: setting });
      return setting;
    } catch {
      /* unknown zone: fall through */
    }
  }
  return browserTimeZone();
}

const keyFormatters = new Map<string, Intl.DateTimeFormat>();

/** The day key of an instant, in `timeZone`. */
export function dayKey(instant: Date | string | number, timeZone: string): string {
  let fmt = keyFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    keyFormatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(new Date(instant));
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Today's day key in `timeZone`. */
export function todayKey(timeZone: string, now: Date = new Date()): string {
  return dayKey(now, timeZone);
}

/** True for a real calendar date written YYYY-MM-DD (so not 2026-02-30). */
export function isDayKey(value: string | null | undefined): value is string {
  const m = value ? DAY_KEY.exec(value) : null;
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** Calendar arithmetic on a day key; no timezone is involved. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The key as a Date at UTC midnight, for formatting with timeZone 'UTC'. */
function keyDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * "Wednesday 23 September", with the year added when it is not `today`'s
 * year. Built from parts so no locale inserts a comma.
 */
export function longDayLabel(key: string, today: string): string {
  const date = keyDate(key);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
  const month = date.toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' });
  const label = `${weekday} ${date.getUTCDate()} ${month}`;
  return key.slice(0, 4) === today.slice(0, 4) ? label : `${label} ${key.slice(0, 4)}`;
}

/** One-letter weekday ("W") for the dashboard strip. */
export function narrowWeekday(key: string): string {
  return keyDate(key).toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' });
}

/** "Today", "Yesterday", or null for any other day. */
export function relativeDayName(key: string, today: string): 'Today' | 'Yesterday' | null {
  if (key === today) return 'Today';
  if (key === addDays(today, -1)) return 'Yesterday';
  return null;
}

/** "9:30 PM" in `timeZone`. */
export function timeInZone(instant: string | Date, timeZone: string): string {
  return new Date(instant).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone });
}
