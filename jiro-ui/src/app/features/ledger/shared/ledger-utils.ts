/** Shared utilities for the Ledger module. Import instead of duplicating per component. */

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Format an amount that already carries its sign (the API stores expenses and
 * transfer-source rows as negative numbers). 'exceptZero' renders +$3,150.00 /
 * -$86.42; 'never' renders the absolute value, used for transfer legs.
 */
export function formatSignedCurrency(
  value: number,
  currency = 'USD',
  sign: 'exceptZero' | 'never' = 'exceptZero',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    signDisplay: sign,
  }).format(sign === 'never' ? Math.abs(value) : value);
}

/**
 * Parse a calendar date (no time component) as a LOCAL date.
 * Accepts both "2026-09-12" and the API's "2026-09-12T00:00:00Z" shape; the
 * DATE columns in the ledger are serialised as midnight UTC, and parsing that
 * with `new Date(iso)` shifts the day backwards in western timezones.
 */
export function parseDateOnly(value: string): Date {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function formatDate(iso: string): string {
  return parseDateOnly(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function hexWithAlpha(hex: string | null | undefined, alpha: number): string {
  if (!hex) return `rgba(155,143,136,${alpha})`;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function periodLabel(period: string): string {
  const map: Record<string, string> = { monthly: 'Monthly', weekly: 'Weekly', yearly: 'Yearly' };
  return map[period] ?? period;
}

export function intervalLabel(interval: string | null): string {
  if (!interval) return '';
  const map: Record<string, string> = {
    weekly: 'Weekly', biweekly: 'Biweekly', monthly: 'Monthly', yearly: 'Yearly',
  };
  return map[interval] ?? interval;
}
