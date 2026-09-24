import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';

import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  JymService,
  RoutineItem,
  CreateSetRequest,
  SetHistory,
  SessionAttachment,
} from '../../../core/services/jym.service';
import { UploadService } from '../../../core/services/upload.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';

interface SetRow {
  setNumber: number;
  weight: string;
  reps: string;
  rpe: string;
  saved: boolean;
  isPR: boolean;
  saving: boolean;
  id: string | null;
  ghostWeight: string;
  ghostReps: string;
  isWarmup: boolean;
}

interface ExerciseBlock {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  sets: SetRow[];
  ghostSets: { weight: number; reps: number }[];
  suggestion: string | null;
  exerciseNote: string;
}

@Component({
  selector: 'app-session-player',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroModalComponent, JiroIconComponent, JiroSkeletonComponent, JiroEmptyStateComponent, JymPrBadgeComponent],
  template: `
    <h1 class="sr-only">Active session</h1>
    <!-- Sticky header bar -->
    <div class="session-bar">
      <div class="session-bar-row">
        <div class="session-bar-left">
          <span class="bar-label">Active Session</span>
          <span class="timer">{{ elapsedDisplay() }}</span>
        </div>
        <div class="session-bar-right">
          <div class="type-toggle">
            <button class="type-btn" [class.active]="sessionType() === 'normal'" (click)="setSessionType('normal')">Normal</button>
            <button class="type-btn" [class.active]="sessionType() === 'deload'" (click)="setSessionType('deload')">Deload</button>
            <button class="type-btn" [class.active]="sessionType() === 'test'" (click)="setSessionType('test')">Test</button>
          </div>
          <div class="type-toggle unit-toggle">
            <button class="type-btn" [class.active]="settingsService.weightUnit() === 'lbs'" (click)="toggleUnit('lbs')">lbs</button>
            <button class="type-btn" [class.active]="settingsService.weightUnit() === 'kg'" (click)="toggleUnit('kg')">kg</button>
          </div>
          <button class="save-template-btn" type="button" title="Save as template" aria-label="Save as template" (click)="showTemplateSave.set(true)">
            <jiro-icon name="floppy-disk" [size]="15" />
          </button>
          <jiro-button size="sm" variant="ghost" type="button" (click)="showExitConfirm.set(true)">Exit</jiro-button>
          <jiro-button size="sm" variant="inverse" type="button" (click)="finishSession()" [disabled]="finishing()">
            {{ finishing() ? 'Finishing...' : 'Finish' }}
          </jiro-button>
        </div>
        @if (emptySessionError()) {
<p class="empty-session-error">{{ emptySessionError() }}</p>
}
      </div>
      <!-- Rest timer row — expands the bar after logging a set -->
      @if (restTimerActive()) {
<div class="rest-row" [class.rest-done]="restTimerDone()">
        <span class="rest-label">Rest</span>
        <span class="rest-countdown">{{ restTimerDisplay() }}</span>
        <div class="rest-presets">
          @for (d of restPresets; track d) {
<button class="rest-chip"
            [class.active]="restTimerDuration() === d"
            (click)="setRestDuration(d)">{{ restPresetLabel(d) }}</button>
}
          <button class="rest-chip rest-add-btn" type="button" (click)="addRestTime(30)" title="Add 30 seconds" aria-label="Add 30 seconds">+30s</button>
        </div>
        <button class="rest-skip-btn" type="button" (click)="skipRestTimer()" aria-label="Skip rest" title="Skip rest"><jiro-icon name="x" [size]="12" /></button>
        <div class="rest-progress">
          <div class="rest-progress-fill"
            [style.width.%]="(restTimerRemaining() / restTimerDuration()) * 100"></div>
        </div>
      </div>
}
    </div>

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
        <textarea
          class="notes-input"
          [(ngModel)]="sessionNotes"
          placeholder="Session notes (optional)..."
          rows="2"
          (blur)="saveNotes()">
        </textarea>
      </div>
}

      <!-- Body weight panel -->
      @if (!loading()) {
<div class="bw-panel">
        <span class="bw-label">Body weight</span>
        @if (!bwLogged()) {
<div class="bw-row">
          <input
            class="bw-input"
            type="number"
            step="0.1"
            min="0"
            [(ngModel)]="bwValue"
            [placeholder]="settingsService.unitLabel()" />
          <button
            class="bw-save-btn"
            [disabled]="bwSaving() || !bwValue"
            (click)="saveBodyWeight()">
            {{ bwSaving() ? '...' : 'Log' }}
          </button>
        </div>
}
        @if (bwLogged()) {
<span class="bw-logged">✓ {{ bwValue }} {{ settingsService.unitLabel() }} logged</span>
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
        @for (block of blocks(); track block; let bi = $index) {
<div class="ex-block">
          <!-- The whole header toggles on click; the name button is its keyboard and
               screen reader handle (its click bubbles up here). Delete stops propagation. -->
          <div class="block-header" [class.block-open]="!isCollapsed(bi)" (click)="toggleBlock(bi)">
            <div class="block-title">
              <h2><button type="button" class="block-toggle" [attr.aria-expanded]="!isCollapsed(bi)" [attr.aria-controls]="'block-body-' + bi">{{ block.exerciseName }}</button></h2>
              @if (block.muscleGroup) {
<span class="mg-tag">{{ block.muscleGroup }}</span>
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
              <svg class="chevron" aria-hidden="true" [class.open]="!isCollapsed(bi)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"/>
              </svg>
            </div>
          </div>

          <div [id]="'block-body-' + bi">
          @if (!isCollapsed(bi)) {

            <!-- Progressive overload suggestion -->
            @if (block.suggestion && !allSaved(bi)) {
<div class="overload-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
              </svg>
              {{ block.suggestion }}
            </div>
}

            <!-- Exercise note -->
            <div class="ex-note-wrap">
              <textarea
                class="ex-note-input"
                [(ngModel)]="block.exerciseNote"
                placeholder="Note for this exercise..."
                rows="1"
                (blur)="saveExerciseNote(bi)"></textarea>
            </div>

            <!-- Set header -->
            <div class="set-header-row">
              <span class="sh set-num">Set</span>
              <span class="sh weight">Weight ({{ settingsService.unitLabel() }})</span>
              <span class="sh reps">Reps</span>
              <span class="sh rpe">RPE</span>
              <span class="sh warmup-col" title="Warm-up"><jiro-icon name="fire" [size]="14" label="Warm-up" /></span>
              <span class="sh action"></span>
            </div>

            <!-- Set rows -->
            @for (row of block.sets; track row; let si = $index) {

              <div class="set-row" [class.set-done]="row.saved" [class.set-warmup]="row.isWarmup">
                <span class="set-num-cell">{{ row.setNumber }}</span>

                <div class="input-wrap">
                  <input
                    class="set-input"
                    type="number"
                    step="0.5"
                    min="0"
                    [(ngModel)]="row.weight"
                    [placeholder]="row.ghostWeight || '0'"
                    [class.has-ghost]="row.ghostWeight && !row.weight"
                    [disabled]="row.saved" />
                  @if (row.ghostWeight && !row.weight) {
<span class="ghost-hint">{{ row.ghostWeight }}</span>
}
                </div>

                <div class="input-wrap">
                  <input
                    class="set-input"
                    type="number"
                    min="1"
                    [(ngModel)]="row.reps"
                    [placeholder]="row.ghostReps || '0'"
                    [class.has-ghost]="row.ghostReps && !row.reps"
                    [disabled]="row.saved" />
                  @if (row.ghostReps && !row.reps) {
<span class="ghost-hint">{{ row.ghostReps }}</span>
}
                </div>

                <input
                  class="set-input rpe-input"
                  [class.input-error]="!!row.rpe && rpeInvalid(row.rpe)"
                  type="number"
                  min="1"
                  max="10"
                  [(ngModel)]="row.rpe"
                  placeholder="—"
                  [disabled]="row.saved" />

                <button
                  type="button"
                  class="warmup-btn"
                  [class.warmup-active]="row.isWarmup"
                  [attr.aria-pressed]="row.isWarmup"
                  [attr.aria-label]="'Warm-up, set ' + row.setNumber"
                  title="{{ row.isWarmup ? 'Warm-up set' : 'Mark as warm-up' }}"
                  (click)="toggleWarmup(bi, si)"><jiro-icon name="fire" [size]="16" /></button>

                <div class="action-cell">
                  @if (row.saved && row.isPR) {
<jym-pr-badge />
}
                  @if (!row.saved) {
<button type="button" class="log-btn" [attr.aria-label]="'Log set ' + row.setNumber"
                    [disabled]="row.saving || !row.weight || !row.reps || (!!row.rpe && rpeInvalid(row.rpe))"
                    (click)="logSet(bi, si)">
                    @if (!row.saving) {
<jiro-icon name="check" [size]="18" />
}
                    @if (row.saving) {
<span class="spinner-sm"></span>
}
                  </button>
}
                  @if (row.saved) {
<button type="button" class="del-btn" [attr.aria-label]="'Remove set ' + row.setNumber" title="Remove set" (click)="deleteSet(bi, si)">
                    <jiro-icon name="x" [size]="14" />
                  </button>
}
                </div>
              </div>
              @if (!row.saved && !!row.rpe && rpeInvalid(row.rpe)) {
<div class="rpe-err-msg">
                RPE must be between 1 and 10
              </div>
}
            
}

            <!-- Add set -->
            <button class="add-set-btn" (click)="addSet(bi)">+ Add Set</button>

            <!-- Form check upload -->
            <div class="form-check-row">
              <label [for]="canUploadFormCheck(bi, block.exerciseId) ? 'fc-input-' + block.exerciseId : ''"
                     class="form-check-btn"
                     [class.fc-uploading]="isFormCheckUploading(block.exerciseId)"
                     [class.fc-disabled]="!canUploadFormCheck(bi, block.exerciseId)"
                     [title]="formCheckBtnTitle(bi, block.exerciseId)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
                {{ isFormCheckUploading(block.exerciseId) ? 'Uploading...' : '+ Form Check' }}
              </label>
              <input type="file" [id]="'fc-input-' + block.exerciseId"
                accept="video/mp4,video/webm,image/jpeg,image/png"
                style="display:none"
                (change)="onFormCheckFileChange($event, bi)">
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
                    </svg>
                  </span>
}
                </a>
              
}
            </div>
          
}
          </div>
        </div>
}

        <!-- Add exercise -->
        <button class="add-exercise-btn" (click)="addExercise()">+ Add Exercise</button>
      </div>
}
    </div>

    <!-- Exit confirmation modal -->
    @if (showExitConfirm()) {
<jiro-modal title="Exit Workout?" maxWidth="400px" (close)="showExitConfirm.set(false)">
      <p style="font-size:var(--font-size-sm);color:var(--text-secondary);line-height:1.6;margin-bottom:var(--space-lg)">
        Your sets are saved. You can resume this session any time from the Jym home page.
      </p>
      <div style="display:flex;flex-direction:column;gap:var(--space-sm)">
        <div style="display:flex;justify-content:flex-end;gap:var(--space-sm)">
          <jiro-button variant="secondary" type="button" (click)="showExitConfirm.set(false)">Keep Training</jiro-button>
          <jiro-button variant="primary" type="button" (click)="exitSession()">Save & Exit</jiro-button>
        </div>
        <div style="border-top:1px solid var(--border-color);padding-top:var(--space-sm)">
          <jiro-button variant="danger" type="button" [disabled]="discarding()" (click)="discardSession()">
            {{ discarding() ? 'Discarding...' : 'Discard Session' }}
          </jiro-button>
        </div>
      </div>
    </jiro-modal>
}

    <!-- Save as Template modal -->
    @if (showTemplateSave()) {
<jiro-modal title="Save as Template" maxWidth="420px" (close)="showTemplateSave.set(false)">
      <p style="font-size:var(--font-size-sm);color:var(--text-secondary);margin-bottom:var(--space-md);">
        Give this workout layout a name to reuse it in future sessions.
      </p>
      <input
        class="template-name-input"
        type="text"
        [(ngModel)]="templateName"
        placeholder="e.g. Push Day A"
        (keydown.enter)="saveAsTemplate()"
        maxlength="80"
      />
      @if (templateSaveError()) {
<div class="template-save-error">{{ templateSaveError() }}</div>
}
      <div style="display:flex;justify-content:flex-end;gap:var(--space-sm);margin-top:var(--space-md)">
        <jiro-button variant="secondary" type="button" (click)="showTemplateSave.set(false)">Cancel</jiro-button>
        <jiro-button variant="primary" type="button" [disabled]="!templateName.trim() || templateSaving()" (click)="saveAsTemplate()">
          {{ templateSaving() ? 'Saving...' : 'Save Template' }}
        </jiro-button>
      </div>
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
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-sm) var(--space-xl);
    }

    .session-bar-left { display: flex; align-items: center; gap: var(--space-md); }

    .bar-label { font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 1px; opacity: 0.75; }

    .timer { font-size: var(--font-size-xl); font-weight: 700; font-variant-numeric: tabular-nums; }

    .session-bar-right { display: flex; align-items: center; gap: var(--space-sm); }

    /* Rest timer row */
    .rest-row {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-xs) var(--space-xl);
      background: rgba(var(--shadow-rgb), 0.18);
      border-top: 1px solid color-mix(in srgb, currentColor 15%, transparent);
      position: relative; overflow: hidden;
      transition: background 0.4s;
    }

    .rest-row.rest-done { background: rgba(var(--color-accent-rgb), 0.45); }

    .rest-label {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 1px; opacity: 0.7; font-weight: 500; white-space: nowrap;
    }

    .rest-countdown {
      font-size: var(--font-size-lg); font-weight: 700;
      font-variant-numeric: tabular-nums; min-width: 52px;
    }

    .rest-presets { display: flex; gap: 4px; margin-left: auto; }

    .rest-chip {
      min-height: 28px; padding: 2px 8px; border-radius: 10px;
      border: 1px solid color-mix(in srgb, currentColor 35%, transparent); background: none;
      color: color-mix(in srgb, currentColor 88%, transparent); font-size: var(--font-size-xs);
      cursor: pointer; transition: all 0.15s; font-family: inherit; white-space: nowrap;
    }

    .rest-chip:hover { border-color: color-mix(in srgb, currentColor 70%, transparent); color: inherit; }

    .rest-chip.active {
      background: var(--text-on-primary); border-color: var(--text-on-primary);
      color: var(--color-primary); font-weight: 600;
    }

    .rest-add-btn { border-style: dashed; }

    .save-template-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px; border-radius: var(--border-radius-sm);
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent); background: none;
      color: color-mix(in srgb, currentColor 88%, transparent); cursor: pointer; transition: all 0.15s;
      flex-shrink: 0;
    }
    .save-template-btn:hover { border-color: color-mix(in srgb, currentColor 70%, transparent); color: inherit; }

    .template-name-input {
      width: 100%; padding: 9px 12px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-base); font-family: inherit;
 box-sizing: border-box;
    }
    .template-name-input:focus { border-color: var(--color-primary); }

    .template-save-error {
      font-size: var(--font-size-sm); color: var(--color-negative); margin-top: var(--space-xs);
    }

    .rest-skip-btn {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 28px; padding: 3px 8px; border-radius: 10px;
      border: 1px solid color-mix(in srgb, currentColor 30%, transparent); background: none;
      color: color-mix(in srgb, currentColor 88%, transparent); cursor: pointer;
      font-size: var(--font-size-xs); transition: all 0.15s; font-family: inherit;
    }

    .rest-skip-btn:hover { border-color: color-mix(in srgb, currentColor 70%, transparent); color: inherit; }

    .rest-progress {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 3px; background: color-mix(in srgb, currentColor 15%, transparent);
    }

    .rest-progress-fill {
      height: 100%; background: color-mix(in srgb, currentColor 75%, transparent);
      transition: width 1s linear;
    }

    .rest-row.rest-done .rest-progress-fill { background: var(--color-positive); }

    .type-toggle {
      display: flex; border-radius: 6px; overflow: hidden;
      border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
    }

    .type-btn {
      min-height: 28px; padding: 5px 10px; background: transparent; border: none;
      color: color-mix(in srgb, currentColor 88%, transparent); font-size: var(--font-size-xs);
      font-family: inherit;
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .type-btn + .type-btn { border-left: 1px solid color-mix(in srgb, currentColor 35%, transparent); }

    /* mirrors the Finish button: fill with the bar's own text colour so the
       label stays readable on the maroon bar and on the lifted dark one.
       currentColor cannot be used for the fill here: in a background it
       resolves to this element's own colour, not the inherited one. */
    .type-btn.active { background: var(--text-on-primary); color: var(--color-primary); font-weight: 600; }

    .type-notice {
      text-align: center; font-size: var(--font-size-sm); font-weight: 500;
      padding: var(--space-xs) var(--space-md); margin-bottom: var(--space-md);
      border-radius: var(--border-radius);
    }

    .deload-notice { background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger); border: 1px solid rgba(var(--color-danger-rgb), 0.2); }

    .test-notice { background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); border: 1px solid rgba(var(--color-primary-rgb), 0.2); }




    /* Body */
    .player-body { max-width: 700px; overflow-x: hidden; }

    /* Notes panel */
    .empty-session-error {
      margin: var(--space-xs) var(--space-md) 0;
      font-size: var(--font-size-sm); color: var(--color-danger); text-align: right;
    }

    .notes-panel { margin-bottom: var(--space-md); }

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
      width: 80px; padding: 6px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas); color: var(--text-primary);
      font-size: var(--font-size-sm); font-family: inherit;
    }

    .bw-input:focus { border-color: var(--color-primary); }

    .bw-save-btn {
      padding: 6px 14px; background: var(--color-primary); color: var(--text-on-primary); font-family: inherit;
      border: none; border-radius: var(--border-radius);
      font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
      transition: opacity 0.15s;
    }

    .bw-save-btn:hover:not(:disabled) { opacity: 0.85; }

    .bw-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .bw-logged {
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

    .block-title { display: flex; align-items: center; gap: var(--space-sm); flex: 1; min-width: 0; }

    .block-title h2 { font-size: var(--font-size-md); font-weight: 600; }

    .sets-done-tag {
      font-size: var(--font-size-xs); padding: 2px 8px; border-radius: 10px;
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); font-weight: 500;
    }

    .chevron {
      flex-shrink: 0; color: var(--text-muted);
      transform: rotate(-90deg); transition: transform 0.2s ease;
    }
    .chevron.open { transform: rotate(0deg); }

    .mg-tag {
      background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary);
      font-size: var(--font-size-xs); padding: 2px 8px; border-radius: 10px;
    }

    /* Exercise note */
    .ex-note-wrap {
      padding: var(--space-xs) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
    }

    .ex-note-input {
      width: 100%; box-sizing: border-box;
      padding: 6px 10px;
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

    /* Set table */
    .set-header-row {
      display: grid;
      grid-template-columns: 40px 1fr 1fr 64px 44px minmax(52px, auto);
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
    }

    .sh {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted); font-weight: 500;
    }

    .warmup-col { text-align: center; }

    .set-row {
      display: grid;
      grid-template-columns: 40px 1fr 1fr 64px 44px minmax(52px, auto);
      gap: var(--space-sm);
      align-items: center;
      padding: var(--space-xs) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
      transition: background 0.2s;
    }

    .set-row:last-of-type { border-bottom: none; }

    .set-row.set-done { background: rgba(var(--color-primary-rgb), 0.04); }

    .set-row.set-warmup { background: rgba(var(--color-warning-rgb), 0.08); }

    .warmup-btn {
      width: 40px; height: 40px; border-radius: var(--border-radius-sm);
      background: none; border: 1px solid var(--border-color);
      color: var(--text-muted); cursor: pointer; transition: all 0.15s;
      display: flex; align-items: center; justify-content: center;
    }

    .warmup-btn:hover { border-color: var(--color-warning); color: var(--color-warning); }

    .warmup-btn.warmup-active {
      background: rgba(var(--color-warning-rgb), 0.15); border-color: var(--color-warning); color: var(--color-warning);
    }

    .set-num-cell { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-muted); text-align: center; }

    .input-wrap { position: relative; }

    .set-input {
      width: 100%; min-height: 44px; padding: 8px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas); color: var(--text-primary);
      font-size: var(--font-size-md); box-sizing: border-box;
      font-family: inherit; transition: border-color 0.15s;
    }

    .set-input:focus { border-color: var(--color-primary); }

    .set-input:disabled { opacity: 0.7; background: transparent; border-color: transparent; }

    .set-input.has-ghost::placeholder { color: rgba(var(--color-primary-rgb), 0.55); font-style: italic; }

    .ghost-hint {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      font-size: var(--font-size-xs); color: rgba(var(--color-primary-rgb), 0.55);
      pointer-events: none;
    }

    .rpe-input { width: 100%; }

    .input-error { border-color: var(--color-danger) !important; }

    .rpe-err-msg {
      grid-column: 1 / -1;
      font-size: var(--font-size-xs); color: var(--color-danger);
      padding: 2px var(--space-lg) var(--space-xs);
    }

    .action-cell { display: flex; align-items: center; justify-content: center; gap: var(--space-xs); }

    .log-btn {
      width: 40px; height: 40px; border-radius: 50%;
      background: var(--color-primary); color: var(--text-on-primary); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s;
    }

    .log-btn:hover:not(:disabled) { opacity: 0.85; }

    .log-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .del-btn {
      width: 40px; height: 40px; border-radius: var(--border-radius-sm);
      background: none; color: var(--text-muted); border: 1px solid var(--border-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }

    .del-btn:hover { color: var(--color-danger); border-color: var(--color-danger); }

    .spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid color-mix(in srgb, currentColor 40%, transparent);
      border-top-color: currentColor; border-radius: 50%;
      animation: spin 0.6s linear infinite; display: inline-block;
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
      background: none; border: none; padding: 0; margin-bottom: var(--space-md);
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

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Mobile responsive ── */
    @media (max-width: 768px) {
      .session-bar {
        margin: calc(-1 * var(--space-md));
        margin-bottom: var(--space-md);
      }

      /* Session bar inner row: stack into 2 rows */
      .session-bar-row {
        flex-direction: column;
        padding: var(--space-sm) var(--space-md);
        gap: var(--space-xs);
        align-items: stretch;
      }

      .rest-row { padding: var(--space-xs) var(--space-md); }

      .rest-presets { gap: 3px; }

      .rest-chip { padding: 2px 6px; font-size: 0.65rem; }

      .session-bar-left { gap: var(--space-sm); }

      .bar-label { display: none; }

      .timer { font-size: var(--font-size-lg); }

      .session-bar-right {
        flex-wrap: wrap;
        gap: var(--space-xs);
      }

      /* Type toggle fills first sub-row */
      .type-toggle { flex: 0 0 100%; }

      .type-btn { flex: 1; padding: 6px 4px; font-size: 0.65rem; }

      /* Exercise + Finish share second sub-row */
    }

    /* ── Set table on very small screens ── */
    @media (max-width: 480px) {
      .set-header-row,
      .set-row {
        grid-template-columns: 24px 1fr 1fr 44px 36px minmax(40px, auto);
        padding: var(--space-xs) var(--space-md);
        gap: 4px;
      }

      .set-input { min-height: 40px; padding: 6px 6px; font-size: var(--font-size-sm); }

      .log-btn { width: 36px; height: 36px; }

      .warmup-btn, .del-btn { width: 36px; height: 36px; }

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
      cursor: pointer; padding: 4px 10px; border-radius: var(--border-radius);
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
      border-radius: 2px; overflow: hidden;
    }

    .fc-progress-fill {
      height: 100%; background: var(--color-primary); transition: width 0.3s;
    }

    .fc-count {
      font-size: var(--font-size-xs); color: var(--text-secondary); white-space: nowrap;
    }

    .fc-clip-link { display: inline-flex; align-items: center; text-decoration: none; }
    .fc-thumb { width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); }
    .fc-thumb-video {
      width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
      background: var(--surface-secondary); border-radius: 4px; border: 1px solid var(--border-color);
      color: var(--text-secondary);
    }
  `]
})
export class SessionPlayerComponent implements OnInit, OnDestroy {
  loading = signal(true);
  finishing = signal(false);
  emptySessionError = signal<string | null>(null);
  showExPicker = signal(false);
  showExitConfirm = signal(false);
  discarding = signal(false);
  showTemplateSave = signal(false);
  templateSaving = signal(false);
  templateSaveError = signal('');
  private readonly toast = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  templateName = '';
  removingBlock = signal<number | null>(null);

