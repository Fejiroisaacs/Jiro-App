import { Component, computed, inject, input, output } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { restText } from '../plan-text';

const REST_PRESETS = [60, 90, 120, 180, 300];

/** 60 is "1m", 90 is "1:30". */
function restLabel(seconds: number): string {
  return seconds % 60 ? restText(seconds) : `${seconds / 60}m`;
}


const SESSION_TYPES = [
  { value: 'normal', label: 'Normal' },
  { value: 'deload', label: 'Deload' },
  { value: 'test', label: 'Test' },
];
const TYPE_HELP: Record<string, string> = {
  deload: "A lighter workout. It doesn't set records or change next time's suggestion.",
  test: "A max attempt. Records count, but next time's suggestion ignores it.",
};

/** Workout options: type, units, rest, the screen, and leaving; fixing a finished workout keeps only type, units and Save as template. */
@Component({
  selector: 'jym-options-sheet',
  standalone: true,
  imports: [JiroModalComponent, JiroIconComponent],
  template: `
    <jiro-modal sheet title="Workout options" maxWidth="440px" (close)="close.emit()">
      <div class="opt-group" role="group" aria-labelledby="opt-type-label">
        <span class="opt-label" id="opt-type-label">Type</span>
        <div class="seg">
          @for (t of sessionTypes; track t.value) {
            <button type="button" class="seg-btn" [class.active]="sessionType() === t.value" [attr.aria-pressed]="sessionType() === t.value" (click)="type.emit(t.value)">{{ t.label }}</button>
          }
        </div>
        <p class="opt-help">{{ typeHelp() }}</p>
      </div>

      <div class="opt-group" role="group" aria-labelledby="opt-unit-label">
        <span class="opt-label" id="opt-unit-label">Units</span>
        <div class="seg">
          @for (u of units; track u) {
            <button type="button" class="seg-btn" [class.active]="settings.weightUnit() === u" [attr.aria-pressed]="settings.weightUnit() === u" (click)="unit.emit(u)">{{ u }}</button>
          }
        </div>
        <p class="opt-help">Your account's unit, the same one as in Settings.</p>
      </div>

      @if (!fix()) {
      <div class="opt-group" role="group" aria-labelledby="opt-rest-label">
        <span class="opt-label" id="opt-rest-label">Rest timer</span>
        <div class="seg">
          @for (d of restPresets; track d) {
            <button type="button" class="seg-btn" [class.active]="restSetting() === d" [attr.aria-pressed]="restSetting() === d" (click)="rest.emit(d)">{{ restLabel(d) }}</button>
          }
        </div>
        <p class="opt-help">Starts after each logged set, unless the plan or the exercise's menu sets its own. Remembered for next time.</p>
      </div>

      <div class="opt-group" role="group" aria-labelledby="opt-awake-label">
        <span class="opt-label" id="opt-awake-label">Keep screen on</span>
        <div class="seg">
          <button type="button" class="seg-btn" [class.active]="!keepAwake()" [attr.aria-pressed]="!keepAwake()" (click)="awake.emit(false)">Off</button>
          <button type="button" class="seg-btn" [class.active]="keepAwake()" [attr.aria-pressed]="keepAwake()" (click)="awake.emit(true)">On</button>
        </div>
        <p class="opt-help">The screen stays on while this workout is open, so the rest timer can sound. On this device only; uses more battery.</p>
      </div>
      }

      <div class="opt-actions">
        <button type="button" class="opt-row" (click)="saveTemplate.emit()">
          <jiro-icon name="floppy-disk" [size]="18" />
          <span class="opt-row-text">Save as template</span>
        </button>
        @if (!fix()) {
        <button type="button" class="opt-row" (click)="leave.emit()">
          <jiro-icon name="sign-out" [size]="18" />
          <span class="opt-row-text">Leave for now<small>The workout stays open. Resume it from Jym.</small></span>
        </button>
        <button type="button" class="opt-row opt-row--danger" [disabled]="discarding()" (click)="discard.emit()">
          <jiro-icon name="trash" [size]="18" />
          <span class="opt-row-text">{{ discarding() ? 'Discarding...' : 'Discard workout' }}</span>
        </button>
        }
      </div>
    </jiro-modal>
  `,
  styleUrl: './player-sheets.css',
})
export class OptionsSheetComponent {
  readonly settings = inject(SettingsService);
  readonly sessionType = input.required<string>();
  readonly restSetting = input.required<number>();
  readonly keepAwake = input(false);
  readonly fix = input(false);
  readonly discarding = input(false);

