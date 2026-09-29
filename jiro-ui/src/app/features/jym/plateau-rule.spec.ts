// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlateau, type PlateauSet } from './plateau-rule.ts';

const epley = (weight: number, reps: number) => (reps <= 1 ? weight : Math.round(weight * (1 + Math.min(reps, 10) / 30) * 10) / 10);

/** Workouts in order, one per day: each a list of [weight kg, reps]. */
function workouts(list: [number, number][][], opts: { type?: string; unfinishedLast?: boolean } = {}): PlateauSet[] {
  return list.flatMap((sets, day) => sets.map(([weight, reps]) => ({
    session_id: `w${day}`,
    date: `2026-09-${String(day + 1).padStart(2, '0')}T10:00:00Z`,
    ended_at: opts.unfinishedLast && day === list.length - 1 ? null : `2026-09-${String(day + 1).padStart(2, '0')}T11:00:00Z`,
    weight,
    reps,
    est_1rm: epley(weight, reps),
    is_warmup: false,
    session_type: opts.type ?? 'normal',
  })));
}

test('the same best set six times is a plateau', () => {
  assert.equal(detectPlateau(workouts(Array(6).fill([[100, 5]]))), 'plateau');
});

test('more reps at the same weight is progress', () => {
  assert.equal(detectPlateau(workouts([[[100, 5]], [[100, 5]], [[100, 6]], [[100, 7]]])), null);
});

test('heavy, medium and light days that keep improving are not a decline', () => {
  const cycle = (add: number) => [[[100 + add, 3]], [[90 + add, 6]], [[80 + add, 10]]] as [number, number][][];
  assert.equal(detectPlateau(workouts([...cycle(0), ...cycle(2.5)])), null);
});

test('a best more than 5% down is a decline', () => {
  assert.equal(detectPlateau(workouts([[[100, 5]], [[100, 5]], [[100, 5]], [[90, 5]], [[90, 5]], [[92.5, 5]]])), 'decline');
});

test('bodyweight lifts compare reps', () => {
  assert.equal(detectPlateau(workouts([[[0, 8]], [[0, 9]], [[0, 10]], [[0, 11]]])), null);
  assert.equal(detectPlateau(workouts(Array(6).fill([[0, 10]]))), 'plateau');
});

test('fewer than four workouts say nothing', () => {
  assert.equal(detectPlateau(workouts(Array(3).fill([[100, 5]]))), null);
});

test('deloads, warm-ups and an unfinished workout are left out', () => {
  const history = [
    ...workouts(Array(4).fill([[100, 5]])),
    ...workouts([[[60, 5]]], { type: 'deload' }).map(s => ({ ...s, session_id: 'deload', date: '2026-09-20T10:00:00Z' })),
    { ...workouts([[[200, 1]]])[0], session_id: 'warm', date: '2026-09-21T10:00:00Z', is_warmup: true },
  ];
  assert.equal(detectPlateau(history), 'plateau');
  // Counted, the unfinished 120 x 5 would read as progress.
  const open = workouts([[[100, 5]], [[100, 5]], [[100, 5]], [[100, 5]], [[120, 5]]], { unfinishedLast: true });
  assert.equal(detectPlateau(open), 'plateau');
});

test('weighted against bodyweight-only is not compared', () => {
  assert.equal(detectPlateau(workouts([[[20, 8]], [[20, 8]], [[20, 8]], [[0, 12]], [[0, 12]], [[0, 12]]])), null);
});
