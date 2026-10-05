/** The fields of a stats row the charts read; ExerciseStatsWorkout is assignable to this. */
export interface StatsWorkout {
  session_id: string;
  started_at: string;
  session_type: string;
  working_sets: number;
  /** kg */
  max_weight: number;
  /** kg */
  best_e1rm: number;
  /** kg × reps over working sets. */
  volume: number;
  note: string | null;
}

export type StatsRange = '3m' | '1y' | 'all';
export type StatsMeasure = 'e1rm' | 'volume' | 'maxweight';

export interface StatsPoint {
  /** Epoch ms of the workout's start, so the axis spaces workouts by date. */
  x: number;
  /** kg (or kg × reps for volume). */
  y: number;
  sessionId: string;
}

const DAY_MS = 86_400_000;
const RANGE_DAYS: Record<Exclude<StatsRange, 'all'>, number> = { '3m': 91, '1y': 365 };

/** Workouts the charts plot: ones with a working set, outside deloads. */
export function chartedWorkouts<T extends StatsWorkout>(workouts: readonly T[]): T[] {
  return workouts.filter(w => w.working_sets > 0 && w.session_type !== 'deload');
}

/** Workouts that started inside the range, counted back from now. */
export function inRange<T extends StatsWorkout>(workouts: readonly T[], range: StatsRange, now: number): T[] {
  if (range === 'all') return [...workouts];
  const from = now - RANGE_DAYS[range] * DAY_MS;
  return workouts.filter(w => new Date(w.started_at).getTime() >= from);
}

/** 1Y when the charted history goes back more than a year, otherwise All. */
export function defaultRange(workouts: readonly StatsWorkout[], now: number): StatsRange {
  const charted = chartedWorkouts(workouts);
  if (charted.length === 0) return 'all';
  const first = Math.min(...charted.map(w => new Date(w.started_at).getTime()));
  return first < now - RANGE_DAYS['1y'] * DAY_MS ? '1y' : 'all';
}

/** One point per charted workout in the range, oldest first. */
export function statsSeries(workouts: readonly StatsWorkout[], measure: StatsMeasure, range: StatsRange, now: number): StatsPoint[] {
  const pick = (w: StatsWorkout) => measure === 'e1rm' ? w.best_e1rm : measure === 'volume' ? w.volume : w.max_weight;
  return inRange(chartedWorkouts(workouts), range, now)
    .map(w => ({ x: new Date(w.started_at).getTime(), y: pick(w), sessionId: w.session_id }))
    .sort((a, b) => a.x - b.x);
}

/** The most workouts a chart draws: past this the line turns to noise, so it shows the latest. */
export const MAX_CHART_POINTS = 20;

/** The latest `max` of a series in date order, and how many the range held. */
export function latestPoints<T>(points: readonly T[], max = MAX_CHART_POINTS): { shown: T[]; total: number } {
  return { shown: points.slice(-max), total: points.length };
}

/** Workouts with an exercise note, newest first. */
export function notesOf<T extends StatsWorkout>(workouts: readonly T[]): T[] {
  return workouts
    .filter(w => !!w.note?.trim())
    .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_STEPS = [1, 2, 3, 4, 6, 12];

/** Axis ticks on the first of a month, spaced so there are at most `maxTicks`; aligned to January. */
export function monthTicks(min: number, max: number, maxTicks = 6): number[] {
  const start = new Date(min);
  const months = (new Date(max).getFullYear() - start.getFullYear()) * 12 + new Date(max).getMonth() - start.getMonth() + 1;
  const step = MONTH_STEPS.find(s => Math.ceil(months / s) <= maxTicks) ?? Math.ceil(months / maxTicks / 12) * 12;
  const ticks: number[] = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d.getTime() <= max; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    const onStep = step < 12 ? d.getMonth() % step === 0 : d.getMonth() === 0 && d.getFullYear() % (step / 12) === 0;
    if (d.getTime() >= min && onStep) ticks.push(d.getTime());
  }
  return ticks;
}

/** "Oct", or "Jan 2026" at a new year and on the first tick. */
export function monthTickLabel(value: number, first: boolean): string {
  const d = new Date(value);
  return first || d.getMonth() === 0 ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : MONTHS[d.getMonth()];
}
