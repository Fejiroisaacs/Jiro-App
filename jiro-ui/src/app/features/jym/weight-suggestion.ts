/** The plate step per display unit: the smallest jump most gyms can load. */
export const PLATE_STEP: Record<'kg' | 'lbs', number> = { kg: 2.5, lbs: 5 };

/** One plate up from a weight: round down to the plate grid, then add a step (177.5 lbs to 180, 81.25 kg to 82.5). */
export function nextPlateWeight(top: number, unit: string): number {
  const step = unit === 'kg' ? PLATE_STEP.kg : PLATE_STEP.lbs;
  return Math.round((Math.floor(top / step + 1e-9) + 1) * step * 100) / 100;
}

/** @deprecated Use nextPlateWeight; kept until the player moves to nextSets. */
export function suggestNextWeight(lastTop: number, unit: string): number {
  return nextPlateWeight(lastTop, unit);
}

/** The fields of a logged set the suggestion reads; SetHistory is assignable to this. */
export interface PastSet {
  session_id: string;
  date: string;
  set_number: number;
  /** kg, as stored. */
  weight: number;
  reps: number;
  rpe: number | null;
  is_warmup: boolean;
  session_type: string;
}

export interface LastSet {
  weight: number;
  reps: number;
  warmup: boolean;
}

/** Today's aim for one exercise; weights are in the display unit. */
export interface NextSets {
  /** Every set of the last normal workout, in order. */
  last: LastSet[];
  /** up: one plate more. hold: the same weight. reps: a bodyweight lift, one rep more. */
  move: 'up' | 'hold' | 'reps';
  weight: number;
  reps: number;
  /** Why it holds: the plan wasn't met, or the top set was near failure (RPE 9 or more). */
  reason: 'plan' | 'rpe' | null;
}

/**
 * Today's aim for one exercise, from its history.
 *
 * Last time is the latest normal workout other than today's; deload and test days
 * would mislead. With a plan it is double progression: once enough sets at the top
 * weight reach the planned reps, add a plate, otherwise stay. Without a plan, add a
 * plate unless the top set was logged at RPE 9 or more. Bodyweight lifts add a rep.
 * Warm-ups never count.
 */
export function nextSets(
  history: readonly PastSet[],
  opts: {
    excludeSessionId: string;
    plan: { sets: number; reps: number } | null;
    unit: string;
    toDisplay: (kg: number) => number;
  },
): NextSets | null {
  let latest: { id: string; time: number } | null = null;
  for (const h of history) {
    if (h.session_id === opts.excludeSessionId || h.session_type !== 'normal') continue;
    const time = new Date(h.date).getTime();
    if (!latest || time > latest.time) latest = { id: h.session_id, time };
  }
  if (!latest) return null;

  const sets = history
    .filter(h => h.session_id === latest!.id)
    .sort((a, b) => a.set_number - b.set_number)
    .map(h => ({ weight: opts.toDisplay(h.weight), reps: h.reps, warmup: h.is_warmup, rpe: h.rpe }));
  const working = sets.filter(s => !s.warmup);
  if (working.length === 0) return null;

  const last = sets.map(({ weight, reps, warmup }) => ({ weight, reps, warmup }));
  const top = Math.max(...working.map(s => s.weight));
  const atTop = working.filter(s => Math.abs(s.weight - top) < 0.01);
  const best = atTop.reduce((a, b) => (b.reps > a.reps ? b : a));

  if (top === 0) {
    return { last, move: 'reps', weight: 0, reps: Math.max(...working.map(s => s.reps)) + 1, reason: null };
  }
  if (opts.plan) {
    const met = atTop.filter(s => s.reps >= opts.plan!.reps).length >= opts.plan.sets;
    return met
      ? { last, move: 'up', weight: nextPlateWeight(top, opts.unit), reps: opts.plan.reps, reason: null }
      : { last, move: 'hold', weight: top, reps: opts.plan.reps, reason: 'plan' };
  }
  if (best.rpe != null && best.rpe >= 9) {
    return { last, move: 'hold', weight: top, reps: best.reps + 1, reason: 'rpe' };
  }
  return { last, move: 'up', weight: nextPlateWeight(top, opts.unit), reps: best.reps, reason: null };
}
