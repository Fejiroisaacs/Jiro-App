/** What only this device knows about an open workout (its unlogged rows), kept in localStorage per workout. */

export interface DraftRow {
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  isWarmup: boolean;
}

/** An exercise a v2 draft added on this device; since v3 the server keeps the list. */
export interface DraftExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
}

export interface SessionDraft {
  /** 3: rows only. 2: `rows` is every unlogged row, plus the list changes below. 1 (absent): typed rows only. */
  v?: number;
  unit?: string;
  /** v2 only: exercises added and plan exercises removed on this device, sent to the server once. */
  added?: DraftExercise[];
  removed?: string[];
  rows: Record<string, DraftRow[]>;
}

export const DRAFT_VERSION = 3;

export function draftKey(sessionId: string): string {
  return `jiro_session_draft_${sessionId}`;
}

export function readDraft(sessionId: string): SessionDraft {
  const empty: SessionDraft = { rows: {} };
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
    if (draft.added?.length || draft.removed?.length || Object.keys(draft.rows).length) {
      localStorage.setItem(draftKey(sessionId), JSON.stringify(draft));
    } else {
      localStorage.removeItem(draftKey(sessionId));
    }
  } catch { /* storage unavailable: the draft is a convenience */ }
}

/** The workout is over (finished, discarded or ended elsewhere): drop its draft for good. */
export function clearDraft(sessionId: string): void {
  try {
    localStorage.removeItem(draftKey(sessionId));
    localStorage.removeItem(`jiro_session_targets_${sessionId}`); // retired key, still on older devices
  } catch { /* storage unavailable */ }
}
