// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogueMatches, groupCatalogue } from './catalogue.ts';

const ex = (name: string, muscle: string, equipment: string, extra: Record<string, unknown> = {}) => ({
  key: name.toLowerCase().replace(/\W+/g, '-'), name, muscle_group: muscle, secondary_muscles: [] as string[],
  kind: 'weight_reps' as const, equipment, in_library: false, ...extra,
});
const list = [
  ex('Leg Press', 'Legs', 'Machine'),
  ex('Barbell Bench Press', 'Chest', 'Barbell', { secondary_muscles: ['Triceps'] }),
  ex('Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell'),
  ex('Cable Lateral Raise', 'Shoulders', 'Cable', { in_library: true }),
  ex('Pec Deck', 'Chest', 'Machine'),
];

test('groups by main muscle in the muscle list order, dropping empty groups', () => {
  const groups = groupCatalogue(list, { search: '', equipment: '' });
  assert.deepEqual(groups.map(g => g.muscle), ['Chest', 'Shoulders', 'Legs']);
  assert.deepEqual(groups[0].items.map(e => e.name), ['Barbell Bench Press', 'Pec Deck']);
});

test('filters by equipment and by name or muscle', () => {
  assert.deepEqual(groupCatalogue(list, { search: '', equipment: 'Machine' }).flatMap(g => g.items.map(e => e.name)), ['Pec Deck', 'Leg Press']);
  assert.deepEqual(groupCatalogue(list, { search: 'tricep', equipment: '' }).flatMap(g => g.items.map(e => e.name)), ['Barbell Bench Press']);
  assert.deepEqual(groupCatalogue(list, { search: 'LATERAL', equipment: 'Cable' }).flatMap(g => g.items.map(e => e.name)), ['Cable Lateral Raise']);
});

test('picker suggestions skip the library and need two letters', () => {
  assert.deepEqual(catalogueMatches(list, 'lateral').map(e => e.name), ['Dumbbell Lateral Raise']);
  assert.deepEqual(catalogueMatches(list, 'l'), []);
  // Names with a word starting with the search come first.
  assert.deepEqual(catalogueMatches(list, 'press').map(e => e.name), ['Leg Press', 'Barbell Bench Press']);
});
