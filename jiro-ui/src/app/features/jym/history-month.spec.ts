// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countByDay, monthBounds, monthGrid, shiftMonth } from './history-month.ts';

test('a month runs from the 1st to its last day, leap years included', () => {
  assert.deepEqual(monthBounds('2026-02'), { from: '2026-02-01', to: '2026-02-28' });
  assert.deepEqual(monthBounds('2028-02'), { from: '2028-02-01', to: '2028-02-29' });
  assert.deepEqual(monthBounds('2026-10'), { from: '2026-10-01', to: '2026-10-31' });
});

test('the grid is whole weeks, Monday first', () => {
  // October 2026 starts on a Thursday and ends on a Saturday.
  const grid = monthGrid('2026-10');
  assert.equal(grid.length % 7, 0);
  assert.equal(grid[0].key, '2026-09-28');
  assert.equal(grid[0].inMonth, false);
  assert.equal(grid[3].key, '2026-10-01');
  assert.equal(grid.at(-1)!.key, '2026-11-01');
  assert.equal(grid.filter(c => c.inMonth).length, 31);
});

test('a month starting on Monday has no leading days', () => {
  // June 2026 starts on a Monday.
  assert.equal(monthGrid('2026-06')[0].key, '2026-06-01');
});

test('months shift across years', () => {
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-10', 0), '2026-10');
});

test('workouts count on the user\'s day, not UTC\'s', () => {
  // 03:00 UTC on 1 Oct is 11 pm on 30 Sep in New York.
  const counts = countByDay([{ started_at: '2026-10-01T03:00:00Z' }, { started_at: '2026-09-30T15:00:00Z' }], 'America/New_York');
  assert.equal(counts.get('2026-09-30'), 2);
  assert.equal(counts.get('2026-10-01'), undefined);
});
