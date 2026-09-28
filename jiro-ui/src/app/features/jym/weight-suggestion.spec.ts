// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextPlateWeight, nextSets, type PastSet } from './weight-suggestion.ts';

/** One workout's sets: [weight kg, reps, rpe?, warm-up?]. */
function workout(id: string, day: number, sets: [number, number, (number | null)?, boolean?][], type = 'normal'): PastSet[] {
  return sets.map(([weight, reps, rpe = null, warmup = false], i) => ({
    session_id: id,
    date: `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`,
    set_number: i + 1,
    weight,
    reps,
    rpe,
    is_warmup: warmup,
    session_type: type,
  }));
}

const opts = (plan: { sets: number; reps: number } | null = null) => ({
  excludeSessionId: 'today',
  plan,
  unit: 'kg',
  toDisplay: (kg: number) => kg,
});

test('one plate up rounds down to the grid first', () => {
  assert.equal(nextPlateWeight(177.5, 'lbs'), 180);
  assert.equal(nextPlateWeight(180, 'lbs'), 185);
  assert.equal(nextPlateWeight(81.25, 'kg'), 82.5);
  assert.equal(nextPlateWeight(80, 'kg'), 82.5);
});

test('a plan that was met adds a plate at the planned reps', () => {
  const got = nextSets(workout('a', 1, [[100, 8], [100, 8], [100, 8]]), opts({ sets: 3, reps: 8 }));
  assert.deepEqual([got?.move, got?.weight, got?.reps], ['up', 102.5, 8]);
});

test('a plan that was missed holds the weight', () => {
  const got = nextSets(workout('a', 1, [[100, 8], [100, 8], [100, 6]]), opts({ sets: 3, reps: 8 }));
  assert.deepEqual([got?.move, got?.weight, got?.reps, got?.reason], ['hold', 100, 8, 'plan']);
});

test('deload, test and today are never last time', () => {
  const history = [
    ...workout('normal', 1, [[100, 5]]),
    ...workout('deload', 2, [[60, 5]], 'deload'),
    ...workout('test', 3, [[140, 1]], 'test'),
    ...workout('today', 4, [[105, 5]]),
  ];
  const got = nextSets(history, opts());
  assert.deepEqual(got?.last, [{ weight: 100, reps: 5, warmup: false }]);
});

test('warm-ups are listed but never count', () => {
  const got = nextSets(workout('a', 1, [[140, 1, null, true], [100, 5]]), opts());
  assert.equal(got?.last.length, 2);
  assert.deepEqual([got?.move, got?.weight, got?.reps], ['up', 102.5, 5]);
});

test('a bodyweight lift adds a rep', () => {
  const got = nextSets(workout('a', 1, [[0, 12], [0, 10]]), opts({ sets: 3, reps: 8 }));
  assert.deepEqual([got?.move, got?.weight, got?.reps], ['reps', 0, 13]);
});

test('freestyle holds after RPE 9 and adds a plate otherwise', () => {
  const hard = nextSets(workout('a', 1, [[100, 5, 9]]), opts());
  assert.deepEqual([hard?.move, hard?.weight, hard?.reps, hard?.reason], ['hold', 100, 6, 'rpe']);
  const easy = nextSets(workout('a', 1, [[100, 5, 7]]), opts());
  assert.deepEqual([easy?.move, easy?.weight, easy?.reps], ['up', 102.5, 5]);
});

test('no normal workout before today means no suggestion', () => {
  assert.equal(nextSets(workout('today', 1, [[100, 5]]), opts()), null);
  assert.equal(nextSets(workout('a', 1, [[60, 10, null, true]]), opts()), null);
});

test('the latest normal workout wins', () => {
  const history = [...workout('old', 1, [[90, 5]]), ...workout('new', 2, [[95, 5]])];
  assert.equal(nextSets(history, opts())?.weight, 97.5);
});
