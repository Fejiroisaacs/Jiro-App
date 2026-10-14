// Record kinds (J16), as the API names them, in rank order: a badge names the first a set earned.
export type PrKind = 'weight' | 'e1rm' | 'reps' | 'hold' | 'distance' | 'pace';

const LABEL: Record<PrKind, string> = {
  weight: 'Weight PR', e1rm: 'e1RM PR', reps: 'Rep PR', hold: 'Hold PR', distance: 'Distance PR', pace: 'Pace PR',
};

const WORDS: Record<PrKind, string> = {
  weight: 'heaviest weight', e1rm: 'best estimated 1RM', reps: 'rep max',
  hold: 'longest hold', distance: 'longest distance', pace: 'fastest pace',
};

/** The badge's text: the top kind's name, or plain "PR" when the kind isn't known. */
export function prLabel(kind?: string | null): string {
  return LABEL[kind as PrKind] ?? 'PR';
}

/** The badge's tooltip and accessible name, listing every record the set earned. */
export function prDescription(kinds?: readonly string[] | null): string {
  const words = (kinds ?? []).map(k => WORDS[k as PrKind]).filter(Boolean);
  if (!words.length) return 'Personal record';
  const list = words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} and ${words.at(-1)}`;
  return `Personal record: ${list}`;
}
