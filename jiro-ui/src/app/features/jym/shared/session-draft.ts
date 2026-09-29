/** What only this device knows about an open workout until it's logged, kept in localStorage per workout. */

export interface DraftRow {
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
}

export interface DraftExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
}

export interface SessionDraft {
  /** 2: `rows` lists every unlogged row of an exercise, so its plan padding isn't used. 1 (absent): typed rows only. */
  v?: number;
  unit?: string;
  added: DraftExercise[];
  removed: string[];
  rows: Record<string, DraftRow[]>;
}

export const DRAFT_VERSION = 2;

export function draftKey(sessionId: string): string {
  return `jiro_session_draft_${sessionId}`;
}

export function readDraft(sessionId: string): SessionDraft {
  const empty: SessionDraft = { added: [], removed: [], rows: {} };
  try {
    const raw = localStorage.getItem(draftKey(sessionId));
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

/** Saves the draft, or drops it when there's nothing in it. */
export function writeDraft(sessionId: string, draft: SessionDraft): void {
  try {
    if (draft.added.length || draft.removed.length || Object.keys(draft.rows).length) {
      localStorage.setItem(draftKey(sessionId), JSON.stringify(draft));
    } else {
      localStorage.removeItem(draftKey(sessionId));
    }
  } catch { /* storage unavailable: the draft is a convenience */ }
}

/** A new workout that repeats another: its extra exercises, and the plan exercises it skipped. */
export function seedDraft(sessionId: string, added: DraftExercise[], removed: string[] = []): void {
  writeDraft(sessionId, { v: DRAFT_VERSION, added, removed, rows: {} });
}

/** The workout is over (finished, discarded or ended elsewhere): drop its draft for good. */
export function clearDraft(sessionId: string): void {
  try {
    localStorage.removeItem(draftKey(sessionId));
    localStorage.removeItem(`jiro_session_targets_${sessionId}`); // retired key, still on older devices
  } catch { /* storage unavailable */ }
}
