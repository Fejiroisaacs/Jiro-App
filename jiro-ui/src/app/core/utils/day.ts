/** Calendar-day helpers in the user's timezone; a day key is YYYY-MM-DD, as in /day URLs and GET /day. */

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

/** "Wednesday 23 September", plus the year when not `today`'s; built from parts so no locale adds a comma. */
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

/** The day key of the Monday that starts the week containing `key`. */
export function mondayOfKey(key: string): string {
  const dow = keyDate(key).getUTCDay(); // 0 = Sunday
  return addDays(key, dow === 0 ? -6 : 1 - dow);
}

/** "Sep 21" for a day key; the key is already a calendar date, so no zone applies. */
export function shortDayLabel(key: string): string {
  return keyDate(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** How far `timeZone`'s wall clock is ahead of UTC at `instant`, in ms. */
function zoneOffsetMs(instant: number, timeZone: string): number {
  let fmt = offsetFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    offsetFormatters.set(timeZone, fmt);
  }
  const parts = fmt.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find(p => p.type === type)?.value);
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wall - Math.floor(instant / 1000) * 1000;
}

/** UTC instant (ISO) when `timeZone` reads `hour`:00 on `key`; the offset is re-checked so DST can't shift it. */
function zonedHourISO(key: string, hour: number, timeZone: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, hour);
  let instant = wall - zoneOffsetMs(wall, timeZone);
  instant = wall - zoneOffsetMs(instant, timeZone);
  return new Date(instant).toISOString();
}

export function zonedNoonISO(key: string, timeZone: string): string {
  return zonedHourISO(key, 12, timeZone);
}

/** UTC instant (ISO) when `key` starts in `timeZone`, for [dayStartISO(from), dayStartISO(to + 1)) ranges. */
export function dayStartISO(key: string, timeZone: string): string {
  return zonedHourISO(key, 0, timeZone);
}
