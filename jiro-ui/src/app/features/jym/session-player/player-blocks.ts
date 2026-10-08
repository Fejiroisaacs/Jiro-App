/** The player's rows and exercise blocks, built from the server's list, logged sets and this device's draft. */
import type { SessionExercise, SessionSet, SetHistory } from '../../../core/services/jym.service';
import { planText } from '../plan-text';
import { durationText, kindOf, parseDuration, setText, toDistanceUnit } from '../exercise-kind';
import type { ExerciseKind } from '../exercise-kind';
import type { DraftRow } from '../shared/session-draft';
import type { NextSets } from '../weight-suggestion';
import { filled, parseDecimal, parseWhole } from '../number-input';

/**
 * One row of an exercise; weight, reps and RPE are the text typed (a comma may be the decimal point). By kind,
 * `weight` is the weight, the added load, or the distance (km or mi), and `reps` is the reps or the time ("0:45").
 */
export interface SetRow {
  setNumber: number;
  weight: string;
  /** Stored kg of a logged set, so a unit switch re-derives it instead of reinterpreting the text. */
  weightKg?: number;
  reps: string;
  rpe: string;
  saved: boolean;
  isPR: boolean;
  saving: boolean;
  id: string | null;
  ghostWeight: string;
  ghostReps: string;
  isWarmup: boolean;
  /** A logged set opened for correction, and its values before the edit. */
  editing?: boolean;
  before?: { weight: string; reps: string; rpe: string };
  /** A logged distance set's stored metres and time, and which record it set (distance or pace). */
  distanceM?: number | null;
  durationS?: number | null;
  prKind?: 'distance' | 'pace' | null;
}

export interface ExerciseBlock {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  /** How its sets are logged; weight × reps when unknown. */
  kind: ExerciseKind;
  sets: SetRow[];
  ghostSets: { weight: number; reps: number }[];
  suggestion: string | null;
  exerciseNote: string;
  /** The plan's target for this exercise, as the workout started with it. */
  plan?: BlockPlan;
  /** repeat when the advice is to hold the weight, trend-up otherwise. */
  suggestionIcon?: 'trend-up' | 'repeat';
  /** Its superset in the workout's list (supersets.ts); null outside one. */
  group?: number | null;
  /** The exercise's own rest in seconds, used when the plan sets none; null rests for your usual. */
  ownRest?: number | null;
}

/** A plan entry in the player; reps is the bottom of the range when repsMax is set. */
export interface BlockPlan {
  sets: number;
  reps: number;
  repsMax: number | null;
  rpe: number | null;
  /** Seconds; null rests for your usual time. */
  rest: number | null;
  note: string | null;
  /** A distance plan's target in metres. */
  distanceM: number | null;
}

/** The entry's plan, or none outside the plan. */
export function planOf(x: SessionExercise): BlockPlan | undefined {
  if (!x.target_sets || !x.target_reps) return undefined;
  return {
    sets: x.target_sets, reps: x.target_reps, repsMax: x.target_reps_max ?? null,
    rpe: x.target_rpe ?? null, rest: x.rest_seconds ?? null, note: x.notes ?? null,
    distanceM: x.target_distance_m ?? null,
  };
}

/** A planned row's ghosts by kind: the reps, the hold's time, or the distance (time is what you do). */
function planGhosts(kind: ExerciseKind, plan: BlockPlan, dUnit: 'km' | 'mi'): Partial<SetRow> {
  if (kind === 'duration') return { ghostReps: durationText(plan.reps) };
  if (kind === 'distance') return plan.distanceM ? { ghostWeight: String(toDistanceUnit(plan.distanceM, dUnit)) } : {};
  return { ghostReps: String(plan.reps) };
}

/** The rest after this exercise when it's set: the plan's, else its own; null rests for your usual. */
export function restOf(block: ExerciseBlock): number | null {
  return block.plan?.rest ?? block.ownRest ?? null;
}

/** "Plan 3×8-12 · RPE 8 · 2:00", "Plan 3×0:45", "Plan 1×5 km". */
export function planTag(plan: BlockPlan, kind: ExerciseKind = 'weight_reps', dUnit: 'km' | 'mi' = 'km'): string {
  return 'Plan ' + planText({
    target_sets: plan.sets, target_reps: plan.reps, target_reps_max: plan.repsMax, target_rpe: plan.rpe, rest_seconds: plan.rest,
    target_distance_m: plan.distanceM,
  }, 'short', { kind, distanceUnit: dUnit });
}

