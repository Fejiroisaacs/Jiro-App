/**
 * Bar and plate maths for the Plates sheet and warm-up sets. Every weight here is in the
 * display unit, so plates are never converted: a gym has kg plates or lb plates.
 */

export interface PlateSet {
  /** The bar's own weight; 0 for a sled or machine with no bar. */
  bar: number;
  /** Sizes on hand, any order; there are always enough of each for both sides. */
  sizes: number[];
}

export type WeightUnit = 'kg' | 'lbs';

export const DEFAULT_PLATES: Record<WeightUnit, PlateSet> = {
  kg: { bar: 20, sizes: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lbs: { bar: 45, sizes: [45, 35, 25, 10, 5, 2.5] },
};

/** The bar and plates in use for a unit: what's stored, else the defaults. */
export function platesFor(unit: string, stored: Partial<Record<WeightUnit, PlateSet>> = {}): PlateSet {
  const u: WeightUnit = unit === 'kg' ? 'kg' : 'lbs';
  return stored[u] ?? DEFAULT_PLATES[u];
}

/** The sizes Settings offers to switch on or off, heaviest first. */
export const COMMON_PLATES: Record<WeightUnit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5],
  lbs: [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25],
};

// Every plate is a whole number of quarters, so the maths runs on integers.
const QUARTERS = 4;
const MAX_QUARTERS = 40_000;
const toQ = (w: number) => Math.round(w * QUARTERS);
const fromQ = (q: number) => q / QUARTERS;
const onGrid = (w: number) => Math.abs(w * QUARTERS - toQ(w)) < 1e-6;

/** For each per-side load up to `limit` quarters, the fewest plates and the heaviest plate that achieves it. */
function reach(sizes: number[], limit: number): { count: number[]; last: number[] } {
  const qs = [...new Set(sizes.filter(s => s > 0 && onGrid(s)).map(toQ))].sort((a, b) => b - a);
  const count = new Array<number>(limit + 1).fill(Infinity);
  const last = new Array<number>(limit + 1).fill(0);
  count[0] = 0;
  for (let x = 1; x <= limit; x++) {
    for (const q of qs) {
      if (q <= x && count[x - q] + 1 < count[x]) {
        count[x] = count[x - q] + 1;
        last[x] = q;
      }
    }
  }
  return { count, last };
}

/** The plates for one side, heaviest first, using as few as possible; [] is the bare bar, null can't be loaded. */
export function platesPerSide(total: number, set: PlateSet): number[] | null {
  const side = (total - set.bar) / 2;
  if (!(side >= 0) || !onGrid(side)) return null;
  const target = toQ(side);
  if (target > MAX_QUARTERS) return null;
  const { count, last } = reach(set.sizes, target);
  if (count[target] === Infinity) return null;
  const plates: number[] = [];
  for (let x = target; x > 0; x -= last[x]) plates.push(fromQ(last[x]));
  return plates.sort((a, b) => b - a);
}

/** The heaviest loadable total at or below `total`, and the lightest at or above it. */
export function nearestLoadable(total: number, set: PlateSet): { below: number | null; above: number | null } {
  if (!(total >= set.bar)) return { below: null, above: set.bar };
  const target = Math.floor(((total - set.bar) / 2) * QUARTERS + 1e-6);
  const biggest = Math.max(0, ...set.sizes.filter(s => s > 0).map(toQ));
  const limit = Math.min(target + biggest, MAX_QUARTERS);
  const { count } = reach(set.sizes, limit);
  const load = (q: number) => +(set.bar + 2 * fromQ(q)).toFixed(2);
  let below: number | null = null;
  for (let x = Math.min(target, limit); x >= 0; x--) if (count[x] < Infinity) { below = load(x); break; }
  let above: number | null = null;
  for (let x = Math.ceil(((total - set.bar) / 2) * QUARTERS - 1e-6); x <= limit; x++) if (count[x] < Infinity) { above = load(x); break; }
  return { below, above };
}

/** Warm-up steps before a working weight: the bar for 10, then about 50%, 70% and 85% for 5, 3 and 1. */
const RAMP = [
  { share: 0, reps: 10 },
  { share: 0.5, reps: 5 },
  { share: 0.7, reps: 3 },
  { share: 0.85, reps: 1 },
];

/** Warm-up sets for a working weight, each rounded down to a weight you can load; none at or below the bar. */
export function warmupRamp(work: number, set: PlateSet): { weight: number; reps: number }[] {
  if (!(work > set.bar)) return [];
  const sets: { weight: number; reps: number }[] = [];
  let previous = 0;
  for (const step of RAMP) {
    const target = step.share === 0 ? set.bar : work * step.share;
    const weight = target <= set.bar ? set.bar : nearestLoadable(target, set).below ?? set.bar;
    // Each step is heavier than the last and lighter than the work; a bare 0 is no warm-up.
    if (weight > previous && weight < work) {
      sets.push({ weight, reps: step.reps });
      previous = weight;
    }
  }
  return sets;
}
