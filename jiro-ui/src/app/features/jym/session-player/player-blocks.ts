/** The player's rows and exercise blocks, built from the server's list, logged sets and this device's draft. */
import type { SessionExercise, SessionSet } from '../../../core/services/jym.service';
import type { DraftRow } from '../shared/session-draft';

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
