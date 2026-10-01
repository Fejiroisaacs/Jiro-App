import { Component, inject, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroMenuComponent } from '../../../shared/components/jiro-menu/jiro-menu';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { ExerciseBlock } from './player-blocks';
import { PlayerStore } from './player-store';

/** One exercise in the player: its header and menu, last time, note, warm-ups, set rows, Add set and form check. */
@Component({
  selector: 'jym-exercise-block',
  standalone: true,
  imports: [FormsModule, JiroIconComponent, JiroMenuComponent, JymPrBadgeComponent],
  template: `
    @let block = blockInput();
    @let bi = index();
    <div class="ex-block">
              <!-- The header toggles on click; the name button is its keyboard handle (its click bubbles up). -->
              <div class="block-header" [class.block-open]="!store.isCollapsed(bi)" (click)="store.toggleBlock(bi)">
                <div class="block-title">
                  <h2><button type="button" class="block-toggle" [attr.aria-expanded]="!store.isCollapsed(bi)" [attr.aria-controls]="'block-body-' + bi">{{ block.exerciseName }}</button></h2>
                  @if (block.muscleGroup) {
    <span class="mg-tag">{{ block.muscleGroup }}</span>
    }
                  @if (block.plan) {
                    <span class="plan-tag">Plan {{ block.plan.sets }} × {{ block.plan.reps }}</span>
                  }
                  @if (store.isCollapsed(bi) && store.savedCount(bi) > 0) {
    <span class="sets-done-tag">{{ store.savedCount(bi) }} sets</span>
    }
                </div>
                <div class="block-actions">
                  @if (store.removingBlock() === bi) {
                    <span class="block-busy" role="status" aria-label="Removing"><span class="spinner-sm"></span></span>
                  } @else {
                    <jiro-menu touch [items]="store.blockActions(bi)" [label]="'More actions for ' + block.exerciseName" (select)="store.onBlockAction(bi, $event)" />
                  }
                  <jiro-icon name="caret-down" [size]="16" class="chevron" [class.open]="!store.isCollapsed(bi)" />
                </div>
              </div>

              <div [id]="'block-body-' + bi">
              @if (!store.isCollapsed(bi)) {

                <!-- Last time, and what to aim for today -->
                @if (block.suggestion && !store.allSaved(bi)) {
    <div class="overload-hint">
                  <jiro-icon [name]="block.suggestionIcon ?? 'trend-up'" [size]="12" />
                  {{ block.suggestion }}
                </div>
    }

                <!-- Exercise note -->
                <div class="ex-note-wrap">
                  <label class="field-label" [attr.for]="'ex-note-' + bi">Exercise note</label>
                  <textarea
                    [id]="'ex-note-' + bi"
                    class="ex-note-input"
                    [(ngModel)]="block.exerciseNote"
                    placeholder="Optional"
                    rows="1"
                    (blur)="store.saveExerciseNote(bi)"></textarea>
                </div>

                <!-- Warm-ups before the first working set: the bar, then about 50, 70 and 85 percent. -->
                @if (store.warmupRampFor(block); as ramp) {
                  <button type="button" class="warmup-prompt" (click)="store.addWarmups(bi, ramp)">
                    <jiro-icon name="fire" [size]="16" />
                    <span class="warmup-prompt-text">
                      Add warm-up sets
                      <small>{{ store.rampSummary(ramp) }}</small>
                    </span>
                  </button>
                }

                <!-- Set header -->
                <div class="set-header-row" aria-hidden="true">
                  <span class="sh set-num">Set</span>
                  <span class="sh">Weight ({{ settingsService.unitLabel() }})</span>
                  <span class="sh">Reps</span>
                  <span class="sh">RPE</span>
                  <span class="sh"></span>
                </div>

                <!-- Set rows: the number opens warm-up and remove; the check logs what the row shows. -->
                @for (row of block.sets; track row.id ?? 'new-' + row.setNumber; let si = $index) {
                  <div class="set-row" [class.set-done]="row.saved" [class.set-warmup]="row.isWarmup" [class.set-short]="store.isShort(block, row)" [class.set-editing]="row.editing">
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
                      [placeholder]="row.ghostWeight || '0'"
                      [class.has-ghost]="row.ghostWeight && !store.filled(row.weight)"
                      [attr.aria-label]="'Set ' + row.setNumber + ' weight (' + settingsService.unitLabel() + ')'"
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
                      [placeholder]="row.ghostReps || '0'"
                      [class.has-ghost]="row.ghostReps && !store.filled(row.reps)"
                      [attr.aria-label]="'Set ' + row.setNumber + ' reps' + (store.isShort(block, row) ? ', below plan' : '')"
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
                      [attr.aria-label]="'Set ' + row.setNumber + ' RPE, 1 to 10'"
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
                        <button type="button" class="log-btn" [attr.aria-label]="store.logLabel(row)"
                          [disabled]="!store.canLog(row)" (click)="store.logSet(bi, si)">
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
                        (pointerdown)="$event.preventDefault()" [disabled]="row.saving || !store.editValid(row)" (click)="store.saveEdit(bi, si)">Save</button>
                    </div>
                  }
                  @if ((!row.saved || row.editing) && store.filled(row.rpe) && store.rpeInvalid(row.rpe)) {
                    <div class="rpe-err-msg" role="alert">RPE must be between 1 and 10</div>
                  }
                }

                <!-- Add set -->
                <button class="add-set-btn" type="button" [id]="'add-set-' + block.exerciseId" (click)="store.addSet(bi)">+ Add set</button>

                <!-- Form check upload -->
                <div class="form-check-row">
                  <label [for]="store.canUploadFormCheck(bi, block.exerciseId) ? 'fc-input-' + block.exerciseId : ''"
                         class="form-check-btn"
                         [class.fc-uploading]="store.isFormCheckUploading(block.exerciseId)"
                         [class.fc-disabled]="!store.canUploadFormCheck(bi, block.exerciseId)"
                         [title]="store.formCheckBtnTitle(bi, block.exerciseId)">
                    <jiro-icon name="camera" [size]="13" />
                    {{ store.isFormCheckUploading(block.exerciseId) ? 'Uploading...' : '+ Form check' }}
                  </label>
                  <input type="file" [id]="'fc-input-' + block.exerciseId"
                    accept="video/mp4,video/webm,image/jpeg,image/png"
                    style="display:none"
                    (change)="store.onFormCheckFileChange($event, bi)">
                  @if (store.formCheckError().get(block.exerciseId); as fcErr) {
                    <span class="fc-error" role="alert">{{ fcErr }}</span>
                    <button type="button" class="fc-retry-btn" (click)="store.retryFormCheck(bi)">Retry</button>
                  }
                  @if (store.isFormCheckUploading(block.exerciseId)) {
    <div class="fc-progress-bar">
                    <div class="fc-progress-fill" [style.width.%]="store.getFormCheckProgress(block.exerciseId)"></div>
                  </div>
    }
                  @if (store.getFirstAttachment(block.exerciseId); as clip) {

                    <a [href]="clip.file_url" target="_blank" class="fc-clip-link">
                      @if (clip.file_type.startsWith('image/')) {
    <img [src]="clip.file_url" class="fc-thumb" alt="form check">
    }
                      @if (!clip.file_type.startsWith('image/')) {
    <span class="fc-thumb-video">
                        <jiro-icon name="video-camera" [size]="14" />
                      </span>
    }
                    </a>

    }
                  <button type="button" class="plates-btn" aria-haspopup="dialog" (click)="store.openPlates(block)">
                    <jiro-icon name="barbell" [size]="16" /> Plates
                  </button>
                </div>

    }
              </div>
            </div>
  `,
  styles: [`
    :host { display: block; }

    .field-label {
          display: block;
          font-size: var(--font-size-sm); font-weight: 500;
          color: var(--text-secondary);
          margin-bottom: var(--space-xs);
        }

    .ex-note-wrap .field-label { font-size: var(--font-size-xs); padding: 0 10px; }

    .ex-block {
          background: var(--bg-surface); border: 1px solid var(--border-color);
          border-radius: var(--border-radius); overflow: hidden;
        }

    .block-header {
          padding: var(--space-md) var(--space-lg);
          background: var(--bg-canvas);
          display: flex; align-items: center; justify-content: space-between;
          cursor: pointer; user-select: none;
        }

    .block-header.block-open { border-bottom: 1px solid var(--border-color); }

    .block-actions { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

    .block-busy { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: var(--text-muted); }

    .overload-hint {
          display: flex; align-items: center; gap: 6px;
          padding: 6px var(--space-lg);
          font-size: var(--font-size-xs); color: var(--color-primary);
          background: rgba(var(--color-primary-rgb), 0.06); border-bottom: 1px solid var(--border-color);
        }

    .block-header:hover { background: var(--bg-surface); }

    .block-header:has(.block-toggle:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: -2px; }

    .block-toggle {
          padding: 0; border: 0; background: none; color: inherit;
          font: inherit; letter-spacing: inherit; text-align: left; cursor: pointer;
        }

    .block-toggle:focus-visible { outline: none; }

    .block-title { display: flex; flex-wrap: wrap; align-items: center; gap: 2px var(--space-sm); flex: 1; min-width: 0; }

    .plan-tag { font-size: var(--font-size-xs); color: var(--text-secondary); font-weight: 500; white-space: nowrap; }

    .block-title h2 { font-size: var(--font-size-md); font-weight: 600; }

    .sets-done-tag {
          font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--border-radius-pill);
          background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); font-weight: 500;
        }

    .chevron {
          flex-shrink: 0; color: var(--text-muted);
          transform: rotate(-90deg); transition: transform 0.2s ease;
        }

    .chevron.open { transform: rotate(0deg); }

    .mg-tag {
          background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary-text);
          font-size: var(--font-size-xs); padding: 2px 8px; border-radius: var(--border-radius-pill);
        }

    .ex-note-wrap {
          padding: var(--space-xs) var(--space-lg);
          border-bottom: 1px solid var(--border-color);
        }

    .ex-note-input {
          width: 100%; box-sizing: border-box; min-height: 44px;
          padding: 12px 10px;
          border: 1px solid transparent; border-radius: var(--border-radius);
          background: transparent; color: var(--text-secondary);
          font-size: var(--font-size-xs); font-family: inherit;
          resize: none; line-height: 1.5;
          transition: border-color 0.15s, background 0.15s;
        }

    .ex-note-input:focus {
          border-color: var(--border-color);
          background: var(--bg-canvas);
          color: var(--text-primary);
        }

    .ex-note-input::placeholder { color: var(--text-muted); }

    .set-header-row, .set-row {
          display: grid;
          grid-template-columns: 44px 1fr 1fr 56px 44px;
          gap: var(--space-sm);
          padding: var(--space-xs) var(--space-lg);
        }

    .set-header-row { border-bottom: 1px solid var(--border-color); }

    .sh {
          font-size: var(--font-size-xs); text-transform: uppercase;
          letter-spacing: 0.5px; color: var(--text-muted); font-weight: 500;
        }

    .sh.set-num { text-align: center; }

    .set-row {
          align-items: center;
          border-bottom: 1px solid var(--border-color);
          transition: background 0.2s;
        }

    .set-row:last-of-type { border-bottom: none; }

    .set-row.set-done { background: rgba(var(--color-primary-rgb), 0.04); }

    .set-row.set-warmup { background: rgba(var(--color-warning-rgb), 0.08); }

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

    .warmup-prompt {
          display: flex; align-items: center; gap: var(--space-sm); width: 100%;
          min-height: 52px; padding: var(--space-xs) var(--space-lg);
          background: rgba(var(--color-warning-rgb), 0.06); border: none; border-bottom: 1px solid var(--border-color);
          color: var(--color-warning); font-family: inherit; font-size: var(--font-size-sm); font-weight: 600;
          text-align: left; cursor: pointer;
        }

    .warmup-prompt:hover { background: rgba(var(--color-warning-rgb), 0.12); }

    .warmup-prompt-text { display: flex; flex-direction: column; gap: 2px; }

    .warmup-prompt-text small { font-weight: 400; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

    .plates-btn {
          display: inline-flex; align-items: center; gap: 6px; margin-left: auto;
          min-height: 44px; padding: 0 var(--space-md);
          border: 1px solid var(--border-color); border-radius: var(--border-radius);
          background: var(--bg-surface); color: var(--text-secondary);
          font-family: inherit; font-size: var(--font-size-sm); font-weight: 500; cursor: pointer; white-space: nowrap;
        }

    .plates-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .spinner-sm {
          width: 14px; height: 14px;
          border: 2px solid color-mix(in srgb, currentColor 40%, transparent);
          border-top-color: currentColor; border-radius: 50%;
          animation: jiro-spin 0.6s linear infinite; display: inline-block;
        }

    .add-set-btn {
          width: 100%; padding: var(--space-sm);
          background: none; border: none; border-top: 1px solid var(--border-color);
          color: var(--text-muted); font-size: var(--font-size-sm); cursor: pointer;
          font-family: inherit; min-height: 44px;
          transition: all 0.15s;
        }

    .add-set-btn:hover { color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.04); }

    @media (max-width: 480px) {
      .set-header-row, .set-row {
        grid-template-columns: 44px 1fr 1fr 52px 44px;
        padding: var(--space-xs) var(--space-md);
        gap: 6px;
      }
      .set-input { padding: 8px 8px; }
      .edit-actions, .rpe-err-msg { padding-left: var(--space-md); padding-right: var(--space-md); }
      .ex-note-wrap { padding: var(--space-xs) var(--space-md); }
    }

    .form-check-row {
          display: flex; align-items: center; gap: var(--space-sm);
          padding: var(--space-xs) var(--space-lg);
          border-top: 1px solid var(--border-color);
        }

    .form-check-btn {
          display: inline-flex; align-items: center; gap: 6px;
          font-size: var(--font-size-xs); color: var(--text-muted);
          cursor: pointer; min-height: 44px; padding: 4px 12px; border-radius: var(--border-radius);
          border: 1px dashed var(--border-color); background: none;
          white-space: nowrap; transition: all 0.15s; font-family: inherit;
        }

    .form-check-btn:hover,
        .form-check-btn.fc-uploading { color: var(--color-primary); border-color: var(--color-primary); }

    .form-check-btn.fc-disabled {
          opacity: 0.4; cursor: not-allowed; pointer-events: none;
        }

    .fc-progress-bar {
          flex: 1; height: 4px; background: var(--border-color);
          border-radius: var(--border-radius-sm); overflow: hidden;
        }

    .fc-progress-fill {
          height: 100%; background: var(--color-primary); transition: width 0.3s;
        }

    .fc-error { font-size: var(--font-size-xs); color: var(--color-danger); }

    .fc-retry-btn {
          font-size: var(--font-size-xs); font-family: inherit; font-weight: 600;
          padding: 4px 12px; min-height: 44px; border-radius: var(--border-radius);
          border: 1px solid var(--color-danger); background: none; color: var(--color-danger);
          cursor: pointer;
        }

    .fc-retry-btn:hover { background: rgba(var(--color-danger-rgb), 0.08); }

    .fc-clip-link { display: inline-flex; align-items: center; text-decoration: none; }

    .fc-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); }

    .fc-thumb-video {
          width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
          background: var(--surface-secondary); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);
          color: var(--text-secondary);
        }
  `],
})
export class ExerciseBlockComponent {
  readonly store = inject(PlayerStore);
  readonly settingsService = inject(SettingsService);
  readonly blockInput = input.required<ExerciseBlock>({ alias: 'block' });
  /** Its place in the workout, which the store's methods take. */
  readonly index = input.required<number>({ alias: 'bi' });
}