export function newRow(setNumber: number, init: Partial<SetRow> = {}): SetRow {
  return {
    setNumber, weight: '', reps: '', rpe: '',
    saved: false, isPR: false, saving: false, id: null,
    ghostWeight: '', ghostReps: '', isWarmup: false,
    ...init,
  };
}

export function emptyBlock(exerciseId: string, exerciseName: string, muscleGroup: string | null, sets: SetRow[], kind: ExerciseKind = 'weight_reps'): ExerciseBlock {
  return { exerciseId, exerciseName, muscleGroup, kind, sets, ghostSets: [], suggestion: null, exerciseNote: '' };
}

/** A block for one entry of the list with nothing logged: its planned rows (the plan's target as ghosts), else one row. */
export function blockFromEntry(x: SessionExercise, dUnit: 'km' | 'mi' = 'km'): ExerciseBlock {
  const plan = planOf(x);
  const kind = kindOf(x.exercise_kind);
  const rows = plan
    ? Array.from({ length: plan.sets }, (_, i) => newRow(i + 1, planGhosts(kind, plan, dUnit)))
    : [newRow(1)];
  return {
    ...emptyBlock(x.exercise_id, x.exercise_name, x.muscle_group, rows, kind), ...(plan ? { plan } : {}),
    group: x.superset_group ?? null, ownRest: x.exercise_rest_seconds ?? null,
  };
}

/** A logged set's two columns by kind: weight and reps, load and time, or distance and time. */
export function loggedColumns(kind: ExerciseKind, s: { weight: number; reps_performed: number; duration_s?: number | null; distance_m?: number | null },
  display: (kg: number) => number, dUnit: 'km' | 'mi'): Pick<SetRow, 'weight' | 'reps'> {
  if (kind === 'distance') return { weight: String(toDistanceUnit(s.distance_m ?? 0, dUnit)), reps: durationText(s.duration_s ?? 0) };
  if (kind === 'duration') return { weight: String(display(s.weight)), reps: durationText(s.duration_s ?? 0) };
  return { weight: String(display(s.weight)), reps: String(s.reps_performed) };
}

/** Logged sets as saved rows, one block per exercise in the order the sets come; `display` shows stored kg. */
export function loggedBlocks(sets: SessionSet[], display: (kg: number) => number, dUnit: 'km' | 'mi' = 'km'): ExerciseBlock[] {
  const byExercise = new Map<string, ExerciseBlock>();
  for (const s of sets) {
    const kind = kindOf(s.exercise_kind);
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { ...emptyBlock(s.exercise_id, s.exercise_name, s.muscle_group, [], kind), exerciseNote: s.exercise_note || '' });
    }
    byExercise.get(s.exercise_id)!.sets.push(newRow(s.set_number, {
      ...loggedColumns(kind, s, display, dUnit),
      weightKg: s.weight,
      distanceM: s.distance_m ?? null,
      durationS: s.duration_s ?? null,
      prKind: s.pr_kind ?? null,
      rpe: s.rpe != null ? String(s.rpe) : '',
      saved: true,
      isPR: s.is_pr,
      id: s.id,
      isWarmup: s.is_warmup,
    }));
  }
  return [...byExercise.values()];
}

/**
 * The workout's blocks in the list's order. A logged exercise is padded to its planned sets, ghosted from its
 * last working set. This device's unlogged rows (`draftRows`, already in the shown unit) replace that padding;
 * a draft row whose number a logged set now holds (logged elsewhere) is dropped.
 */
