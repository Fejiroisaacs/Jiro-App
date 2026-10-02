import { Component, OnInit, OnDestroy, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { JymService, SessionAttachment, SessionSet } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { dayKey, timeInZone, todayKey } from '../../../core/utils/day';
import { formatInstant } from '../../../core/utils/format-date';
import { isStale } from '../stale-workout';
import { parseDecimal } from '../number-input';
import { AuthService } from '../../../core/services/auth.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { PlayerStore } from './player-store';
import { RestRowComponent } from './rest-row';
import { PlatesSheetComponent } from './plates-sheet';
import { OptionsSheetComponent, SetSheetComponent } from './player-sheets';
import { ExercisePickerComponent, PickerExercise } from './exercise-picker';
import { ExerciseBlockComponent } from './exercise-block';
import { SaveTemplateDialogComponent } from '../shared/save-template-dialog';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-session-player',
  providers: [PlayerStore],
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroIconComponent, JiroSkeletonComponent, JiroEmptyStateComponent, SaveTemplateDialogComponent, RestRowComponent, PlatesSheetComponent, OptionsSheetComponent, SetSheetComponent, ExercisePickerComponent, ExerciseBlockComponent],
  template: `
    <h1 class="sr-only">Active session</h1>
    <!-- Sticky bar: the clock, the options, and Finish; everything else waits in the options sheet. -->
    <div class="session-bar">
      <div class="session-bar-row">
        <div class="session-bar-left">
          @if (store.fix) {
            <span class="bar-label bar-label--always">Editing</span>
            <span class="timer timer--date">{{ fixDate() }}</span>
          } @else {
            <span class="bar-label">Active session</span>
            <span class="timer">{{ elapsedDisplay() }}</span>
          }
        </div>
        <div class="session-bar-right">
          <button class="bar-icon-btn" type="button" aria-label="Workout options" title="Workout options" aria-haspopup="dialog" (click)="showOptions.set(true)">
            <jiro-icon name="dots-three" [size]="22" />
          </button>
          @if (store.fix) {
            <jiro-button size="lg" variant="inverse" type="button" (click)="doneFixing()">Done</jiro-button>
          } @else {
            <jiro-button size="lg" variant="inverse" type="button" (click)="finishSession()" [disabled]="finishing()">
              {{ finishing() ? 'Finishing...' : 'Finish' }}
            </jiro-button>
          }
        </div>
      </div>
      <!-- Rest timer row: opens after a logged set -->
      @if (store.rest.active()) {
        <jym-rest-row [timer]="store.rest" />
      }
    </div>

    <!-- A workout left open for hours: finish it where it really ended, or throw away an empty one. -->
    @if (stale(); as st) {
      <div class="stale-banner" role="status">
        <p class="stale-text">
          This workout started {{ st.started }} and wasn't finished.
          {{ st.lastSet ? 'Your last set was at ' + st.lastSet + '.' : 'Nothing was logged.' }}
        </p>
        <div class="stale-actions">
          @if (st.lastSetAt) {
            <jiro-button size="lg" type="button" [loading]="finishing()" (click)="finishAtLastSet(st.lastSetAt)">Finish at {{ st.lastSetTime }}</jiro-button>
          } @else {
            <jiro-button size="lg" variant="danger" type="button" [loading]="discarding()" (click)="discardSession()">Discard it</jiro-button>
          }
          <jiro-button size="lg" variant="secondary" type="button" (click)="stale.set(null)">Keep going</jiro-button>
        </div>
      </div>
    }

    @if (emptySessionError()) {
      <p class="empty-session-error" role="alert">{{ emptySessionError() }}</p>
    }

    <!-- Deload / Test notice -->
    @if (sessionType() === 'deload') {
<div class="type-notice deload-notice">
      Deload session: take it easy and focus on recovery.
    </div>
}
    @if (sessionType() === 'test') {
<div class="type-notice test-notice">
      Test session: work up to a top set and see where your 1RM stands.
    </div>
}

    <!-- Loading -->
    <div class="player-body">
      @if (loading()) {
        <div class="loading-blocks" aria-busy="true" aria-label="Loading session">
          <jiro-skeleton height="56px" />
          <jiro-skeleton height="180px" />
          <jiro-skeleton height="180px" />
        </div>
      }

      <!-- Session notes -->
      @if (!loading()) {
<div class="notes-panel">
        <label class="field-label" for="session-notes">Session notes</label>
        <textarea
          id="session-notes"
          class="notes-input"
          [(ngModel)]="sessionNotes"
          placeholder="Optional"
          rows="2"
          (blur)="saveNotes()">
        </textarea>
      </div>
}

      <!-- Body weight panel (today's, so not when fixing a past workout) -->
      @if (!loading() && !store.fix) {
<div class="bw-panel">
        <label class="bw-label" for="session-bw">Body weight</label>
        @if (!bwLogged()) {
<div class="bw-row">
          <input
            id="session-bw"
            class="bw-input"
            type="text"
            inputmode="decimal"
            enterkeyhint="done"
            autocomplete="off"
            [(ngModel)]="bwValue"
            [placeholder]="settingsService.unitLabel()"
            (keydown.enter)="saveBodyWeight()" />
          <button
            class="bw-save-btn"
            type="button"
            [disabled]="bwSaving() || !bwValid()"
            (click)="saveBodyWeight()">
            {{ bwSaving() ? '...' : 'Log' }}
          </button>
        </div>
}
        @if (bwLogged()) {
<span class="bw-logged"><jiro-icon name="check" [size]="14" /> {{ bwValue }} {{ settingsService.unitLabel() }} logged</span>
}
      </div>
}

      <!-- Session body -->
      @if (!loading()) {
<div class="exercises">
        <!-- Empty state -->
        @if (store.blocks().length === 0) {
          <jiro-empty-state compact icon="barbell" heading="No exercises yet" message="Add your first lift to start logging sets.">
            <jiro-button size="sm" type="button" (click)="addExercise()">Add exercise</jiro-button>
          </jiro-empty-state>
        }

        <!-- Exercise blocks -->
        @for (seg of store.segments(); track store.blocks()[seg.indices[0]].exerciseId) {
          @if (seg.group !== null) {
            <section class="ss-group" [attr.aria-label]="supersetTitle(seg)">
              <div class="ss-head">
                <span class="ss-title">{{ supersetTitle(seg) }}</span>
                <span class="ss-hint">No rest between these; rest after the round.</span>
              </div>
              @for (bi of seg.indices; track store.blocks()[bi].exerciseId) {
                <jym-exercise-block [block]="store.blocks()[bi]" [bi]="bi" />
              }
            </section>
          } @else {
            <jym-exercise-block [block]="store.blocks()[seg.indices[0]]" [bi]="seg.indices[0]" />
          }
        }

        <!-- Add exercise -->
        <button class="add-exercise-btn" (click)="addExercise()">+ Add exercise</button>
      </div>
}
    </div>

    <!-- Workout options: type, units, rest, and leaving -->
    @if (showOptions()) {
      <jym-options-sheet
        [sessionType]="sessionType()" [restSetting]="store.restSetting()" [fix]="store.fix" [discarding]="discarding()"
        (type)="setSessionType($event)" (unit)="toggleUnit($event)" (rest)="store.setRestDefault($event)"
        (saveTemplate)="showOptions.set(false); showTemplateSave.set(true)"
        (leave)="exitSession()" (discard)="discardSession()" (close)="showOptions.set(false)" />
    }

    @if (showTemplateSave()) {
      <jym-save-template-dialog [sessionId]="store.sessionId" (close)="showTemplateSave.set(false)" />
    }

    <!-- One set: warm-up or working, and remove -->
    @if (store.setSheetRow(); as ref) {
      <jym-set-sheet [setNumber]="ref.row.setNumber" [summary]="ref.summary" [isWarmup]="ref.row.isWarmup"
        (toggleWarmup)="store.toggleWarmupFromSheet()" (remove)="store.removeSetFromSheet()" (close)="store.setSheet.set(null)" />
    }

    <!-- Plates for one side of the bar, from the account's bar and plates -->
    @if (store.platesOpen()) {
      <jym-plates-sheet [weight]="store.platesWeight()" (close)="store.platesOpen.set(false)" />
    }


    <!-- Exercise picker -->
    @if (showExPicker()) {
      <jym-exercise-picker [exercises]="allExercises()" (created)="allExercises.update(list => [...list, $event])"
        (picked)="showExPicker.set(false); store.pickExercise($event)" (close)="showExPicker.set(false)" />
    }
  `,
  styles: [`
    :host { display: block; }

    /* Sticky bar */

    .session-bar {
      position: sticky; top: var(--topbar-height, 0px); z-index: var(--z-sticky);
      background: var(--color-primary); color: var(--text-on-primary);
      box-shadow: 0 2px 12px rgba(var(--shadow-rgb), 0.25);
      margin: calc(-1 * var(--space-xl));
      margin-bottom: var(--space-xl);
    }

    .session-bar-row {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-md);
      padding: var(--space-sm) var(--space-xl);
    }

    .session-bar-left { display: flex; align-items: center; gap: var(--space-md); min-width: 0; }

    .bar-label { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 1px; opacity: 0.9; }

    .timer--date { font-size: var(--font-size-lg); }

    .timer { font-size: var(--font-size-xl); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }

    .session-bar-right { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

    /* On the coloured bar: the icon takes the bar's text colour, as the ghost button does. */

    .bar-icon-btn {
      display: inline-flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: var(--border-radius);
      border: 1px solid color-mix(in srgb, currentColor 40%, transparent); background: none;
      color: inherit; cursor: pointer; transition: background 0.15s, border-color 0.15s;
    }

    .bar-icon-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); border-color: color-mix(in srgb, currentColor 75%, transparent); }

    .type-notice {
      text-align: center; font-size: var(--font-size-sm); font-weight: 500;
      padding: var(--space-xs) var(--space-md); margin-bottom: var(--space-md);
      border-radius: var(--border-radius);
    }

    .deload-notice { background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger); border: 1px solid rgba(var(--color-danger-rgb), 0.2); }

    .test-notice { background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); border: 1px solid rgba(var(--color-primary-rgb), 0.2); }

    /* Body; the bottom clears the phone's home indicator now the nav bar is gone. */

    .player-body { max-width: 700px; overflow-x: hidden; padding-bottom: calc(var(--space-xl) + env(safe-area-inset-bottom)); }

    .stale-banner {
      max-width: 700px; margin-bottom: var(--space-md); padding: var(--space-md);
      background: rgba(var(--color-warning-rgb), 0.08); border: 1px solid rgba(var(--color-warning-rgb), 0.35);
      border-radius: var(--border-radius);
    }

    .stale-text { font-size: var(--font-size-sm); line-height: 1.5; margin-bottom: var(--space-sm); }

    .stale-actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); }

    .empty-session-error {
      max-width: 700px; margin-bottom: var(--space-md); padding: var(--space-sm) var(--space-md);
      font-size: var(--font-size-sm); color: var(--color-negative);
      background: rgba(var(--color-danger-rgb), 0.08); border: 1px solid rgba(var(--color-danger-rgb), 0.25);
      border-radius: var(--border-radius);
    }

    .notes-panel { margin-bottom: var(--space-md); }

    .field-label {
      display: block;
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-secondary);
      margin-bottom: var(--space-xs);
    }

    .notes-input {
      width: 100%; box-sizing: border-box;
      padding: var(--space-sm) var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-sm); font-family: inherit;
      resize: vertical; line-height: 1.5;
      transition: border-color 0.15s;
    }

    .notes-input:focus { border-color: var(--color-primary); }

    .notes-input::placeholder { color: var(--text-muted); }

    /* Body weight panel */

    .bw-panel {
      display: flex; align-items: center; gap: var(--space-md);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-sm) var(--space-md);
      margin-bottom: var(--space-lg);
    }

    .bw-label {
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-secondary); white-space: nowrap;
    }

    .bw-row { display: flex; align-items: center; gap: var(--space-xs); }

    .bw-input {
      width: 96px; min-height: 44px; padding: 6px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas); color: var(--text-primary);
      font-size: var(--font-size-sm); font-family: inherit;
    }

    .bw-input:focus { border-color: var(--color-primary); }

    .bw-save-btn {
      min-height: 44px; min-width: 64px; padding: 6px 14px; background: var(--color-primary); color: var(--text-on-primary); font-family: inherit;
      border: none; border-radius: var(--border-radius);
      font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
      transition: opacity 0.15s;
    }

    .bw-save-btn:hover:not(:disabled) { opacity: 0.85; }

    .bw-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .bw-logged {
      display: inline-flex; align-items: center; gap: 4px;
      font-size: var(--font-size-sm); color: var(--color-accent); font-weight: 500;
    }

    .loading-blocks { display: flex; flex-direction: column; gap: var(--space-xl); }

    .exercises { display: flex; flex-direction: column; gap: var(--space-xl); }

    /* Exercise block */

    /* drawn on the whole header above */

    /* Exercise note */

    /* Set table: set number, weight, reps, RPE, log. Every target is 44 px. */

    /* A logged working set below the plan's reps */

    /* The set number is the handle for warm-up and remove. */

    /* Editing a logged set: its own Cancel and Save under the row. */

    /* Warm-up prompt: shown above the rows until a set is logged. */

    .ss-group {
      display: flex; flex-direction: column; gap: var(--space-sm);
      border: 2px solid rgba(var(--color-primary-rgb), 0.35); border-radius: var(--border-radius);
      padding: var(--space-sm); background: rgba(var(--color-primary-rgb), 0.04);
    }

    .ss-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px var(--space-sm); padding: 0 var(--space-xs); }

    .ss-title { font-weight: 700; color: var(--color-primary); }

    .ss-hint { font-size: var(--font-size-xs); color: var(--text-secondary); }

    .add-exercise-btn {
      width: 100%; padding: var(--space-md);
      background: none; border: 2px dashed var(--border-color);
      border-radius: var(--border-radius); color: var(--text-muted);
      font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
      transition: all 0.15s; font-family: inherit; margin-top: var(--space-sm);
    }

    .add-exercise-btn:hover { color: var(--color-primary); border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.04); }

    /* ── Mobile responsive ── */

    @media (max-width: 768px) {
      .session-bar {
        margin: calc(-1 * var(--space-md));
        margin-bottom: var(--space-md);
      }
      /* One row on a phone too: the clock on the left, options and Finish on the right. */
      .session-bar-row { padding: var(--space-xs) var(--space-md); }
      .bar-label:not(.bar-label--always) { display: none; }
      .timer { font-size: var(--font-size-lg); }
    }

    /* ── Set table on very small screens ── */

    /* ── Body weight panel on mobile ── */

    @media (max-width: 480px) {
      .bw-panel { flex-wrap: wrap; }
      .bw-label { flex: 0 0 100%; }
    }


    .fc-count {
      font-size: var(--font-size-xs); color: var(--text-secondary); white-space: nowrap;
    }

  `]
})
export class SessionPlayerComponent implements OnInit, OnDestroy {
  /** "Superset A", or "Circuit A" for three or more. */
  supersetTitle(seg: { group: number | null; indices: number[] }): string {
    return `${seg.indices.length >= 3 ? 'Circuit' : 'Superset'} ${String.fromCharCode(64 + (seg.group ?? 1))}`;
  }

