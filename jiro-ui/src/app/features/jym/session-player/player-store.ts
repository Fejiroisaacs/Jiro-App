import { Injectable, WritableSignal, computed, effect, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import {
  JymService,
  CreateSetRequest,
  UpdateSetRequest,
  SetHistory,
  SessionAttachment,
  SessionExercise,
  SessionSet,
  SessionWithSets,
} from '../../../core/services/jym.service';
import { UploadService } from '../../../core/services/upload.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { JiroMenuItem } from '../../../shared/components/jiro-menu/jiro-menu';
import { nextSets } from '../weight-suggestion';
import { filled, parseDecimal, parseWhole } from '../number-input';
import { platesFor, warmupRamp } from '../plates';
import { DRAFT_VERSION, SessionDraft, clearDraft, readDraft, writeDraft } from '../shared/session-draft';
import {
  ExerciseBlock, SetRow, Suggestion, blockFromEntry, buildBlocks, canLog as canLogRow, convertDistanceText, isShort, lastTimeFrom,
  logLabel as logLabelText, loggedColumns, newRow, rampSummary, restOf, rowValues, rpeInvalid, suggestionFrom, workingWeight,
} from './player-blocks';
import { ExerciseKind, distanceUnit, durationText, kindOf, parseDistance, parseDuration, toDistanceUnit } from '../exercise-kind';
import { RestTimer } from './rest-timer';
import { ScreenWakeLock } from '../../../core/utils/wake-lock';
import { readLocal, writeLocal } from '../../../core/storage';
import { groupLabels, linkedWithNext, membersOf, normalizeGroups, roundStep, segments, toggleLink } from '../supersets';
import { PickerExercise } from './exercise-picker';

/**
 * One open workout's exercises and everything that changes or saves them: logging, editing and removing sets,
 * the device draft, "last time" suggestions, the rest timer and form checks. Provided by the player, one per workout.
 */
@Injectable()
export class PlayerStore {
  private readonly jymService = inject(JymService);
  private readonly uploadService = inject(UploadService);
  readonly settingsService = inject(SettingsService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);

  /** What the player does when the server says the workout was already finished. */
  onEnded: () => void = () => {};

  removingBlock = signal<number | null>(null);
  /** The row a superset round points to next ("exerciseId-setNumber"), highlighted briefly. */
  readonly nextUp = signal<string | null>(null);
  private nextUpTimer: ReturnType<typeof setTimeout> | null = null;
  /** Each block's superset group, its label (A1, A2) and the runs to draw. */
  readonly groups = computed(() => this.blocks().map(b => b.group ?? null));
  readonly labels = computed(() => groupLabels(this.groups()));
  readonly segments = computed(() => segments(this.groups()));

  blocks = signal<ExerciseBlock[]>([]);
  /** Collapsed exercises by id, so removing one never shifts which are closed. */
  private collapsedBlocks = signal<Set<string>>(new Set());
  /** The set whose sheet (warm-up, remove) is open. */
  readonly setSheet = signal<{ exerciseId: string; setNumber: number } | null>(null);
  readonly setSheetRow = computed(() => {
    const ref = this.setSheet();
    const bi = ref ? this.blocks().findIndex(b => b.exerciseId === ref.exerciseId) : -1;
    const block = this.blocks()[bi];
    const si = block ? block.sets.findIndex(r => r.setNumber === ref!.setNumber) : -1;
    if (!block || si < 0) return null;
    const row = block.sets[si];
    const values = filled(row.weight) && filled(row.reps) ? `, ${row.weight} ${this.settingsService.unitLabel()} × ${row.reps}` : '';
    return { bi, si, row, summary: `${block.exerciseName}${values}${row.saved ? ', logged' : ', not logged yet'}` };
  });
  readonly filled = filled;
  readonly isShort = isShort;
  /** Distances follow the weight unit: km for kg, miles for lbs. */
  readonly dUnit = computed(() => distanceUnit(this.settingsService.weightUnit()));

  /** ✓ is ready when the row reads for its exercise's kind. */
  canLog(row: SetRow, kind: ExerciseKind = 'weight_reps'): boolean {
    return canLogRow(row, kind);
  }
  readonly rpeInvalid = rpeInvalid;
  readonly rampSummary = rampSummary;
  // The account's bar and plate sizes for the unit in use (warm-up ramps); the sheet opens at platesWeight.
  readonly currentPlates = computed(() => platesFor(this.settingsService.weightUnit(), this.settingsService.plates()));
  readonly platesOpen = signal(false);
  readonly platesWeight = signal('');
  // Warm-up ramps keyed by exercise and inputs, so change detection doesn't redo the plate maths.
  private readonly rampCache = new Map<string, { key: string; ramp: { weight: number; reps: number }[] | null }>();
  // Rest timer: this rest (rest-timer.ts); restSetting is how long every rest starts at.
  readonly rest = new RestTimer();
  private readonly restChoice = signal<number | null>(null);
  readonly restSetting = computed(() => this.restChoice() ?? this.settingsService.restSeconds());
  /** The exercise whose rest is running, and whether it runs at your usual length; a change to that restarts it. */
  private restAfter: string | null = null;
  private restIsUsual = true;
  /** The exercise whose Rest sheet is open. */
  readonly restSheet = signal<string | null>(null);
  readonly restSheetBlock = computed(() => this.blocks().find(b => b.exerciseId === this.restSheet()) ?? null);
  // Keep the screen on during the workout: a per-device choice, as it costs this phone's battery.
  readonly keepAwake = signal(readLocal(KEEP_AWAKE_KEY) === '1');
  private readonly wakeLock = new ScreenWakeLock();

  sessionId = '';
  /** Fixing a finished workout (route data `fix`): no clock, rest, draft or Finish; sets are fixed in. */
  fix = false;
  /** When the workout started (the player's clock, and "last time" is before it). */
  startedAt = new Date();
  // Form check upload state (keyed by exerciseId)
  private formCheckUploading = signal<Map<string, boolean>>(new Map());
  private formCheckProgressMap = signal<Map<string, number>>(new Map());
  formCheckError = signal<Map<string, string>>(new Map());
  private formCheckFiles = new Map<string, File>();
  blockAttachments = signal<Map<string, SessionAttachment[]>>(new Map());

  // History behind each exercise's suggestion, kept to rebuild it in another unit.
  private readonly historyByExercise = new Map<string, SetHistory[]>();
  private lastUnit: string | null = null;
  // The bar's kg/lbs toggle changes the unit mid-workout: convert the rows, never reread their numbers.
  private readonly convertOnUnitChange = effect(() => {
    const unit = this.settingsService.weightUnit();
    if (this.lastUnit && unit !== this.lastUnit) this.convertWorkout(this.lastUnit, unit);
    this.lastUnit = unit;
  });

  draftReady = false;
  private orderSave: Promise<unknown> = Promise.resolve();
  private closed = false;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  // Structural changes (added, removed, logged) reach the draft; typing goes through saveDraftSoon().
  private readonly draftOnChange = effect(() => {
    this.blocks();
    if (this.draftReady) this.saveDraft();
  });

  // ── Rest timer ──────────────────────────────────────────────────
  /** Undefined seconds is your usual length. */
  private startRestTimer(seconds: number | undefined, after: string | null) {
    this.restAfter = after;
    this.restIsUsual = seconds === undefined;
    this.rest.start(seconds ?? this.restSetting());
  }

  /** Every rest's length, remembered on the account; applied at once, reverted if the save fails. */
  setRestDefault(seconds: number) {
    if (seconds === this.restSetting()) return;
    this.restChoice.set(seconds);
    if (this.rest.active() && !this.rest.done() && this.restIsUsual) this.startRestTimer(undefined, this.restAfter);
    this.authService.updateSettings({ rest_seconds: seconds }).subscribe({
      next: () => this.restChoice.set(null),
      error: () => {
        this.restChoice.set(null);
        this.toast.error('Could not save the rest timer.');
      },
    });
  }

  /** The exercise's own rest, saved on it; null goes back to your usual. Shown at once, reverted if the save fails. */
  setExerciseRest(exerciseId: string, seconds: number | null) {
    const before = this.blocks().find(b => b.exerciseId === exerciseId);
    if (!before || (before.ownRest ?? null) === seconds) return;
    const prev = before.ownRest ?? null;
    const apply = (rest: number | null) =>
      this.blocks.update(bs => bs.map(b => b.exerciseId === exerciseId ? { ...b, ownRest: rest } : b));
    apply(seconds);
    // A rest running after this exercise (or its superset) restarts at the new length.
    const bi = this.blocks().findIndex(b => b.exerciseId === exerciseId);
    const after = this.restAfter ? this.blocks().findIndex(b => b.exerciseId === this.restAfter) : -1;
    if (this.rest.active() && !this.rest.done() && after >= 0 && membersOf(this.groups(), after).includes(bi)) {
      this.startRestTimer(this.restFor(after, false), this.restAfter);
    }
    this.jymService.setExerciseRest(exerciseId, seconds).subscribe({
      error: () => {
        apply(prev);
        this.toast.error('Could not save the rest for this exercise.');
      },
    });
  }

  /** Keeps the screen on while the workout is open, on this device. */
  setKeepAwake(on: boolean) {
    this.keepAwake.set(on);
    writeLocal(KEEP_AWAKE_KEY, on ? '1' : '0');
    this.applyWakeLock();
  }

  /** Holds the wake lock while it's on and the workout is live; the player calls it on open and close. */
  applyWakeLock(open = !this.closed) {
    if (open && this.keepAwake() && !this.fix) this.wakeLock.hold(); else this.wakeLock.release();
  }

  /** A new row's ghosts: the last logged working set, else the suggestion the other rows carry; never a warm-up. */
  addSet(blockIndex: number) {
    const block = this.blocks()[blockIndex];
    const working = block.sets.filter(s => !s.isWarmup);
    const lastLogged = working.filter(s => s.saved).at(-1);
    const suggested = working.filter(s => !s.saved).at(-1);
    const row = newRow(block.sets.length + 1, {
      ghostWeight: lastLogged?.weight ?? suggested?.ghostWeight ?? '',
      ghostReps: lastLogged?.reps ?? suggested?.ghostReps ?? '',
    });
    this.blocks.update(bs => bs.map((b, i) => i === blockIndex ? { ...b, sets: [...b.sets, row] } : b));
  }

  logSet(blockIndex: number, setIndex: number) {
    this.persistRow(blockIndex, setIndex, true);
  }

  /** Saves one typed row; resolves false when it didn't save. */
  persistRow(blockIndex: number, setIndex: number, startRest: boolean): Promise<boolean> {
    const block = this.blocks()[blockIndex];
    const row = block?.sets[setIndex];
    if (!row || !this.canLog(row, block.kind)) return Promise.resolve(false);
    // Typed values win, a typed 0 included; otherwise the ghosts the row shows.
    const kind = block.kind;
    const v = rowValues(row, kind)!;
    const timed = kind === 'duration' || kind === 'distance';
    const weight = kind === 'distance' || v.first !== 0 || filled(row.weight) || filled(row.ghostWeight) ? String(v.first) : '';
    const reps = timed ? durationText(v.second) : String(v.second);

    // Warm up audio NOW, synchronously while the tap gesture is still active.
    // Safari blocks AudioContext creation/resume in async callbacks (e.g. HTTP responses).
    this.rest.warmUpAudio();

    this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
      ...b,
      sets: b.sets.map((s, si) => si === setIndex ? { ...s, weight, reps, saving: true } : s),
    } : b));

    const req: CreateSetRequest = {
      exercise_id: block.exerciseId,
      set_number: row.setNumber,
      weight: kind === 'distance' ? 0 : this.settingsService.toKg(v.first),
      ...(timed ? { duration_s: v.second } : { reps_performed: v.second }),
      ...(kind === 'distance' ? { distance_m: parseDistance(String(v.first), this.dUnit())! } : {}),
      rpe: parseWhole(row.rpe) ?? undefined,
      is_warmup: row.isWarmup,
      exercise_note: block.exerciseNote || undefined,
      ...(this.fix ? { fix: true } : {}),
    };

    return new Promise<boolean>(resolve => {
      this.jymService.logSet(this.sessionId, req).subscribe({
        next: saved => {
          this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
            ...b,
            sets: b.sets.map((s, si) => si === setIndex ? {
              ...s, saving: false, saved: true, isPR: saved.is_pr, id: saved.id, weightKg: saved.weight,
              distanceM: saved.distance_m, durationS: saved.duration_s, prKind: saved.pr_kind,
            } : s),
          } : b));
          if (startRest && !this.fix) this.afterLogged(blockIndex, row.isWarmup);
          resolve(true);
        },
        error: err => {
          if (this.handleEnded(err)) { resolve(false); return; }
          this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
            ...b,
            sets: b.sets.map((s, si) => si === setIndex ? { ...s, saving: false } : s),
          } : b));
          this.toast.error('Could not save that set. Check your connection and try again.');
          resolve(false);
        },
      });
    });
  }

  private deleteSet(blockIndex: number, setIndex: number) {
    const row = this.blocks()[blockIndex].sets[setIndex];
    if (!row.id) return;
    const exerciseId = this.blocks()[blockIndex].exerciseId;
    this.jymService.deleteSet(row.id).subscribe({
      next: () => {
        this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
          ...b,
          sets: b.sets
            .filter((_, si) => si !== setIndex)
            .map((s, i) => ({ ...s, setNumber: i + 1 })),
        } : b));
        // If this exercise now has no saved sets, remove any stale form check attachment.
        if (this.savedCount(blockIndex) === 0) {
          this.deleteStaleFormChecks(exerciseId);
        }
        this.refreshPrBadges();
      },
      error: () => this.toast.error('Could not remove the set.'),
    });
  }

  /** The exercise's menu: move it up or down one place, superset it with the next one (or unlink), or remove it. */
  blockActions(bi: number): JiroMenuItem[] {
    const last = this.blocks().length - 1;
    const link = linkedWithNext(this.groups(), bi) ? [UNLINK_NEXT] : bi < last ? [LINK_NEXT] : [];
    const rest = this.fix ? [] : [REST];
    return [...(bi > 0 ? [MOVE_UP] : []), ...(bi < last ? [MOVE_DOWN] : []), ...link, ...rest, REMOVE];
  }

  onBlockAction(bi: number, action: string) {
    if (action === 'up') this.moveBlock(bi, -1);
    else if (action === 'down') this.moveBlock(bi, 1);
    else if (action === 'link') this.applyLayout(this.blocks(), toggleLink(this.groups(), bi));
    else if (action === 'rest') this.restSheet.set(this.blocks()[bi]?.exerciseId ?? null);
    else if (action === 'remove') this.removeBlock(bi);
  }

  /** Moves an exercise one place; moved out of its superset, it leaves it. */
  private moveBlock(bi: number, step: -1 | 1) {
    const bs = [...this.blocks()];
    const to = bi + step;
    if (to < 0 || to >= bs.length) return;
    [bs[bi], bs[to]] = [bs[to], bs[bi]];
    this.applyLayout(bs, normalizeGroups(bs.map(b => b.group ?? null)));
  }

  /** Shows the order and supersets at once, then saves them; saves run one at a time, and a failure brings the server's back. */
  private applyLayout(blocks: ExerciseBlock[], groups: (number | null)[]) {
    const bs = blocks.map((b, i) => (b.group ?? null) === groups[i] ? b : { ...b, group: groups[i] });
    this.blocks.set(bs);
    const order = bs.map(b => b.exerciseId);
    this.orderSave = this.orderSave.then(() => firstValueFrom(this.jymService.reorderSessionExercises(this.sessionId, order, groups)).catch(() => {
      this.toast.error('Could not save the new order.');
      this.jymService.getSession(this.sessionId).subscribe(s => {
        const list = s.exercises ?? [];
        const pos = new Map(list.map((x, i) => [x.exercise_id, i]));
        const grp = new Map(list.map(x => [x.exercise_id, x.superset_group ?? null]));
        this.blocks.update(cur => [...cur]
          .sort((a, b) => (pos.get(a.exerciseId) ?? cur.length) - (pos.get(b.exerciseId) ?? cur.length))
          .map(b => ({ ...b, group: grp.get(b.exerciseId) ?? null })));
      });
    }));
  }

  /**
   * After a set is logged: outside a superset (or for a warm-up), rest as planned. In one, a working set
   * leads to the next member with sets to do, without rest; after the round, rest for the group's longest
   * planned rest, then back to the first member.
   */
  private afterLogged(bi: number, warmup: boolean) {
    const blocks = this.blocks();
    const step = warmup ? { rest: true, next: null } : roundStep(this.groups(), bi, j => blocks[j].sets.some(s => !s.saved && !s.isWarmup));
    if (step.rest) this.startRestTimer(this.restFor(bi, warmup), this.blocks()[bi].exerciseId);
    if (step.next !== null) this.pointTo(step.next);
  }

  /**
   * Seconds to rest after exercise bi: the plan's, else the exercise's own; in a superset the longest of its
   * members'. Undefined is your usual.
   */
  private restFor(bi: number, warmup: boolean): number | undefined {
    const blocks = this.blocks();
    const members = warmup ? [bi] : membersOf(this.groups(), bi);
    const planned = members.map(i => restOf(blocks[i])).filter((r): r is number => r != null);
    return planned.length ? Math.max(...planned) : undefined;
  }

  /** Scrolls to exercise bi's next working row and marks it for a moment. */
  private pointTo(bi: number) {
    const block = this.blocks()[bi];
    const row = block?.sets.find(s => !s.saved && !s.isWarmup);
    if (!row) return;
    const key = `${block.exerciseId}-${row.setNumber}`;
    this.nextUp.set(key);
    if (this.nextUpTimer) clearTimeout(this.nextUpTimer);
    this.nextUpTimer = setTimeout(() => this.nextUp.set(null), 2500);
    if (typeof document === 'undefined') return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    setTimeout(() => document.querySelector(`[data-set="${key}"]`)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }), 0);
  }

  private async removeBlock(blockIndex: number) {
    const block = this.blocks()[blockIndex];
    const ok = await this.confirmService.confirm({
      title: `Remove ${block.exerciseName}?`,
      message: this.savedCount(blockIndex) > 0
        ? `This deletes ${this.savedCount(blockIndex)} logged ${this.savedCount(blockIndex) === 1 ? 'set' : 'sets'} for this exercise. It cannot be undone.`
        : 'It has no logged sets yet.',
      confirmLabel: 'Remove exercise',
      danger: true,
    });
    if (!ok) return;

    this.removingBlock.set(blockIndex);
    this.jymService.deleteSessionExercise(this.sessionId, block.exerciseId).subscribe({
      next: () => {
        this.deleteStaleFormChecks(block.exerciseId);
        this.collapsedBlocks.update(set => { const next = new Set(set); next.delete(block.exerciseId); return next; });
        // A partner left alone is no longer a superset (the server does the same).
        this.blocks.update(bs => {
          const left = bs.filter((_, bi) => bi !== blockIndex);
          const groups = normalizeGroups(left.map(b => b.group ?? null));
          return left.map((b, i) => (b.group ?? null) === groups[i] ? b : { ...b, group: groups[i] });
        });
        this.removingBlock.set(null);
        this.toast.success(`${block.exerciseName} removed`);
      },
      error: () => {
        this.removingBlock.set(null);
        this.toast.error('Could not remove the exercise.');
      },
    });
  }

  private deleteStaleFormChecks(exerciseId: string) {
    const attachments = this.blockAttachments().get(exerciseId);
    if (!attachments || attachments.length === 0) return;
    for (const att of attachments) {
      this.uploadService.deleteSessionAttachment(att.id).subscribe();
    }
    this.blockAttachments.update(m => { const n = new Map(m); n.delete(exerciseId); return n; });
  }

  /** The API refuses writes to a finished session (e.g. finished in another tab). */
  handleEnded(err: unknown): boolean {
    const code = (err as { status?: number; error?: { error?: { code?: string } } })?.error?.error?.code;
    if (code !== 'SESSION_ENDED') return false;
    this.closeDraft();
    this.toast.error('This workout was already finished.');
    this.onEnded();
    return true;
  }

  toggleBlock(bi: number) {
    const id = this.blocks()[bi]?.exerciseId;
    if (!id) return;
    this.collapsedBlocks.update(s => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  isCollapsed(bi: number): boolean {
    const id = this.blocks()[bi]?.exerciseId;
    return !!id && this.collapsedBlocks().has(id);
  }

  openSetSheet(block: ExerciseBlock, row: SetRow) {
    this.setSheet.set({ exerciseId: block.exerciseId, setNumber: row.setNumber });
  }

  toggleWarmupFromSheet() {
    const ref = this.setSheetRow();
    this.setSheet.set(null);
    if (ref) this.toggleWarmup(ref.bi, ref.si);
  }

  /** A logged set is deleted on the server; an unlogged row just goes. Either way the rows renumber by position. */
  removeSetFromSheet() {
    const ref = this.setSheetRow();
    this.setSheet.set(null);
    if (!ref) return;
    const exerciseId = this.blocks()[ref.bi].exerciseId;
    if (ref.row.saved) {
      this.deleteSet(ref.bi, ref.si);
    } else {
      this.blocks.update(bs => bs.map((b, bi) => bi !== ref.bi ? b : {
        ...b,
        sets: b.sets.filter((_, si) => si !== ref.si).map((s, i) => ({ ...s, setNumber: i + 1 })),
      }));
    }
    // The set's own button is gone, so focus lands on the exercise's Add set.
    setTimeout(() => document.getElementById('add-set-' + exerciseId)?.focus({ preventScroll: true }));
  }

  /** Warm-up sets to offer: before anything is logged or marked warm-up, and only above the bar. */
  warmupRampFor(block: ExerciseBlock): { weight: number; reps: number }[] | null {
    if (block.sets.some(s => s.saved || s.isWarmup)) return null;
    const work = workingWeight(block);
    if (work === null) return null;
    const set = this.currentPlates();
    const key = `${work}|${set.bar}|${set.sizes.join(',')}`;
    const cached = this.rampCache.get(block.exerciseId);
    if (cached?.key === key) return cached.ramp;
    const ramp = warmupRamp(work, set);
    const value = ramp.length ? ramp : null;
    this.rampCache.set(block.exerciseId, { key, ramp: value });
    return value;
  }

  /** Inserts the ramp as typed warm-up rows above the working rows; each then logs with one tap. */
  addWarmups(bi: number, ramp: { weight: number; reps: number }[]) {
    this.blocks.update(bs => bs.map((b, i) => i !== bi ? b : {
      ...b,
      sets: [
        ...ramp.map(r => newRow(0, { weight: String(r.weight), reps: String(r.reps), isWarmup: true })),
        ...b.sets,
      ].map((s, n) => ({ ...s, setNumber: n + 1 })),
    }));
  }

  openPlates(block: ExerciseBlock) {
    const weight = workingWeight(block);
    this.platesWeight.set(weight === null ? '' : String(weight));
    this.platesOpen.set(true);
  }

  /**
   * Enter on a phone keypad: a logged row opens for editing; in an edit, weight moves to reps and
   * reps or RPE save; on a new row it just closes the keyboard (the check logs).
   */
  onEnter(event: Event, bi: number, si: number, field: 'weight' | 'reps' | 'rpe') {
    const row = this.blocks()[bi]?.sets[si];
    if (!row) return;
    if (row.saved && !row.editing) {
      this.editRow(event, bi, si);
      return;
    }
    event.preventDefault();
    const input = event.target as HTMLInputElement;
    if (field === 'weight') {
      input.parentElement?.querySelector<HTMLInputElement>('.reps-input')?.focus();
    } else if (row.editing) {
      this.saveEdit(bi, si);
    } else {
      input.blur();
    }
  }

  savedCount(bi: number): number {
    return this.blocks()[bi]?.sets.filter(s => s.saved).length ?? 0;
  }

  allSaved(bi: number): boolean {
    const sets = this.blocks()[bi]?.sets;
    return !!sets?.length && sets.every(s => s.saved);
  }

  private toggleWarmup(bi: number, si: number) {
    const row = this.blocks()[bi]?.sets[si];
    if (!row) return;
    const newVal = !row.isWarmup;
    this.blocks.update(bs => bs.map((b, i) => i !== bi ? b : {
      ...b,
      sets: b.sets.map((s, j) => j !== si ? s : { ...s, isWarmup: newVal }),
    }));
    if (row.id) {
      const id = row.id;
      this.jymService.updateSet(id, { is_warmup: newVal }).subscribe({
        next: () => this.refreshPrBadges(),
        error: () => {
          this.blocks.update(bs => bs.map((b, i) => i !== bi ? b : {
            ...b,
            sets: b.sets.map(s => s.id !== id ? s : { ...s, isWarmup: !newVal }),
          }));
          this.toast.error('Could not change the warm-up.');
        },
      });
    }
  }

  saveExerciseNote(bi: number) {
    const block = this.blocks()[bi];
    if (!block) return;
    const note = (block.exerciseNote || '').trim();
    const savedIds = block.sets.filter(s => s.saved && s.id).map(s => s.id!);
    let warned = false;
    for (const id of savedIds) {
      this.jymService.updateSet(id, { exercise_note: note }).subscribe({
        error: () => {
          if (warned) return;
          warned = true;
          this.toast.error('Could not save the exercise note.');
        },
      });
    }
  }

  /** The server keeps the workout's list; a plan exercise added back comes back with its plan. */
  pickExercise(ex: PickerExercise) {
    if (this.blocks().some(b => b.exerciseId === ex.id)) return;
    this.jymService.addSessionExercise(this.sessionId, ex.id).subscribe({
      next: entry => {
        if (this.blocks().some(b => b.exerciseId === entry.exercise_id)) return;
        const block = blockFromEntry(entry, this.dUnit());
        this.blocks.update(bs => [...bs, block]);
        this.loadSuggestionsForBlocks([block]);
      },
      error: () => this.toast.error(`Could not add ${ex.name}. Try again.`),
    });
  }

  /** Deleting a set, a warm-up or a type change can move a PR to another set: re-read the flags. */
  refreshPrBadges() {
    this.jymService.getSession(this.sessionId).subscribe({
      next: s => {
        const pr = new Map(s.sets.map(x => [x.id, x]));
        this.blocks.update(bs => bs.map(b => ({
          ...b,
          sets: b.sets.map(r => (r.id && pr.has(r.id) ? { ...r, isPR: pr.get(r.id)!.is_pr, prKind: pr.get(r.id)!.pr_kind } : r)),
        })));
      },
    });
  }

  // ── Plan and draft ──────────────────────────────────────────────

  /**
   * The workout's blocks: the server's list and logged sets, plus this device's unlogged rows.
   * A v2 draft's added and removed exercises are sent to the server first, once.
   */
  async restoreBlocks(session: SessionWithSets): Promise<ExerciseBlock[]> {
    const draft = this.fix ? null : readDraft(this.sessionId);
    let exercises = session.exercises ?? [];
    if (draft && (draft.added?.length || draft.removed?.length)) {
      exercises = await this.upgradeDraft(draft, exercises, session.sets ?? []);
    }
    // v1 drafts (typed rows only) are from long before; their rows are not restored.
    const unit = this.settingsService.weightUnit();
    const kinds = new Map(exercises.map(x => [x.exercise_id, kindOf(x.exercise_kind)]));
    const rows: SessionDraft['rows'] = {};
    if (draft && (draft.v ?? 1) >= 2) {
      for (const [id, list] of Object.entries(draft.rows)) {
        rows[id] = list.map(d => draft.unit && draft.unit !== unit ? {
          ...d,
          weight: kinds.get(id) === 'distance' ? convertDistanceText(d.weight, draft.unit, unit) : this.convertText(d.weight, draft.unit, unit),
        } : d);
      }
    }
    const blocks = buildBlocks(exercises, session.sets ?? [], rows, kg => this.settingsService.toDisplay(kg), this.dUnit());
    this.loadSuggestionsForBlocks(blocks);
    return blocks;
  }

  /** A draft from before the list lived on the server: its removed plan exercises and added ones, sent once. */
  private async upgradeDraft(draft: SessionDraft, list: SessionExercise[], sets: SessionSet[]): Promise<SessionExercise[]> {
    const logged = new Set(sets.map(x => x.exercise_id));
    let next = list;
    for (const id of draft.removed ?? []) {
      if (logged.has(id) || !next.some(x => x.exercise_id === id)) continue;
      await firstValueFrom(this.jymService.deleteSessionExercise(this.sessionId, id));
      next = next.filter(x => x.exercise_id !== id);
    }
    for (const a of draft.added ?? []) {
      if (next.some(x => x.exercise_id === a.exerciseId)) continue;
      next = [...next, await firstValueFrom(this.jymService.addSessionExercise(this.sessionId, a.exerciseId))];
    }
    return next;
  }

  /** Rows with a weight and reps typed but not ticked; a typed 0 counts. */
  unloggedRows(): { bi: number; si: number }[] {
    const rows: { bi: number; si: number }[] = [];
    this.blocks().forEach((b, bi) => b.sets.forEach((s, si) => {
      const typed = filled(s.reps) && (filled(s.weight) || b.kind === 'bodyweight' || b.kind === 'duration');
      if (!s.saved && typed && this.canLog(s, b.kind)) rows.push({ bi, si });
    }));
    return rows;
  }

  /** Keeps what the server doesn't have for this workout, on this device: every unlogged row, empty ones too. */
  saveDraft() {
    if (this.closed || !this.draftReady) return;
    const blocks = this.blocks();
    const rows: SessionDraft['rows'] = {};
    for (const b of blocks) {
      rows[b.exerciseId] = b.sets
        .filter(s => !s.saved)
        .map(s => ({ setNumber: s.setNumber, weight: s.weight, reps: s.reps, rpe: s.rpe, isWarmup: s.isWarmup }));
    }
    writeDraft(this.sessionId, { v: DRAFT_VERSION, unit: this.settingsService.weightUnit(), rows });
  }

  /** Typing saves shortly after the last keystroke. */
  saveDraftSoon() {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null;
      this.saveDraft();
    }, 300);
  }

  flushDraft() {
    if (!this.draftTimer) return;
    clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.saveDraft();
  }

  /** The session is over (finished, discarded or ended elsewhere): drop its draft for good. */
  closeDraft() {
    this.closed = true;
    this.wakeLock.release();
    if (this.draftTimer) clearTimeout(this.draftTimer);
    clearDraft(this.sessionId);
  }

  // ── Form check helpers ──────────────────────────────────────────
  isFormCheckUploading(exerciseId: string): boolean {
    return this.formCheckUploading().get(exerciseId) ?? false;
  }

  getFormCheckProgress(exerciseId: string): number {
    return this.formCheckProgressMap().get(exerciseId) ?? 0;
  }

  private getFormCheckCount(exerciseId: string): number {
    return this.blockAttachments().get(exerciseId)?.length ?? 0;
  }

  getFirstAttachment(exerciseId: string): SessionAttachment | null {
    return this.blockAttachments().get(exerciseId)?.[0] ?? null;
  }

  canUploadFormCheck(bi: number, exerciseId: string): boolean {
    return this.savedCount(bi) > 0 && this.getFormCheckCount(exerciseId) < 1 && !this.isFormCheckUploading(exerciseId);
  }

  formCheckBtnTitle(bi: number, exerciseId: string): string {
    if (this.savedCount(bi) === 0) return 'Log at least one set first';
    if (this.getFormCheckCount(exerciseId) >= 1) return 'One clip per exercise per session';
    return '';
  }

  onFormCheckFileChange(event: Event, blockIndex: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // reset so the same file can be re-selected
    if (file) this.uploadFormCheck(blockIndex, file);
  }

  retryFormCheck(blockIndex: number) {
    const exId = this.blocks()[blockIndex]?.exerciseId;
    const file = exId ? this.formCheckFiles.get(exId) : undefined;
    if (file) this.uploadFormCheck(blockIndex, file);
  }

  private uploadFormCheck(blockIndex: number, file: File) {
    const block = this.blocks()[blockIndex];
    if (!block) return;
    const exId = block.exerciseId;
    this.formCheckFiles.set(exId, file);
    setKey(this.formCheckError, exId);
    setKey(this.formCheckUploading, exId, true);
    setKey(this.formCheckProgressMap, exId, 0);

    this.uploadService.uploadSessionAttachment(
      this.sessionId, file, exId, undefined,
      (pct) => setKey(this.formCheckProgressMap, exId, pct)
    ).subscribe({
      next: attachment => {
        this.blockAttachments.update(m => {
          const n = new Map(m);
          n.set(exId, [...(n.get(exId) ?? []), attachment]);
          return n;
        });
        this.formCheckFiles.delete(exId);
        setKey(this.formCheckUploading, exId, false);
      },
      error: () => {
        setKey(this.formCheckUploading, exId, false);
        setKey(this.formCheckError, exId, 'Form check upload failed.');
      },
    });
  }

  private loadSuggestionsForBlocks(blocks: ExerciseBlock[]) {
    for (const block of blocks) {
      this.jymService.getExercise(block.exerciseId, { limit: SUGGESTION_SETS }).subscribe({
        next: ex => {
          this.historyByExercise.set(block.exerciseId, ex.history);
          this.applySuggestion(block.exerciseId);
        },
      });
    }
  }

  /**
   * Last time and today's aim as the block's hint line. Before the first set of the
   * day the aim is also the ghost on every row; after it, rows keep what was just lifted.
   */
  private applySuggestion(exerciseId: string) {
    const history = this.historyByExercise.get(exerciseId);
    const block = this.blocks().find(b => b.exerciseId === exerciseId);
    if (!history || !block) return;
    const next = this.suggestionFor(block, history);
    if (!next) return;
    const setGhosts = !block.sets.some(s => s.saved);
    this.blocks.update(bs => bs.map(b => b.exerciseId === exerciseId ? {
      ...b,
      suggestion: next.text,
      suggestionIcon: next.icon,
      sets: setGhosts ? b.sets.map(s => !s.saved && !s.isWarmup ? { ...s, ghostWeight: next.ghostWeight, ghostReps: next.ghostReps } : s) : b.sets,
    } : b));
  }

  /** The hint line ("Last time ... Stay at ...") and the ghost values, from nextSets(). */
  private suggestionFor(block: ExerciseBlock, history: SetHistory[]): Suggestion | null {
    const unit = this.settingsService.unitLabel();
    // Bodyweight, holds and distances show last time only; today's aim is a weight × reps feature.
    if (block.kind !== 'weight_reps') {
      return lastTimeFrom(block.kind, history, {
        excludeSessionId: this.sessionId, before: this.startedAt.toISOString(), unit, dUnit: this.dUnit(),
        display: kg => this.settingsService.toDisplay(kg),
      });
    }
    const next = nextSets(history, {
      excludeSessionId: this.sessionId,
      before: this.startedAt.toISOString(),
      plan: block.plan ?? null,
      unit,
      toDisplay: kg => this.settingsService.toDisplay(kg),
    });
    return next ? suggestionFrom(next, block.plan, unit) : null;
  }

  logLabel(row: SetRow, kind: ExerciseKind = 'weight_reps'): string {
    return logLabelText(row, this.settingsService.unitLabel(), kind, this.dUnit());
  }

  /** A typed time reads back formatted when you leave the box: "130" becomes 1:30. */
  formatTime(bi: number, si: number) {
    const row = this.blocks()[bi]?.sets[si];
    const seconds = row ? parseDuration(row.reps) : null;
    if (row && seconds !== null && durationText(seconds) !== row.reps) {
      this.patchRow(bi, si, { reps: durationText(seconds) });
      this.saveDraftSoon();
    }
  }

  /** A tap on a logged value opens its row for editing; unlocking and focusing inside the tap lets a phone open its keyboard. */
  editRow(event: Event, bi: number, si: number) {
    const row = this.blocks()[bi]?.sets[si];
    if (!row?.saved || row.editing || row.saving) return;
    event.preventDefault();
    this.patchRow(bi, si, { editing: true, before: { weight: row.weight, reps: row.reps, rpe: row.rpe } });
    const input = event.target as HTMLInputElement;
    input.readOnly = false;
    input.focus();
  }

  cancelEdit(bi: number, si: number) {
    const row = this.blocks()[bi]?.sets[si];
    if (!row?.editing || row.saving) return;
    this.patchRow(bi, si, { editing: false, ...(row.before ?? {}), before: undefined });
  }

  editValid(row: SetRow, kind: ExerciseKind = 'weight_reps'): boolean {
    return rowValues({ weight: row.weight, reps: row.reps, ghostWeight: '', ghostReps: '' }, kind) !== null
      && !(filled(row.rpe) && this.rpeInvalid(row.rpe));
  }

  /** Saves a corrected set; the API re-rates the exercise, so PR badges are re-read. */
  saveEdit(bi: number, si: number) {
    const block = this.blocks()[bi];
    const row = block?.sets[si];
    if (!row?.id || !row.editing || row.saving || !this.editValid(row, block.kind)) return;
    const kind = block.kind;
    const before = row.before;
    if (before && row.weight === before.weight && row.reps === before.reps && row.rpe === before.rpe) {
      this.patchRow(bi, si, { editing: false, before: undefined });
      return;
    }
    const id = row.id;
    const rpe = parseWhole(row.rpe);
    const v = rowValues({ weight: row.weight, reps: row.reps, ghostWeight: '', ghostReps: '' }, kind)!;
    const req: UpdateSetRequest = {
      ...(kind === 'distance'
        ? { distance_m: parseDistance(String(v.first), this.dUnit())!, duration_s: v.second }
        : { weight: this.settingsService.toKg(v.first), ...(kind === 'duration' ? { duration_s: v.second } : { reps_performed: v.second }) }),
      ...(rpe !== null ? { rpe } : {}),
    };
    this.patchSet(id, { saving: true });
    this.jymService.updateSet(id, req).subscribe({
      next: saved => {
        this.patchSet(id, {
          saving: false, editing: false, before: undefined,
          weightKg: saved.weight, distanceM: saved.distance_m, durationS: saved.duration_s,
          ...loggedColumns(kind, saved, kg => this.settingsService.toDisplay(kg), this.dUnit()),
          rpe: saved.rpe != null ? String(saved.rpe) : '',
        });
        this.refreshPrBadges();
      },
      error: () => {
        this.patchSet(id, { saving: false });
        this.toast.error('Could not save the change.');
      },
    });
  }

  private patchRow(bi: number, si: number, patch: Partial<SetRow>) {
    this.blocks.update(bs => bs.map((b, i) => i !== bi ? b : {
      ...b,
      sets: b.sets.map((r, j) => j !== si ? r : { ...r, ...patch }),
    }));
  }

  /** Patches a logged set by id: rows can move while a request is out. */
  private patchSet(id: string, patch: Partial<SetRow>) {
    this.blocks.update(bs => bs.map(b => ({
      ...b,
      sets: b.sets.map(r => r.id !== id ? r : { ...r, ...patch }),
    })));
  }

  /** A logged working set below the plan's reps. */
  convertText(value: string, from: string, to: string): string {
    const n = parseDecimal(value);
    return n !== null ? String(this.settingsService.convertWeight(n, from, to)) : value;
  }

  /** Logged rows come back from their stored kg; typed rows and ghosts are converted; suggestions are rebuilt. */
  private convertWorkout(from: string, to: string) {
    const dUnit = distanceUnit(to);
    this.blocks.update(bs => bs.map(b => ({
      ...b,
      sets: b.sets.map(s => b.kind === 'distance' ? {
        ...s,
        weight: s.saved && s.distanceM != null ? String(toDistanceUnit(s.distanceM, dUnit)) : convertDistanceText(s.weight, from, to),
        ghostWeight: convertDistanceText(s.ghostWeight, from, to),
      } : {
        ...s,
        weight: s.saved && s.weightKg != null ? String(this.settingsService.toDisplay(s.weightKg)) : this.convertText(s.weight, from, to),
        ghostWeight: this.convertText(s.ghostWeight, from, to),
      }),
    })));
    for (const b of this.blocks()) this.applySuggestion(b.exerciseId);
  }
}

/** Recent sets fetched per exercise for the "last time" suggestion. */
const SUGGESTION_SETS = 60;

const MOVE_UP: JiroMenuItem = { id: 'up', label: 'Move up', icon: 'caret-up' };
const MOVE_DOWN: JiroMenuItem = { id: 'down', label: 'Move down', icon: 'caret-down' };
const REMOVE: JiroMenuItem = { id: 'remove', label: 'Remove exercise', icon: 'trash', danger: true };
const REST: JiroMenuItem = { id: 'rest', label: 'Rest timer', icon: 'timer' };
const KEEP_AWAKE_KEY = 'jiro_jym_keep_awake';
const LINK_NEXT: JiroMenuItem = { id: 'link', label: 'Superset with next', icon: 'link' };
const UNLINK_NEXT: JiroMenuItem = { id: 'link', label: 'Unlink from next', icon: 'link' };

/** Sets (or, with no value, removes) one key of a Map held in a signal. */
function setKey<T>(sig: WritableSignal<Map<string, T>>, key: string, value?: T) {
  sig.update(m => {
    const n = new Map(m);
    if (value === undefined) n.delete(key); else n.set(key, value);
    return n;
  });
}
