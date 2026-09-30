/** The player's rows and exercise blocks, built from the server's list, logged sets and this device's draft. */
import type { SessionExercise, SessionSet } from '../../../core/services/jym.service';
import type { DraftRow } from '../shared/session-draft';
import type { NextSets } from '../weight-suggestion';
import { filled, parseDecimal, parseWhole } from '../number-input';

/** One row of an exercise; weight, reps and RPE are the text typed (a comma may be the decimal point). */
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
}

export interface ExerciseBlock {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  sets: SetRow[];
  ghostSets: { weight: number; reps: number }[];
  suggestion: string | null;
  exerciseNote: string;
  /** The plan's target for this exercise, as the workout started with it. */
  plan?: { sets: number; reps: number };
  /** repeat when the advice is to hold the weight, trend-up otherwise. */
  suggestionIcon?: 'trend-up' | 'repeat';
}

export function newRow(setNumber: number, init: Partial<SetRow> = {}): SetRow {
  return {
    setNumber, weight: '', reps: '', rpe: '',
    saved: false, isPR: false, saving: false, id: null,
    ghostWeight: '', ghostReps: '', isWarmup: false,
    ...init,
  };
}

export function emptyBlock(exerciseId: string, exerciseName: string, muscleGroup: string | null, sets: SetRow[]): ExerciseBlock {
  return { exerciseId, exerciseName, muscleGroup, sets, ghostSets: [], suggestion: null, exerciseNote: '' };
}

/** A block for one entry of the list with nothing logged: its planned rows (planned reps as ghosts), else one row. */
export function blockFromEntry(x: SessionExercise): ExerciseBlock {
  const plan = x.target_sets && x.target_reps ? { sets: x.target_sets, reps: x.target_reps } : undefined;
  const rows = plan
    ? Array.from({ length: plan.sets }, (_, i) => newRow(i + 1, { ghostReps: String(plan.reps) }))
    : [newRow(1)];
  return { ...emptyBlock(x.exercise_id, x.exercise_name, x.muscle_group, rows), ...(plan ? { plan } : {}) };
}

/** Logged sets as saved rows, one block per exercise in the order the sets come; `display` shows stored kg. */
export function loggedBlocks(sets: SessionSet[], display: (kg: number) => number): ExerciseBlock[] {
  const byExercise = new Map<string, ExerciseBlock>();
  for (const s of sets) {
    if (!byExercise.has(s.exercise_id)) {
      byExercise.set(s.exercise_id, { ...emptyBlock(s.exercise_id, s.exercise_name, s.muscle_group, []), exerciseNote: s.exercise_note || '' });
    }
    byExercise.get(s.exercise_id)!.sets.push(newRow(s.set_number, {
      weight: String(display(s.weight)),
      weightKg: s.weight,
      reps: String(s.reps_performed),
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
): ExerciseBlock[] {
  const logged = new Map(loggedBlocks(sets, display).map(b => [b.exerciseId, b]));
  // Logged exercises missing from the list (never expected) still show, after it.
  const listed = new Set(exercises.map(x => x.exercise_id));
  const extra = [...logged.values()].filter(b => !listed.has(b.exerciseId));

  const blocks = exercises.map(x => {
    const b = logged.get(x.exercise_id);
    if (!b) return blockFromEntry(x);
    const plan = x.target_sets && x.target_reps ? { sets: x.target_sets, reps: x.target_reps } : undefined;
    if (plan) b.plan = plan;
    const last = b.sets.filter(s => !s.isWarmup).at(-1);
    for (let n = b.sets.length + 1; plan && n <= plan.sets; n++) {
      b.sets.push(newRow(n, { ghostWeight: last?.weight ?? '', ghostReps: String(plan.reps) }));
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
      ghostReps: !d.isWarmup && b.plan ? String(b.plan.reps) : '',
    }))].sort((x, y) => x.setNumber - y.setNumber);
  }
  return [...blocks, ...extra];
}

/** RPE is a whole number from 1 to 10. */
export function rpeInvalid(rpe: string): boolean {
  const v = parseWhole(rpe);
  return v === null || v < 1 || v > 10;
}

/** ✓ is ready when weight and reps each read as numbers, typed (0 included) or ghosted. */
export function canLog(row: SetRow): boolean {
  const weight = parseDecimal(filled(row.weight) ? row.weight : row.ghostWeight);
  const reps = parseWhole(filled(row.reps) ? row.reps : row.ghostReps);
  return !row.saving && weight !== null && reps !== null && reps >= 1
    && !(filled(row.rpe) && rpeInvalid(row.rpe));
}

/** The ✓'s accessible name: what one tap logs. */
export function logLabel(row: SetRow, unit: string): string {
  const weight = filled(row.weight) ? row.weight : row.ghostWeight;
  const reps = filled(row.reps) ? row.reps : row.ghostReps;
  return filled(weight) && filled(reps)
    ? `Log set ${row.setNumber}: ${weight} ${unit} × ${reps}`
    : `Log set ${row.setNumber}`;
}

/** A logged working set below the plan's reps. */
export function isShort(block: ExerciseBlock, row: SetRow): boolean {
  return !!block.plan && row.saved && !row.isWarmup && (parseWhole(row.reps) ?? 0) < block.plan.reps;
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
export function suggestionFrom(next: NextSets, plan: { sets: number; reps: number } | undefined, unit: string): Suggestion {
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
    advice = plan ? `Hit ${plan.sets} × ${plan.reps}, try ${w(next.weight)}.` : `Try ${w(next.weight)} × ${next.reps}.`;
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
