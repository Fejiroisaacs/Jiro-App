// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  distanceText, distanceUnit, durationText, kindChangeAllowed, kindOf, parseDistance, parseDuration, paceText, setText,
} from './exercise-kind.ts';

test('a typed time fills from the right like a microwave', () => {
  assert.equal(parseDuration('45'), 45);
  assert.equal(parseDuration('130'), 90);
  assert.equal(parseDuration('2505'), 1505);
  assert.equal(parseDuration('10000'), 3600);
  assert.equal(parseDuration('90'), 90, 'ninety seconds is fine');
  assert.equal(parseDuration('1:30'), 90, 'with a colon, as written');
  assert.equal(parseDuration('1:02:05'), 3725);
  assert.equal(parseDuration(''), null);
  assert.equal(parseDuration('0'), null);
  assert.equal(parseDuration('1:x'), null);
  assert.equal(parseDuration('1234567'), null);
});

test('times read as m:ss, and h:mm:ss from an hour', () => {
  assert.equal(durationText(45), '0:45');
  assert.equal(durationText(1505), '25:05');
  assert.equal(durationText(3725), '1:02:05');
});

test('distance follows the weight unit, stored in metres', () => {
  assert.equal(distanceUnit('kg'), 'km');
  assert.equal(distanceUnit('lbs'), 'mi');
  assert.equal(parseDistance('5', 'km'), 5000);
  assert.equal(parseDistance('3,1', 'mi'), 4989);
  assert.equal(parseDistance('0', 'km'), null);
  assert.equal(parseDistance('abc', 'km'), null);
  assert.equal(distanceText(5000, 'km'), '5 km');
  assert.equal(distanceText(4989, 'mi'), '3.1 mi');
  assert.equal(paceText(1560, 5000, 'km'), '5:12 /km');
  assert.equal(paceText(null, 5000, 'km'), null);
});

test('a set reads by its kind', () => {
  assert.equal(setText('weight_reps', { weight: 100, reps: 5 }, 'kg'), '100 kg × 5');
  assert.equal(setText('bodyweight', { weight: 20, reps: 8 }, 'kg'), '8 × +20 kg');
  assert.equal(setText('bodyweight', { weight: 0, reps: 12 }, 'kg'), '12 reps');
  assert.equal(setText('duration', { weight: 0, reps: 0, duration_s: 45 }, 'kg'), '0:45');
  assert.equal(setText('duration', { weight: 10, reps: 0, duration_s: 60 }, 'kg'), '1:00 · +10 kg');
  assert.equal(setText('distance', { weight: 0, reps: 0, duration_s: 1560, distance_m: 5000 }, 'kg'), '5 km in 26:00 (5:12 /km)');
});

test('a type changes freely between rep types, otherwise only before any set', () => {
  assert.equal(kindChangeAllowed('weight_reps', 'bodyweight', true), true);
  assert.equal(kindChangeAllowed('weight_reps', 'duration', true), false);
  assert.equal(kindChangeAllowed('distance', 'duration', false), true);
  assert.equal(kindOf(undefined), 'weight_reps');
  assert.equal(kindOf('distance'), 'distance');
});
