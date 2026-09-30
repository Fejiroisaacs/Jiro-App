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
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { JiroMenuComponent } from '../../../shared/components/jiro-menu/jiro-menu';
import { PlayerStore } from './player-store';
import { RestRowComponent } from './rest-row';
import { PlatesSheetComponent } from './plates-sheet';
import { OptionsSheetComponent, SetSheetComponent } from './player-sheets';
import { ExercisePickerComponent, PickerExercise } from './exercise-picker';
import { SaveTemplateDialogComponent } from '../shared/save-template-dialog';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

@Component({
  selector: 'app-session-player',
  providers: [PlayerStore],
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroIconComponent, JiroSkeletonComponent, JiroEmptyStateComponent, JymPrBadgeComponent, SaveTemplateDialogComponent, JiroMenuComponent, RestRowComponent, PlatesSheetComponent, OptionsSheetComponent, SetSheetComponent, ExercisePickerComponent],
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
        @for (block of store.blocks(); track block.exerciseId; let bi = $index) {
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

    .ex-note-wrap .field-label { font-size: var(--font-size-xs); padding: 0 10px; }

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
    .block-toggle:focus-visible { outline: none; } /* drawn on the whole header above */

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

    /* Exercise note */
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

    /* Set table: set number, weight, reps, RPE, log. Every target is 44 px. */
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

    /* A logged working set below the plan's reps */
    .set-row.set-short .reps-input { color: var(--color-warning); font-weight: 600; }

    /* The set number is the handle for warm-up and remove. */
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

    /* Editing a logged set: its own Cancel and Save under the row. */
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


    /* Warm-up prompt: shown above the rows until a set is logged. */
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
    @media (max-width: 480px) {
      .set-header-row,
      .set-row {
        grid-template-columns: 44px 1fr 1fr 52px 44px;
        padding: var(--space-xs) var(--space-md);
        gap: 6px;
      }

      .set-input { padding: 8px 8px; }

      .edit-actions, .rpe-err-msg { padding-left: var(--space-md); padding-right: var(--space-md); }

      .ex-note-wrap { padding: var(--space-xs) var(--space-md); }
    }

    /* ── Body weight panel on mobile ── */
    @media (max-width: 480px) {
      .bw-panel { flex-wrap: wrap; }
      .bw-label { flex: 0 0 100%; }
    }

    /* ── Form check ── */
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

    .fc-count {
      font-size: var(--font-size-xs); color: var(--text-secondary); white-space: nowrap;
    }

    .fc-clip-link { display: inline-flex; align-items: center; text-decoration: none; }
    .fc-thumb { width: 44px; height: 44px; object-fit: cover; border-radius: var(--border-radius-sm); border: 1px solid var(--border-color); }
    .fc-thumb-video {
      width: 44px; height: 44px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--surface-secondary); border-radius: var(--border-radius-sm); border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
  `]
})
export class SessionPlayerComponent implements OnInit, OnDestroy {
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
