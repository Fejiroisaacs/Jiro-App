/** Shared utilities for the Ledger module. Import instead of duplicating per component. */

/**
 * Money in the user's one currency (SettingsService.currency): thousands
 * separators, the currency's own decimals (two for most), and a minus sign when negative.
 */
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

/**
 * The currencies Settings offers, most used first. Any ISO 4217 code works
 * with the API; this is the list people pick from.
 */
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

/**
 * A change between two periods as a percentage: "+12.5%", "-3.0%", or,
 * when the earlier period is zero so there is no base, "new" (something
 * appeared) or "n/a" (still nothing).
 */
export function formatPctChange(pct: number | null, current: number): string {
  if (pct === null) return current !== 0 ? 'new' : 'n/a';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(pct) + '%';
}

/**
 * Net worth from the accounts, the one rule the Accounts page and "Take
 * snapshot" share: every account counts, inactive ones too, at its real
 * signed balance. A positive balance is an asset and a negative one a
 * liability (a credit card owing money is stored negative).
 */
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

/**
 * Category colours: the default categories' own palette, so a custom
 * category sits with them. The API picks the next unused one when none is
 * chosen.
 */
export const CATEGORY_PALETTE: { hex: string; name: string }[] = [
  { hex: '#8D6E63', name: 'Clay' },
  { hex: '#E57373', name: 'Coral' },
  { hex: '#64B5F6', name: 'Sky' },
  { hex: '#81C784', name: 'Sage' },
  { hex: '#FFD54F', name: 'Mustard' },
  { hex: '#F48FB1', name: 'Rose' },
  { hex: '#90A4AE', name: 'Slate' },
  { hex: '#CE93D8', name: 'Lilac' },
  { hex: '#BCAAA4', name: 'Sand' },
  { hex: '#66BB6A', name: 'Leaf' },
  { hex: '#4DB6AC', name: 'Teal' },
  { hex: '#FFA726', name: 'Amber' },
  { hex: '#AB47BC', name: 'Plum' },
  { hex: '#78909C', name: 'Steel' },
];

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
