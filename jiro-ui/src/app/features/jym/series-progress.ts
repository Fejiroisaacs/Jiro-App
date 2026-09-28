/** The fields of a series its progress reads; SplitSeriesSummary is assignable to this. */
export interface SeriesLength {
  duration_type: string;
  target_weeks: number | null;
  target_sessions: number | null;
  started_at: string;
  /** Null while the series runs. */
  ended_at: string | null;
  /** Finished workouts with a working set. */
  session_count: number;
}

export interface SeriesProgress {
  /** 0 to 100. */
  percent: number;
  /** For example "3 / 8 weeks". */
  label: string;
}

const WEEK_MS = 7 * 86_400_000;

/** Weeks from the start to the end, or to now while the series runs; never negative. */
function elapsedWeeks(s: Pick<SeriesLength, 'started_at' | 'ended_at'>, now: number): number {
  const end = s.ended_at ? new Date(s.ended_at).getTime() : now;
  return Math.max(0, (end - new Date(s.started_at).getTime()) / WEEK_MS);
}

/** Whole weeks a series has run: to its end once ended, so an old block doesn't keep counting. */
export function weeksElapsed(s: Pick<SeriesLength, 'started_at' | 'ended_at'>, now = Date.now()): number {
  return Math.floor(elapsedWeeks(s, now));
}

/** Progress towards a series' length; null when it is open-ended or has no target. */
export function seriesProgress(s: SeriesLength, now = Date.now()): SeriesProgress | null {
  if (s.duration_type === 'sessions' && s.target_sessions) {
    return {
      percent: Math.min(100, (s.session_count / s.target_sessions) * 100),
      label: `${s.session_count} / ${s.target_sessions} sessions`,
    };
  }
  if (s.duration_type === 'weeks' && s.target_weeks) {
    const weeks = elapsedWeeks(s, now);
    return {
      percent: Math.min(100, (weeks / s.target_weeks) * 100),
      label: `${Math.floor(weeks)} / ${s.target_weeks} weeks`,
    };
  }
  return null;
}
