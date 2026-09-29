// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { suggestDeload, type DeloadRuleSession } from './deload-rule.ts';

type Opts = Partial<Pick<DeloadRuleSession, 'session_type' | 'set_count' | 'pr_count'>> & { open?: boolean };

/** One workout on a given day of September, oldest first in the lists below. */
function w(day: number, routine: string | null, volume: number, o: Opts = {}): DeloadRuleSession {
  const dd = String(day).padStart(2, '0');
  return {
    session_type: o.session_type ?? 'normal',
    routine_id: routine,
    started_at: `2026-09-${dd}T10:00:00Z`,
    ended_at: o.open ? null : `2026-09-${dd}T11:00:00Z`,
    set_count: o.set_count ?? 12,
    total_volume: volume,
    pr_count: o.pr_count ?? 0,
  };
}

/** Push, pull, legs on consecutive days from `start`, each day's volume scaled by `scale`. */
function rotation(start: number, scale = 1): DeloadRuleSession[] {
  return [w(start, 'push', 5000 * scale), w(start + 1, 'pull', 4000 * scale), w(start + 2, 'legs', 8000 * scale)];
}

test('a steady push, pull, legs rotation is not a drop', () => {
  assert.equal(suggestDeload([...rotation(1), ...rotation(4), ...rotation(7)]), null);
});

test('each day down 10% on its last time suggests a deload', () => {
  const got = suggestDeload([...rotation(1), ...rotation(4, 0.9)]);
  assert.deepEqual([got?.sessionCount, got?.dropPercent], [3, 10]);
});

test('a notes-only workout is ignored', () => {
  const got = suggestDeload([...rotation(1), ...rotation(4, 0.9), w(7, 'push', 0, { set_count: 0 })]);
  assert.equal(got?.dropPercent, 10);
});

test('a record in a recent workout means no deload', () => {
  const recent = rotation(4, 0.9);
  recent[1] = { ...recent[1], pr_count: 1 };
  assert.equal(suggestDeload([...rotation(1), ...recent]), null);
});

test('a deload in progress or just taken quiets the card', () => {
  const drop = [...rotation(1), ...rotation(4, 0.9)];
  assert.equal(suggestDeload([...drop, w(7, 'push', 2500, { session_type: 'deload', open: true })]), null);
  assert.equal(suggestDeload([...drop, w(7, 'push', 2500, { session_type: 'deload' })]), null);
});

test('a freestyle workout among the recent ones gives no answer', () => {
  assert.equal(suggestDeload([...rotation(1), ...rotation(4, 0.9), w(7, null, 3000)]), null);
});

test('too few workouts, or a day never trained before, gives no answer', () => {
  assert.equal(suggestDeload(rotation(1, 0.9)), null);
  assert.equal(suggestDeload([...rotation(1), w(4, 'arms', 1000), w(5, 'push', 4000), w(6, 'pull', 3000)]), null);
});
