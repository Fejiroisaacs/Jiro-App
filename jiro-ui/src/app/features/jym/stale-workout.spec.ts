// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStale, lastActivity } from './stale-workout.ts';

const now = Date.parse('2026-09-28T20:00:00Z');
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString();

test('stale after three hours without a set', () => {
  assert.equal(isStale({ started_at: hoursAgo(5), last_set_at: hoursAgo(3) }, now), true);
  assert.equal(isStale({ started_at: hoursAgo(5), last_set_at: hoursAgo(2.9) }, now), false);
});

test('a long workout that is still logging is not stale', () => {
  assert.equal(isStale({ started_at: hoursAgo(4), last_set_at: hoursAgo(0.1) }, now), false);
});

test('with nothing logged, the start is the last activity', () => {
  assert.equal(lastActivity({ started_at: hoursAgo(1), last_set_at: null }), now - 3_600_000);
  assert.equal(isStale({ started_at: hoursAgo(26), last_set_at: null }, now), true);
});
