// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planText, repsText, restText } from './plan-text.ts';

test('reps read as a number or a range', () => {
  assert.equal(repsText({ target_reps: 8, target_reps_max: null }), '8');
  assert.equal(repsText({ target_reps: 8, target_reps_max: 12 }), '8-12');
  // A range of one number is just the number.
  assert.equal(repsText({ target_reps: 8, target_reps_max: 8 }), '8');
});

test('rest reads as m:ss', () => {
  assert.equal(restText(90), '1:30');
  assert.equal(restText(120), '2:00');
  assert.equal(restText(45), '0:45');
});

test('a plain plan is sets × reps; details are added in order', () => {
  assert.equal(planText({ target_sets: 3, target_reps: 8 }), '3×8');
  const full = { target_sets: 3, target_reps: 8, target_reps_max: 12, target_rpe: 8, rest_seconds: 120 };
  assert.equal(planText(full), '3×8-12 · RPE 8 · 2:00');
  assert.equal(planText(full, 'long'), '3 × 8-12 reps · RPE 8 · 2:00 rest');
});
