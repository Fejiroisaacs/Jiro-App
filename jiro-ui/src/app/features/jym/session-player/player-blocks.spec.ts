// Run with: npm run test:unit
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildBlocks, canLog, isShort, logLabel, newRow, rampSummary, rpeInvalid, suggestionFrom, workingWeight, emptyBlock } from './player-blocks.ts';

const same = (kg: number) => kg;
const entry = (id: string, sets: number | null = null, reps: number | null = null, position = 1) =>
  ({ exercise_id: id, exercise_name: id, muscle_group: null, position, target_sets: sets, target_reps: reps });
const set = (exercise: string, n: number, weight: number, reps: number, extra: Record<string, unknown> = {}) => ({
  id: `${exercise}-${n}`, session_id: 's', exercise_id: exercise, set_number: n, weight, reps_performed: reps,
  rpe: null, is_pr: false, is_warmup: false, exercise_note: null, created_at: '', exercise_name: exercise, muscle_group: null,
  ...extra,
});
const shape = (blocks: ReturnType<typeof buildBlocks>) =>
  blocks.map(b => `${b.exerciseId}[${b.sets.map(s => `${s.setNumber}${s.saved ? 'L' : ''}${s.weight ? '=' + s.weight : ''}${s.ghostWeight || s.ghostReps ? `~${s.ghostWeight}x${s.ghostReps}` : ''}`).join(' ')}]`).join(' ');

test('the list sets the order; plan exercises get their planned rows, others one row', () => {
  const blocks = buildBlocks([entry('curl'), entry('squat', 3, 5)], [], {}, same);
  assert.equal(shape(blocks), 'curl[1] squat[1~x5 2~x5 3~x5]');
  assert.deepEqual(blocks[1].plan, { sets: 3, reps: 5 });
  assert.equal(blocks[0].plan, undefined);
});

test('a logged plan exercise is padded to its planned sets, ghosted from its last working set', () => {
  const sets = [set('squat', 1, 20, 10, { is_warmup: true }), set('squat', 2, 100, 5)];
  assert.equal(shape(buildBlocks([entry('squat', 3, 5)], sets, {}, same)), 'squat[1L=20 2L=100 3~100x5]');
});

test('logged sets show in the display unit and keep their stored kg', () => {
  const [b] = buildBlocks([entry('bench')], [set('bench', 1, 100, 5)], {}, kg => Math.round(kg * 2.20462 * 10) / 10);
  assert.equal(b.sets[0].weight, '220.5');
  assert.equal(b.sets[0].weightKg, 100);
});

test('draft rows replace the padding, and a number now logged elsewhere is dropped', () => {
  const sets = [set('squat', 1, 100, 5)];
  const draft = {
    squat: [
      { setNumber: 1, weight: '999', reps: '1', rpe: '', isWarmup: false },
      { setNumber: 2, weight: '105', reps: '5', rpe: '8', isWarmup: false },
    ],
  };
  const [b] = buildBlocks([entry('squat', 3, 5)], sets, draft, same);
  assert.equal(shape([b]), 'squat[1L=100 2=105~100x5]');
  assert.equal(b.sets[1].rpe, '8');
});

test('an empty draft list means every unlogged row was removed', () => {
  assert.equal(shape(buildBlocks([entry('squat', 3, 5)], [], { squat: [] }, same)), 'squat[]');
});

test('a warm-up draft row gets no ghosts', () => {
  const draft = { squat: [{ setNumber: 1, weight: '45', reps: '10', rpe: '', isWarmup: true }] };
  const [b] = buildBlocks([entry('squat', 3, 5)], [], draft, same);
  assert.equal(b.sets[0].isWarmup, true);
  assert.equal(b.sets[0].ghostReps, '');
});

test('the exercise note comes from the logged sets', () => {
  const [b] = buildBlocks([entry('row')], [set('row', 1, 60, 8, { exercise_note: 'Strict' })], {}, same);
  assert.equal(b.exerciseNote, 'Strict');
});

