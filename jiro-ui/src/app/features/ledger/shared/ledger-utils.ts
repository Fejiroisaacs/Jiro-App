/** Shared utilities for the Ledger module. Import instead of duplicating per component. */

export function formatCurrency(value: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
