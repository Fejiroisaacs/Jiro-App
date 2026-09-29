// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PLATES, nearestLoadable, platesPerSide, warmupRamp } from './plates.ts';

const lbs = DEFAULT_PLATES.lbs;
const kg = DEFAULT_PLATES.kg;

test('plates per side, fewest first', () => {
  assert.deepEqual(platesPerSide(225, lbs), [45, 45]);
  assert.deepEqual(platesPerSide(135, lbs), [45]);
  assert.deepEqual(platesPerSide(185, lbs), [45, 25]);
  // 100 kg is 40 a side: two plates either way, the heavier first.
  assert.deepEqual(platesPerSide(100, kg), [25, 15]);
});

test('the bare bar is no plates; lighter than the bar is none', () => {
  assert.deepEqual(platesPerSide(45, lbs), []);
  assert.equal(platesPerSide(40, lbs), null);
});

test('a weight the plates cannot make is null', () => {
  // 227.5 lbs is 91.25 a side, and the smallest plate is 2.5.
  assert.equal(platesPerSide(227.5, lbs), null);
});

test('finds the fewest plates where heaviest-first would fail', () => {
  // 60 a side from 45/35/25: greedy takes 45 and is stuck at 15; 35 + 25 works.
  assert.deepEqual(platesPerSide(120, { bar: 0, sizes: [45, 35, 25] }), [35, 25]);
});

test('nearest loadable weights either side', () => {
  assert.deepEqual(nearestLoadable(227.5, lbs), { below: 225, above: 230 });
  assert.deepEqual(nearestLoadable(225, lbs), { below: 225, above: 225 });
  assert.deepEqual(nearestLoadable(30, lbs), { below: null, above: 45 });
});

test('warm-ups for 225 lbs: the bar, then about 50, 70 and 85 percent, rounded down', () => {
  // 112.5 -> 110 (32.5 a side), 157.5 -> 155 (55), 191.25 -> 190 (72.5).
  assert.deepEqual(warmupRamp(225, lbs), [
    { weight: 45, reps: 10 },
    { weight: 110, reps: 5 },
    { weight: 155, reps: 3 },
    { weight: 190, reps: 1 },
  ]);
});

test('warm-ups for 100 kg', () => {
  assert.deepEqual(warmupRamp(100, kg), [
    { weight: 20, reps: 10 },
    { weight: 50, reps: 5 },
    { weight: 70, reps: 3 },
    { weight: 85, reps: 1 },
  ]);
});

test('a light working weight drops the steps that would not climb', () => {
  // 50% and 70% of 60 are under the bar; 85% is 51, loadable as 50.
  assert.deepEqual(warmupRamp(60, lbs), [
    { weight: 45, reps: 10 },
    { weight: 50, reps: 1 },
  ]);
});

test('no warm-ups at or below the bar, and no bare-zero step without a bar', () => {
  assert.deepEqual(warmupRamp(45, lbs), []);
  assert.deepEqual(warmupRamp(0, lbs), []);
  assert.deepEqual(warmupRamp(100, { bar: 0, sizes: [10, 5] }), [
    { weight: 50, reps: 5 },
    { weight: 70, reps: 3 },
    { weight: 80, reps: 1 },
  ]);
});