test('a logged exercise missing from the list still shows, after it', () => {
  assert.equal(shape(buildBlocks([entry('squat')], [set('ghost', 1, 10, 10)], {}, same)), 'squat[1] ghost[1L=10]');
});

test('RPE is a whole number from 1 to 10', () => {
  assert.equal(rpeInvalid('8'), false);
  assert.equal(rpeInvalid('0'), true);
  assert.equal(rpeInvalid('11'), true);
  assert.equal(rpeInvalid('8.5'), true);
});

test('one tap logs typed values, else the ghosts; a typed 0 counts', () => {
  assert.equal(canLog(newRow(1, { ghostWeight: '100', ghostReps: '5' })), true);
  assert.equal(canLog(newRow(1, { weight: '0', reps: '8' })), true);
  assert.equal(canLog(newRow(1, { weight: '100' })), false);
  assert.equal(canLog(newRow(1, { weight: '100', reps: '5', rpe: '12' })), false);
  assert.equal(canLog(newRow(1, { weight: '100', reps: '5', saving: true })), false);
  assert.equal(logLabel(newRow(2, { ghostWeight: '100', reps: '6' }), 'lbs'), 'Log set 2: 100 lbs × 6');
  assert.equal(logLabel(newRow(3), 'kg'), 'Log set 3');
});

test('a logged working set under the plan is short; warm-ups never are', () => {
  const block = { ...emptyBlock('x', 'x', null, []), plan: { sets: 3, reps: 8 } };
  assert.equal(isShort(block, newRow(1, { reps: '7', saved: true })), true);
  assert.equal(isShort(block, newRow(1, { reps: '8', saved: true })), false);
  assert.equal(isShort(block, newRow(1, { reps: '5', saved: true, isWarmup: true })), false);
  assert.equal(isShort(emptyBlock('x', 'x', null, []), newRow(1, { reps: '1', saved: true })), false);
});

test('the working weight is the next working row, typed or ghosted, else the last logged', () => {
  const b = (sets: ReturnType<typeof newRow>[]) => emptyBlock('x', 'x', null, sets);
  assert.equal(workingWeight(b([newRow(1, { weight: '45', isWarmup: true }), newRow(2, { ghostWeight: '135' })])), 135);
  assert.equal(workingWeight(b([newRow(1, { weight: '140' })])), 140);
  assert.equal(workingWeight(b([newRow(1, { weight: '100', saved: true })])), 100);
  assert.equal(workingWeight(b([])), null);
  assert.equal(rampSummary([{ weight: 45, reps: 10 }, { weight: 95, reps: 5 }]), '45 × 10, 95 × 5');
});

test('the suggestion line: up with a plan, hold after a miss, reps for bodyweight', () => {
  const last = [{ weight: 100, reps: 8, warmup: false }, { weight: 100, reps: 8, warmup: false }];
  const up = suggestionFrom({ last, move: 'up', weight: 105, reps: 8, reason: null }, { sets: 2, reps: 8 }, 'lbs');
  assert.equal(up.text, 'Last time 100 lbs × 8, 8. Hit 2 × 8, try 105 lbs.');
  assert.deepEqual([up.ghostWeight, up.ghostReps, up.icon], ['105', '8', 'trend-up']);
  const hold = suggestionFrom({ last: [...last.slice(0, 1), { weight: 100, reps: 6, warmup: false }], move: 'hold', weight: 100, reps: 8, reason: 'plan' }, { sets: 2, reps: 8 }, 'lbs');
  assert.equal(hold.text, 'Last time 100 lbs × 8, 6. Stay at 100 lbs until every set hits 8.');
  assert.equal(hold.icon, 'repeat');
  const bw = suggestionFrom({ last: [{ weight: 0, reps: 10, warmup: false }, { weight: 0, reps: 9, warmup: false }], move: 'reps', weight: 0, reps: 11, reason: null }, undefined, 'kg');
  assert.equal(bw.text, 'Last time 10, 9 reps. Aim for 11 reps.');
});
