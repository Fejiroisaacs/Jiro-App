/** The fields of a plan item the text reads; RoutineItem, SessionExercise and the previews are assignable to this. */
export interface PlanFields {
  target_sets: number;
  target_reps: number;
  target_reps_max?: number | null;
  target_rpe?: number | null;
  rest_seconds?: number | null;
}

/** "8" or a range, "8-12". */
export function repsText(p: Pick<PlanFields, 'target_reps' | 'target_reps_max'>): string {
  return p.target_reps_max && p.target_reps_max > p.target_reps ? `${p.target_reps}-${p.target_reps_max}` : `${p.target_reps}`;
}

/** Seconds as m:ss: 90 is "1:30". */
export function restText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Short ("3×8-12 · RPE 8 · 2:00") for chips, or long ("3 × 8-12 reps · RPE 8 · 2:00 rest") for sentences. */
export function planText(p: PlanFields, style: 'short' | 'long' = 'short'): string {
  const parts = [style === 'short' ? `${p.target_sets}×${repsText(p)}` : `${p.target_sets} × ${repsText(p)} reps`];
  if (p.target_rpe) parts.push(`RPE ${p.target_rpe}`);
  if (p.rest_seconds) parts.push(style === 'short' ? restText(p.rest_seconds) : `${restText(p.rest_seconds)} rest`);
  return parts.join(' · ');
}

/** The rest lengths the builder offers, in seconds. */
export const REST_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300];
