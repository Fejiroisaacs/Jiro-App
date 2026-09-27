/** The plate step per display unit: the smallest jump most gyms can load. */
export const PLATE_STEP: Record<'kg' | 'lbs', number> = { kg: 2.5, lbs: 5 };

/**
 * The next weight to try, in the user's display unit: last time's top weight
 * plus one plate step, rounded to the nearest step (175 lbs to 180, 80 kg to 82.5).
 */
export function suggestNextWeight(lastTop: number, unit: string): number {
  const step = unit === 'kg' ? PLATE_STEP.kg : PLATE_STEP.lbs;
  return Math.round((lastTop + step) / step) * step;
}
