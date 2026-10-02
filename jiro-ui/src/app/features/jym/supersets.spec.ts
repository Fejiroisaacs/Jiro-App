// Run with `npm run test:unit` (Node's test runner; the app build skips *.spec.ts).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupLabels, linkedWithNext, membersOf, normalizeGroups, normalizeItems, roundStep, segments, toggleLink, type Group } from './supersets.ts';

const g = (s: string): Group[] => s.split(' ').map(x => (x === '-' ? null : Number(x)));
const show = (groups: Group[]) => groups.map(x => x ?? '-').join(' ');

test('the same rule as the API', () => {
  for (const [input, want] of [
    ['- -', '- -'], ['1 1', '1 1'], ['7 7 7', '1 1 1'], ['1', '-'],
    ['2 2 1 1', '1 1 2 2'], ['5 5 - 5 5', '1 1 - 2 2'], ['1 2 1', '- - -'], ['3 3 - 4', '1 1 - -'],
  ]) {
    assert.equal(show(normalizeGroups(g(input))), want, input);
  }
});

test('linking joins, a third member makes a circuit, and joining two supersets merges them', () => {
  assert.equal(show(toggleLink(g('- - -'), 0)), '1 1 -');
  assert.equal(show(toggleLink(g('1 1 -'), 1)), '1 1 1');
  assert.equal(show(toggleLink(g('1 1 2 2'), 1)), '1 1 1 1');
  // The last item has nothing to link to.
  assert.equal(show(toggleLink(g('- -'), 1)), '- -');
});

test('unlinking splits at the joint; a member left alone is ungrouped', () => {
  assert.equal(show(toggleLink(g('1 1'), 0)), '- -');
  assert.equal(show(toggleLink(g('1 1 1 1'), 1)), '1 1 2 2');
  assert.equal(show(toggleLink(g('1 1 1'), 0)), '- 1 1');
});

test('labels name each superset and member in order', () => {
  assert.deepEqual(groupLabels(g('1 1 - 2 2 2')), ['A1', 'A2', null, 'B1', 'B2', 'B3']);
  assert.equal(linkedWithNext(g('1 1 -'), 0), true);
  assert.equal(linkedWithNext(g('1 1 -'), 1), false);
});

test('items keep their identity when their group is unchanged', () => {
  const a = { id: 'a', superset_group: 1 as Group };
  const b = { id: 'b', superset_group: null as Group };
  const c = { id: 'c', superset_group: 1 as Group };
  const out = normalizeItems([a, b, c]);
  assert.deepEqual(out.map(x => x.superset_group), [null, null, null]);
  assert.equal(out[1], b);
});

test('segments keep a superset together and the rest one by one', () => {
  assert.deepEqual(segments(g('- 1 1 - 2 2 2')).map(x => x.indices.join('')), ['0', '12', '3', '456']);
  assert.deepEqual(membersOf(g('- 1 1 -'), 2), [1, 2]);
  assert.deepEqual(membersOf(g('- 1 1 -'), 3), [3]);
});

test('a round: no rest between members, rest after the last, then back to the first', () => {
  const groups = g('- 1 1 -');
  const all = () => true;
  assert.deepEqual(roundStep(groups, 1, all), { rest: false, next: 2 });
  assert.deepEqual(roundStep(groups, 2, all), { rest: true, next: 1 });
  // Outside a superset: rest, nothing to point to.
  assert.deepEqual(roundStep(groups, 0, all), { rest: true, next: null });
});

test('a finished member is skipped; when nothing is left the round ends', () => {
  const groups = g('1 1 1');
  // B is done: A goes straight to C.
  assert.deepEqual(roundStep(groups, 0, j => j !== 1), { rest: false, next: 2 });
  // Only A still has sets: rest, then A again.
  assert.deepEqual(roundStep(groups, 2, j => j === 0), { rest: true, next: 0 });
  assert.deepEqual(roundStep(groups, 2, () => false), { rest: true, next: null });
});
