// The app's one date style: "23 Sep 2026", or "Wed 23 Sep" when the year is obvious.
import { dayKey } from './day';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DateStyle {
  /** 'auto' (default) shows the year only when it isn't the current one. */
  year?: 'auto' | 'always' | 'never';
  weekday?: boolean;
}

/** Formats a calendar day key (YYYY-MM-DD) or a DATE value ("2026-09-23T00:00:00Z"). */
export function formatDay(key: string, style: DateStyle = {}, today = new Date()): string {
  const [y, m, d] = key.slice(0, 10).split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = style.year ?? 'auto';
  const showYear = year === 'always' || (year === 'auto' && y !== today.getFullYear());
  return `${style.weekday ? weekday + ' ' : ''}${d} ${MONTHS[m - 1]}${showYear ? ' ' + y : ''}`;
}

/** Formats a timestamp as the calendar day it falls on in the user's timezone. */
export function formatInstant(instant: string | Date, timeZone: string, style: DateStyle = {}): string {
  return formatDay(dayKey(instant, timeZone), style);
}

/** Month heading: "September 2026". */
export function formatMonth(key: string): string {
  const [y, m] = key.slice(0, 7).split('-').map(Number);
  const long = new Date(Date.UTC(y, m - 1, 1)).toLocaleString('en-GB', { month: 'long', timeZone: 'UTC' });
  return `${long} ${y}`;
}