  /** This workout's exercises, sets, draft, rest timer and form checks. */
  readonly store = inject(PlayerStore);
  loading = signal(true);
  finishing = signal(false);
  emptySessionError = signal<string | null>(null);
  showExPicker = signal(false);
  showOptions = signal(false);
  discarding = signal(false);
  showTemplateSave = signal(false);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  bwSaving = signal(false);
  bwLogged = signal(false);
  bwValue = '';
  private bwUnit: string | null = null;
  // The unit can change mid-workout: a typed body weight is converted like the rows (the store converts those).
  private readonly convertBodyWeight = effect(() => {
    const unit = this.settingsService.weightUnit();
    if (this.bwUnit && unit !== this.bwUnit) this.bwValue = this.store.convertText(this.bwValue, this.bwUnit, unit);
    this.bwUnit = unit;
  });
  elapsedDisplay = signal('0:00');
  sessionType = signal<string>('normal');

  /** Set when the workout was opened after hours with nothing logged; "Keep going" clears it. */
  readonly stale = signal<{ started: string; lastSet: string | null; lastSetTime: string; lastSetAt: string | null } | null>(null);

  /** The library, for the exercise picker. */
  allExercises = signal<PickerExercise[]>([]);
  sessionNotes = '';

  readonly fixDate = signal('');
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Re-sync both timers when the user returns from a locked screen; save the draft when leaving.
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.store.rest.tick();
      this.updateElapsed();
    } else {
      this.store.flushDraft();
    }
  };

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    private router: Router,
    public settingsService: SettingsService,
    private authService: AuthService,
  ) { }

  ngOnInit() {
    this.store.onEnded = () => this.openSummary();
    this.store.sessionId = this.route.snapshot.paramMap.get('id') || '';
    this.store.fix = this.route.snapshot.data['fix'] === true;
    if (!this.store.fix) {
      this.startTimer();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    // Load all exercises for the picker
    this.jymService.listExercises().subscribe(exs => {
      this.allExercises.set(exs);
    });

    // Load session + sets (restores mid-workout state on page refresh)
    this.jymService.getSession(this.store.sessionId).subscribe({
      next: session => {
        if (session.ended_at && !this.store.fix) {
          this.store.closeDraft();
          this.openSummary();
          return;
        }
        // Only a finished workout is fixed; an open one is simply resumed.
        if (this.store.fix && !session.ended_at) {
          this.router.navigate(['/jym/session', this.store.sessionId], { replaceUrl: true });
          return;
        }
        if (this.store.fix) {
          const tz = this.settingsService.timezone();
          this.fixDate.set(`${formatInstant(session.started_at, tz, { weekday: true })}, ${timeInZone(session.started_at, tz)}`);
        }
        this.store.startedAt = new Date(session.started_at);
        if (!this.store.fix) this.noteIfStale(session.started_at, session.sets ?? []);
        this.sessionType.set(session.session_type || 'normal');
        this.sessionNotes = session.notes || '';

        // Populate form check counts from existing attachments
        const amap = new Map<string, SessionAttachment[]>();
        for (const a of session.attachments ?? []) {
          if (a.exercise_id) {
            const arr = amap.get(a.exercise_id) ?? [];
            arr.push(a);
            amap.set(a.exercise_id, arr);
          }
        }
        this.store.blockAttachments.set(amap);

        this.store.restoreBlocks(session).then(
          blocks => {
            this.store.blocks.set(blocks);
            // A fix is saved set by set; only a live workout keeps a device draft.
            this.store.draftReady = !this.store.fix;
            this.loading.set(false);
          },
          () => {
            // The old draft is left as it was, so the next load tries again.
            this.toast.error("Could not load this workout's exercises. Reload to try again.");
            this.loading.set(false);
          },
        );
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    this.store.flushDraft();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.store.rest.clear();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  private startTimer() {
    this.timerInterval = setInterval(() => this.updateElapsed(), 1000);
  }

  private updateElapsed() {
    const elapsed = Math.max(0, Math.floor((Date.now() - this.store.startedAt.getTime()) / 1000));
    // Past a day the seconds are noise: "2d 3h".
    if (elapsed >= 86_400) {
      this.elapsedDisplay.set(`${Math.floor(elapsed / 86_400)}d ${Math.floor((elapsed % 86_400) / 3600)}h`);
      return;
    }
    const h = Math.floor(elapsed / 3600);
    const m = Math.floor((elapsed % 3600) / 60);
    const s = elapsed % 60;
    this.elapsedDisplay.set(h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`
    );
  }

  setSessionType(type: string) {
    const previous = this.sessionType();
    this.sessionType.set(type);
    this.jymService.updateSession(this.store.sessionId, { session_type: type }).subscribe({
      // Deload sets never count, so the type can move PR badges.
      next: () => this.store.refreshPrBadges(),
      error: err => {
        if (this.store.handleEnded(err)) return;
        this.sessionType.set(previous);
        this.toast.error('Could not change the session type.');
      },
    });
  }

  toggleUnit(unit: string) {
    if (unit === this.settingsService.weightUnit()) return;
    this.authService.updateSettings({ weight_unit: unit }).subscribe({
      error: () => this.toast.error('Could not change the unit.'),
    });
  }

  /** Leaves the workout open: logged sets are on the server, typed ones in this device's draft. */
  exitSession() {
    this.showOptions.set(false);
    this.router.navigate(['/jym']);
  }

  async discardSession() {
    const logged = this.store.blocks().reduce((n, b) => n + b.sets.filter(s => s.saved).length, 0);
    this.showOptions.set(false);
    const ok = await this.confirmService.confirm({
      title: 'Discard this workout?',
      message: logged > 0
        ? `This deletes the ${logged} ${logged === 1 ? 'set' : 'sets'} you logged. It can't be undone.`
        : 'Nothing is logged yet.',
      confirmLabel: 'Discard workout',
      danger: true,
    });
    if (!ok) return;
    this.discarding.set(true);
    this.jymService.deleteSession(this.store.sessionId).subscribe({
      next: () => {
        this.store.closeDraft();
        this.router.navigate(['/jym']);
      },
      error: () => {
        this.discarding.set(false);
        this.toast.error('Could not discard the workout.');
      },
    });
  }

  saveNotes() {
    this.jymService.updateSession(this.store.sessionId, { notes: this.sessionNotes }).subscribe({
      error: err => { if (!this.store.handleEnded(err)) this.toast.error('Could not save the session notes.'); },
    });
  }

  /** Typed rows that weren't ticked: log them, skip them, or stay. Resolves false to stay. */
  private async settleTypedRows(action: string): Promise<boolean> {
    const pending = this.store.unloggedRows();
    if (pending.length === 0) return true;
    const n = pending.length;
    const choice = await this.confirmService.choose({
      title: n === 1 ? 'Log the unlogged set?' : `Log ${n} unlogged sets?`,
      message: n === 1
        ? `You typed a set but did not tick it. Log it before you ${action}?`
        : `You typed ${n} sets but did not tick them. Log them before you ${action}?`,
      confirmLabel: `Log and ${action}`,
      altLabel: n === 1 ? 'Skip it' : 'Skip them',
      cancelLabel: 'Go back',
      danger: false,
    });
    if (choice === 'cancel') return false;
    if (choice === 'confirm') {
      for (const { bi, si } of pending) {
        // A failed save keeps the user here, with the row still typed.
        if (!(await this.store.persistRow(bi, si, false))) return false;
      }
    }
    return true;
  }

  /** Done fixing: back to the summary in place of this page, keeping where the summary returns to. */
  async doneFixing() {
    if (!(await this.settleTypedRows('finish'))) return;
    const back = (history.state as { back?: unknown } | null)?.back;
    this.router.navigate(['/jym/sessions', this.store.sessionId, 'summary'], {
      replaceUrl: true,
      state: typeof back === 'string' ? { back } : {},
    });
  }

  async finishSession() {
    if (!(await this.settleTypedRows('finish'))) return;

    const hasSavedSets = this.store.blocks().some(b => b.sets.some(s => s.saved));
    if (!hasSavedSets && !this.sessionNotes.trim()) {
      this.emptySessionError.set('Nothing to save. Log at least one set or add session notes first.');
      return;
    }
    this.emptySessionError.set(null);
    this.finishing.set(true);
    this.jymService.updateSession(this.store.sessionId, {
      ended_at: new Date().toISOString(),
      notes: this.sessionNotes,
    }).subscribe({
      next: () => {
        this.store.closeDraft();
        // Replaced, so Back from the summary skips the finished player.
        this.router.navigate(['/jym/sessions', this.store.sessionId, 'summary'], { replaceUrl: true, state: { from: 'finish' } });
      },
      error: err => {
        this.finishing.set(false);
        if (!this.store.handleEnded(err)) this.toast.error('Could not finish the workout. Check your connection and try again.');
      },
    });
  }

  /** A forgotten workout (nothing logged for hours) gets the banner; the times are the server's. */
  private noteIfStale(startedAt: string, sets: SessionSet[]) {
    const lastSetAt = sets.reduce<string | null>((m, s) => !m || Date.parse(s.created_at) > Date.parse(m) ? s.created_at : m, null);
    if (!isStale({ started_at: startedAt, last_set_at: lastSetAt })) return;
    const tz = this.settingsService.timezone();
    const at = (iso: string) => `${formatInstant(iso, tz, { weekday: true })}, ${timeInZone(iso, tz)}`;
    const sameDay = !!lastSetAt && dayKey(lastSetAt, tz) === dayKey(startedAt, tz);
    this.stale.set({
      started: at(startedAt),
      lastSet: lastSetAt ? (sameDay ? timeInZone(lastSetAt, tz) : at(lastSetAt)) : null,
      lastSetTime: lastSetAt ? timeInZone(lastSetAt, tz) : '',
      lastSetAt,
    });
  }

  /** Ends a forgotten workout at its last logged set, so its duration is the training, not the days after. */
  finishAtLastSet(endedAt: string) {
    if (this.finishing()) return;
    this.finishing.set(true);
    this.jymService.updateSession(this.store.sessionId, { ended_at: endedAt, notes: this.sessionNotes }).subscribe({
      next: () => {
        this.store.closeDraft();
        this.router.navigate(['/jym/sessions', this.store.sessionId, 'summary'], { replaceUrl: true, state: { from: 'finish' } });
      },
      error: err => {
        this.finishing.set(false);
        if (!this.store.handleEnded(err)) this.toast.error('Could not finish the workout. Try again.');
      },
    });
  }

  /** A finished workout opens as its summary, never as a live workout. */
  private openSummary() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.router.navigate(['/jym/sessions', this.store.sessionId, 'summary'], { replaceUrl: true });
  }

  bwValid(): boolean {
    const v = parseDecimal(this.bwValue);
    return v !== null && v > 0;
  }

  saveBodyWeight() {
    if (!this.bwValid() || this.bwSaving()) return;
    this.bwSaving.set(true);
    const today = todayKey(this.settingsService.timezone());
    this.jymService.logBodyWeight({ recorded_at: today, weight_kg: this.settingsService.toKg(parseDecimal(this.bwValue)!) }).subscribe({
      next: () => { this.bwLogged.set(true); this.bwSaving.set(false); },
      error: () => {
        this.bwSaving.set(false);
        this.toast.error('Could not log your body weight.');
      },
    });
  }

  addExercise() {
    this.showExPicker.set(true);
  }

}
