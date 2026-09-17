/**
 * Writing prompts for the journal editor.
 *
 * One prompt per calendar day, picked deterministically so the question does
 * not change while someone is looking at it. Questions are specific and
 * answerable in a sentence or two: no horoscopes, no therapy-speak.
 */
export const WRITING_PROMPTS: readonly string[] = [
  'What did you notice today that you would have missed a year ago?',
  'Who made your day easier?',
  'What are you avoiding, and why?',
  'What is the smallest thing that went right today?',
  'What did you change your mind about this week?',
  'Which part of today would you happily live again?',
  'Who do you owe a reply to?',
  'What did you say today that you wish you had phrased better?',
  'What took far longer today than you expected?',
  'Which conversation from today do you keep replaying?',
  'What did someone teach you today without meaning to?',
  'What is taking up space in your head that does not deserve it?',
  'What have you been putting off until you feel ready?',
  'What went better than you feared?',
  'Who did you think about today without getting in touch?',
  'What was the best thing you ate today?',
  'What did you get wrong this week?',
  'Which small comfort got you through today?',
  'What are you pretending not to know?',
  'What did today take out of you?',
  'What are you better at than you were six months ago?',
  'What made you impatient today?',
  'What did you decide not to do today?',
  'Where did your time actually go today?',
  'What would make tomorrow easier than today was?',
  'Describe where you are sitting as a stranger walking in would see it.',
  'What did you do today that nobody else saw?',
  'Who has helped you lately that you have never thanked properly?',
  'What do you want to remember about this week in ten years?',
  'What would you tell yourself this morning, knowing how the day turned out?',
];

/** Milliseconds in a day, used to turn a calendar date into a day number. */
const MS_PER_DAY = 86_400_000;

/**
 * The number of whole days between the epoch and the given LOCAL calendar date.
 *
 * Local rather than UTC on purpose. The prompt belongs to the day the writer is
 * living in, so it must turn over at their midnight, not at midnight UTC.
 * Reading `getUTCDate()` in, say, BST or anywhere west of Greenwich hands back a
 * different date for part of the evening or morning, which would swap the prompt
 * out from under someone who is still writing about the same day. Feeding the
 * local year/month/date fields into `Date.UTC` sidesteps that: the offset is
 * dropped entirely and only the calendar date survives, so every moment of one
 * local day yields the same number.
 */
function localDayNumber(date: Date): number {
  const utcMidnight = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utcMidnight / MS_PER_DAY);
}

/**
 * Today's local date as `YYYY-MM-DD`.
 *
 * Local for the same reason as `localDayNumber`: it is the writer's calendar day,
 * so `toISOString()` (which is UTC) would be wrong either side of midnight.
 */
export function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * The prompt for the local calendar day `date` falls in.
 *
 * Deterministic: the same day always returns the same prompt, so reopening the
 * editor never reshuffles the question. `offset` steps forward through the list
 * and wraps, which is what the shuffle control uses.
 */
export function promptForDay(date: Date, offset = 0): string {
  const total = WRITING_PROMPTS.length;
  const day = localDayNumber(date);
  const index = Number.isFinite(day) ? day + offset : offset;
  // Double modulo so a negative day number or offset still lands in range.
  return WRITING_PROMPTS[((index % total) + total) % total];
}
