/** The fields of a workout's stats row the rule reads; ExerciseStatsWorkout is assignable to this. */
export interface PlateauWorkout {
  started_at: string;
  /** Null while the workout is still in progress. */
  ended_at: string | null;
  session_type: string;
  working_sets: number;
  /** kg; the API's best estimated 1RM over the workout's working sets. */
  best_e1rm: number;
  max_reps: number;
  /** kg; 0 when every working set was bodyweight. */
  max_weight: number;
}

/** Workouts on each side of the comparison. */
export const PLATEAU_WINDOW = 3;

/** How far the recent best must fall below the earlier one to read as a decline. */
export const DECLINE_PERCENT = 5;

export type PlateauStatus = 'plateau' | 'decline' | null;

/**
 * Whether an exercise has stalled, from its workouts.
 *
 * Only finished normal workouts with a working set count. Each workout is measured
 * by its best set: estimated 1RM, or reps when the sets compared are all bodyweight.
 * The best of the last 3 workouts is set against the best of the up to 3 before
 * them: higher is progress (no banner), more than 5% lower is a decline, anything
 * else a plateau. Comparing bests over a window, not workout by workout, keeps
 * heavy, medium and light days from reading as a decline.
 */
export function detectPlateau(history: readonly PlateauWorkout[]): PlateauStatus {
  const workouts = history
    .filter(w => w.working_sets > 0 && w.session_type === 'normal' && w.ended_at !== null)
    .map(w => ({ time: new Date(w.started_at).getTime(), e1rm: w.best_e1rm, reps: w.max_reps, weighted: w.max_weight > 0 }))
    .sort((a, b) => a.time - b.time);
  if (workouts.length < PLATEAU_WINDOW + 1) return null;

  const recent = workouts.slice(-PLATEAU_WINDOW);
  const earlier = workouts.slice(-2 * PLATEAU_WINDOW, -PLATEAU_WINDOW);
  const weighted = (ws: typeof workouts) => ws.some(w => w.weighted);
  // Weighted against bodyweight-only has no fair measure.
  if (weighted(recent) !== weighted(earlier)) return null;
  const measure = weighted(recent) ? (w: typeof workouts[number]) => w.e1rm : (w: typeof workouts[number]) => w.reps;

  const recentBest = Math.max(...recent.map(measure));
  const earlierBest = Math.max(...earlier.map(measure));
  if (earlierBest <= 0 || recentBest > earlierBest) return null;
  return recentBest < earlierBest * (1 - DECLINE_PERCENT / 100) ? 'decline' : 'plateau';
}
