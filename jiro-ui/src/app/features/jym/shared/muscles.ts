/** The one muscle list, in display order; the API (jym_muscles.go) and migration 000042 hold the same. */
export const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Other'] as const;

/**
 * Secondaries after picking `m`: added or removed, kept in list order, never the primary.
 * Secondaries only organise an exercise; every count uses the primary.
 */
export function toggleSecondary(primary: string, list: readonly string[], m: string): string[] {
  if (m === primary) return withoutPrimary(primary, list);
  const next = new Set(list.includes(m) ? list.filter(x => x !== m) : [...list, m]);
  return MUSCLE_GROUPS.filter(x => next.has(x) && x !== primary);
}

/** The secondaries once `primary` is chosen: it can't be its own secondary, and no primary means none. */
export function withoutPrimary(primary: string, list: readonly string[]): string[] {
  if (!primary) return [];
  return MUSCLE_GROUPS.filter(x => list.includes(x) && x !== primary);
}
