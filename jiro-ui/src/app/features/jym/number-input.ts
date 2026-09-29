/**
 * Numbers typed into text fields with a numeric keypad. A comma is a decimal point, because
 * a phone set to a comma language types "102,5"; `type="number"` would drop that value.
 */

/** True when something is typed; a typed 0 counts. */
export function filled(value: unknown): boolean {
  return value != null && String(value).trim() !== '';
}

/** "102,5", "102.5" or "0" as a number; null when empty or not a plain decimal. */
export function parseDecimal(value: unknown): number | null {
  const s = String(value ?? '').trim().replace(',', '.');
  return /^(\d+\.?\d*|\.\d+)$/.test(s) ? Number(s) : null;
}

/** A plain whole number ("8"), or null. */
export function parseWhole(value: unknown): number | null {
  const s = String(value ?? '').trim();
  return /^\d+$/.test(s) ? Number(s) : null;
}
