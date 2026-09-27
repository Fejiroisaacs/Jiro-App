/** Shared utilities for the Ledger module. Import instead of duplicating per component. */
import { formatDay } from '../../../core/utils/format-date';

/** Money in the user's currency, with its own decimals and a minus sign when negative. */
export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(value);
}

/**
 * Format an amount that already carries its sign (the API stores expenses and
 * transfer-source rows as negative numbers). 'exceptZero' renders +$3,150.00 /
 * -$86.42; 'never' renders the absolute value, used for transfers.
 */
export function formatSignedCurrency(
  value: number,
  currency = 'USD',
  sign: 'exceptZero' | 'never' = 'exceptZero',
): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    signDisplay: sign,
  }).format(sign === 'never' ? Math.abs(value) : value);
}

/** The currency's symbol on its own ("$", "€", "CA$"), for field labels. */
export function currencySymbol(currency: string): string {
  const part = new Intl.NumberFormat('en-US', { style: 'currency', currency })
    .formatToParts(0)
    .find(p => p.type === 'currency');
  return part?.value ?? currency;
}

/** The currencies Settings offers, most used first; the API takes any ISO 4217 code. */
export const CURRENCIES: { code: string; name: string }[] = [
  { code: 'USD', name: 'US dollar' },
  { code: 'EUR', name: 'Euro' },
  { code: 'GBP', name: 'British pound' },
  { code: 'CAD', name: 'Canadian dollar' },
  { code: 'AUD', name: 'Australian dollar' },
  { code: 'NZD', name: 'New Zealand dollar' },
  { code: 'JPY', name: 'Japanese yen' },
  { code: 'CNY', name: 'Chinese yuan' },
  { code: 'INR', name: 'Indian rupee' },
  { code: 'NGN', name: 'Nigerian naira' },
  { code: 'GHS', name: 'Ghanaian cedi' },
  { code: 'KES', name: 'Kenyan shilling' },
  { code: 'ZAR', name: 'South African rand' },
  { code: 'CHF', name: 'Swiss franc' },
  { code: 'SEK', name: 'Swedish krona' },
  { code: 'NOK', name: 'Norwegian krone' },
  { code: 'DKK', name: 'Danish krone' },
  { code: 'PLN', name: 'Polish zloty' },
  { code: 'BRL', name: 'Brazilian real' },
  { code: 'MXN', name: 'Mexican peso' },
  { code: 'SGD', name: 'Singapore dollar' },
  { code: 'HKD', name: 'Hong Kong dollar' },
  { code: 'KRW', name: 'South Korean won' },
  { code: 'AED', name: 'UAE dirham' },
];

/** Period change as "+12.5%", or "new" / "n/a" when the earlier period is zero. */
export function formatPctChange(pct: number | null, current: number): string {
  if (pct === null) return current !== 0 ? 'new' : 'n/a';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(pct) + '%';
}

/** Net worth over every account, inactive too, at its signed balance (negative is a liability). */
export function netWorthTotals(accounts: { balance: number }[]): { assets: number; liabilities: number; net: number } {
  let assets = 0;
  let liabilities = 0;
  for (const a of accounts) {
    if (a.balance >= 0) assets += a.balance;
    else liabilities += -a.balance;
  }
  const round = (v: number) => Math.round(v * 100) / 100;
  return { assets: round(assets), liabilities: round(liabilities), net: round(assets - liabilities) };
}

/** Category colours: palette keys the API stores, drawn from the theme's data palette. */
export const CATEGORY_PALETTE: { key: string; name: string }[] = [
  { key: 'data-1', name: 'Terracotta' },
  { key: 'data-2', name: 'Olive' },
  { key: 'data-3', name: 'Ochre' },
  { key: 'data-4', name: 'Sage' },
  { key: 'data-5', name: 'Slate' },
  { key: 'data-6', name: 'Rose' },
  { key: 'data-7', name: 'Taupe' },
  { key: 'data-8', name: 'Forest' },
  { key: 'data-9', name: 'Copper' },
  { key: 'data-10', name: 'Steel' },
  { key: 'data-11', name: 'Mustard' },
  { key: 'data-12', name: 'Walnut' },
];

const PALETTE_KEY = /^data-([1-9]|1[0-2])$/;

/** A category colour as CSS: data-3 becomes var(--data-3), a legacy hex passes through. */
export function categoryColor(color: string | null | undefined): string {
  const c = (color ?? '').trim().toLowerCase();
  if (PALETTE_KEY.test(c)) return `var(--${c})`;
  if (/^#[0-9a-f]{6}$/.test(c)) return c;
  return 'var(--text-muted)';
}

/** The tint behind a category chip; chip text stays var(--text-primary). */
export function categoryTint(color: string | null | undefined): string {
  return `color-mix(in srgb, ${categoryColor(color)} 18%, var(--bg-surface))`;
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

/** A DATE value in the app's style: "25 Sep", with the year when it isn't this year. */
export function formatDate(iso: string): string {
  return formatDay(iso);
}

export function formatPct(value: number): string {
  return value.toFixed(1) + '%';
}

export function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}

export function periodLabel(period: string): string {
  const map: Record<string, string> = { monthly: 'Monthly', weekly: 'Weekly', yearly: 'Yearly' };
  return map[period] ?? period;
}

export function intervalLabel(interval: string | null): string {
  if (!interval) return '';
  const map: Record<string, string> = {
    weekly: 'Weekly', biweekly: 'Every 2 weeks', monthly: 'Monthly', yearly: 'Yearly',
  };
  return map[interval] ?? interval;
}

/** "every month", for sentences about a series. */
export function intervalPhrase(interval: string | null): string {
  const map: Record<string, string> = {
    weekly: 'every week', biweekly: 'every two weeks', monthly: 'every month', yearly: 'every year',
  };
  return interval ? map[interval] ?? interval : '';
}

/**
 * The colour a transaction is drawn in. Income, expense and transfer are the
 * three kinds; transfers are informational rather than good or bad, so they
 * take the neutral info tone.
 */
export function transactionColor(type: string): string {
  if (type === 'income') return 'var(--color-accent)';
  if (type === 'expense') return 'var(--color-danger)';
  return 'var(--color-info)';
}
