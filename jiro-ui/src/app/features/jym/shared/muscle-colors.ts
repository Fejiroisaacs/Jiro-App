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

/** The muscle group's data colour as a CSS value, e.g. `var(--data-5)`. */
export function muscleColor(group: string | null | undefined): string {
  const n = MUSCLE_TOKENS[(group ?? 'other').trim().toLowerCase()] ?? MUSCLE_TOKENS['other'];
  return `var(--data-${n})`;
}
