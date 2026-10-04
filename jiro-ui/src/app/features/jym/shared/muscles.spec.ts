// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toggleSecondary, withoutPrimary } from './muscles.ts';

test('a secondary toggles on and off, in list order', () => {
  assert.deepEqual(toggleSecondary('Chest', [], 'Triceps'), ['Triceps']);
  assert.deepEqual(toggleSecondary('Chest', ['Triceps'], 'Shoulders'), ['Shoulders', 'Triceps']);
  assert.deepEqual(toggleSecondary('Chest', ['Shoulders', 'Triceps'], 'Triceps'), ['Shoulders']);
});

test('the primary is never its own secondary', () => {
  assert.deepEqual(toggleSecondary('Chest', ['Triceps'], 'Chest'), ['Triceps']);
  assert.deepEqual(withoutPrimary('Triceps', ['Shoulders', 'Triceps']), ['Shoulders']);
});

test('no primary means no secondaries', () => {
  assert.deepEqual(withoutPrimary('', ['Triceps']), []);
});