export function buildBlocks(
  exercises: SessionExercise[],
  sets: SessionSet[],
  draftRows: Record<string, DraftRow[]>,
  display: (kg: number) => number,
  dUnit: 'km' | 'mi' = 'km',
): ExerciseBlock[] {
  const logged = new Map(loggedBlocks(sets, display, dUnit).map(b => [b.exerciseId, b]));
  // Logged exercises missing from the list (never expected) still show, after it.
  const listed = new Set(exercises.map(x => x.exercise_id));
  const extra = [...logged.values()].filter(b => !listed.has(b.exerciseId));

  const blocks = exercises.map(x => {
    const b = logged.get(x.exercise_id);
    if (!b) return blockFromEntry(x, dUnit);
    const plan = planOf(x);
    b.kind = kindOf(x.exercise_kind);
    if (plan) b.plan = plan;
    b.group = x.superset_group ?? null;
    b.ownRest = x.exercise_rest_seconds ?? null;
    const last = b.sets.filter(s => !s.isWarmup).at(-1);
    for (let n = b.sets.length + 1; plan && n <= plan.sets; n++) {
      b.sets.push(newRow(n, { ghostWeight: last?.weight ?? '', ghostReps: last?.reps ?? '', ...planGhosts(b.kind, plan, dUnit) }));
    }
    return b;
  });

  for (const b of [...blocks, ...extra]) {
    const rows = draftRows[b.exerciseId];
    if (!rows) continue;
    const kept = b.sets.filter(r => r.saved);
    const taken = new Set(kept.map(r => r.setNumber));
    const last = kept.filter(r => !r.isWarmup).at(-1);
    b.sets = [...kept, ...rows.filter(d => !taken.has(d.setNumber)).map(d => newRow(d.setNumber, {
      weight: d.weight, reps: d.reps, rpe: d.rpe, isWarmup: d.isWarmup,
      ghostWeight: d.isWarmup ? '' : last?.weight ?? '',
      ghostReps: '',
      ...(!d.isWarmup && b.plan ? planGhosts(b.kind, b.plan, dUnit) : {}),
    }))].sort((x, y) => x.setNumber - y.setNumber);
  }
  return [...blocks, ...extra];
}

/** RPE is a whole number from 1 to 10. */
export function rpeInvalid(rpe: string): boolean {
  const v = parseWhole(rpe);
  return v === null || v < 1 || v > 10;
}

/**
 * What a row logs, read by kind from typed values (a typed 0 included) or ghosts: `first` is the weight, the added
 * load (blank is none) or the distance in the shown unit; `second` is the reps, or the time in seconds. Null when
 * a needed value doesn't read.
 */
export function rowValues(row: Pick<SetRow, 'weight' | 'reps' | 'ghostWeight' | 'ghostReps'>, kind: ExerciseKind = 'weight_reps'): { first: number; second: number } | null {
  const firstText = filled(row.weight) ? row.weight : row.ghostWeight;
  const secondText = filled(row.reps) ? row.reps : row.ghostReps;
  const loadOptional = kind === 'bodyweight' || kind === 'duration';
  const first = loadOptional && !filled(firstText) ? 0 : parseDecimal(firstText);
  if (first === null || (kind === 'distance' && first <= 0)) return null;
  if (kind === 'duration' || kind === 'distance') {
    const seconds = parseDuration(secondText);
    return seconds === null ? null : { first, second: seconds };
  }
  const reps = parseWhole(secondText);
  return reps === null || reps < 1 ? null : { first, second: reps };
}

/** ✓ is ready when the row's values read for its kind, typed or ghosted. */
export function canLog(row: SetRow, kind: ExerciseKind = 'weight_reps'): boolean {
  return !row.saving && rowValues(row, kind) !== null && !(filled(row.rpe) && rpeInvalid(row.rpe));
}

/** The ✓'s accessible name: what one tap logs ("Log set 2: 100 lbs × 5", "Log set 1: 0:45", "Log set 1: 3 mi in 26:00"). */
export function logLabel(row: SetRow, unit: string, kind: ExerciseKind = 'weight_reps', dUnit: 'km' | 'mi' = 'km'): string {
  const v = rowValues(row, kind);
  if (!v) return `Log set ${row.setNumber}`;
  const text = kind === 'distance'
    ? `${v.first} ${dUnit} in ${durationText(v.second)}`
    : setText(kind, { weight: v.first, reps: v.second, duration_s: v.second }, unit);
  return `Log set ${row.setNumber}: ${text}`;
}

/** A logged working set under the plan: fewer reps, a shorter hold, or a shorter distance. */
export function isShort(block: ExerciseBlock, row: SetRow): boolean {
  if (!block.plan || !row.saved || row.isWarmup) return false;
  if (block.kind === 'duration') return (parseDuration(row.reps) ?? 0) < block.plan.reps;
  if (block.kind === 'distance') return !!block.plan.distanceM && (row.distanceM ?? 0) < block.plan.distanceM - 0.5;
  return (parseWhole(row.reps) ?? 0) < block.plan.reps;
}

/**
 * "Last time" for kinds without an aim (bodyweight, duration, distance): the latest earlier normal workout's working
 * sets in words, and its first set as every row's ghost. `display` shows stored kg; `before` is this workout's start.
 */
