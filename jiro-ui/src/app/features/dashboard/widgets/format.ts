/** "just now", "5m ago", "3h ago", "yesterday", "4 days ago", then a short date. */
export function timeAgo(iso: string, now = Date.now()): string {
  const ms = now - new Date(iso).getTime();
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return shortDate(iso);
}

/**
 * For date-only values (a weigh-in has a day, not a time): compares calendar
 * days, so today's entry reads "today" rather than "11h ago" from UTC midnight.
 * `today` is the user's day key (todayKey in their settings zone).
 */
export function daysAgo(dateOnly: string, today: string): string {
  const toUtc = (key: string) => {
    const [y, m, d] = key.slice(0, 10).split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const day = toUtc(dateOnly);
  const days = Math.round((toUtc(today) - day) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return `${days} days ago`;
  return new Date(day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** "12 Sep" (en-GB, like the rest of the dashboard). */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}