  readonly type = output<string>();
  readonly unit = output<string>();
  readonly rest = output<number>();
  readonly awake = output<boolean>();
  readonly saveTemplate = output<void>();
  readonly leave = output<void>();
  readonly discard = output<void>();
  readonly close = output<void>();

  readonly sessionTypes = SESSION_TYPES;
  readonly units = ['lbs', 'kg'];
  readonly restPresets = REST_PRESETS;
  readonly typeHelp = computed(() => TYPE_HELP[this.sessionType()] ?? "Counts for records and next time's suggestion.");
  readonly restLabel = restLabel;
}

/** One exercise's rest: its own length, or your usual; a plan's rest still comes first. */
@Component({
  selector: 'jym-rest-sheet',
  standalone: true,
  imports: [JiroModalComponent],
  template: `
    <jiro-modal sheet title="Rest timer" maxWidth="440px" (close)="close.emit()">
      <p class="sheet-sub">After {{ exerciseName() }}</p>
      <div class="opt-group" role="group" aria-label="Rest after this exercise">
        <div class="seg">
          <button type="button" class="seg-btn" [class.active]="own() === null" [attr.aria-pressed]="own() === null" (click)="choose.emit(null)">Usual</button>
          @for (d of presets; track d) {
            <button type="button" class="seg-btn" [class.active]="own() === d" [attr.aria-pressed]="own() === d" (click)="choose.emit(d)">{{ restLabel(d) }}</button>
          }
        </div>
        <p class="opt-help">{{ help() }}</p>
      </div>
    </jiro-modal>
  `,
  styleUrl: './player-sheets.css',
})
export class RestSheetComponent {
  readonly exerciseName = input.required<string>();
  /** The exercise's own rest; null is your usual. */
  readonly own = input<number | null>(null);
  /** The plan's rest in this workout, which wins over the exercise's. */
  readonly planned = input<number | null>(null);
  /** Your usual rest, from Workout options. */
  readonly usual = input.required<number>();

  readonly choose = output<number | null>();
  readonly close = output<void>();

  readonly presets = REST_PRESETS;
  readonly restLabel = restLabel;
  readonly help = computed(() => {
    const planned = this.planned();
    if (planned != null) return `This workout's plan rests ${restText(planned)} here, so that comes first. Your choice applies when a plan doesn't set one.`;
    return this.own() === null
      ? `Rests your usual ${restText(this.usual())}, set in Workout options. Pick a length to give this exercise its own.`
      : 'Remembered for this exercise in every workout.';
  });
}

/** One set's sheet: make it a warm-up or a working set, or remove it. */
@Component({
  selector: 'jym-set-sheet',
  standalone: true,
  imports: [JiroModalComponent, JiroIconComponent],
  template: `
    <jiro-modal sheet [title]="'Set ' + setNumber()" maxWidth="400px" (close)="close.emit()">
      <p class="sheet-sub">{{ summary() }}</p>
      <div class="opt-actions opt-actions--plain">
        <button type="button" class="opt-row" (click)="toggleWarmup.emit()">
          <jiro-icon name="fire" [size]="18" />
          <span class="opt-row-text">
            {{ isWarmup() ? 'Make it a working set' : 'Mark as warm-up' }}
            <small>{{ isWarmup() ? 'It counts for volume and records again.' : "Warm-ups don't count for volume or records." }}</small>
          </span>
        </button>
        <button type="button" class="opt-row opt-row--danger" (click)="remove.emit()">
          <jiro-icon name="trash" [size]="18" />
          <span class="opt-row-text">Remove set</span>
        </button>
      </div>
    </jiro-modal>
  `,
  styleUrl: './player-sheets.css',
})
export class SetSheetComponent {
  readonly setNumber = input.required<number>();
  /** The exercise, the values and whether it's logged, under the title. */
  readonly summary = input.required<string>();
  readonly isWarmup = input(false);

  readonly toggleWarmup = output<void>();
  readonly remove = output<void>();
  readonly close = output<void>();
}
