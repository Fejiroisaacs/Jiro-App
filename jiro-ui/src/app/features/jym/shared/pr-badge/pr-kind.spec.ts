// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prDescription, prLabel } from './pr-kind.ts';

test('the badge names the top record kind', () => {
  assert.equal(prLabel('weight'), 'Weight PR');
  assert.equal(prLabel('e1rm'), 'e1RM PR');
  assert.equal(prLabel('reps'), 'Rep PR');
  assert.equal(prLabel('pace'), 'Pace PR');
  assert.equal(prLabel(null), 'PR');
  assert.equal(prLabel('unknown'), 'PR');
});

test('its description lists every record the set earned', () => {
  assert.equal(prDescription(['weight', 'e1rm', 'reps']), 'Personal record: heaviest weight, best estimated 1RM and rep max');
  assert.equal(prDescription(['distance', 'pace']), 'Personal record: longest distance and fastest pace');
  assert.equal(prDescription(['hold']), 'Personal record: longest hold');
  assert.equal(prDescription([]), 'Personal record');
  assert.equal(prDescription(null), 'Personal record');
});
