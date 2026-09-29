// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filled, parseDecimal, parseWhole } from './number-input.ts';

test('a comma is a decimal point', () => {
  assert.equal(parseDecimal('102,5'), 102.5);
  assert.equal(parseDecimal('102.5'), 102.5);
  assert.equal(parseDecimal(' 60 '), 60);
  assert.equal(parseDecimal('.5'), 0.5);
});

test('a typed 0 is a value, an empty field is not', () => {
  assert.equal(parseDecimal('0'), 0);
  assert.equal(filled('0'), true);
  assert.equal(filled(0), true);
  assert.equal(filled(''), false);
  assert.equal(filled('  '), false);
  assert.equal(filled(null), false);
});

test('anything else is not a number', () => {
  for (const bad of ['', 'abc', '1.2.3', '-5', '1e3', '12 kg', null, undefined]) {
    assert.equal(parseDecimal(bad), null, String(bad));
  }
});

test('whole numbers only for reps', () => {
  assert.equal(parseWhole('8'), 8);
  assert.equal(parseWhole('8.5'), null);
  assert.equal(parseWhole('8,5'), null);
  assert.equal(parseWhole(''), null);
});
