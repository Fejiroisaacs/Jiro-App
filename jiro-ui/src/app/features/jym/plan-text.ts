import { distanceText, durationText } from './exercise-kind';
import type { ExerciseKind } from './exercise-kind';

/** The fields of a plan item the text reads; RoutineItem, SessionExercise and the previews are assignable to this. */
export interface PlanFields {
  target_sets: number;
  target_reps: number;
  target_reps_max?: number | null;
  target_rpe?: number | null;
  rest_seconds?: number | null;
  target_distance_m?: number | null;
}

/** What a plan's target means: reps, seconds held (target_reps), or a distance in this unit. */
export interface PlanKind {
  kind: ExerciseKind;
  distanceUnit: 'km' | 'mi';
}

/** "8" or a range, "8-12". */
export function repsText(p: Pick<PlanFields, 'target_reps' | 'target_reps_max'>): string {
  return p.target_reps_max && p.target_reps_max > p.target_reps ? `${p.target_reps}-${p.target_reps_max}` : `${p.target_reps}`;
}

/** Seconds as m:ss: 90 is "1:30". */
export function restText(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Short ("3×8-12 · RPE 8 · 2:00") for chips, or long ("3 × 8-12 reps · RPE 8 · 2:00 rest") for sentences. A hold
 * reads "3×0:45" ("3 × 0:45 held"), a distance "1×5 km".
 */
export function planText(p: PlanFields, style: 'short' | 'long' = 'short', k?: PlanKind): string {
  const target = targetText(p, style, k);
  const parts = [style === 'short' ? `${p.target_sets}×${target}` : `${p.target_sets} × ${target}`];
  if (p.target_rpe) parts.push(`RPE ${p.target_rpe}`);
  if (p.rest_seconds) parts.push(style === 'short' ? restText(p.rest_seconds) : `${restText(p.rest_seconds)} rest`);
  return parts.join(' · ');
}

/** One set's target: reps ("8-12", "8-12 reps"), a hold ("0:45", "0:45 held") or a distance ("5 km"). */
function targetText(p: PlanFields, style: 'short' | 'long', k?: PlanKind): string {
  if (k?.kind === 'duration') return style === 'short' ? durationText(p.target_reps) : `${durationText(p.target_reps)} held`;
  if (k?.kind === 'distance' && p.target_distance_m) return distanceText(p.target_distance_m, k.distanceUnit);
  return style === 'short' ? repsText(p) : `${repsText(p)} reps`;
}

/** The rest lengths the builder offers, in seconds. */
export const REST_CHOICES = [30, 45, 60, 90, 120, 150, 180, 240, 300];
