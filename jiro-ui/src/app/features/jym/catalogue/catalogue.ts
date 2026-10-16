// Grouping and searching the exercise catalogue (J20); pure, so it runs in the unit tests.
import type { CatalogueExercise } from '../../../core/services/jym.service';
import { MUSCLE_GROUPS } from '../shared/muscles';

/** The equipment chips, in order. */
export const EQUIPMENT = ['Barbell', 'Dumbbell', 'Kettlebell', 'Machine', 'Cable', 'Bodyweight', 'Other'] as const;

export interface CatalogueGroup {
  muscle: string;
  items: CatalogueExercise[];
}

/** Matches a name or any of its muscles, ignoring case. */
function matches(e: CatalogueExercise, q: string): boolean {
  return !q || e.name.toLowerCase().includes(q) || e.muscle_group.toLowerCase().includes(q)
    || e.secondary_muscles.some(m => m.toLowerCase().includes(q));
}

/** The catalogue in one section per main muscle (the muscle list's order), filtered; empty sections drop out. */
export function groupCatalogue(list: readonly CatalogueExercise[], o: { search: string; equipment: string }): CatalogueGroup[] {
  const q = o.search.trim().toLowerCase();
  return MUSCLE_GROUPS
    .map(muscle => ({ muscle, items: list.filter(e => e.muscle_group === muscle && (!o.equipment || e.equipment === o.equipment) && matches(e, q)) }))
    .filter(g => g.items.length > 0);
}

/** A picker search's catalogue suggestions: not in the library, name matches, names starting with it first. */
export function catalogueMatches(list: readonly CatalogueExercise[], search: string, limit = 5): CatalogueExercise[] {
  const q = search.trim().toLowerCase();
  if (q.length < 2) return [];
  const hits = list.filter(e => !e.in_library && e.name.toLowerCase().includes(q));
  const starts = (e: CatalogueExercise) => e.name.toLowerCase().split(/\s+/).some(w => w.startsWith(q)) ? 0 : 1;
  return hits.sort((a, b) => starts(a) - starts(b)).slice(0, limit);
}
