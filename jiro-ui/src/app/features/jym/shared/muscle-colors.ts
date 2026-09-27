// One stable data token per muscle group, shared by every Jym view that colours them.
const MUSCLE_TOKENS: Record<string, number> = {
  chest: 1,
  legs: 2,
  quadriceps: 2,
  shoulders: 3,
  glutes: 4,
  back: 5,
  triceps: 6,
  hamstrings: 7,
  cardio: 8,
  biceps: 9,
  arms: 9,
  forearms: 9,
  other: 10,
  core: 11,
  abs: 11,
  calves: 12,
};

const DATA = [
  'var(--data-1)', 'var(--data-2)', 'var(--data-3)', 'var(--data-4)', 'var(--data-5)', 'var(--data-6)',
  'var(--data-7)', 'var(--data-8)', 'var(--data-9)', 'var(--data-10)', 'var(--data-11)', 'var(--data-12)',
];

/** The muscle group's data colour as a CSS value, e.g. `var(--data-5)`. */
export function muscleColor(group: string | null | undefined): string {
  const n = MUSCLE_TOKENS[(group ?? 'other').trim().toLowerCase()] ?? MUSCLE_TOKENS['other'];
  return DATA[n - 1];
}
