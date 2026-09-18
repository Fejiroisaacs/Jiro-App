/**
 * The deload rule.
 *
 * Training has gone flat when volume is drifting down and nothing is getting
 * stronger. This file holds that judgement as one pure function so it can be
 * read, reasoned about and tested on its own, rather than living inside a
 * component's template logic.
 *
 * It returns the numbers it saw, never a sentence — the caller composes its own
 * wording (and applies the user's weight unit) from the result.
 */

/** How many qualifying sessions the rule looks at. */
export const DELOAD_WINDOW = 4;

/**
 * The smallest drop worth calling a decline, as a percentage.
 *
 * Volume swings by a few per cent between sessions for reasons that have
 * nothing to do with stalling: a missed rep, a warm-up logged one week and not
 * the next, a session cut short. Without a floor here the rule fires on that
 * noise, and a suggestion that appears after every slightly lighter week is
 * one the user learns to dismiss without reading.
 */
export const DELOAD_MIN_DROP_PERCENT = 5;

/**
 * The fields of `SessionSummary` the rule actually reads. Narrowed on purpose:
 * `SessionSummary` is assignable to this, so callers pass their sessions
 * straight in, and tests can build a case from five plain fields.
 */
export interface DeloadRuleSession {
  /** 'normal' | 'deload' | 'test' — only 'normal' sessions are evidence. */
  session_type: string;
  started_at: string;
  /** null while a session is still in progress. */
  ended_at: string | null;
  /** Sum of weight x reps, in kg, as the API stores it. */
  total_volume: number;
  /** Sets flagged as a personal record in that session. */
  pr_count: number;
}

/**
 * What the rule saw. Numbers only, so the card can phrase it however it likes
 * and a test can assert on the arithmetic.
 */
export interface DeloadSuggestion {
  /** Qualifying sessions compared — always DELOAD_WINDOW. */
  sessionCount: number;
  /** Mean total volume (kg) of the older half of the window. */
  olderMeanVolume: number;
  /** Mean total volume (kg) of the newer half. */
  newerMeanVolume: number;
  /** How far the newer half fell below the older, as a percentage (1 dp). */
  dropPercent: number;
}

/**
 * Returns the numbers behind a deload suggestion, or null when training does
 * not look flat.
 *
 * Both conditions must hold across the last DELOAD_WINDOW completed normal
 * sessions: volume is down by at least DELOAD_MIN_DROP_PERCENT, and not one of
 * them produced a PR.
 */
export function suggestDeload(sessions: readonly DeloadRuleSession[]): DeloadSuggestion | null {
  // Deload and test sessions are excluded. A deliberately light week is not
  // evidence of stalling — its volume is down and its PR count is zero by
  // design — so counting it would make the suggestion self-perpetuating:
  // every deload taken would argue for the next one.
  const window = sessions
    .filter(s => s.session_type === 'normal' && s.ended_at !== null)
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
    .slice(0, DELOAD_WINDOW);

  // Someone three sessions in is not stalling, they are starting.
  if (window.length < DELOAD_WINDOW) return null;

  // A single PR anywhere in the window means something is still progressing.
  if (window.some(s => s.pr_count > 0)) return null;

  // window is newest-first, so the first half is the newer half.
  const half = DELOAD_WINDOW / 2;
  const newerMeanVolume = mean(window.slice(0, half).map(s => s.total_volume));
  const olderMeanVolume = mean(window.slice(half).map(s => s.total_volume));

  // Compare half against half rather than first against last, so one heavy
  // outlier at either end of the window cannot decide the answer on its own.
  // A zero older mean leaves nothing to fall from and no base for a
  // percentage, so there is no trend to report.
  if (!Number.isFinite(olderMeanVolume) || !Number.isFinite(newerMeanVolume)) return null;
  if (olderMeanVolume <= 0 || newerMeanVolume >= olderMeanVolume) return null;

  const dropPercent = ((olderMeanVolume - newerMeanVolume) / olderMeanVolume) * 100;

  // A decline has to be big enough to mean something. See DELOAD_MIN_DROP_PERCENT.
  if (dropPercent < DELOAD_MIN_DROP_PERCENT) return null;

  return {
    sessionCount: DELOAD_WINDOW,
    olderMeanVolume,
    newerMeanVolume,
    dropPercent: Math.round(dropPercent * 10) / 10,
  };
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}
