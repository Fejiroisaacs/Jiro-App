// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartedWorkouts, defaultRange, inRange, monthTickLabel, monthTicks, notesOf, statsSeries, type StatsWorkout } from './exercise-stats.ts';

const NOW = new Date('2026-10-01T12:00:00Z').getTime();
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

function row(id: string, days: number, o: Partial<StatsWorkout> = {}): StatsWorkout {
  return {
    session_id: id, started_at: daysAgo(days), session_type: 'normal', working_sets: 3,
    max_weight: 100, best_e1rm: 116.7, volume: 1500, note: null, ...o,
  };
}

test('deloads and warm-up-only workouts are not charted', () => {
  const list = [row('a', 10), row('d', 9, { session_type: 'deload' }), row('w', 8, { working_sets: 0 }), row('t', 7, { session_type: 'test' })];
  assert.deepEqual(chartedWorkouts(list).map(w => w.session_id), ['a', 't']);
});

test('ranges count back from now', () => {
  const list = [row('old', 400), row('year', 200), row('recent', 30)];
  assert.deepEqual(inRange(list, '3m', NOW).map(w => w.session_id), ['recent']);
  assert.deepEqual(inRange(list, '1y', NOW).map(w => w.session_id), ['year', 'recent']);
  assert.equal(inRange(list, 'all', NOW).length, 3);
});

test('the default range is 1Y only when there is more than a year to hide', () => {
  assert.equal(defaultRange([row('a', 400), row('b', 10)], NOW), '1y');
  assert.equal(defaultRange([row('a', 300), row('b', 10)], NOW), 'all');
  // An old deload alone doesn't make the history long.
  assert.equal(defaultRange([row('d', 400, { session_type: 'deload' }), row('b', 10)], NOW), 'all');
  assert.equal(defaultRange([], NOW), 'all');
});

test('a series is one point per workout, by date, oldest first', () => {
  const list = [row('b', 10, { best_e1rm: 120, volume: 2000, max_weight: 105 }), row('a', 70, { best_e1rm: 110 })];
  const e1rm = statsSeries(list, 'e1rm', 'all', NOW);
  assert.deepEqual(e1rm.map(p => [p.sessionId, p.y]), [['a', 110], ['b', 120]]);
  assert.equal(e1rm[1].x - e1rm[0].x, 60 * 86_400_000);
  assert.deepEqual(statsSeries(list, 'volume', 'all', NOW).map(p => p.y), [1500, 2000]);
  assert.deepEqual(statsSeries(list, 'maxweight', '3m', NOW).map(p => p.y), [100, 105]);
});

test('notes are newest first and skip blanks', () => {
  const list = [row('a', 20, { note: 'Elbows in' }), row('b', 10, { note: '  ' }), row('c', 5, { note: 'Pause at the bottom' })];
  assert.deepEqual(notesOf(list).map(w => w.session_id), ['c', 'a']);
});

test('month ticks sit on the 1st, at most six, aligned to January', () => {
  const at = (y: number, m: number, d = 1) => new Date(y, m - 1, d).getTime();
  const three = monthTicks(at(2026, 7, 3), at(2026, 10, 1));
  assert.deepEqual(three.map(t => new Date(t).getMonth() + 1), [8, 9, 10]);
  const year = monthTicks(at(2025, 10, 1), at(2026, 10, 1));
  assert.ok(year.length <= 6, String(year.length));
  assert.ok(year.every(t => new Date(t).getDate() === 1 && new Date(t).getMonth() % 3 === 0));
  const long = monthTicks(at(2019, 3, 1), at(2026, 10, 1));
  assert.ok(long.length <= 6 && long.length >= 3, String(long.length));
  assert.ok(long.every(t => new Date(t).getMonth() === 0));
});

test('a tick names its year at January and on the first tick', () => {
  assert.equal(monthTickLabel(new Date(2026, 3, 1).getTime(), false), 'Apr');
  assert.equal(monthTickLabel(new Date(2026, 0, 1).getTime(), false), 'Jan 2026');
  assert.equal(monthTickLabel(new Date(2025, 9, 1).getTime(), true), 'Oct 2025');
});