  // Inline exercise creation
  creatingExercise = signal(false);
  newExName = '';
  newExMuscleGroup = '';
  newExSaving = signal(false);
  newExError = signal('');
  readonly muscleGroups = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio', 'Other'];
  bwSaving = signal(false);
  bwLogged = signal(false);
  bwValue: number | null = null;
  blocks = signal<ExerciseBlock[]>([]);
  elapsedDisplay = signal('0:00');
  sessionType = signal<string>('normal');

  collapsedBlocks = signal<Set<number>>(new Set());
  allExercises = signal<{ id: string; name: string; muscle_group: string | null }[]>([]);
  filteredExercises = signal<{ id: string; name: string; muscle_group: string | null }[]>([]);
  exSearch = '';
  sessionNotes = '';

  // Rest timer
  restTimerActive = signal(false);
  restTimerRemaining = signal(0);
  restTimerDuration = signal(90);
  restTimerDone = signal(false);
  readonly restPresets = [60, 90, 120, 180, 300];
  private restInterval: ReturnType<typeof setInterval> | null = null;
  private restStartedAt: Date | null = null;
  private audioCtx: AudioContext | null = null;

  private sessionId = '';
  private startedAt = new Date();
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  // Form check upload state (keyed by exerciseId)
  formCheckUploading = signal<Map<string, boolean>>(new Map());
  formCheckProgressMap = signal<Map<string, number>>(new Map());
  blockAttachments = signal<Map<string, SessionAttachment[]>>(new Map());

