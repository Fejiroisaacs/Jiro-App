/**
 * The deload rule: training has gone flat when each day's volume is down on the
 * last time that day was trained, and nothing set a record. One pure function, so
 * it can be tested on its own; it returns numbers and the card writes the words.
 */

/** Recent workouts compared, each against the last time its day was trained. */
export const DELOAD_WINDOW = 3;

/** The smallest drop worth calling a decline; a few per cent is everyday noise. */
export const DELOAD_MIN_DROP_PERCENT = 5;

/** The fields of `SessionSummary` the rule reads; `SessionSummary` is assignable to this. */
export interface DeloadRuleSession {
  /** 'normal' | 'deload' | 'test'. */
  session_type: string;
  /** The split day trained; null for a freestyle workout. */
  routine_id: string | null;
  started_at: string;
  /** Null while the workout is still in progress. */
  ended_at: string | null;
  /** Working sets; a notes-only workout has none. */
  set_count: number;
  /** Weight × reps over working sets, in kg. */
  total_volume: number;
  /** Lifts with a new record. */
  pr_count: number;
}

export interface DeloadSuggestion {
  /** Recent workouts compared: always DELOAD_WINDOW. */
  sessionCount: number;
  /** Mean volume (kg) of the earlier workout on each of those days. */
  olderMeanVolume: number;
  /** Mean volume (kg) of the recent workouts. */
  newerMeanVolume: number;
  /** How far the recent mean fell below the earlier one, as a percentage (1 dp). */
  dropPercent: number;
}

/**
 * The numbers behind a deload suggestion, or null when training doesn't look flat.
 *
 * Evidence is finished normal workouts with working sets, started after the latest
 * deload, so a deload in progress or just taken quiets the card until new evidence
 * builds up. The newest DELOAD_WINDOW of them each meet the previous workout of the
 * same split day; a freestyle workout has no like-for-like and gives no answer.
 * A suggestion needs the mean drop to reach DELOAD_MIN_DROP_PERCENT with no record set.
 */
export function suggestDeload(sessions: readonly DeloadRuleSession[]): DeloadSuggestion | null {
  const newestFirst = [...sessions].sort((a, b) => time(b.started_at) - time(a.started_at));
  const lastDeload = newestFirst.findIndex(s => s.session_type === 'deload');
  const sinceDeload = lastDeload === -1 ? newestFirst : newestFirst.slice(0, lastDeload);
  const evidence = sinceDeload.filter(s => s.session_type === 'normal' && s.ended_at !== null && s.set_count > 0);

  const recent = evidence.slice(0, DELOAD_WINDOW);
  if (recent.length < DELOAD_WINDOW) return null;
  if (recent.some(s => s.pr_count > 0)) return null;

  const earlier: DeloadRuleSession[] = [];
  for (const [i, s] of recent.entries()) {
    const previous = s.routine_id ? evidence.slice(i + 1).find(p => p.routine_id === s.routine_id) : undefined;
    if (!previous) return null;
    earlier.push(previous);
  }

  const newerMeanVolume = mean(recent.map(s => s.total_volume));
  const olderMeanVolume = mean(earlier.map(s => s.total_volume));
  if (olderMeanVolume <= 0 || newerMeanVolume >= olderMeanVolume) return null;
  const dropPercent = ((olderMeanVolume - newerMeanVolume) / olderMeanVolume) * 100;
  if (dropPercent < DELOAD_MIN_DROP_PERCENT) return null;

  return {
    sessionCount: DELOAD_WINDOW,
    olderMeanVolume,
    newerMeanVolume,
    dropPercent: Math.round(dropPercent * 10) / 10,
  };
}

function time(iso: string): number {
  return new Date(iso).getTime();
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
