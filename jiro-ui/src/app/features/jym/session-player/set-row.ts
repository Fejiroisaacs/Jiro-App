import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { ExerciseBlock, SetRow } from './player-blocks';
import { paceText } from '../exercise-kind';
import { PlayerStore } from './player-store';

/** One set: its number (warm-up, remove), weight, reps, RPE and ✓, and Cancel / Save while a logged set is edited. */
@Component({
  selector: 'jym-set-row',
  standalone: true,
  imports: [FormsModule, JiroIconComponent, JymPrBadgeComponent],
  template: `
    @let block = blockInput();
    @let bi = blockIndex();
    @let row = rowInput();
    @let si = setIndex();
    <div class="set-row" [class.set-done]="row.saved" [class.set-warmup]="row.isWarmup" [class.set-short]="store.isShort(block, row)" [class.set-editing]="row.editing"
      [attr.data-set]="block.exerciseId + '-' + row.setNumber" [class.next-up]="store.nextUp() === block.exerciseId + '-' + row.setNumber">
      <button
        type="button"
        class="set-num-btn"
        [class.is-warmup]="row.isWarmup"
        aria-haspopup="dialog"
        [attr.aria-label]="'Set ' + row.setNumber + (row.isWarmup ? ', warm-up' : '') + ', options'"
        [disabled]="row.saving"
        (click)="store.openSetSheet(block, row)">
        @if (row.isWarmup) {
          <jiro-icon name="fire" [size]="12" />
        }
        {{ row.setNumber }}
      </button>

      <input
        class="set-input"
        type="text"
        inputmode="decimal"
        enterkeyhint="next"
        autocomplete="off"
        [(ngModel)]="row.weight"
        (ngModelChange)="store.saveDraftSoon()"
        [placeholder]="row.ghostWeight || (block.kind === 'distance' ? '' : '0')"
        [class.has-ghost]="row.ghostWeight && !store.filled(row.weight)"
        [attr.aria-label]="'Set ' + row.setNumber + ' ' + firstLabel()"
        [readonly]="row.saved && !row.editing"
        [class.logged]="row.saved && !row.editing"
        [attr.title]="row.saved && !row.editing ? 'Tap to edit' : null"
        (click)="store.editRow($event, bi, si)"
        (keydown.enter)="store.onEnter($event, bi, si, 'weight')"
        (keydown.escape)="store.cancelEdit(bi, si)" />

      <input
        class="set-input reps-input"
        type="text"
        inputmode="numeric"
        enterkeyhint="done"
        autocomplete="off"
        [(ngModel)]="row.reps"
        (ngModelChange)="store.saveDraftSoon()"
        [placeholder]="row.ghostReps || (timed() ? '0:00' : '0')"
        [class.has-ghost]="row.ghostReps && !store.filled(row.reps)"
        [attr.aria-label]="'Set ' + row.setNumber + (timed() ? ' time, minutes and seconds' : ' reps') + (store.isShort(block, row) ? ', below plan' : '')"
        (blur)="timed() && store.formatTime(bi, si)"
        [readonly]="row.saved && !row.editing"
        [class.logged]="row.saved && !row.editing"
        [attr.title]="row.saved && !row.editing ? 'Tap to edit' : null"
        (click)="store.editRow($event, bi, si)"
        (keydown.enter)="store.onEnter($event, bi, si, 'reps')"
        (keydown.escape)="store.cancelEdit(bi, si)" />

      <input
        class="set-input rpe-input"
        type="text"
        inputmode="numeric"
        enterkeyhint="done"
        autocomplete="off"
        [attr.aria-label]="'Set ' + row.setNumber + ' RPE, 1 to 10' + (block.plan?.rpe && !row.isWarmup ? ', plan ' + block.plan?.rpe : '')"
        [attr.placeholder]="block.plan?.rpe && !row.isWarmup && !row.saved ? block.plan?.rpe : null"
        [class.has-ghost]="!!block.plan?.rpe && !row.isWarmup && !row.saved"
        [class.input-error]="store.filled(row.rpe) && store.rpeInvalid(row.rpe)"
        [(ngModel)]="row.rpe"
        (ngModelChange)="store.saveDraftSoon()"
        [readonly]="row.saved && !row.editing"
        [class.logged]="row.saved && !row.editing"
        [attr.title]="row.saved && !row.editing ? 'Tap to edit' : null"
        (click)="store.editRow($event, bi, si)"
        (keydown.enter)="store.onEnter($event, bi, si, 'rpe')"
        (keydown.escape)="store.cancelEdit(bi, si)" />

      <div class="action-cell">
        @if (!row.saved) {
          <!-- One tap logs what the row shows: typed values, else the ghosts. -->
          <button type="button" class="log-btn" [attr.aria-label]="store.logLabel(row, block.kind)"
            [disabled]="!store.canLog(row, block.kind)" (click)="store.logSet(bi, si)">
            @if (row.saving) {
              <span class="spinner-sm"></span>
            } @else {
              <jiro-icon name="check" [size]="20" />
            }
          </button>
        } @else if (row.saving) {
          <span class="spinner-sm" role="status" aria-label="Saving"></span>
        } @else if (!row.editing) {
          @if (row.isPR) {
            <jym-pr-badge />
          } @else {
            <jiro-icon class="logged-mark" name="check" [size]="16" label="Logged" />
          }
        }
      </div>
    </div>
    <!-- Phones' number pads have no Enter key, so an edit always shows its own buttons.
         pointerdown is held back so the first tap doesn't blur, shift the layout and miss. -->
    @if (row.editing) {
      <div class="edit-actions">
        <button type="button" class="edit-btn" (pointerdown)="$event.preventDefault()" (click)="store.cancelEdit(bi, si)">Cancel</button>
        <button type="button" class="edit-btn edit-btn--save" [attr.aria-label]="'Save set ' + row.setNumber"
          (pointerdown)="$event.preventDefault()" [disabled]="row.saving || !store.editValid(row, block.kind)" (click)="store.saveEdit(bi, si)">Save</button>
      </div>
    }
    @if (block.kind === 'distance' && row.saved && !row.editing && pace(row); as p) {
      <div class="pace-note">{{ p }}{{ row.isPR && row.prKind ? ' · ' + (row.prKind === 'pace' ? 'fastest pace' : 'longest distance') : '' }}</div>
    }
    @if ((!row.saved || row.editing) && store.filled(row.rpe) && store.rpeInvalid(row.rpe)) {
      <div class="rpe-err-msg" role="alert">RPE must be between 1 and 10</div>
    }
  `,
  styles: [`
    :host { display: block; }

    .set-row {
      display: grid;
      grid-template-columns: 44px 1fr 1fr 56px 44px;
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-lg);
    }

    .set-row {
      align-items: center;
      border-bottom: 1px solid var(--border-color);
      transition: background 0.2s;
    }

    .set-row.set-done { background: rgba(var(--color-primary-rgb), 0.04); }

    .set-row.set-warmup { background: rgba(var(--color-warning-rgb), 0.08); }

    .set-row.next-up { box-shadow: inset 3px 0 0 var(--color-primary); background: rgba(var(--color-primary-rgb), 0.08); transition: background 0.3s; }

    .set-row.set-short .reps-input { color: var(--color-warning); font-weight: 600; }

    .set-num-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 2px;
      width: 44px; height: 44px; padding: 0;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); font-weight: 600; font-family: inherit;
      font-variant-numeric: tabular-nums; cursor: pointer;
    }

    .set-num-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--text-primary); }

    .set-num-btn.is-warmup { color: var(--color-warning); border-color: rgba(var(--color-warning-rgb), 0.45); background: rgba(var(--color-warning-rgb), 0.1); }

    .set-input {
      width: 100%; min-width: 0; min-height: 44px; padding: 8px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas); color: var(--text-primary);
      font-size: var(--font-size-md); box-sizing: border-box;
      font-family: inherit; font-variant-numeric: tabular-nums; transition: border-color 0.15s;
    }

    .set-input:focus { border-color: var(--color-primary); }

    .set-input.logged { background: transparent; border-color: transparent; cursor: pointer; }

    .set-input.logged:hover { border-color: var(--border-color); }

    .set-row.set-editing { background: rgba(var(--color-primary-rgb), 0.08); border-bottom-color: transparent; }

    .set-input.has-ghost::placeholder { color: rgba(var(--color-primary-rgb), 0.55); font-style: italic; }

    .input-error { border-color: var(--color-danger) !important; }

    .rpe-err-msg {
      font-size: var(--font-size-xs); color: var(--color-danger);
      padding: 2px var(--space-lg) var(--space-xs);
    }

    .pace-note {
      font-size: var(--font-size-xs); color: var(--text-secondary);
      padding: 0 var(--space-lg) var(--space-xs) calc(var(--space-lg) + 44px + var(--space-sm));
      background: rgba(var(--color-primary-rgb), 0.04); border-bottom: 1px solid var(--border-color);
    }

    .action-cell { display: flex; align-items: center; justify-content: center; min-width: 0; }

    .logged-mark { color: var(--text-muted); }

    .log-btn {
      width: 44px; height: 44px; border-radius: 50%;
      background: var(--color-primary); color: var(--text-on-primary); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s;
    }

    .log-btn:hover:not(:disabled) { opacity: 0.85; }

    .log-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .edit-actions {
      display: flex; justify-content: flex-end; gap: var(--space-sm);
      padding: 0 var(--space-lg) var(--space-sm);
      background: rgba(var(--color-primary-rgb), 0.08);
      border-bottom: 1px solid var(--border-color);
    }

    .edit-btn {
      min-height: 44px; min-width: 88px; padding: 0 var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-sm); font-weight: 600; font-family: inherit; cursor: pointer;
    }

    .edit-btn--save { background: var(--color-primary); border-color: var(--color-primary); color: var(--text-on-primary); }

    .edit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid color-mix(in srgb, currentColor 40%, transparent);
      border-top-color: currentColor; border-radius: 50%;
      animation: jiro-spin 0.6s linear infinite; display: inline-block;
    }

    @media (max-width: 480px) {
      .set-row {
        grid-template-columns: 44px 1fr 1fr 52px 44px;
        padding: var(--space-xs) var(--space-md);
        gap: 6px;
      }
      .set-input { padding: 8px 8px; }
      .edit-actions, .rpe-err-msg { padding-left: var(--space-md); padding-right: var(--space-md); }
      .pace-note { padding-left: calc(var(--space-md) + 44px + 6px); }
    }

  `],
})
export class SetRowComponent {
  readonly store = inject(PlayerStore);
  readonly settingsService = inject(SettingsService);
  readonly blockInput = input.required<ExerciseBlock>({ alias: 'block' });
  readonly blockIndex = input.required<number>({ alias: 'bi' });
  readonly rowInput = input.required<SetRow>({ alias: 'row' });
  /** Its place in the exercise, which the store's methods take. */
  readonly setIndex = input.required<number>({ alias: 'si' });

  /** The second column is a time (holds, distances) rather than reps. */
  timed(): boolean {
    const k = this.blockInput().kind;
    return k === 'duration' || k === 'distance';
  }

  /** The first column in words, for its label: weight, the load added, or the distance. */
  firstLabel(): string {
    const unit = this.settingsService.unitLabel();
    const k = this.blockInput().kind;
    return k === 'distance' ? `distance (${this.store.dUnit()})` : k === 'weight_reps' ? `weight (${unit})` : `added weight (${unit}), blank for none`;
  }

  /** A logged distance set's pace. */
  pace(row: SetRow): string | null {
    return paceText(row.durationS, row.distanceM, this.store.dUnit());
  }
}
