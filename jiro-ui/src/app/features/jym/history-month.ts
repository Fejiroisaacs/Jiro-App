import { addDays, dayKey, mondayOfKey } from '../../core/utils/day';

/** A month is YYYY-MM; a day is a YYYY-MM-DD key in the user's zone. */
export interface MonthCell {
  key: string;
  /** Day of the month, for the label. */
  day: number;
  inMonth: boolean;
}

/** The month's first and last day keys. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Whole weeks, Monday first, covering the month; days outside it are marked. */
export function monthGrid(month: string): MonthCell[] {
  const { from, to } = monthBounds(month);
  const cells: MonthCell[] = [];
  const end = addDays(mondayOfKey(to), 6);
  for (let key = mondayOfKey(from); key <= end; key = addDays(key, 1)) {
    cells.push({ key, day: Number(key.slice(8)), inMonth: key.slice(0, 7) === month });
  }
  return cells;
}

/** The month `delta` months from `month`. */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Workouts per day key, counted on the user's calendar day. */
export function countByDay(sessions: readonly { started_at: string }[], timeZone: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of sessions) {
    const key = dayKey(s.started_at, timeZone);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
