/** How an exercise's sets are logged (J21): weight × reps, bodyweight ± load, time held, or distance and time. */
export type ExerciseKind = 'weight_reps' | 'bodyweight' | 'duration' | 'distance';

export const EXERCISE_KINDS: { value: ExerciseKind; label: string; help: string }[] = [
  { value: 'weight_reps', label: 'Weight × reps', help: 'Barbell, dumbbell and machine lifts.' },
  { value: 'bodyweight', label: 'Bodyweight', help: 'Pull-ups, dips, push-ups: reps, with any added weight.' },
  { value: 'duration', label: 'Duration', help: 'Planks and holds: time held, with any added weight.' },
  { value: 'distance', label: 'Distance + time', help: 'Runs, rows and rides: distance and time; pace follows.' },
];

/** The kind of a value that may be missing (older data): weight × reps. */
export function kindOf(kind: string | null | undefined): ExerciseKind {
  return kind === 'bodyweight' || kind === 'duration' || kind === 'distance' ? kind : 'weight_reps';
}

/** Logged in reps (weight × reps, bodyweight). */
export function isRepKind(kind: ExerciseKind): boolean {
  return kind === 'weight_reps' || kind === 'bodyweight';
}

/** The short tag a list shows beside the muscles; weight × reps shows none. */
export function kindTag(kind: ExerciseKind): string | null {
  return kind === 'bodyweight' ? 'Bodyweight' : kind === 'duration' ? 'Duration' : kind === 'distance' ? 'Distance' : null;
}

/** A type can change between weight × reps and bodyweight any time; to or from the others only with no sets. */
export function kindChangeAllowed(from: ExerciseKind, to: ExerciseKind, hasSets: boolean): boolean {
  return from === to || !hasSets || (isRepKind(from) && isRepKind(to));
}

// ── Time ──────────────────────────────────────────────────────────────

/** Seconds as m:ss, or h:mm:ss from an hour: 45 is "0:45", 1505 is "25:05", 3725 is "1:02:05". */
export function durationText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * A typed time in seconds. Phone keypads have no colon, so digits fill from the right like a microwave:
 * "45" is 0:45, "130" is 1:30, "2505" is 25:05, "10000" is 1:00:00. With colons ("1:30") the parts are read
 * as written. Null when there's no time in it.
 */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  let h = 0, m = 0, s = 0;
  if (t.includes(':')) {
    const parts = t.split(':').map(p => p.trim());
    if (parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) return null;
    const n = parts.map(Number);
    [h, m, s] = n.length === 3 ? n : [0, ...(n.length === 2 ? n : [0, n[0]])] as [number, number, number];
  } else {
    if (!/^\d+$/.test(t) || t.length > 6) return null;
    const d = t.padStart(6, '0');
    h = Number(d.slice(0, 2));
    m = Number(d.slice(2, 4));
    s = Number(d.slice(4, 6));
  }
  const total = h * 3600 + m * 60 + s;
  return total > 0 ? total : null;
}

// ── Distance ──────────────────────────────────────────────────────────

/** The distance unit that goes with the weight unit: kg accounts log km, lbs accounts miles. */
export function distanceUnit(weightUnit: string): 'km' | 'mi' {
  return weightUnit === 'kg' ? 'km' : 'mi';
}

const METRES_PER_MILE = 1609.344;

/** Metres in the unit, rounded to 0.01. */
export function toDistanceUnit(metres: number, unit: 'km' | 'mi'): number {
  const v = unit === 'km' ? metres / 1000 : metres / METRES_PER_MILE;
  return Math.round(v * 100) / 100;
}

/** A typed distance in the unit, as metres to 0.1; null when it isn't a positive number. */
export function parseDistance(text: string, unit: 'km' | 'mi'): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$/.test(t)) return null;
  const v = Number(t);
  if (!(v > 0)) return null;
  return Math.round((unit === 'km' ? v * 1000 : v * METRES_PER_MILE) * 10) / 10;
}

/** "5 km", "3.1 mi": the unit's value without trailing zeros. */
export function distanceText(metres: number, unit: 'km' | 'mi'): string {
  return `${toDistanceUnit(metres, unit)} ${unit}`;
}

/** Time per km or mile, "5:12 /km"; null without both numbers. */
export function paceText(seconds: number | null | undefined, metres: number | null | undefined, unit: 'km' | 'mi'): string | null {
  if (!seconds || !metres) return null;
  const per = unit === 'km' ? 1000 : METRES_PER_MILE;
  return `${durationText(seconds / (metres / per))} /${unit}`;
}

// ── A set, in words ───────────────────────────────────────────────────

/** The numbers a set reads by; weight is in the display unit, distances in metres. */
export interface KindSet {
  weight: number;
  reps: number;
  duration_s?: number | null;
  distance_m?: number | null;
}

/**
 * One set as a line reads it: "100 kg × 5", "8 × +20 kg" (or "8 reps" unweighted), "0:45" (or "0:45 · +10 kg"),
 * "5 km in 26:00 (5:12 /km)". `unit` is the weight unit.
 */
export function setText(kind: ExerciseKind, set: KindSet, unit: string): string {
  const dUnit = distanceUnit(unit);
  switch (kind) {
    case 'bodyweight':
      return set.weight > 0 ? `${set.reps} × +${set.weight} ${unit}` : `${set.reps} reps`;
    case 'duration': {
      const held = durationText(set.duration_s ?? 0);
      return set.weight > 0 ? `${held} · +${set.weight} ${unit}` : held;
    }
    case 'distance': {
      const pace = paceText(set.duration_s, set.distance_m, dUnit);
      return `${distanceText(set.distance_m ?? 0, dUnit)} in ${durationText(set.duration_s ?? 0)}${pace ? ` (${pace})` : ''}`;
    }
    default:
      return `${set.weight} ${unit} × ${set.reps}`;
  }
}
