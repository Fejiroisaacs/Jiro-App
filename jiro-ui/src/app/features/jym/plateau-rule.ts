/** The fields of a history row the rule reads; SetHistory is assignable to this. */
export interface PlateauSet {
  session_id: string;
  date: string;
  /** Null while the workout is still in progress. */
  ended_at: string | null;
  /** kg; 0 for a bodyweight set. */
  weight: number;
  reps: number;
  /** The API's estimated 1RM, in kg. */
  est_1rm: number;
  is_warmup: boolean;
  session_type: string;
}

/** Workouts on each side of the comparison. */
export const PLATEAU_WINDOW = 3;

/** How far the recent best must fall below the earlier one to read as a decline. */
export const DECLINE_PERCENT = 5;

export type PlateauStatus = 'plateau' | 'decline' | null;

interface Workout {
  time: number;
  e1rm: number;
  reps: number;
  weighted: boolean;
}

/**
 * Whether an exercise has stalled, from its history.
 *
 * Only finished normal workouts count, and never warm-ups. Each workout is measured
 * by its best set: estimated 1RM, or reps when the sets compared are all bodyweight.
 * The best of the last 3 workouts is set against the best of the up to 3 before
 * them: higher is progress (no banner), more than 5% lower is a decline, anything
 * else a plateau. Comparing bests over a window, not workout by workout, keeps
 * heavy, medium and light days from reading as a decline.
 */
export function detectPlateau(history: readonly PlateauSet[]): PlateauStatus {
  const byWorkout = new Map<string, Workout>();
  for (const h of history) {
    if (h.is_warmup || h.session_type !== 'normal' || h.ended_at === null) continue;
    const w = byWorkout.get(h.session_id) ?? { time: new Date(h.date).getTime(), e1rm: 0, reps: 0, weighted: false };
    w.e1rm = Math.max(w.e1rm, h.est_1rm);
    w.reps = Math.max(w.reps, h.reps);
    w.weighted ||= h.weight > 0;
    byWorkout.set(h.session_id, w);
  }
  const workouts = [...byWorkout.values()].sort((a, b) => a.time - b.time);
  if (workouts.length < PLATEAU_WINDOW + 1) return null;

  const recent = workouts.slice(-PLATEAU_WINDOW);
  const earlier = workouts.slice(-2 * PLATEAU_WINDOW, -PLATEAU_WINDOW);
  const weighted = (ws: Workout[]) => ws.some(w => w.weighted);
  // Weighted against bodyweight-only has no fair measure.
  if (weighted(recent) !== weighted(earlier)) return null;
  const measure = weighted(recent) ? (w: Workout) => w.e1rm : (w: Workout) => w.reps;

  const recentBest = Math.max(...recent.map(measure));
  const earlierBest = Math.max(...earlier.map(measure));
  if (earlierBest <= 0 || recentBest > earlierBest) return null;
  return recentBest < earlierBest * (1 - DECLINE_PERCENT / 100) ? 'decline' : 'plateau';
}
