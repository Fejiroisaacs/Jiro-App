import { Component, OnInit, OnDestroy, WritableSignal, computed, effect, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  JymService,
  RoutineItem,
  CreateSetRequest,
  UpdateSetRequest,
  SetHistory,
  SessionAttachment,
  SessionSet,
} from '../../../core/services/jym.service';
import { UploadService } from '../../../core/services/upload.service';
import { SettingsService } from '../../../core/services/settings.service';
import { dayKey, timeInZone, todayKey } from '../../../core/utils/day';
import { formatInstant } from '../../../core/utils/format-date';
import { isStale } from '../stale-workout';
import { nextSets } from '../weight-suggestion';
import { filled, parseDecimal, parseWhole } from '../number-input';
import { nearestLoadable, platesFor, platesPerSide, warmupRamp } from '../plates';
import { DRAFT_VERSION, SessionDraft, clearDraft, readDraft, writeDraft } from '../shared/session-draft';
import { AuthService } from '../../../core/services/auth.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { SaveTemplateDialogComponent } from '../shared/save-template-dialog';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

/** One row of an exercise; weight, reps and RPE are the text typed (a comma may be the decimal point). */
interface SetRow {
  setNumber: number;
  weight: string;
  /** Stored kg of a logged set, so a unit switch re-derives it instead of reinterpreting the text. */
  weightKg?: number;
  reps: string;
  rpe: string;
  saved: boolean;
  isPR: boolean;
  saving: boolean;
  id: string | null;
  ghostWeight: string;
  ghostReps: string;
  isWarmup: boolean;
  /** A logged set opened for correction, and its values before the edit. */
  editing?: boolean;
  before?: { weight: string; reps: string; rpe: string };
}

interface ExerciseBlock {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  sets: SetRow[];
  ghostSets: { weight: number; reps: number }[];
  suggestion: string | null;
  exerciseNote: string;
  /** The routine's target for this exercise, when the workout follows one. */
  plan?: { sets: number; reps: number };
  /** repeat when the advice is to hold the weight, trend-up otherwise. */
  suggestionIcon?: 'trend-up' | 'repeat';
}

