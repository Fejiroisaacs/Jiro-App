/** A workout left open with nothing logged for this long was almost certainly forgotten. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

/** What any open-workout listing carries: when it started and when its last set was logged (server time). */
export interface OpenWorkout {
  started_at: string;
  last_set_at: string | null;
}

/** The workout's last sign of life: its last set, or its start when nothing is logged. */
export function lastActivity(w: OpenWorkout): number {
  return new Date(w.last_set_at ?? w.started_at).getTime();
}

export function isStale(w: OpenWorkout, now: number = Date.now()): boolean {
  return now - lastActivity(w) >= STALE_AFTER_MS;
}
