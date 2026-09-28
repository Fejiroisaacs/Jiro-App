// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seriesProgress, weeksElapsed, type SeriesLength } from './series-progress.ts';

const NOW = new Date('2026-09-28T12:00:00Z').getTime();

function series(o: Partial<SeriesLength>): SeriesLength {
  return {
    duration_type: 'weeks', target_weeks: 8, target_sessions: null,
    started_at: '2026-08-01T12:00:00Z', ended_at: null, session_count: 0, ...o,
  };
}

test('an ended block is measured to its end, not to today', () => {
  const old = series({ started_at: '2026-01-01T12:00:00Z', ended_at: '2026-02-26T12:00:00Z' });
  assert.deepEqual(seriesProgress(old, NOW), { percent: 100, label: '8 / 8 weeks' });
});

test('a running block counts whole weeks so far', () => {
  const running = series({ started_at: new Date(NOW - 3.5 * 7 * 86_400_000).toISOString() });
  const got = seriesProgress(running, NOW);
  assert.equal(got?.label, '3 / 8 weeks');
  assert.equal(Math.round(got?.percent ?? 0), 44);
});

test('a sessions block counts its counted workouts', () => {
  const got = seriesProgress(series({ duration_type: 'sessions', target_weeks: null, target_sessions: 20, session_count: 12 }), NOW);
  assert.deepEqual(got, { percent: 60, label: '12 / 20 sessions' });
});

test('the bar never passes 100%', () => {
  const over = series({ duration_type: 'sessions', target_weeks: null, target_sessions: 10, session_count: 14 });
  assert.equal(seriesProgress(over, NOW)?.percent, 100);
});

test('open-ended or target-less series have no progress', () => {
  assert.equal(seriesProgress(series({ duration_type: 'open', target_weeks: null }), NOW), null);
  assert.equal(seriesProgress(series({ target_weeks: null }), NOW), null);
});

test('weeks never go negative', () => {
  assert.equal(weeksElapsed({ started_at: '2026-10-05T12:00:00Z', ended_at: null }, NOW), 0);
});