  // Re-sync both timers when the user returns from a locked screen
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.tickRestTimer();
      this.updateElapsed();
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
    this.startTimer();
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    // Targets passed via router state when starting a routine-based session
    const routerTargets: RoutineItem[] = (history.state?.targets) || [];

    // Load all exercises for the picker
    this.jymService.listExercises().subscribe(exs => {
      this.allExercises.set(exs);
      this.filteredExercises.set(exs);
    });

    // Load session + sets (restores mid-workout state on page refresh)
    this.jymService.getSession(this.sessionId).subscribe({
      next: session => {
        this.startedAt = new Date(session.started_at);
        this.sessionType.set(session.session_type || 'normal');
        this.sessionNotes = session.notes || '';
        const existingBlocks = this.buildBlocksFromSets(session.sets || []);
        const targetsKey = `jiro_session_targets_${this.sessionId}`;

        const buildRoutineBlocks = (targets: RoutineItem[]) => targets.map(t => ({
          exerciseId: t.exercise_id,
          exerciseName: t.exercise_name,
          muscleGroup: t.muscle_group,
          sets: Array.from({ length: t.target_sets }, (_, i) => ({
            setNumber: i + 1, weight: '', reps: '', rpe: '',
            saved: false, isPR: false, saving: false, id: null,
            ghostWeight: '', ghostReps: String(t.target_reps),
            isWarmup: false,
          })),
          ghostSets: [] as { weight: number; reps: number }[],
          suggestion: null,
          exerciseNote: '',
        }));

        if (existingBlocks.length === 0 && routerTargets.length > 0) {
          // Fresh split session — save targets so we can restore on return
          localStorage.setItem(targetsKey, JSON.stringify(routerTargets));
          const newBlocks = buildRoutineBlocks(routerTargets);
          this.blocks.set(newBlocks);
          this.loadSuggestionsForBlocks(newBlocks);
        } else {
          // Returning: merge logged sets with any un-logged routine exercises
          const savedStr = localStorage.getItem(targetsKey);
          const savedTargets: RoutineItem[] = savedStr ? JSON.parse(savedStr) : [];
          if (savedTargets.length > 0 && existingBlocks.length > 0) {
            const existingIds = new Set(existingBlocks.map(b => b.exerciseId));
            const missing = buildRoutineBlocks(savedTargets.filter(t => !existingIds.has(t.exercise_id)));
            this.blocks.set([...existingBlocks, ...missing]);
            this.loadSuggestionsForBlocks(missing);
          } else if (savedTargets.length > 0 && existingBlocks.length === 0) {
            const newBlocks = buildRoutineBlocks(savedTargets);
            this.blocks.set(newBlocks);
            this.loadSuggestionsForBlocks(newBlocks);
          } else {
            this.blocks.set(existingBlocks);
          }
        }

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
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.clearRestTimer();
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  // ── Rest timer ──────────────────────────────────────────────────
  startRestTimer() {
    this.clearRestTimer();
    this.warmUpAudio();
    this.restStartedAt = new Date();
    this.restTimerRemaining.set(this.restTimerDuration());
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
    const rem = Math.max(0, this.restTimerDuration() - elapsed);
    this.restTimerRemaining.set(rem);
    if (rem <= 0 && !this.restTimerDone()) {
      this.clearRestTimer();
      this.restTimerDone.set(true);
      this.playBeep();
      setTimeout(() => {
        this.restTimerActive.set(false);
        this.restTimerDone.set(false);
      }, 3000);
    }
  }

  private clearRestTimer() {
    if (this.restInterval) { clearInterval(this.restInterval); this.restInterval = null; }
    this.restStartedAt = null;
  }

  skipRestTimer() {
    this.clearRestTimer();
    this.restTimerActive.set(false);
    this.restTimerDone.set(false);
  }

  setRestDuration(seconds: number) {
    this.restTimerDuration.set(seconds);
    if (this.restTimerActive() && !this.restTimerDone()) {
      this.startRestTimer();
    }
  }

  addRestTime(seconds: number) {
    if (this.restTimerDone()) {
      // Re-arm with fresh duration
      this.restTimerDuration.set(seconds);
      this.startRestTimer();
    } else {
      // Extend: increase duration, shift start back so remaining grows
      this.restTimerDuration.update(d => d + seconds);
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
    const elapsed = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
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
    this.sessionType.set(type);
    this.jymService.updateSession(this.sessionId, { session_type: type }).subscribe();
  }

  toggleUnit(unit: string) {
    this.authService.updateSettings({ weight_unit: unit }).subscribe();
  }

  rpeInvalid(rpe: string): boolean {
    const v = parseInt(rpe, 10);
    return isNaN(v) || v < 1 || v > 10;
  }

  addSet(blockIndex: number) {
    const block = this.blocks()[blockIndex];
    const lastSaved = block.sets.filter(s => s.saved).slice(-1)[0];
    const setNumber = block.sets.length + 1;
    const newRow: SetRow = {
      setNumber,
      weight: '',
      reps: '',
      rpe: '',
      saved: false,
      isPR: false,
      saving: false,
      id: null,
      ghostWeight: lastSaved ? lastSaved.weight : '',
      ghostReps: lastSaved ? lastSaved.reps : '',
      isWarmup: false,
    };
    this.blocks.update(bs => bs.map((b, i) => i === blockIndex ? { ...b, sets: [...b.sets, newRow] } : b));
  }

  logSet(blockIndex: number, setIndex: number) {
    const block = this.blocks()[blockIndex];
    const row = block.sets[setIndex];
    if (!row.weight || !row.reps) return;

    // Warm up audio NOW, synchronously while the tap gesture is still active.
    // Safari blocks AudioContext creation/resume in async callbacks (e.g. HTTP responses).
    this.warmUpAudio();

    this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
      ...b,
      sets: b.sets.map((s, si) => si === setIndex ? { ...s, saving: true } : s),
    } : b));

    const req: CreateSetRequest = {
      exercise_id: block.exerciseId,
      set_number: row.setNumber,
      weight: this.settingsService.toKg(parseFloat(row.weight)),
      reps_performed: parseInt(row.reps, 10),
      rpe: row.rpe ? parseInt(row.rpe, 10) : undefined,
      is_warmup: row.isWarmup,
      exercise_note: block.exerciseNote || undefined,
    };

    this.jymService.logSet(this.sessionId, req).subscribe({
      next: saved => {
        this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
          ...b,
          sets: b.sets.map((s, si) => si === setIndex ? {
            ...s, saving: false, saved: true, isPR: saved.is_pr, id: saved.id,
          } : s),
        } : b));
        this.startRestTimer();
      },
      error: () => {
        this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
          ...b,
          sets: b.sets.map((s, si) => si === setIndex ? { ...s, saving: false } : s),
        } : b));
      },
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
      },
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

  exitSession() {
    this.router.navigate(['/jym']);
  }

  discardSession() {
    this.discarding.set(true);
    this.jymService.deleteSession(this.sessionId).subscribe({
      next: () => {
        localStorage.removeItem(`jiro_session_targets_${this.sessionId}`);
        this.router.navigate(['/jym']);
      },
      error: () => this.discarding.set(false),
    });
  }

  saveNotes() {
    this.jymService.updateSession(this.sessionId, { notes: this.sessionNotes }).subscribe();
  }

  saveAsTemplate() {
    const name = this.templateName.trim();
    if (!name) return;
    this.templateSaving.set(true);
    this.templateSaveError.set('');
    this.jymService.createTemplateFromSession(this.sessionId, name).subscribe({
      next: () => {
        this.showTemplateSave.set(false);
        this.templateSaving.set(false);
        this.templateName = '';
        this.toast.success(`Template "${name}" saved`);
      },
      error: () => {
        this.templateSaving.set(false);
        this.templateSaveError.set('Could not save template. Make sure you have logged at least one set.');
      },
    });
  }

  finishSession() {
    const hasSavedSets = this.blocks().some(b => b.sets.some(s => s.saved));
    if (!hasSavedSets && !this.sessionNotes.trim()) {
      this.emptySessionError.set('Nothing to save — log at least one set or add session notes first.');
      return;
    }
    this.emptySessionError.set(null);
    this.finishing.set(true);
    this.jymService.updateSession(this.sessionId, {
      ended_at: new Date().toISOString(),
      notes: this.sessionNotes,
    }).subscribe({
      next: () => {
        localStorage.removeItem(`jiro_session_targets_${this.sessionId}`);
        const durationSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
        this.router.navigate(['/jym/session-summary'], {
          state: {
            sessionId: this.sessionId,
            durationSeconds,
            sessionType: this.sessionType(),
            weightUnit: this.settingsService.weightUnit(),
            routineName: null,
            blocks: this.blocks().map(b => ({
              exerciseId: b.exerciseId,
              exerciseName: b.exerciseName,
              muscleGroup: b.muscleGroup,
              sets: b.sets.map(s => ({
                weight: parseFloat(s.weight) || 0,
                reps: parseInt(s.reps, 10) || 0,
                saved: s.saved,
                isPR: s.isPR,
                isWarmup: s.isWarmup,
              })),
            })),
          },
        });
      },
      error: () => this.finishing.set(false),
    });
  }

  saveBodyWeight() {
    if (!this.bwValue) return;
    this.bwSaving.set(true);
    const today = new Date().toISOString().split('T')[0];
    this.jymService.logBodyWeight({ recorded_at: today, weight_kg: this.settingsService.toKg(this.bwValue) }).subscribe({
      next: () => { this.bwLogged.set(true); this.bwSaving.set(false); },
      error: () => this.bwSaving.set(false),
    });
  }

  toggleBlock(bi: number) {
    this.collapsedBlocks.update(s => {
      const next = new Set(s);
      if (next.has(bi)) next.delete(bi); else next.add(bi);
      return next;
    });
  }

  isCollapsed(bi: number): boolean {
    return this.collapsedBlocks().has(bi);
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
      this.jymService.updateSet(row.id, { is_warmup: newVal }).subscribe();
    }
  }

  saveExerciseNote(bi: number) {
    const block = this.blocks()[bi];
    if (!block) return;
    const note = block.exerciseNote || undefined;
    const savedIds = block.sets.filter(s => s.saved && s.id).map(s => s.id!);
    for (const id of savedIds) {
      this.jymService.updateSet(id, { exercise_note: note }).subscribe();
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

    const newBlock: ExerciseBlock = {
      exerciseId: ex.id,
      exerciseName: ex.name,
      muscleGroup: ex.muscle_group,
      sets: [{
        setNumber: 1, weight: '', reps: '', rpe: '',
        saved: false, isPR: false, saving: false, id: null,
        ghostWeight: '', ghostReps: '', isWarmup: false,
      }],
      ghostSets: [],
      suggestion: null,
      exerciseNote: '',
    };

    this.blocks.update(bs => [...bs, newBlock]);

    // Fetch history to generate progressive overload suggestion
    this.jymService.getExercise(ex.id).subscribe({
      next: exWithHistory => {
        const { suggestion, ghostWeight, ghostReps } = this.computeSuggestion(exWithHistory.history);
        this.blocks.update(bs => bs.map(b => b.exerciseId === ex.id ? {
          ...b,
          suggestion,
          sets: b.sets.map((s, i) => i === 0 && !s.saved ? {
            ...s,
            ghostWeight: ghostWeight ?? s.ghostWeight,
            ghostReps: ghostReps ?? s.ghostReps,
          } : s),
        } : b));
      },
    });
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
    const block = this.blocks()[blockIndex];
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !block) return;
    input.value = ''; // reset so the same file can be re-selected

    const exId = block.exerciseId;
    this.formCheckUploading.update(m => { const n = new Map(m); n.set(exId, true); return n; });
    this.formCheckProgressMap.update(m => { const n = new Map(m); n.set(exId, 0); return n; });

    this.uploadService.uploadSessionAttachment(
      this.sessionId, file, exId, undefined,
      (pct) => this.formCheckProgressMap.update(m => { const n = new Map(m); n.set(exId, pct); return n; })
    ).subscribe({
      next: attachment => {
        this.blockAttachments.update(m => {
          const n = new Map(m);
          n.set(exId, [...(n.get(exId) ?? []), attachment]);
          return n;
        });
        this.formCheckUploading.update(m => { const n = new Map(m); n.set(exId, false); return n; });
      },
      error: () => {
        this.formCheckUploading.update(m => { const n = new Map(m); n.set(exId, false); return n; });
      },
    });
  }

  private loadSuggestionsForBlocks(blocks: ExerciseBlock[]) {
    for (const block of blocks) {
      this.jymService.getExercise(block.exerciseId).subscribe({
        next: ex => {
          const { suggestion, ghostWeight, ghostReps } = this.computeSuggestion(ex.history);
          if (!suggestion) return;
          this.blocks.update(bs => bs.map(b => b.exerciseId === block.exerciseId ? {
            ...b,
            suggestion,
            sets: b.sets.map(s => !s.saved ? {
              ...s,
              ghostWeight: ghostWeight ?? s.ghostWeight,
              ghostReps: ghostReps ?? s.ghostReps,
            } : s),
          } : b));
        },
      });
    }
  }

  private computeSuggestion(history: SetHistory[]): { suggestion: string | null; ghostWeight: string | null; ghostReps: string | null } {
    const nonDeload = history.filter(h => h.session_type !== 'deload');
    if (nonDeload.length === 0) return { suggestion: null, ghostWeight: null, ghostReps: null };

    // Get max weight per session, take the most recent
    const bySession = new Map<string, SetHistory>();
    for (const h of nonDeload) {
      if (!bySession.has(h.session_id) || h.weight > bySession.get(h.session_id)!.weight) {
        bySession.set(h.session_id, h);
      }
    }
    const sorted = Array.from(bySession.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const last = sorted[0];

    const increment = last.weight >= 50 ? 2.5 : 1.25;
    const suggestKg = Math.round((last.weight + increment) * 4) / 4;
    const unit = this.settingsService.unitLabel();
    const lastDisp = +(this.settingsService.toDisplay(last.weight)).toFixed(2);
    const suggestDisp = +(this.settingsService.toDisplay(suggestKg)).toFixed(2);

    return {
      suggestion: `Last: ${lastDisp} ${unit} × ${last.reps} — try ${suggestDisp} ${unit}`,
      ghostWeight: String(suggestDisp),
      ghostReps: String(last.reps),
    };
  }
}