export function lastTimeFrom(kind: ExerciseKind, history: SetHistory[], o: {
  excludeSessionId: string; before: string; unit: string; dUnit: 'km' | 'mi'; display: (kg: number) => number;
}): Suggestion | null {
  const earlier = history.filter(h => h.session_id !== o.excludeSessionId && h.session_type === 'normal'
    && !h.is_warmup && Date.parse(h.date) < Date.parse(o.before));
  if (!earlier.length) return null;
  const latest = earlier.reduce((a, b) => Date.parse(b.date) > Date.parse(a.date) ? b : a);
  const sets = earlier.filter(h => h.session_id === latest.session_id).sort((a, b) => a.set_number - b.set_number);
  const words = sets.map(h => setText(kind, { weight: o.display(h.weight), reps: h.reps, duration_s: h.duration_s, distance_m: h.distance_m }, o.unit));
  const first = sets[0];
  const cols = loggedColumns(kind, { weight: first.weight, reps_performed: first.reps, duration_s: first.duration_s, distance_m: first.distance_m }, o.display, o.dUnit);
  return {
    text: `Last time ${words.join(', ')}.`,
    // A bodyweight or hold with no load ghosts a blank load, not "0".
    ghostWeight: kind !== 'distance' && first.weight === 0 ? '' : cols.weight,
    ghostReps: cols.reps,
    icon: 'repeat',
  };
}

/** A distance in the other unit when the weight unit switches (kg ↔ lbs is km ↔ mi). */
export function convertDistanceText(value: string, fromWeightUnit: string, toWeightUnit: string): string {
  const n = parseDecimal(value);
  if (n === null || fromWeightUnit === toWeightUnit) return value;
  const metres = n * (fromWeightUnit === 'kg' ? 1000 : 1609.344);
  return String(toDistanceUnit(metres, toWeightUnit === 'kg' ? 'km' : 'mi'));
}

/** The weight an exercise works at next: the first unlogged working row, typed or ghosted, else the last logged. */
export function workingWeight(block: ExerciseBlock): number | null {
  const next = block.sets.find(s => !s.saved && !s.isWarmup);
  const typed = next ? parseDecimal(filled(next.weight) ? next.weight : next.ghostWeight) : null;
  if (typed !== null) return typed;
  const last = block.sets.filter(s => s.saved && !s.isWarmup).at(-1);
  return last ? parseDecimal(last.weight) : null;
}

export function rampSummary(ramp: { weight: number; reps: number }[]): string {
  return ramp.map(r => `${r.weight} × ${r.reps}`).join(', ');
}

export interface Suggestion {
  text: string;
  ghostWeight: string;
  ghostReps: string;
  icon: 'trend-up' | 'repeat';
}

/** The hint line ("Last time ... Stay at ...") and the ghost values, from nextSets(). */
export function suggestionFrom(next: NextSets, plan: { sets: number; reps: number; repsMax?: number | null } | undefined, unit: string): Suggestion {
  const w = (x: number) => `${+x.toFixed(2)} ${unit}`;
  const working = next.last.filter(s => !s.warmup);
  const oneWeight = working.every(s => s.weight === working[0].weight);
  const last = working[0].weight === 0 && oneWeight
    ? `${working.map(s => s.reps).join(', ')} reps`
    : oneWeight
      ? `${w(working[0].weight)} × ${working.map(s => s.reps).join(', ')}`
      : working.map(s => `${w(s.weight)} × ${s.reps}`).join(', ');

  let advice: string;
  if (next.move === 'reps') {
    advice = `Aim for ${next.reps} reps.`;
  } else if (next.move === 'up') {
    const range = plan?.repsMax && plan.repsMax > plan.reps;
    advice = !plan ? `Try ${w(next.weight)} × ${next.reps}.`
      : range ? `Hit ${plan.sets} × ${plan.repsMax}, try ${w(next.weight)} × ${next.reps}.`
        : `Hit ${plan.sets} × ${plan.reps}, try ${w(next.weight)}.`;
  } else if (next.reason === 'plan' && plan?.repsMax && plan.repsMax > plan.reps) {
    advice = `Stay at ${w(next.weight)} until every set hits ${plan.repsMax}; aim for ${next.reps} today.`;
  } else {
    advice = next.reason === 'plan'
      ? `Stay at ${w(next.weight)} until every set hits ${next.reps}.`
      : `That was RPE 9 or more, so stay at ${w(next.weight)} and aim for ${next.reps}.`;
  }
  return {
    text: `Last time ${last}. ${advice}`,
    ghostWeight: String(+next.weight.toFixed(2)),
    ghostReps: String(next.reps),
    icon: next.move === 'hold' ? 'repeat' : 'trend-up',
  };
}
