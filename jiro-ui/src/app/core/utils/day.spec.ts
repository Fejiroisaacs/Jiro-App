// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fromZonedInput, toZonedInput } from './day.ts';

const NY = 'America/New_York';

test('a date-time field shows the wall clock of the zone, summer and winter', () => {
  assert.equal(toZonedInput('2026-07-01T16:30:00Z', NY), '2026-07-01T12:30');
  assert.equal(toZonedInput('2026-12-01T17:30:45Z', NY), '2026-12-01T12:30');
  assert.equal(toZonedInput('2026-03-10T03:45:00Z', 'Asia/Kolkata'), '2026-03-10T09:15');
});

test('a typed wall-clock time is read back in the zone', () => {
  assert.equal(fromZonedInput('2026-07-01T12:30', NY), '2026-07-01T16:30:00.000Z');
  assert.equal(fromZonedInput('2026-12-01T12:30', NY), '2026-12-01T17:30:00.000Z');
  assert.equal(fromZonedInput('2026-03-10T09:15', 'Asia/Kolkata'), '2026-03-10T03:45:00.000Z');
});

test('the day the clocks go back keeps both 1:30s distinct from 2:30', () => {
  // 2026-11-01 01:30 happens twice in New York; either reading is a real instant, and 02:30 is after it.
  const onethirty = fromZonedInput('2026-11-01T01:30', NY)!;
  assert.equal(toZonedInput(onethirty, NY), '2026-11-01T01:30');
  assert.ok(Date.parse(fromZonedInput('2026-11-01T02:30', NY)!) > Date.parse(onethirty));
});

test('the hour the clocks skip still gives an instant', () => {
  // 2026-03-08 02:30 does not exist in New York; the field must still save something sane.
  const skipped = fromZonedInput('2026-03-08T02:30', NY);
  assert.ok(skipped !== null && ['2026-03-08T01:30', '2026-03-08T03:30'].includes(toZonedInput(skipped, NY)));
});

test('empty or malformed values are null', () => {
  assert.equal(fromZonedInput('', NY), null);
  assert.equal(fromZonedInput('2026-07-01', NY), null);
  assert.equal(fromZonedInput('12:30', NY), null);
});