@Component({
  selector: 'app-session-player',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroButtonComponent, JiroModalComponent, JiroIconComponent, JiroSkeletonComponent, JiroEmptyStateComponent, JymPrBadgeComponent, SaveTemplateDialogComponent],
  template: `
    <h1 class="sr-only">Active session</h1>
    <!-- Sticky bar: the clock, the options, and Finish; everything else waits in the options sheet. -->
    <div class="session-bar">
      <div class="session-bar-row">
        <div class="session-bar-left">
          @if (fix) {
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
          @if (fix) {
            <jiro-button size="lg" variant="inverse" type="button" (click)="doneFixing()">Done</jiro-button>
          } @else {
            <jiro-button size="lg" variant="inverse" type="button" (click)="finishSession()" [disabled]="finishing()">
              {{ finishing() ? 'Finishing...' : 'Finish' }}
            </jiro-button>
          }
        </div>
      </div>
      <!-- Rest timer row: opens after a logged set -->
      @if (restTimerActive()) {
        <div class="rest-row" [class.rest-done]="restTimerDone()">
          <span class="rest-label">Rest</span>
          <span class="rest-countdown" role="timer" aria-live="off">{{ restTimerDisplay() }}</span>
          <button class="rest-btn" type="button" (click)="addRestTime(30)" aria-label="Add 30 seconds to this rest">+30s</button>
          <button class="rest-btn" type="button" (click)="skipRestTimer()">Skip</button>
          <div class="rest-progress" aria-hidden="true">
            <div class="rest-progress-fill" [style.width.%]="(restTimerRemaining() / restLength()) * 100"></div>
          </div>
        </div>
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
      @if (!loading() && !fix) {
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
        @if (blocks().length === 0) {
          <jiro-empty-state compact icon="barbell" heading="No exercises yet" message="Add your first lift to start logging sets.">
            <jiro-button size="sm" type="button" (click)="addExercise()">Add exercise</jiro-button>
          </jiro-empty-state>
        }

        <!-- Exercise blocks -->
        @for (block of blocks(); track block.exerciseId; let bi = $index) {
<div class="ex-block">
          <!-- The header toggles on click; the name button is its keyboard handle (its click bubbles up). -->
          <div class="block-header" [class.block-open]="!isCollapsed(bi)" (click)="toggleBlock(bi)">
            <div class="block-title">
              <h2><button type="button" class="block-toggle" [attr.aria-expanded]="!isCollapsed(bi)" [attr.aria-controls]="'block-body-' + bi">{{ block.exerciseName }}</button></h2>
              @if (block.muscleGroup) {
<span class="mg-tag">{{ block.muscleGroup }}</span>
}
              @if (block.plan) {
                <span class="plan-tag">Plan {{ block.plan.sets }} × {{ block.plan.reps }}</span>
              }
              @if (isCollapsed(bi) && savedCount(bi) > 0) {
<span class="sets-done-tag">{{ savedCount(bi) }} sets</span>
}
            </div>
            <div class="block-actions">
              <button
                type="button"
                class="del-btn"
                [attr.aria-label]="'Remove ' + block.exerciseName"
                [disabled]="removingBlock() === bi"
                (click)="$event.stopPropagation(); removeBlock(bi)">
                @if (removingBlock() === bi) {
                  <span class="spinner-sm"></span>
                } @else {
                  <jiro-icon name="trash" [size]="16" />
                }
              </button>
              <jiro-icon name="caret-down" [size]="16" class="chevron" [class.open]="!isCollapsed(bi)" />
            </div>
          </div>

          <div [id]="'block-body-' + bi">
          @if (!isCollapsed(bi)) {

            <!-- Last time, and what to aim for today -->
            @if (block.suggestion && !allSaved(bi)) {
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
                (blur)="saveExerciseNote(bi)"></textarea>
            </div>

            <!-- Warm-ups before the first working set: the bar, then about 50, 70 and 85 percent. -->
            @if (warmupRampFor(block); as ramp) {
              <button type="button" class="warmup-prompt" (click)="addWarmups(bi, ramp)">
                <jiro-icon name="fire" [size]="16" />
                <span class="warmup-prompt-text">
                  Add warm-up sets
                  <small>{{ rampSummary(ramp) }}</small>
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
              <div class="set-row" [class.set-done]="row.saved" [class.set-warmup]="row.isWarmup" [class.set-short]="isShort(block, row)" [class.set-editing]="row.editing">
                <button
                  type="button"
                  class="set-num-btn"
                  [class.is-warmup]="row.isWarmup"
                  aria-haspopup="dialog"
                  [attr.aria-label]="'Set ' + row.setNumber + (row.isWarmup ? ', warm-up' : '') + ', options'"
                  [disabled]="row.saving"
                  (click)="openSetSheet(block, row)">
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
                  (ngModelChange)="saveDraftSoon()"
                  [placeholder]="row.ghostWeight || '0'"
                  [class.has-ghost]="row.ghostWeight && !filled(row.weight)"
                  [attr.aria-label]="'Set ' + row.setNumber + ' weight (' + settingsService.unitLabel() + ')'"
                  [readonly]="row.saved && !row.editing"
                  [class.logged]="row.saved && !row.editing"
                  [attr.title]="row.saved && !row.editing ? 'Tap to edit' : null"
                  (click)="editRow($event, bi, si)"
                  (keydown.enter)="onEnter($event, bi, si, 'weight')"
                  (keydown.escape)="cancelEdit(bi, si)" />

                <input
                  class="set-input reps-input"
                  type="text"
                  inputmode="numeric"
                  enterkeyhint="done"
                  autocomplete="off"
                  [(ngModel)]="row.reps"
                  (ngModelChange)="saveDraftSoon()"
                  [placeholder]="row.ghostReps || '0'"
                  [class.has-ghost]="row.ghostReps && !filled(row.reps)"
                  [attr.aria-label]="'Set ' + row.setNumber + ' reps' + (isShort(block, row) ? ', below plan' : '')"
                  [readonly]="row.saved && !row.editing"
                  [class.logged]="row.saved && !row.editing"
                  [attr.title]="row.saved && !row.editing ? 'Tap to edit' : null"
                  (click)="editRow($event, bi, si)"
                  (keydown.enter)="onEnter($event, bi, si, 'reps')"
                  (keydown.escape)="cancelEdit(bi, si)" />

                <input
                  class="set-input rpe-input"
                  type="text"
                  inputmode="numeric"
                  enterkeyhint="done"
                  autocomplete="off"
                  [attr.aria-label]="'Set ' + row.setNumber + ' RPE, 1 to 10'"
                  [class.input-error]="filled(row.rpe) && rpeInvalid(row.rpe)"
                  [(ngModel)]="row.rpe"
                  (ngModelChange)="saveDraftSoon()"
                  [readonly]="row.saved && !row.editing"
                  [class.logged]="row.saved && !row.editing"
                  [attr.title]="row.saved && !row.editing ? 'Tap to edit' : null"
                  (click)="editRow($event, bi, si)"
                  (keydown.enter)="onEnter($event, bi, si, 'rpe')"
                  (keydown.escape)="cancelEdit(bi, si)" />

                <div class="action-cell">
                  @if (!row.saved) {
                    <!-- One tap logs what the row shows: typed values, else the ghosts. -->
                    <button type="button" class="log-btn" [attr.aria-label]="logLabel(row)"
                      [disabled]="!canLog(row)" (click)="logSet(bi, si)">
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
                  <button type="button" class="edit-btn" (pointerdown)="$event.preventDefault()" (click)="cancelEdit(bi, si)">Cancel</button>
                  <button type="button" class="edit-btn edit-btn--save" [attr.aria-label]="'Save set ' + row.setNumber"
                    (pointerdown)="$event.preventDefault()" [disabled]="row.saving || !editValid(row)" (click)="saveEdit(bi, si)">Save</button>
                </div>
              }
              @if ((!row.saved || row.editing) && filled(row.rpe) && rpeInvalid(row.rpe)) {
                <div class="rpe-err-msg" role="alert">RPE must be between 1 and 10</div>
              }
            }

            <!-- Add set -->
            <button class="add-set-btn" type="button" [id]="'add-set-' + block.exerciseId" (click)="addSet(bi)">+ Add set</button>

            <!-- Form check upload -->
            <div class="form-check-row">
              <label [for]="canUploadFormCheck(bi, block.exerciseId) ? 'fc-input-' + block.exerciseId : ''"
                     class="form-check-btn"
                     [class.fc-uploading]="isFormCheckUploading(block.exerciseId)"
                     [class.fc-disabled]="!canUploadFormCheck(bi, block.exerciseId)"
                     [title]="formCheckBtnTitle(bi, block.exerciseId)">
                <jiro-icon name="camera" [size]="13" />
                {{ isFormCheckUploading(block.exerciseId) ? 'Uploading...' : '+ Form check' }}
              </label>
              <input type="file" [id]="'fc-input-' + block.exerciseId"
                accept="video/mp4,video/webm,image/jpeg,image/png"
                style="display:none"
                (change)="onFormCheckFileChange($event, bi)">
              @if (formCheckError().get(block.exerciseId); as fcErr) {
                <span class="fc-error" role="alert">{{ fcErr }}</span>
                <button type="button" class="fc-retry-btn" (click)="retryFormCheck(bi)">Retry</button>
              }
              @if (isFormCheckUploading(block.exerciseId)) {
<div class="fc-progress-bar">
                <div class="fc-progress-fill" [style.width.%]="getFormCheckProgress(block.exerciseId)"></div>
              </div>
}
              @if (getFirstAttachment(block.exerciseId); as clip) {

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
              <button type="button" class="plates-btn" aria-haspopup="dialog" (click)="openPlates(block)">
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
      <jiro-modal sheet title="Workout options" maxWidth="440px" (close)="showOptions.set(false)">
        <div class="opt-group" role="group" aria-labelledby="opt-type-label">
          <span class="opt-label" id="opt-type-label">Type</span>
          <div class="seg">
            @for (t of sessionTypes; track t.value) {
              <button type="button" class="seg-btn" [class.active]="sessionType() === t.value" [attr.aria-pressed]="sessionType() === t.value" (click)="setSessionType(t.value)">{{ t.label }}</button>
            }
          </div>
          <p class="opt-help">{{ typeHelp() }}</p>
        </div>

        <div class="opt-group" role="group" aria-labelledby="opt-unit-label">
          <span class="opt-label" id="opt-unit-label">Units</span>
          <div class="seg">
            @for (u of units; track u) {
              <button type="button" class="seg-btn" [class.active]="settingsService.weightUnit() === u" [attr.aria-pressed]="settingsService.weightUnit() === u" (click)="toggleUnit(u)">{{ u }}</button>
            }
          </div>
          <p class="opt-help">Your account's unit, the same one as in Settings.</p>
        </div>

        @if (!fix) {
        <div class="opt-group" role="group" aria-labelledby="opt-rest-label">
          <span class="opt-label" id="opt-rest-label">Rest timer</span>
          <div class="seg">
            @for (d of restPresets; track d) {
              <button type="button" class="seg-btn" [class.active]="restSetting() === d" [attr.aria-pressed]="restSetting() === d" (click)="setRestDefault(d)">{{ restPresetLabel(d) }}</button>
            }
          </div>
          <p class="opt-help">Starts after each logged set. Remembered for next time.</p>
        </div>
        }

        <div class="opt-actions">
          <button type="button" class="opt-row" (click)="showOptions.set(false); showTemplateSave.set(true)">
            <jiro-icon name="floppy-disk" [size]="18" />
            <span class="opt-row-text">Save as template</span>
          </button>
          @if (!fix) {
          <button type="button" class="opt-row" (click)="exitSession()">
            <jiro-icon name="sign-out" [size]="18" />
            <span class="opt-row-text">Leave for now<small>The workout stays open. Resume it from Jym.</small></span>
          </button>
          <button type="button" class="opt-row opt-row--danger" [disabled]="discarding()" (click)="discardSession()">
            <jiro-icon name="trash" [size]="18" />
            <span class="opt-row-text">{{ discarding() ? 'Discarding...' : 'Discard workout' }}</span>
          </button>
          }
        </div>
      </jiro-modal>
    }

    @if (showTemplateSave()) {
      <jym-save-template-dialog [sessionId]="sessionId" (close)="showTemplateSave.set(false)" />
    }

    <!-- One set: warm-up or working, and remove -->
    @if (setSheetRow(); as ref) {
      <jiro-modal sheet [title]="'Set ' + ref.row.setNumber" maxWidth="400px" (close)="setSheet.set(null)">
        <p class="sheet-sub">{{ ref.summary }}</p>
        <div class="opt-actions opt-actions--plain">
          <button type="button" class="opt-row" (click)="toggleWarmupFromSheet()">
            <jiro-icon name="fire" [size]="18" />
            <span class="opt-row-text">
              {{ ref.row.isWarmup ? 'Make it a working set' : 'Mark as warm-up' }}
              <small>{{ ref.row.isWarmup ? 'It counts for volume and records again.' : "Warm-ups don't count for volume or records." }}</small>
            </span>
          </button>
          <button type="button" class="opt-row opt-row--danger" (click)="removeSetFromSheet()">
            <jiro-icon name="trash" [size]="18" />
            <span class="opt-row-text">Remove set</span>
          </button>
        </div>
      </jiro-modal>
    }

    <!-- Plates for one side of the bar, from the account's bar and plates -->
    @if (platesOpen()) {
      <jiro-modal sheet title="Plates" maxWidth="420px" (close)="platesOpen.set(false)">
        <label class="field-label" for="plates-weight">Weight ({{ settingsService.unitLabel() }})</label>
        <input
          id="plates-weight"
          class="plates-input"
          type="text"
          inputmode="decimal"
          enterkeyhint="done"
          autocomplete="off"
          [ngModel]="platesWeight()"
          (ngModelChange)="platesWeight.set($event)"
          (keydown.enter)="$any($event.target).blur()" />

        @let r = plateResult();
        <div class="plates-result" aria-live="polite">
          @if (r.kind === 'plates') {
            <div class="plate-stack" role="img" [attr.aria-label]="'Each side: ' + r.side.join(', ') + ' ' + settingsService.unitLabel()">
              <span class="plate-sleeve" aria-hidden="true"></span>
              @for (p of r.side; track $index) {
                <span class="plate" aria-hidden="true" [style.height.px]="plateHeight(p)">{{ p }}</span>
              }
            </div>
            <p class="plates-line">Each side: {{ r.side.join(', ') }}</p>
          } @else if (r.kind === 'bar') {
            <p class="plates-line">Just the bar.</p>
          } @else if (r.kind === 'light') {
            <p class="plates-line">That's lighter than the bar.</p>
          } @else if (r.kind === 'near') {
            <p class="plates-line">Your plates can't make exactly {{ platesWeight() }} {{ settingsService.unitLabel() }}. The closest you can load:</p>
            <div class="near-chips">
              @for (w of r.near; track w) {
                <button type="button" class="near-chip" (click)="platesWeight.set('' + w)">{{ w }} {{ settingsService.unitLabel() }}</button>
              }
            </div>
          } @else {
            <p class="plates-line plates-muted">Type a weight to see the plates for each side.</p>
          }
        </div>

        <p class="plates-bar">
          On a {{ currentPlates().bar }} {{ settingsService.unitLabel() }} bar.
          <a class="plates-link" routerLink="/settings" fragment="workouts" (click)="platesOpen.set(false)">Change bar and plates</a>
        </p>
      </jiro-modal>
    }


    <!-- Exercise picker -->
    @if (showExPicker()) {
      <jiro-modal [title]="creatingExercise() ? 'New exercise' : 'Add exercise'" maxWidth="480px" (close)="showExPicker.set(false)">
        @if (!creatingExercise()) {
          <input class="picker-search" type="text" [(ngModel)]="exSearch" (input)="filterExercises()" placeholder="Search exercises..." aria-label="Search exercises" autofocus />
          <div class="picker-list">
            @for (ex of filteredExercises(); track ex.id) {
              <button type="button" class="picker-item" (click)="pickExercise(ex)">
                <span class="pi-name">{{ ex.name }}</span>
                @if (ex.muscle_group) {
                  <span class="pi-mg">{{ ex.muscle_group }}</span>
                }
              </button>
            }
            @if (filteredExercises().length === 0 && exSearch.trim()) {
              <p class="picker-none">Nothing matches "{{ exSearch.trim() }}".</p>
            }
            <!-- Create shortcut: always at the bottom, name pre-filled from the search -->
            <button type="button" class="picker-create-btn" (click)="startCreateExercise()">
              <jiro-icon name="plus" [size]="14" />
              @if (exSearch.trim()) {
                <span>Create "{{ exSearch.trim() }}"</span>
              } @else {
                <span>New exercise</span>
              }
            </button>
          </div>
        } @else {
          <button type="button" class="back-btn" (click)="creatingExercise.set(false)">
            <jiro-icon name="caret-left" [size]="14" /> Back to search
          </button>
          <div class="create-form">
            <label class="create-label" for="new-ex-name">Name</label>
            <input
              id="new-ex-name"
              class="picker-search"
              type="text"
              [(ngModel)]="newExName"
              placeholder="e.g. Romanian Deadlift"
              (keydown.enter)="!newExSaving() && newExName.trim() && createAndPickExercise()"
            />
            <label class="create-label" for="new-ex-mg" style="margin-top:var(--space-sm)">Muscle group <span class="optional">(optional)</span></label>
            <select id="new-ex-mg" class="create-select" [(ngModel)]="newExMuscleGroup">
              <option value="">None</option>
              @for (mg of muscleGroups; track mg) {
                <option [value]="mg">{{ mg }}</option>
              }
            </select>
            @if (newExError()) {
              <div class="template-save-error">{{ newExError() }}</div>
            }
            <jiro-button
              block
              type="button"
              style="margin-top:var(--space-md)"
              [disabled]="!newExName.trim()"
              [loading]="newExSaving()"
              (click)="createAndPickExercise()">
              {{ newExSaving() ? 'Creating...' : 'Create and add to session' }}
            </jiro-button>
          </div>
        }
      </jiro-modal>
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

    /* Rest timer row */
    .rest-row {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-xs) var(--space-xl) calc(var(--space-xs) + 3px);
      background: rgba(var(--shadow-rgb), 0.18);
      border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      position: relative; overflow: hidden;
      transition: background 0.4s;
    }

    .rest-row.rest-done { background: rgba(var(--color-accent-rgb), 0.45); }

    .rest-label {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 1px; opacity: 0.8; font-weight: 500; white-space: nowrap;
    }

    .rest-countdown {
      font-size: var(--font-size-lg); font-weight: 700;
      font-variant-numeric: tabular-nums; min-width: 52px; margin-right: auto;
    }

    .rest-btn {
      min-height: 44px; min-width: 64px; padding: 0 var(--space-md); border-radius: var(--border-radius-pill);
      border: 1px solid color-mix(in srgb, currentColor 40%, transparent); background: none;
      color: inherit; font-size: var(--font-size-sm); font-weight: 600; font-family: inherit;
      cursor: pointer; white-space: nowrap; transition: background 0.15s, border-color 0.15s;
    }
    .rest-btn:hover { background: color-mix(in srgb, currentColor 12%, transparent); border-color: color-mix(in srgb, currentColor 75%, transparent); }

    .template-save-error {
      font-size: var(--font-size-sm); color: var(--color-negative); margin-top: var(--space-xs);
    }

    /* Workout options sheet */
    .opt-group { margin-bottom: var(--space-lg); }
    .opt-label { display: block; font-size: var(--font-size-sm); font-weight: 600; margin-bottom: var(--space-xs); }
    .opt-help { font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: var(--space-xs); line-height: 1.5; }

    .seg {
      display: flex; border: 1px solid var(--border-color); border-radius: var(--border-radius);
      overflow: hidden; background: var(--bg-surface);
    }
    .seg-btn {
      flex: 1; min-height: 44px; padding: 0 var(--space-xs);
      background: none; border: none; color: var(--text-primary);
      font-size: var(--font-size-sm); font-family: inherit; cursor: pointer; white-space: nowrap;
    }
    .seg-btn + .seg-btn { border-left: 1px solid var(--border-color); }
    .seg-btn:hover:not(.active) { background: var(--bg-surface-hover); }
    .seg-btn.active { background: var(--color-primary); color: var(--text-on-primary); font-weight: 600; }

    .opt-actions { border-top: 1px solid var(--border-color); padding-top: var(--space-sm); display: flex; flex-direction: column; }
    .opt-row {
      display: flex; align-items: center; gap: var(--space-md); width: 100%;
      min-height: 52px; padding: var(--space-sm) var(--space-xs);
      background: none; border: none; border-radius: var(--border-radius);
      color: var(--text-primary); font-size: var(--font-size-md); font-family: inherit;
      text-align: left; cursor: pointer;
    }
    .opt-row:hover:not(:disabled) { background: var(--bg-surface-hover); }
    .opt-row:disabled { opacity: 0.6; cursor: not-allowed; }
    .opt-row jiro-icon { color: var(--text-secondary); flex-shrink: 0; }
    .opt-row-text { display: flex; flex-direction: column; gap: 2px; }
    .opt-row-text small { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .opt-row--danger, .opt-row--danger jiro-icon { color: var(--color-negative); }

    .rest-progress {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 3px; background: color-mix(in srgb, currentColor 15%, transparent);
    }

    .rest-progress-fill {
      height: 100%; background: color-mix(in srgb, currentColor 75%, transparent);
      transition: width 1s linear;
    }

    .rest-row.rest-done .rest-progress-fill { background: var(--color-positive); }

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
    .block-actions .del-btn { border: none; background: transparent; }

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

    .sheet-sub { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-sm); }

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

    /* Plates sheet */
    .plates-input {
      width: 100%; box-sizing: border-box; min-height: 48px; padding: 10px 12px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-lg); font-weight: 600; font-family: inherit; font-variant-numeric: tabular-nums;
    }
    .plates-input:focus { border-color: var(--color-primary); }
    .plates-result { min-height: 132px; padding: var(--space-md) 0 var(--space-sm); }
    .plate-stack {
      position: relative; display: flex; align-items: center; gap: 4px;
      height: 88px; padding-left: var(--space-lg);
    }
    .plate-sleeve {
      position: absolute; left: 0; right: 0; top: 50%; height: 8px; transform: translateY(-50%);
      background: var(--border-color); border-radius: var(--border-radius-pill);
    }
    .plate {
      position: relative; display: inline-flex; align-items: center; justify-content: center;
      min-width: 32px; padding: 0 4px; border-radius: var(--border-radius-sm);
      background: var(--text-primary); color: var(--bg-surface);
      font-size: var(--font-size-xs); font-weight: 700; font-variant-numeric: tabular-nums;
    }
    .plates-line { font-size: var(--font-size-md); font-weight: 600; margin-top: var(--space-sm); font-variant-numeric: tabular-nums; }
    .plates-muted { color: var(--text-secondary); font-weight: 400; }
    .near-chips { display: flex; gap: var(--space-sm); margin-top: var(--space-sm); }
    .near-chip {
      min-height: 44px; padding: 0 var(--space-md);
      border: 1px solid var(--color-primary); border-radius: var(--border-radius-pill);
      background: none; color: var(--color-primary);
      font-family: inherit; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    }
    .plates-bar { font-size: var(--font-size-sm); color: var(--text-secondary); border-top: 1px solid var(--border-color); padding-top: var(--space-sm); }
    .plates-link { display: inline-flex; align-items: center; min-height: 44px; color: var(--color-primary); font-weight: 600; }
    .opt-actions--plain { border-top: none; padding-top: 0; }

    .del-btn {
      width: 44px; height: 44px; border-radius: var(--border-radius-sm);
      background: none; color: var(--text-muted); border: 1px solid var(--border-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }

    .del-btn:hover { color: var(--color-danger); border-color: var(--color-danger); }

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

    /* Exercise picker (inside jiro-modal) */
    .picker-search {
      width: 100%; box-sizing: border-box;
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-canvas);
      color: var(--text-primary); font-size: var(--font-size-md);
      font-family: inherit;
    }
    .picker-search:focus { border-color: var(--color-primary); }

    .picker-list { max-height: 50dvh; overflow-y: auto; margin-top: var(--space-sm); }

    .picker-item {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm);
      width: 100%; min-height: 44px; padding: var(--space-sm) var(--space-md);
      background: none; border: none; border-radius: var(--border-radius);
      cursor: pointer; text-align: left; font-family: inherit; transition: background 0.15s;
    }
    .picker-item:hover { background: var(--bg-surface-hover); }

    .pi-name { font-size: var(--font-size-md); color: var(--text-primary); font-weight: 500; }
    .pi-mg { font-size: var(--font-size-xs); color: var(--text-muted); white-space: nowrap; }

    .picker-none { padding: var(--space-md); font-size: var(--font-size-sm); color: var(--text-muted); text-align: center; }

    .picker-create-btn {
      display: flex; align-items: center; gap: var(--space-xs);
      width: 100%; min-height: 44px; padding: var(--space-sm) var(--space-md);
      background: none; border: none; border-top: 1px solid var(--border-color);
      color: var(--color-primary); font-size: var(--font-size-sm);
      font-weight: 500; cursor: pointer; text-align: left;
      font-family: inherit; margin-top: var(--space-xs);
      transition: background 0.15s;
    }
    .picker-create-btn:hover { background: rgba(var(--color-primary-rgb), 0.06); }

    .back-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: none; min-height: 44px; padding: 0; margin-bottom: var(--space-xs);
      color: var(--text-secondary); font-size: var(--font-size-sm); font-family: inherit; cursor: pointer;
    }
    .back-btn:hover { color: var(--text-primary); }

    .create-form { display: flex; flex-direction: column; }
    .create-label {
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-secondary); margin-bottom: 6px; display: block;
    }
    .create-label .optional { color: var(--text-muted); font-weight: 400; }
    .create-select {
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-canvas);
      color: var(--text-primary); font-size: var(--font-size-md);
      font-family: inherit; width: 100%;
    }
    .create-select:focus { border-color: var(--color-primary); }

    /* ── Mobile responsive ── */
    @media (max-width: 768px) {
      .session-bar {
        margin: calc(-1 * var(--space-md));
        margin-bottom: var(--space-md);
      }

      /* One row on a phone too: the clock on the left, options and Finish on the right. */
      .session-bar-row { padding: var(--space-xs) var(--space-md); }

      .rest-row { padding: var(--space-xs) var(--space-md) calc(var(--space-xs) + 3px); }

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
  loading = signal(true);
  finishing = signal(false);
  emptySessionError = signal<string | null>(null);
  showExPicker = signal(false);
  showOptions = signal(false);
  discarding = signal(false);
  showTemplateSave = signal(false);
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  removingBlock = signal<number | null>(null);

  readonly sessionTypes = [
    { value: 'normal', label: 'Normal' },
    { value: 'deload', label: 'Deload' },
    { value: 'test', label: 'Test' },
  ];
  readonly units = ['lbs', 'kg'];
  readonly typeHelp = computed(() => ({
    deload: "A lighter workout. It doesn't set records or change next time's suggestion.",
    test: "A max attempt. Records count, but next time's suggestion ignores it.",
  } as Record<string, string>)[this.sessionType()] ?? "Counts for records and next time's suggestion.");

  // Inline exercise creation
  creatingExercise = signal(false);
  newExName = '';
  newExMuscleGroup = '';
  newExSaving = signal(false);
  newExError = signal('');
  readonly muscleGroups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Other'];
  bwSaving = signal(false);
  bwLogged = signal(false);
  bwValue = '';
  blocks = signal<ExerciseBlock[]>([]);
  elapsedDisplay = signal('0:00');
  sessionType = signal<string>('normal');

  /** Collapsed exercises by id, so removing one never shifts which are closed. */
  collapsedBlocks = signal<Set<string>>(new Set());
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
  /** Set when the workout was opened after hours with nothing logged; "Keep going" clears it. */
  readonly stale = signal<{ started: string; lastSet: string | null; lastSetTime: string; lastSetAt: string | null } | null>(null);

  // Plates: the account's bar and plate sizes for the unit in use.
  readonly currentPlates = computed(() => platesFor(this.settingsService.weightUnit(), this.settingsService.plates()));
  readonly platesOpen = signal(false);
  readonly platesWeight = signal('');
  readonly plateResult = computed(() => {
    const weight = parseDecimal(this.platesWeight());
    const set = this.currentPlates();
    const none = { side: [] as number[], near: [] as number[] };
    if (weight === null || weight <= 0) return { kind: 'none', ...none };
    if (weight < set.bar) return { kind: 'light', ...none };
    const side = platesPerSide(weight, set);
    if (side) return { kind: side.length ? 'plates' : 'bar', ...none, side };
    const { below, above } = nearestLoadable(weight, set);
    return { kind: 'near', ...none, near: [below, above].filter((w): w is number => w !== null) };
  });
  // Warm-up ramps keyed by exercise and inputs, so change detection doesn't redo the plate maths.
  private readonly rampCache = new Map<string, { key: string; ramp: { weight: number; reps: number }[] | null }>();
  allExercises = signal<{ id: string; name: string; muscle_group: string | null }[]>([]);
  filteredExercises = signal<{ id: string; name: string; muscle_group: string | null }[]>([]);
  exSearch = '';
  sessionNotes = '';

  // Rest timer: restLength is this rest (+30s grows it); restSetting is how long every rest starts at.
  restTimerActive = signal(false);
  restTimerRemaining = signal(0);
  restLength = signal(90);
  restTimerDone = signal(false);
  readonly restPresets = [60, 90, 120, 180, 300];
  private readonly restChoice = signal<number | null>(null);
  readonly restSetting = computed(() => this.restChoice() ?? this.settingsService.restSeconds());
  private restInterval: ReturnType<typeof setInterval> | null = null;
  private restHideTimer: ReturnType<typeof setTimeout> | null = null;
  private restStartedAt: Date | null = null;
  private audioCtx: AudioContext | null = null;

  sessionId = '';
  /** Fixing a finished workout (route data `fix`): no clock, rest, draft or Finish; sets are fixed in. */
  fix = false;
  readonly fixDate = signal('');
  private startedAt = new Date();
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Form check upload state (keyed by exerciseId)
  formCheckUploading = signal<Map<string, boolean>>(new Map());
  formCheckProgressMap = signal<Map<string, number>>(new Map());
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

  // Plan exercises (routine targets), and those removed from the plan on this device.
  private targetIds = new Set<string>();
  private targetById = new Map<string, RoutineItem>();
  private removedTargets = new Set<string>();
  private draftReady = false;
  private closed = false;
  private draftTimer: ReturnType<typeof setTimeout> | null = null;
  // Structural changes (added, removed, logged) reach the draft; typing goes through saveDraftSoon().
  private readonly draftOnChange = effect(() => {
    this.blocks();
    if (this.draftReady) this.saveDraft();
  });

  // Re-sync both timers when the user returns from a locked screen; save the draft when leaving.
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.tickRestTimer();
      this.updateElapsed();
    } else {
      this.flushDraft();
    }
  };

  constructor(
    private jymService: JymService,
    private uploadService: UploadService,
    private route: ActivatedRoute,
    private router: Router,
    public settingsService: SettingsService,
    private authService: AuthService,
  ) { }

  ngOnInit() {
    this.sessionId = this.route.snapshot.paramMap.get('id') || '';
    this.fix = this.route.snapshot.data['fix'] === true;
    if (!this.fix) {
      this.startTimer();
      document.addEventListener('visibilitychange', this.onVisibilityChange);
    }

    // Load all exercises for the picker
    this.jymService.listExercises().subscribe(exs => {
      this.allExercises.set(exs);
      this.filteredExercises.set(exs);
    });

    // Load session + sets (restores mid-workout state on page refresh)
    this.jymService.getSession(this.sessionId).subscribe({
      next: session => {
        if (session.ended_at && !this.fix) {
          this.closeDraft();
          this.openSummary();
          return;
        }
        // Only a finished workout is fixed; an open one is simply resumed.
        if (this.fix && !session.ended_at) {
          this.router.navigate(['/jym/session', this.sessionId], { replaceUrl: true });
          return;
        }
        if (this.fix) {
          const tz = this.settingsService.timezone();
          this.fixDate.set(`${formatInstant(session.started_at, tz, { weekday: true })}, ${timeInZone(session.started_at, tz)}`);
        }
        this.startedAt = new Date(session.started_at);
        if (!this.fix) this.noteIfStale(session.started_at, session.sets ?? []);
        this.sessionType.set(session.session_type || 'normal');
        this.sessionNotes = session.notes || '';
        this.blocks.set(this.restoreBlocks(session.sets || [], session.targets ?? []));
        // A fix is saved set by set; only a live workout keeps a device draft.
        this.draftReady = !this.fix;

        // Populate form check counts from existing attachments
        const amap = new Map<string, SessionAttachment[]>();
        for (const a of session.attachments ?? []) {
          if (a.exercise_id) {
            const arr = amap.get(a.exercise_id) ?? [];
            arr.push(a);
            amap.set(a.exercise_id, arr);
          }
        }
        this.blockAttachments.set(amap);

        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  ngOnDestroy() {
    this.flushDraft();
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.clearRestTimer();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  // ── Rest timer ──────────────────────────────────────────────────
  startRestTimer(seconds = this.restSetting()) {
    this.clearRestTimer();
    this.warmUpAudio();
    this.restStartedAt = new Date();
    this.restLength.set(seconds);
    this.restTimerRemaining.set(seconds);
    this.restTimerDone.set(false);
    this.restTimerActive.set(true);
    // Tick at 500ms so the display snaps quickly after screen unlock
    this.restInterval = setInterval(() => this.tickRestTimer(), 500);
  }

  // Call during a user gesture so the AudioContext is created/unlocked while
  // the browser permits it — avoids the "play blocked, no user gesture" error
  // that fires when we try to create one from the timer callback.
  private warmUpAudio() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      // Unlock immediately if it was suspended (happens after screen lock)
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (_) {}
  }

  private tickRestTimer() {
    if (!this.restStartedAt) return;
    const elapsed = Math.floor((Date.now() - this.restStartedAt.getTime()) / 1000);
    const rem = Math.max(0, this.restLength() - elapsed);
    this.restTimerRemaining.set(rem);
    if (rem <= 0 && !this.restTimerDone()) {
      this.clearRestTimer();
      this.restTimerDone.set(true);
      this.playBeep();
      // Kept so a rest started in these 3 s isn't hidden by the old one.
      this.restHideTimer = setTimeout(() => {
        this.restHideTimer = null;
        this.restTimerActive.set(false);
        this.restTimerDone.set(false);
      }, 3000);
    }
  }

  private clearRestTimer() {
    if (this.restInterval) { clearInterval(this.restInterval); this.restInterval = null; }
    if (this.restHideTimer) { clearTimeout(this.restHideTimer); this.restHideTimer = null; }
    this.restStartedAt = null;
  }

  skipRestTimer() {
    this.clearRestTimer();
    this.restTimerActive.set(false);
    this.restTimerDone.set(false);
  }

  /** Every rest's length, remembered on the account; applied at once, reverted if the save fails. */
  setRestDefault(seconds: number) {
    if (seconds === this.restSetting()) return;
    this.restChoice.set(seconds);
    if (this.restTimerActive() && !this.restTimerDone()) this.startRestTimer(seconds);
    this.authService.updateSettings({ rest_seconds: seconds }).subscribe({
      next: () => this.restChoice.set(null),
      error: () => {
        this.restChoice.set(null);
        this.toast.error('Could not save the rest timer.');
      },
    });
  }

  /** Lengthens this rest only; after the beep it starts a fresh rest of that length. */
  addRestTime(seconds: number) {
    if (this.restTimerDone()) {
      this.startRestTimer(seconds);
    } else {
      this.restLength.update(d => d + seconds);
      this.restTimerRemaining.update(r => r + seconds);
    }
  }

  restTimerDisplay(): string {
    const s = this.restTimerRemaining();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  restPresetLabel(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m}:${String(s).padStart(2, '0')}` : `${m}m`;
  }

  private playBeep() {
    // Vibrate: short-pause-short-pause-long (works even with silent mode on Android)
    try { navigator.vibrate?.([150, 80, 150, 80, 400]); } catch (_) {}

    // Audio ping: three ascending tones using the pre-warmed context
    try {
      const ctx = this.audioCtx;
      if (!ctx) return;
      // resume() is async — schedule tones only after the context is running
      const play = () => {
        const tones = [660, 880, 1100];
        tones.forEach((freq, i) => {
          const offset = i * 0.22;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.35);
        });
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(play);
      } else {
        play();
      }
    } catch (_) { /* audio not supported */ }
  }

  private startTimer() {
    this.timerInterval = setInterval(() => this.updateElapsed(), 1000);
  }

  private updateElapsed() {
    const elapsed = Math.max(0, Math.floor((Date.now() - this.startedAt.getTime()) / 1000));
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

  private buildBlocksFromSets(sets: import('../../../core/services/jym.service').SessionSet[]): ExerciseBlock[] {
    const blockMap = new Map<string, ExerciseBlock>();
    for (const s of sets) {
      if (!blockMap.has(s.exercise_id)) {
        blockMap.set(s.exercise_id, {
          exerciseId: s.exercise_id,
          exerciseName: s.exercise_name,
          muscleGroup: s.muscle_group,
          sets: [],
          ghostSets: [],
          suggestion: null,
          exerciseNote: s.exercise_note || '',
        });
      }
      blockMap.get(s.exercise_id)!.sets.push({
        setNumber: s.set_number,
        weight: String(this.settingsService.toDisplay(s.weight)),
        weightKg: s.weight,
        reps: String(s.reps_performed),
        rpe: s.rpe != null ? String(s.rpe) : '',
        saved: true,
        isPR: s.is_pr,
        saving: false,
        id: s.id,
        ghostWeight: '',
        ghostReps: '',
        isWarmup: s.is_warmup,
      });
    }
    return Array.from(blockMap.values());
  }

  setSessionType(type: string) {
    const previous = this.sessionType();
    this.sessionType.set(type);
    this.jymService.updateSession(this.sessionId, { session_type: type }).subscribe({
      // Deload sets never count, so the type can move PR badges.
      next: () => this.refreshPrBadges(),
      error: err => {
        if (this.handleEnded(err)) return;
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

  rpeInvalid(rpe: string): boolean {
    const v = parseWhole(rpe);
    return v === null || v < 1 || v > 10;
  }

  /** A new row's ghosts: the last logged working set, else the suggestion the other rows carry; never a warm-up. */
  addSet(blockIndex: number) {
    const block = this.blocks()[blockIndex];
    const working = block.sets.filter(s => !s.isWarmup);
    const lastLogged = working.filter(s => s.saved).at(-1);
    const suggested = working.filter(s => !s.saved).at(-1);
    const newRow = this.newRow(block.sets.length + 1, {
      ghostWeight: lastLogged?.weight ?? suggested?.ghostWeight ?? '',
      ghostReps: lastLogged?.reps ?? suggested?.ghostReps ?? '',
    });
    this.blocks.update(bs => bs.map((b, i) => i === blockIndex ? { ...b, sets: [...b.sets, newRow] } : b));
  }

  logSet(blockIndex: number, setIndex: number) {
    this.persistRow(blockIndex, setIndex, true);
  }

  /** Saves one typed row; resolves false when it didn't save. */
  private persistRow(blockIndex: number, setIndex: number, startRest: boolean): Promise<boolean> {
    const block = this.blocks()[blockIndex];
    const row = block?.sets[setIndex];
    if (!row || !this.canLog(row)) return Promise.resolve(false);
    // Typed values win, a typed 0 included; otherwise the ghosts the row shows.
    const weightNum = parseDecimal(filled(row.weight) ? row.weight : row.ghostWeight)!;
    const repsNum = parseWhole(filled(row.reps) ? row.reps : row.ghostReps)!;
    const weight = String(weightNum);
    const reps = String(repsNum);

    // Warm up audio NOW, synchronously while the tap gesture is still active.
    // Safari blocks AudioContext creation/resume in async callbacks (e.g. HTTP responses).
    this.warmUpAudio();

    this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
      ...b,
      sets: b.sets.map((s, si) => si === setIndex ? { ...s, weight, reps, saving: true } : s),
    } : b));

    const req: CreateSetRequest = {
      exercise_id: block.exerciseId,
      set_number: row.setNumber,
      weight: this.settingsService.toKg(weightNum),
      reps_performed: repsNum,
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
            } : s),
          } : b));
          if (startRest && !this.fix) this.startRestTimer();
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

  deleteSet(blockIndex: number, setIndex: number) {
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

  async removeBlock(blockIndex: number) {
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
        if (this.targetIds.has(block.exerciseId)) this.removedTargets.add(block.exerciseId);
        this.collapsedBlocks.update(set => { const next = new Set(set); next.delete(block.exerciseId); return next; });
        this.blocks.update(bs => bs.filter((_, bi) => bi !== blockIndex));
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

  /** Leaves the workout open: logged sets are on the server, typed ones in this device's draft. */
  exitSession() {
    this.showOptions.set(false);
    this.router.navigate(['/jym']);
  }

  async discardSession() {
    const logged = this.blocks().reduce((n, b) => n + b.sets.filter(s => s.saved).length, 0);
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
    this.jymService.deleteSession(this.sessionId).subscribe({
      next: () => {
        this.closeDraft();
        this.router.navigate(['/jym']);
      },
      error: () => {
        this.discarding.set(false);
        this.toast.error('Could not discard the workout.');
      },
    });
  }

  saveNotes() {
    this.jymService.updateSession(this.sessionId, { notes: this.sessionNotes }).subscribe({
      error: err => { if (!this.handleEnded(err)) this.toast.error('Could not save the session notes.'); },
    });
  }

  /** Typed rows that weren't ticked: log them, skip them, or stay. Resolves false to stay. */
  private async settleTypedRows(action: string): Promise<boolean> {
    const pending = this.unloggedRows();
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
        if (!(await this.persistRow(bi, si, false))) return false;
      }
    }
    return true;
  }

  /** Done fixing: back to the summary in place of this page, keeping where the summary returns to. */
  async doneFixing() {
    if (!(await this.settleTypedRows('finish'))) return;
    const back = (history.state as { back?: unknown } | null)?.back;
    this.router.navigate(['/jym/sessions', this.sessionId, 'summary'], {
      replaceUrl: true,
      state: typeof back === 'string' ? { back } : {},
    });
  }

  async finishSession() {
    if (!(await this.settleTypedRows('finish'))) return;

    const hasSavedSets = this.blocks().some(b => b.sets.some(s => s.saved));
    if (!hasSavedSets && !this.sessionNotes.trim()) {
      this.emptySessionError.set('Nothing to save. Log at least one set or add session notes first.');
      return;
    }
    this.emptySessionError.set(null);
    this.finishing.set(true);
    this.jymService.updateSession(this.sessionId, {
      ended_at: new Date().toISOString(),
      notes: this.sessionNotes,
    }).subscribe({
      next: () => {
        this.closeDraft();
        // Replaced, so Back from the summary skips the finished player.
        this.router.navigate(['/jym/sessions', this.sessionId, 'summary'], { replaceUrl: true, state: { from: 'finish' } });
      },
      error: err => {
        this.finishing.set(false);
        if (!this.handleEnded(err)) this.toast.error('Could not finish the workout. Check your connection and try again.');
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
    this.jymService.updateSession(this.sessionId, { ended_at: endedAt, notes: this.sessionNotes }).subscribe({
      next: () => {
        this.closeDraft();
        this.router.navigate(['/jym/sessions', this.sessionId, 'summary'], { replaceUrl: true, state: { from: 'finish' } });
      },
      error: err => {
        this.finishing.set(false);
        if (!this.handleEnded(err)) this.toast.error('Could not finish the workout. Try again.');
      },
    });
  }

  /** A finished workout opens as its summary, never as a live workout. */
  private openSummary() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.router.navigate(['/jym/sessions', this.sessionId, 'summary'], { replaceUrl: true });
  }

  /** The API refuses writes to a finished session (e.g. finished in another tab). */
  private handleEnded(err: unknown): boolean {
    const code = (err as { status?: number; error?: { error?: { code?: string } } })?.error?.error?.code;
    if (code !== 'SESSION_ENDED') return false;
    this.closeDraft();
    this.toast.error('This workout was already finished.');
    this.openSummary();
    return true;
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

  /** The weight an exercise works at next: the first unlogged working row, typed or ghosted, else the last logged. */
  private workingWeight(block: ExerciseBlock): number | null {
    const next = block.sets.find(s => !s.saved && !s.isWarmup);
    const typed = next ? parseDecimal(filled(next.weight) ? next.weight : next.ghostWeight) : null;
    if (typed !== null) return typed;
    const last = block.sets.filter(s => s.saved && !s.isWarmup).at(-1);
    return last ? parseDecimal(last.weight) : null;
  }

  /** Warm-up sets to offer: before anything is logged or marked warm-up, and only above the bar. */
  warmupRampFor(block: ExerciseBlock): { weight: number; reps: number }[] | null {
    if (block.sets.some(s => s.saved || s.isWarmup)) return null;
    const work = this.workingWeight(block);
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

  rampSummary(ramp: { weight: number; reps: number }[]): string {
    return ramp.map(r => `${r.weight} × ${r.reps}`).join(', ');
  }

  /** Inserts the ramp as typed warm-up rows above the working rows; each then logs with one tap. */
  addWarmups(bi: number, ramp: { weight: number; reps: number }[]) {
    this.blocks.update(bs => bs.map((b, i) => i !== bi ? b : {
      ...b,
      sets: [
        ...ramp.map(r => this.newRow(0, { weight: String(r.weight), reps: String(r.reps), isWarmup: true })),
        ...b.sets,
      ].map((s, n) => ({ ...s, setNumber: n + 1 })),
    }));
  }

  openPlates(block: ExerciseBlock) {
    const weight = this.workingWeight(block);
    this.platesWeight.set(weight === null ? '' : String(weight));
    this.platesOpen.set(true);
  }

  /** A plate drawn taller the heavier it is, against the heaviest size on hand. */
  plateHeight(plate: number): number {
    const heaviest = Math.max(...this.currentPlates().sizes);
    return Math.round(32 + 52 * (plate / heaviest));
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

  toggleWarmup(bi: number, si: number) {
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
    const note = block.exerciseNote || undefined;
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

  addExercise() {
    this.exSearch = '';
    this.creatingExercise.set(false);
    this.filteredExercises.set(this.allExercises());
    this.showExPicker.set(true);
  }

  startCreateExercise() {
    this.newExName = this.exSearch.trim();
    this.newExMuscleGroup = '';
    this.newExError.set('');
    this.creatingExercise.set(true);
  }

  createAndPickExercise() {
    const name = this.newExName.trim();
    if (!name) return;
    this.newExSaving.set(true);
    this.newExError.set('');
    this.jymService.createExercise({
      name,
      muscle_group: this.newExMuscleGroup || undefined,
    }).subscribe({
      next: ex => {
        // Add to local library so it appears in future searches this session
        const entry = { id: ex.id, name: ex.name, muscle_group: ex.muscle_group };
        this.allExercises.update(list => [...list, entry]);
        this.newExSaving.set(false);
        this.creatingExercise.set(false);
        this.showExPicker.set(false);
        this.pickExercise(entry);
      },
      error: () => {
        this.newExSaving.set(false);
        this.newExError.set('Could not create exercise. The name may already be taken.');
      },
    });
  }

  filterExercises() {
    const q = this.exSearch.toLowerCase();
    this.filteredExercises.set(this.allExercises().filter(e =>
      e.name.toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q)
    ));
  }

  pickExercise(ex: { id: string; name: string; muscle_group: string | null }) {
    this.showExPicker.set(false);
    const existing = this.blocks().find(b => b.exerciseId === ex.id);
    if (existing) return;

    this.removedTargets.delete(ex.id);
    // A plan exercise added back comes back with its plan.
    const target = this.targetById.get(ex.id);
    const newBlock = target ? this.blockFromTarget(target) : this.emptyBlock(ex.id, ex.name, ex.muscle_group, [this.newRow(1)]);
    this.blocks.update(bs => [...bs, newBlock]);

    this.loadSuggestionsForBlocks([newBlock]);
  }

  /** Deleting a set, a warm-up or a type change can move a PR to another set: re-read the flags. */
  private refreshPrBadges() {
    this.jymService.getSession(this.sessionId).subscribe({
      next: s => {
        const pr = new Map(s.sets.map(x => [x.id, x.is_pr]));
        this.blocks.update(bs => bs.map(b => ({
          ...b,
          sets: b.sets.map(r => (r.id && pr.has(r.id) ? { ...r, isPR: pr.get(r.id)! } : r)),
        })));
      },
    });
  }

  // ── Plan and draft ──────────────────────────────────────────────

  /**
   * Logged exercises in the order done, then the plan's unlogged ones, then exercises added on this device.
   * A v2 draft holds every unlogged row of an exercise, so inserted warm-ups and removed rows survive a reload;
   * without one, the plan pads each exercise to its planned sets.
   */
  private restoreBlocks(sets: SessionSet[], targets: RoutineItem[]): ExerciseBlock[] {
    const draft: SessionDraft = this.fix ? { added: [], removed: [], rows: {} } : readDraft(this.sessionId);
    const whole = draft.v === DRAFT_VERSION;
    this.targetIds = new Set(targets.map(t => t.exercise_id));
    this.removedTargets = new Set(draft.removed.filter(id => this.targetIds.has(id)));

    const logged = this.buildBlocksFromSets(sets);
    const loggedIds = new Set(logged.map(b => b.exerciseId));
    // A plan exercise logged part-way keeps its remaining planned rows, ghosted from its last working set.
    this.targetById = new Map(targets.map(t => [t.exercise_id, t]));
    for (const b of logged) {
      const t = this.targetById.get(b.exerciseId);
      if (t) b.plan = { sets: t.target_sets, reps: t.target_reps };
      const last = b.sets.filter(s => !s.isWarmup).at(-1);
      for (let n = b.sets.length + 1; t && n <= t.target_sets; n++) {
        b.sets.push(this.newRow(n, { ghostWeight: last?.weight ?? '', ghostReps: String(t.target_reps) }));
      }
    }
    const planned = targets
      .filter(t => !loggedIds.has(t.exercise_id) && !this.removedTargets.has(t.exercise_id))
      .map(t => this.blockFromTarget(t));
    const added = draft.added
      .filter(a => !loggedIds.has(a.exerciseId) && !this.targetIds.has(a.exerciseId))
      .map(a => this.emptyBlock(a.exerciseId, a.exerciseName, a.muscleGroup, [this.newRow(1)]));

    const blocks = [...logged, ...planned, ...added];
    const unit = this.settingsService.weightUnit();
    for (const b of blocks) {
      const draftRows = draft.rows[b.exerciseId];
      if (!draftRows) continue;
      const rows = draftRows.map(d => draft.unit && draft.unit !== unit ? { ...d, weight: this.convertText(d.weight, draft.unit, unit) } : d);
      if (whole) {
        // The draft's rows replace the padding; a number a logged set now holds (logged elsewhere) is dropped.
        const kept = b.sets.filter(r => r.saved);
        const taken = new Set(kept.map(r => r.setNumber));
        const last = kept.filter(r => !r.isWarmup).at(-1);
        b.sets = [...kept, ...rows.filter(d => !taken.has(d.setNumber)).map(d => this.newRow(d.setNumber, {
          weight: d.weight, reps: d.reps, rpe: d.rpe, isWarmup: d.isWarmup,
          ghostWeight: d.isWarmup ? '' : last?.weight ?? '',
          ghostReps: !d.isWarmup && b.plan ? String(b.plan.reps) : '',
        }))];
      } else {
        for (const d of rows) {
          const row = b.sets.find(r => r.setNumber === d.setNumber);
          if (row && !row.saved) Object.assign(row, { weight: d.weight, reps: d.reps, rpe: d.rpe, isWarmup: d.isWarmup });
          else if (!row) b.sets.push(this.newRow(d.setNumber, { weight: d.weight, reps: d.reps, rpe: d.rpe, isWarmup: d.isWarmup }));
        }
      }
      b.sets.sort((x, y) => x.setNumber - y.setNumber);
    }
    this.loadSuggestionsForBlocks(blocks);
    return blocks;
  }

  private newRow(setNumber: number, init: Partial<SetRow> = {}): SetRow {
    return {
      setNumber, weight: '', reps: '', rpe: '',
      saved: false, isPR: false, saving: false, id: null,
      ghostWeight: '', ghostReps: '', isWarmup: false,
      ...init,
    };
  }

  /** An unlogged plan exercise: its planned rows, with the planned reps as ghosts. */
  private blockFromTarget(t: RoutineItem): ExerciseBlock {
    return {
      ...this.emptyBlock(t.exercise_id, t.exercise_name, t.muscle_group,
        Array.from({ length: t.target_sets }, (_, i) => this.newRow(i + 1, { ghostReps: String(t.target_reps) }))),
      plan: { sets: t.target_sets, reps: t.target_reps },
    };
  }

  private emptyBlock(exerciseId: string, exerciseName: string, muscleGroup: string | null, sets: SetRow[]): ExerciseBlock {
    return { exerciseId, exerciseName, muscleGroup, sets, ghostSets: [], suggestion: null, exerciseNote: '' };
  }

  /** Rows with a weight and reps typed but not ticked; a typed 0 counts. */
  private unloggedRows(): { bi: number; si: number }[] {
    const rows: { bi: number; si: number }[] = [];
    this.blocks().forEach((b, bi) => b.sets.forEach((s, si) => {
      if (!s.saved && filled(s.weight) && filled(s.reps) && this.canLog(s)) rows.push({ bi, si });
    }));
    return rows;
  }

  /** Keeps what the server doesn't have yet for this workout, on this device: every unlogged row, empty ones too. */
  saveDraft() {
    if (this.closed || !this.draftReady) return;
    const blocks = this.blocks();
    const rows: SessionDraft['rows'] = {};
    for (const b of blocks) {
      rows[b.exerciseId] = b.sets
        .filter(s => !s.saved)
        .map(s => ({ setNumber: s.setNumber, weight: s.weight, reps: s.reps, rpe: s.rpe, isWarmup: s.isWarmup }));
    }
    writeDraft(this.sessionId, {
      v: DRAFT_VERSION,
      unit: this.settingsService.weightUnit(),
      added: blocks
        .filter(b => !this.targetIds.has(b.exerciseId) && !b.sets.some(s => s.saved))
        .map(b => ({ exerciseId: b.exerciseId, exerciseName: b.exerciseName, muscleGroup: b.muscleGroup })),
      removed: [...this.removedTargets],
      rows,
    });
  }

  /** Typing saves shortly after the last keystroke. */
  saveDraftSoon() {
    if (this.draftTimer) clearTimeout(this.draftTimer);
    this.draftTimer = setTimeout(() => {
      this.draftTimer = null;
      this.saveDraft();
    }, 300);
  }

  private flushDraft() {
    if (!this.draftTimer) return;
    clearTimeout(this.draftTimer);
    this.draftTimer = null;
    this.saveDraft();
  }

  /** The session is over (finished, discarded or ended elsewhere): drop its draft for good. */
  private closeDraft() {
    this.closed = true;
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

  getFormCheckCount(exerciseId: string): number {
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
  private suggestionFor(block: ExerciseBlock, history: SetHistory[]): { text: string; ghostWeight: string; ghostReps: string; icon: 'trend-up' | 'repeat' } | null {
    const unit = this.settingsService.unitLabel();
    const next = nextSets(history, {
      excludeSessionId: this.sessionId,
      before: this.startedAt.toISOString(),
      plan: block.plan ?? null,
      unit,
      toDisplay: kg => this.settingsService.toDisplay(kg),
    });
    if (!next) return null;

    const w = (x: number) => `${+x.toFixed(2)} ${unit}`;
    const working = next.last.filter(s => !s.warmup);
    const oneWeight = working.every(s => s.weight === working[0].weight);
    const last = working[0].weight === 0 && oneWeight
      ? `${working.map(s => s.reps).join(', ')} reps`
      : oneWeight
        ? `${w(working[0].weight)} × ${working.map(s => s.reps).join(', ')}`
        : working.map(s => `${w(s.weight)} × ${s.reps}`).join(', ');

    let advice: string;
    if (next.move === 'reps') {
      advice = `Aim for ${next.reps} reps.`;
    } else if (next.move === 'up') {
      advice = block.plan
        ? `Hit ${block.plan.sets} × ${block.plan.reps}, try ${w(next.weight)}.`
        : `Try ${w(next.weight)} × ${next.reps}.`;
    } else {
      advice = next.reason === 'plan'
        ? `Stay at ${w(next.weight)} until every set hits ${next.reps}.`
        : `That was RPE 9 or more, so stay at ${w(next.weight)} and aim for ${next.reps}.`;
    }
    return {
      text: `Last time ${last}. ${advice}`,
      ghostWeight: String(+next.weight.toFixed(2)),
      ghostReps: String(next.reps),
      icon: next.move === 'hold' ? 'repeat' : 'trend-up',
    };
  }

  /** ✓ is ready when weight and reps each read as numbers, typed (0 included) or ghosted. */
  canLog(row: SetRow): boolean {
    const weight = parseDecimal(filled(row.weight) ? row.weight : row.ghostWeight);
    const reps = parseWhole(filled(row.reps) ? row.reps : row.ghostReps);
    return !row.saving && weight !== null && reps !== null && reps >= 1
      && !(filled(row.rpe) && this.rpeInvalid(row.rpe));
  }

  logLabel(row: SetRow): string {
    const weight = filled(row.weight) ? row.weight : row.ghostWeight;
    const reps = filled(row.reps) ? row.reps : row.ghostReps;
    return filled(weight) && filled(reps)
      ? `Log set ${row.setNumber}: ${weight} ${this.settingsService.unitLabel()} × ${reps}`
      : `Log set ${row.setNumber}`;
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

  editValid(row: SetRow): boolean {
    const reps = parseWhole(row.reps);
    return parseDecimal(row.weight) !== null && reps !== null && reps >= 1 && !(filled(row.rpe) && this.rpeInvalid(row.rpe));
  }

  /** Saves a corrected set; the API re-rates the exercise, so PR badges are re-read. */
  saveEdit(bi: number, si: number) {
    const row = this.blocks()[bi]?.sets[si];
    if (!row?.id || !row.editing || row.saving || !this.editValid(row)) return;
    const before = row.before;
    if (before && row.weight === before.weight && row.reps === before.reps && row.rpe === before.rpe) {
      this.patchRow(bi, si, { editing: false, before: undefined });
      return;
    }
    const id = row.id;
    const rpe = parseWhole(row.rpe);
    const req: UpdateSetRequest = {
      weight: this.settingsService.toKg(parseDecimal(row.weight)!),
      reps_performed: parseWhole(row.reps)!,
      ...(rpe !== null ? { rpe } : {}),
    };
    this.patchSet(id, { saving: true });
    this.jymService.updateSet(id, req).subscribe({
      next: saved => {
        this.patchSet(id, {
          saving: false, editing: false, before: undefined,
          weightKg: saved.weight,
          weight: String(this.settingsService.toDisplay(saved.weight)),
          reps: String(saved.reps_performed),
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
  isShort(block: ExerciseBlock, row: SetRow): boolean {
    return !!block.plan && row.saved && !row.isWarmup && (parseWhole(row.reps) ?? 0) < block.plan.reps;
  }

  private convertText(value: string, from: string, to: string): string {
    const n = parseDecimal(value);
    return n !== null ? String(this.settingsService.convertWeight(n, from, to)) : value;
  }

  /** Logged rows come back from their stored kg; typed rows and ghosts are converted; suggestions are rebuilt. */
  private convertWorkout(from: string, to: string) {
    this.blocks.update(bs => bs.map(b => ({
      ...b,
      sets: b.sets.map(s => ({
        ...s,
        weight: s.saved && s.weightKg != null ? String(this.settingsService.toDisplay(s.weightKg)) : this.convertText(s.weight, from, to),
        ghostWeight: this.convertText(s.ghostWeight, from, to),
      })),
    })));
    this.bwValue = this.convertText(this.bwValue, from, to);
    for (const b of this.blocks()) this.applySuggestion(b.exerciseId);
  }
}

/** Recent sets fetched per exercise for the "last time" suggestion. */
const SUGGESTION_SETS = 60;

/** Sets (or, with no value, removes) one key of a Map held in a signal. */
function setKey<T>(sig: WritableSignal<Map<string, T>>, key: string, value?: T) {
  sig.update(m => {
    const n = new Map(m);
    if (value === undefined) n.delete(key); else n.set(key, value);
    return n;
  });
}
