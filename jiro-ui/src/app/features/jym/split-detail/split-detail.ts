import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CdkScrollable } from '@angular/cdk/scrolling';
import { Observable, firstValueFrom, forkJoin } from 'rxjs';

import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { JymService, Split, SplitWithRoutines, Routine, RoutineItem, Exercise, ReplaceItemEntry } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JymNewSeriesModalComponent } from '../shared/new-series-modal/new-series-modal';
import { WorkoutLauncher } from '../shared/workout-launcher';
import { JiroMenuComponent, JiroMenuItem } from '../../../shared/components/jiro-menu/jiro-menu';
import { SettingsService } from '../../../core/services/settings.service';
import { formatInstant } from '../../../core/utils/format-date';
import { REST_CHOICES, PlanKind, planText, restText } from '../plan-text';
import { EXERCISE_KINDS, ExerciseKind, distanceUnit, durationText, isRepKind, kindOf, parseDistance, parseDuration, toDistanceUnit } from '../exercise-kind';
import { groupLabels, linkedWithNext, normalizeItems, toggleLink } from '../supersets';
import { MUSCLE_GROUPS } from '../shared/muscles';

@Component({
  selector: 'app-split-detail',
  standalone: true,
  imports: [FormsModule, DragDropModule, CdkScrollable, JiroButtonComponent, JiroModalComponent, JiroIconComponent, JiroSkeletonComponent, JiroMenuComponent, JymNewSeriesModalComponent],
  template: `
    @if (!ready() && loading()) {
      <div class="split-detail" role="status" [attr.aria-label]="templateMode ? 'Loading template' : 'Loading split'">
        <div class="sk-header">
          <jiro-skeleton width="90px" height="14px" />
          <jiro-skeleton width="280px" height="36px" />
          <jiro-skeleton width="200px" height="24px" />
        </div>
        <div class="routines-board">
          @for (i of [1, 2, 3]; track i) {
            <div class="routine-column sk-column">
              <jiro-skeleton width="50%" height="20px" />
              <jiro-skeleton [lines]="4" height="40px" />
            </div>
          }
        </div>
      </div>
    }
    @if (ready()) {
<div class="split-detail">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">
            <jiro-icon name="caret-left" [size]="16" />
            {{ templateMode ? 'All templates' : 'All splits' }}
          </button>
          <div class="split-title-row">
            @if (!editingName()) {
<h1>{{ title() }}</h1>
}
            @if (editingName()) {
<input class="title-input" [(ngModel)]="editName" [attr.aria-label]="templateMode ? 'Template name' : 'Split name'" maxlength="100" (blur)="saveName()" (keydown.enter)="saveName()" autofocus />
}
            <button class="edit-btn" type="button" (click)="startEditName()" [title]="templateMode ? 'Rename template' : 'Rename split'" [attr.aria-label]="templateMode ? 'Rename template' : 'Rename split'">
              <jiro-icon name="pencil-simple" [size]="14" />
            </button>
          </div>

          @if (templateMode) {
            <p class="template-sub">A template on its own. Start it any time, or add a copy to a split as a new day.</p>
          } @else {
          <!-- Visibility + Tags -->
          <div class="split-meta-row">
            <div class="vis-toggle">
              <button class="vis-btn" [class.active]="split()!.visibility === 'private'" (click)="setVisibility('private')">
                <jiro-icon name="lock-simple" [size]="11" />
                Private
              </button>
              <button class="vis-btn" [class.active]="split()!.visibility === 'public'" (click)="setVisibility('public')">
                <jiro-icon name="globe" [size]="11" />
                Public
              </button>
            </div>
            <div class="tags-row">
              @if (!editingTags()) {
<div class="tags-display">
                @for (tag of split()!.tags; track tag) {
<span class="tag-chip">{{ tag }}</span>
}
                <button class="tag-edit-btn" (click)="startEditTags()" [attr.aria-label]="split()!.tags.length ? 'Edit tags' : null">
                  <jiro-icon name="pencil-simple" [size]="11" />
                  {{ split()!.tags.length ? '' : 'Add tags' }}
                </button>
              </div>
}
              @if (editingTags()) {
<div class="tags-edit">
                <label class="tag-label" for="split-tags">Tags, separated by commas</label>
                <input id="split-tags" class="tag-input" type="text" [(ngModel)]="editTagsRaw" placeholder="PPL, Hypertrophy, Beginner" (keydown.enter)="saveTags()" (keydown.escape)="editingTags.set(false)" autofocus />
                <button class="tag-save-btn" (click)="saveTags()">Save</button>
                <button class="tag-cancel-btn" (click)="editingTags.set(false)">Cancel</button>
              </div>
}
            </div>
          </div>
          }
        </div>
        @if (templateMode) {
        <div class="header-btns">
          <jiro-button variant="secondary" type="button" (click)="deleteTemplate()">
            <jiro-icon name="trash" [size]="13" />
            Delete
          </jiro-button>
          <jiro-button variant="secondary" type="button" (click)="openAddToSplit()">
            <jiro-icon name="plus" [size]="13" />
            Add to split
          </jiro-button>
          <jiro-button variant="primary" type="button" [loading]="launcher.starting()" (click)="startTemplate()">
            <jiro-icon name="play:fill" [size]="11" />
            Start
          </jiro-button>
        </div>
        } @else {
        <div class="header-btns">
          <jiro-button variant="secondary" type="button" (click)="openSeriesModal()">
            <jiro-icon name="play:fill" [size]="13" />
            Start series
          </jiro-button>
          <jiro-button variant="secondary" type="button" [disabled]="sharing()" (click)="shareSplit()">
            <jiro-icon name="share-network" [size]="13" />
            {{ sharing() ? 'Generating...' : 'Share' }}
          </jiro-button>
          <jiro-button variant="primary" type="button" (click)="openAddRoutine()">
            Add day
          </jiro-button>
        </div>
        }
      </div>

      <!-- Share panel -->
      @for (link of shares(); track link.share_id) {
        <div class="share-panel">
          <div class="share-url-row">
            <input class="share-url-input" [value]="link.url" readonly [attr.aria-label]="'Share link'" />
            <button class="share-copy-btn" type="button" (click)="copyLink(link.share_id, link.url)" [class.copied]="copied() === link.share_id">
              <jiro-icon [name]="copied() === link.share_id ? 'check' : 'copy'" [size]="14" />
              {{ copied() === link.share_id ? 'Copied' : 'Copy' }}
            </button>
          </div>
          <span class="share-expiry">{{ link.expires_at ? 'Expires ' + expiryLabel(link.expires_at) : 'Never expires' }}</span>
          <button class="share-revoke-btn" type="button" (click)="revokeShare(link.share_id)">Revoke link</button>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="routines-board" role="status" aria-label="Loading days">
          @for (i of [1, 2, 3]; track i) {
            <div class="routine-column sk-column">
              <jiro-skeleton width="50%" height="20px" />
              <jiro-skeleton [lines]="4" height="40px" />
            </div>
          }
        </div>
      }

      <!-- Routines (drag-drop columns) -->
      @if (!loading()) {
<div class="routines-board" [class.single]="templateMode" cdkScrollable>
        @for (routine of routines(); track routine.id; let ri = $index) {
<div
         
          class="routine-column">
          @if (!templateMode) {
          <div class="routine-header">
            <div class="routine-title">
              <span class="day-chip">Day {{ routine.day_order }}</span>
              @if (renamingDay() === routine.id) {
                <input class="day-name-input" [(ngModel)]="dayNameDraft" [attr.aria-label]="'Name for day ' + routine.day_order"
                  maxlength="80" enterkeyhint="done" (blur)="saveDayName(routine)" (keydown.enter)="saveDayName(routine)" (keydown.escape)="renamingDay.set(null)" autofocus />
              } @else {
                <button class="routine-name" type="button" title="Rename" [attr.aria-label]="'Rename ' + routine.name" (click)="startRenameDay(routine)">{{ routine.name }}</button>
              }
            </div>
            <div class="day-actions">
              <button class="icon-btn" type="button" [disabled]="ri === 0 || movingDay()" (click)="moveDay(ri, -1)"
                [attr.aria-label]="'Move ' + routine.name + ' earlier'" title="Move earlier">
                <jiro-icon name="caret-left" [size]="16" />
              </button>
              <button class="icon-btn" type="button" [disabled]="ri === routines().length - 1 || movingDay()" (click)="moveDay(ri, 1)"
                [attr.aria-label]="'Move ' + routine.name + ' later'" title="Move later">
                <jiro-icon name="caret-right" [size]="16" />
              </button>
              <jiro-menu touch [items]="dayActions" [label]="'More actions for ' + routine.name" (select)="onDayAction(routine, ri, $event)" />
            </div>
          </div>
          }

          <!-- Exercise items (drag-drop list) -->
          <div
            cdkDropList
            [cdkDropListData]="routine.items"
            [id]="'routine-' + routine.id"
            [cdkDropListConnectedTo]="getConnectedLists()"
            class="exercise-list"
            (cdkDropListDropped)="onDrop($event, ri)">
            @let labels = supersetLabels(routine.items);
            @for (item of routine.items; track item; let ii = $index) {
<div
             
              cdkDrag
              class="exercise-item"
              [class.in-superset]="!!labels[ii]"
              [class.joined-next]="linked(routine.items, ii)">
              <div class="drag-handle" cdkDragHandle>
                <jiro-icon name="dots-six-vertical" [size]="14" />
              </div>
              <div class="item-info">
                <span class="item-name">
                  @if (labels[ii]) { <span class="ss-label">{{ labels[ii] }}</span> }
                  {{ item.exercise_name }}
                </span>
                @if (item.muscle_group) {
<span class="item-muscle">{{ item.muscle_group }}</span>
}
                <button type="button" class="target-text" (click)="openTargetEdit(ri, ii)"
                  [attr.aria-label]="'Edit the plan for ' + item.exercise_name + ': ' + planLabel(item)"
                  title="Edit the plan">{{ planText(item, 'short', planKind(item)) }}</button>
                @if (item.notes) {
                  <span class="item-note">{{ item.notes }}</span>
                }
              </div>
              @if (ii < routine.items.length - 1) {
                <button class="icon-btn link-btn" type="button" (click)="toggleSuperset(ri, ii)"
                  [class.on]="linked(routine.items, ii)"
                  [attr.aria-pressed]="linked(routine.items, ii)"
                  [attr.aria-label]="(linked(routine.items, ii) ? 'Unlink ' : 'Superset ') + item.exercise_name + (linked(routine.items, ii) ? ' from ' : ' with ') + routine.items[ii + 1].exercise_name"
                  [title]="linked(routine.items, ii) ? 'Unlink from the next exercise' : 'Superset with the next exercise'">
                  <jiro-icon name="link" [size]="14" />
                </button>
              }
              <button class="icon-btn" type="button" (click)="removeItem(ri, ii)" title="Remove exercise"
                [attr.aria-label]="'Remove ' + item.exercise_name + ' from ' + routine.name">
                <jiro-icon name="x" [size]="12" />
              </button>
            </div>
}

            @if (routine.items.length === 0) {
<div class="empty-list">
              Drag exercises here or click + Add
            </div>
}
          </div>

          <button class="add-ex-btn" (click)="openExercisePicker(ri)">
            + Add exercise
          </button>
        </div>
}

        @if (routines().length === 0) {
<div class="board-empty">
          <p class="text-secondary">No days yet. Add your first day to start building.</p>
          <jiro-button variant="primary" type="button" (click)="openAddRoutine()">+ Add day</jiro-button>
        </div>
}
      </div>
}
    </div>
}

    <!-- Add Routine Modal -->
    @if (showAddRoutine()) {
<jiro-modal title="Add day" maxWidth="400px" (close)="showAddRoutine.set(false)">
      <form class="simple-form" (ngSubmit)="addRoutine()">
        <div class="form-group">
          <label class="form-label" for="add-day-name">Day name</label>
          <input id="add-day-name" class="form-input" type="text" [(ngModel)]="newRoutineName" name="name" placeholder="e.g. Push Day" required />
        </div>
        <div class="form-group">
          <label class="form-label" for="add-day-order">Day order</label>
          <input id="add-day-order" class="form-input" type="number" [(ngModel)]="newRoutineDay" name="day" min="1" />
        </div>
        <div class="form-actions">
          <jiro-button variant="secondary" type="button" (click)="showAddRoutine.set(false)">Cancel</jiro-button>
          <jiro-button variant="primary" type="submit" [disabled]="saving() || !newRoutineName.trim()">
            {{ saving() ? 'Adding...' : 'Add day' }}
          </jiro-button>
        </div>
      </form>
    </jiro-modal>
}

    <!-- Exercise Picker Modal -->
    @if (showExPicker()) {
<jiro-modal title="Add exercise" maxWidth="480px" (close)="showExPicker.set(false)">
      <div class="ex-picker">
        @if (!creatingExercise()) {
<label class="sr-only" for="picker-search">Search exercises</label>
<input id="picker-search" class="form-input" type="search" [(ngModel)]="exSearch" (input)="filterExercises()" placeholder="Search exercises..." />
}
        @if (!creatingExercise()) {
<div class="ex-picker-list">
          @for (ex of filteredExercises(); track ex) {
<button
           
            class="ex-pick-btn"
            (click)="addExerciseToRoutine(ex)">
            <span class="ex-pick-name">{{ ex.name }}</span>
            @if (ex.muscle_group) {
<span class="ex-pick-muscle">{{ ex.muscle_group }}</span>
}
          </button>
}
          @if (filteredExercises().length === 0) {
<div class="no-results">
            <p class="text-secondary">No exercises match "{{ exSearch }}".</p>
          </div>
}
        </div>
}

        <!-- Create new exercise inline -->
        @if (!creatingExercise() && !pickerSelectedEx()) {
<button class="create-ex-inline-btn" (click)="startCreateExercise()">
          + Create new exercise{{ exSearch.trim() ? ' "' + exSearch.trim() + '"' : '' }}
        </button>
}

        @if (creatingExercise()) {
<div class="inline-create-form">
          <div class="form-group">
            <label class="form-label" for="picker-new-name">Exercise name *</label>
            <input id="picker-new-name" class="form-input" type="text" [(ngModel)]="newExName" placeholder="e.g. Bulgarian Split Squat" />
          </div>
          <div class="form-group">
            <label class="form-label" for="picker-new-kind">Type</label>
            <select id="picker-new-kind" class="form-input" [(ngModel)]="newExKind">
              @for (k of exerciseKinds; track k.value) { <option [value]="k.value">{{ k.label }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="picker-new-mg">Muscle group</label>
            <select id="picker-new-mg" class="form-input" [ngModel]="newExMuscleGroup" (ngModelChange)="setNewMuscle($event)">
              <option value="">None</option>
              @for (mg of muscleGroups; track mg) {
<option [value]="mg">{{ mg }}</option>
}
            </select>
          </div>
          @if (newExError()) {
<p class="create-ex-error">{{ newExError() }}</p>
}
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="creatingExercise.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="button" [disabled]="newExSaving() || !newExName.trim()" (click)="createAndPickExercise()">
              {{ newExSaving() ? 'Creating...' : 'Create & Select' }}
            </jiro-button>
          </div>
        </div>
}

        <!-- Target sets/reps -->
        @if (pickerSelectedEx()) {
<div class="target-inputs">
          <div class="target-row">
            <div class="form-group">
              <label class="form-label" for="picker-sets">Sets</label>
              <input id="picker-sets" class="form-input" type="number" [(ngModel)]="pickerSets" min="1" max="20" />
            </div>
            @switch (kindOf(pickerSelectedEx()!.kind)) {
              @case ('duration') {
                <div class="form-group">
                  <label class="form-label" for="picker-time">Time</label>
                  <input id="picker-time" class="form-input" type="text" inputmode="numeric" [(ngModel)]="pickerTarget" placeholder="0:45" />
                </div>
              }
              @case ('distance') {
                <div class="form-group">
                  <label class="form-label" for="picker-distance">Distance ({{ distUnit() }})</label>
                  <input id="picker-distance" class="form-input" type="text" inputmode="decimal" [(ngModel)]="pickerTarget" />
                </div>
              }
              @default {
                <div class="form-group">
                  <label class="form-label" for="picker-reps">Reps</label>
                  <input id="picker-reps" class="form-input" type="number" [(ngModel)]="pickerReps" min="1" max="100" />
                </div>
              }
            }
          </div>
          <jiro-button variant="primary" type="button" [disabled]="pickerTargetValue() === null" (click)="confirmAddExercise()">
            Add {{ pickerSelectedEx()!.name }}
          </jiro-button>
        </div>
}
      </div>
    </jiro-modal>
}

    <!-- Add a copy of this template to a split -->
    @if (showAddToSplit()) {
      <jiro-modal sheet title="Add to split" maxWidth="440px" (close)="showAddToSplit.set(false)">
        <p class="sheet-sub">A copy of {{ title() }} becomes the split's last day. The template stays as it is.</p>
        @if (splitsLoading()) {
          <div class="split-pick-list" role="status" aria-label="Loading splits">@for (i of [1, 2]; track i) { <jiro-skeleton height="52px" /> }</div>
        } @else if (splits().length === 0) {
          <p class="text-secondary">No splits yet. Make one on the Plan page, then add this template to it.</p>
        } @else {
          <div class="split-pick-list">
            @for (s of splits(); track s.id) {
              <button type="button" class="split-pick-btn" [disabled]="copying()" (click)="addToSplit(s)">
                <span class="split-pick-name">{{ s.name }}</span>
                <span class="split-pick-days">{{ s.routine_count }} {{ s.routine_count === 1 ? 'day' : 'days' }}</span>
              </button>
            }
          </div>
        }
      </jiro-modal>
    }

    <!-- Start Series Modal -->
    @if (showSeriesModal()) {
      <jym-new-series-modal [splitId]="splitId" [defaultName]="seriesDefaultName()" (closed)="showSeriesModal.set(false)" />
    }

    <!-- Edit Target Modal -->
    @if (targetEdit(); as te) {
<jiro-modal [title]="'Plan for ' + te.name" maxWidth="400px" (close)="targetEdit.set(null)">
      <form class="simple-form plan-form" (ngSubmit)="saveTargetEdit()">
        <div class="target-row" [class.three]="isRepKind(te.kind)">
          <div class="form-group">
            <label class="form-label" for="edit-target-sets">Sets</label>
            <input id="edit-target-sets" class="form-input" type="number" inputmode="numeric" [(ngModel)]="editSets" name="editSets" min="1" max="20" required />
          </div>
          @if (te.kind === 'duration') {
            <div class="form-group">
              <label class="form-label" for="edit-target-time">Time</label>
              <input id="edit-target-time" class="form-input" type="text" inputmode="numeric" [(ngModel)]="editTarget" name="editTarget" placeholder="0:45" required />
            </div>
          } @else if (te.kind === 'distance') {
            <div class="form-group">
              <label class="form-label" for="edit-target-distance">Distance ({{ distUnit() }})</label>
              <input id="edit-target-distance" class="form-input" type="text" inputmode="decimal" [(ngModel)]="editTarget" name="editTarget" required />
            </div>
          } @else {
            <div class="form-group">
              <label class="form-label" for="edit-target-reps">Reps</label>
              <input id="edit-target-reps" class="form-input" type="number" inputmode="numeric" [(ngModel)]="editReps" name="editReps" min="1" max="100" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="edit-target-max">Up to</label>
              <input id="edit-target-max" class="form-input" type="number" inputmode="numeric" [(ngModel)]="editRepsMax" name="editRepsMax" min="1" max="100" placeholder="Optional" />
            </div>
          }
        </div>
        @if (!isRepKind(te.kind) && editTarget.trim() && editTargetValue() === null) {
          <p class="plan-error" role="alert">{{ te.kind === 'duration' ? 'Enter a time such as 45 or 1:30, up to 16:40.' : 'Enter a distance such as 5 or 2.5.' }}</p>
        }
        @if (!validRange()) {
          <p class="plan-error" role="alert">Up to must be at least {{ editReps }}.</p>
        }
        <div class="target-row">
          <div class="form-group">
            <label class="form-label" for="edit-target-rpe">RPE</label>
            <select id="edit-target-rpe" class="form-input" [(ngModel)]="editRpe" name="editRpe">
              <option [ngValue]="null">None</option>
              @for (r of rpeChoices; track r) { <option [ngValue]="r">{{ r }}</option> }
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="edit-target-rest">Rest</label>
            <select id="edit-target-rest" class="form-input" [(ngModel)]="editRest" name="editRest">
              <option [ngValue]="null">Your usual</option>
              @for (r of restChoices; track r) { <option [ngValue]="r">{{ restText(r) }}</option> }
            </select>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="edit-target-note">Note</label>
          <input id="edit-target-note" class="form-input" type="text" [(ngModel)]="editNote" name="editNote" maxlength="140" placeholder="A cue, such as pause at the bottom" />
        </div>
        <p class="plan-hint">With a range, add weight once every set reaches the top.</p>
        <div class="form-actions">
          <jiro-button variant="secondary" type="button" (click)="targetEdit.set(null)">Cancel</jiro-button>
          <jiro-button variant="primary" type="submit" [disabled]="!planValid()">Save</jiro-button>
        </div>
      </form>
    </jiro-modal>
}
  `,
  styles: [`
    :host { display: block; }

    .split-detail { max-width: 1200px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }


    .header-left { display: flex; flex-direction: column; gap: var(--space-sm); }

    .back-btn {
      display: inline-flex; align-items: center; gap: var(--space-xs); min-height: 44px; align-self: flex-start;
      background: none; border: none; color: var(--text-muted);
      font-size: var(--font-size-sm); cursor: pointer; padding: 0;
    }

    .back-btn:hover { color: var(--text-primary); }

    .split-title-row {
      display: flex; align-items: center; gap: var(--space-sm);
    }

    .split-title-row h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .title-input {
      font-family: 'Newsreader', serif;
      font-size: var(--font-size-2xl); font-weight: 700;
      border: none; border-bottom: 2px dashed var(--color-primary);
      background: transparent; color: var(--text-primary);
 padding: 0 var(--space-xs);
    }

    .edit-btn {
      display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px;
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; padding: var(--space-xs); border-radius: var(--border-radius-sm);
    }

    .edit-btn:hover { color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.1); }

    /* Visibility + Tags */
    .split-meta-row { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; margin-top: var(--space-xs); }

    .vis-toggle { display: flex; border: 1px solid var(--border-color); border-radius: var(--border-radius); overflow: hidden; }

    .vis-btn {
      display: flex; align-items: center; gap: 5px;
      padding: 5px 12px; background: none; border: none;
      color: var(--text-muted); font-size: var(--font-size-xs); font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }

    .vis-btn + .vis-btn { border-left: 1px solid var(--border-color); }

    .vis-btn.active { background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); }

    .tags-row { display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap; }

    .tags-display { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }

    .tag-chip {
      background: var(--bg-canvas); 
      color: var(--text-primary);
      font-size: var(--font-size-xs); 
      font-weight: 600;
      padding: 4px 8px; 
      border-radius: var(--border-radius-pill);
      border: 1px dashed var(--border-color);
      box-shadow: 1px 1px 0 var(--border-color);
      white-space: nowrap;
    }

    .tag-edit-btn {
      display: flex; align-items: center; gap: 4px;
      background: none; border: 1px dashed var(--border-color);
      border-radius: var(--border-radius-pill); padding: 2px 8px;
      color: var(--text-muted); font-size: 11px; cursor: pointer;
      transition: all 0.15s;
    }

    .tag-edit-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .tags-edit { display: flex; align-items: center; gap: var(--space-xs); flex-wrap: wrap; }

    .tag-label {
      flex-basis: 100%;
      font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary);
    }

    .tag-input {
      padding: 4px 10px; border: 1px solid var(--color-primary);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm);
 font-family: inherit; width: 240px;
    }

    .tag-save-btn, .tag-cancel-btn {
      padding: 4px 10px; border-radius: var(--border-radius);
      font-size: var(--font-size-xs); cursor: pointer; transition: all 0.15s;
    }

    .tag-save-btn { background: var(--color-primary); color: var(--text-on-primary); border: 1px solid var(--color-primary); }

    .tag-cancel-btn { background: none; border: 1px solid var(--border-color); color: var(--text-muted); }

    .tag-cancel-btn:hover { border-color: var(--color-danger); color: var(--color-danger); }

    .sk-column { padding: var(--space-md); gap: var(--space-md); }
    .sk-header { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-xl); }

    .routines-board {
      display: flex; gap: var(--space-lg); overflow-x: auto;
      padding-bottom: var(--space-md); align-items: flex-start;
    }

    .board-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center; width: 100%;
    }


    .routines-board.single { overflow-x: visible; }
    .routines-board.single .routine-column { min-width: 0; max-width: 640px; width: 100%; flex-shrink: 1; }
    .template-sub { font-size: var(--font-size-sm); color: var(--text-secondary); margin-top: var(--space-xs); }
    .sheet-sub { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-md); }
    .split-pick-list { display: flex; flex-direction: column; gap: var(--space-xs); }
    .split-pick-btn {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-md);
      width: 100%; min-height: 52px; padding: var(--space-sm) var(--space-md);
      background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--border-radius);
      color: var(--text-primary); font: inherit; text-align: left; cursor: pointer;
    }
    .split-pick-btn:hover:not(:disabled) { background: var(--bg-surface-hover); }
    .split-pick-btn:disabled { opacity: 0.6; cursor: wait; }
    .split-pick-name { font-weight: 600; }
    .split-pick-days { font-size: var(--font-size-sm); color: var(--text-secondary); white-space: nowrap; }

    .routine-column {
      min-width: 260px; max-width: 280px; flex-shrink: 0;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); display: flex; flex-direction: column;
    }

    .routine-header {
      display: flex; align-items: center; gap: var(--space-xs);
      padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md); border-bottom: 1px solid var(--border-color);
    }
    .day-actions { display: flex; flex-shrink: 0; }
    .day-name-input {
      flex: 1; min-width: 0; min-height: 44px; padding: 6px 10px;
      border: 1px solid var(--color-primary); border-radius: var(--border-radius-sm);
      background: var(--bg-canvas); color: var(--text-primary);
      font: inherit; font-weight: 600; font-size: var(--font-size-md);
    }

    .routine-title { display: flex; align-items: center; gap: var(--space-xs); flex: 1; min-width: 0; }

    .day-chip {
      background: var(--bg-canvas);
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 4px 8px;
      border-radius: var(--border-radius-pill);
      border: 1px solid var(--border-color);
      box-shadow: 1px 1px 0 rgba(var(--shadow-rgb), 0.1);
      white-space: nowrap;
    }

    .routine-name {
      min-height: 44px; min-width: 44px; padding: 0 4px; border: none; border-radius: var(--border-radius-sm);
      background: none; color: inherit; font-family: inherit; text-align: left; cursor: text;
      font-weight: 600; font-size: var(--font-size-sm);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .routine-name:hover { background: var(--bg-surface-hover); }

    .icon-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); min-width: 44px; min-height: 44px; justify-content: center; border-radius: var(--border-radius-sm);
      display: flex; align-items: center; flex-shrink: 0;
    }
    .icon-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    .icon-btn:hover { color: var(--text-primary); background: var(--bg-surface-hover); }
    .icon-btn.danger:hover { color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.1); }

    .exercise-list {
      padding: var(--space-sm); display: flex; flex-direction: column;
      gap: var(--space-xs); min-height: 60px; flex: 1;
    }

    .exercise-item {
      display: flex; align-items: center; gap: var(--space-xs);
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-xs) var(--space-sm);
      cursor: grab; transition: box-shadow 0.15s;
    }

    .exercise-item:hover { box-shadow: var(--shadow-sm); }

    .exercise-item.cdk-drag-preview {
      box-shadow: var(--shadow-md); opacity: 0.95;
    }

    .exercise-item.cdk-drag-placeholder { opacity: 0.3; }

    .drag-handle { cursor: grab; color: var(--text-muted); flex-shrink: 0; }

    .item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }

    .item-name { font-size: var(--font-size-sm); font-weight: 500; }

    .item-muscle { font-size: var(--font-size-xs); color: var(--text-muted); }

    .target-text {
      align-self: flex-start; margin-top: 2px;
      font-family: inherit; cursor: pointer; min-height: 44px; min-width: 44px;
      background: var(--bg-canvas);
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 4px 8px;
      border-radius: var(--border-radius-pill);
      border: 1px solid var(--border-color);
      box-shadow: 1px 1px 0 rgba(var(--shadow-rgb), 0.1);
      white-space: nowrap;
    }

    .target-text:hover { border-color: var(--color-primary); }

    .exercise-item.in-superset { border-left: 3px solid var(--color-primary); }

    .exercise-item.joined-next { margin-bottom: -4px; border-bottom-left-radius: 0; border-bottom-right-radius: 0; }

    .exercise-item.joined-next + .exercise-item { border-top-left-radius: 0; border-top-right-radius: 0; }

    .ss-label {
      display: inline-block; margin-right: 4px; padding: 0 6px; border-radius: var(--border-radius-pill);
      background: var(--color-primary); color: var(--text-on-primary);
      font-size: var(--font-size-xs); font-weight: 700; font-variant-numeric: tabular-nums;
    }

    .link-btn.on { color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.12); }

    .item-note {
      font-size: var(--font-size-xs); color: var(--text-secondary); font-style: italic;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .empty-list {
      font-size: var(--font-size-xs); color: var(--text-muted);
      text-align: center; padding: var(--space-md);
      border: 1px dashed var(--border-color); border-radius: var(--border-radius);
    }

    .add-ex-btn {
      width: 100%; min-height: 44px; padding: var(--space-sm); background: none;
      border: none; border-top: 1px solid var(--border-color);
      color: var(--text-muted); font-size: var(--font-size-sm);
      cursor: pointer; text-align: center; transition: all 0.15s;
      border-radius: 0 0 var(--border-radius) var(--border-radius);
    }

    .add-ex-btn:hover { color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

    /* Modal forms */
    .simple-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-md); }

    .form-label { 
      font-size: var(--font-size-lg); 
      font-weight: 600; 
      color: var(--text-primary); 
      font-family: 'Newsreader', serif;
    }

    .form-input {
      padding: 10px 0; 
      border: none;
      border-bottom: 2px dashed var(--border-color);
      border-radius: 0; 
      background: transparent;
      color: var(--text-primary); 
      font-size: var(--font-size-md);
      transition: border-color 0.2s; 
      font-family: inherit; 
      width: 100%; 
      box-sizing: border-box;
    }

    .form-input:focus { border-bottom-color: var(--color-primary); }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }


    /* Exercise picker */
    .ex-picker { display: flex; flex-direction: column; gap: var(--space-md); }

    .ex-picker-list {
      max-height: 240px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 2px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: var(--space-xs);
    }

    .ex-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-sm) var(--space-md); background: none;
      border: none; border-radius: var(--border-radius-sm); cursor: pointer;
      text-align: left; width: 100%; transition: background 0.15s;
    }

    .ex-pick-btn:hover { background: rgba(var(--color-primary-rgb), 0.08); }

    .ex-pick-name { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); }

    .ex-pick-muscle { font-size: var(--font-size-xs); color: var(--text-muted); }

    .no-results { padding: var(--space-md); text-align: center; }

    .target-inputs {
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md);
      display: flex; flex-direction: column; gap: var(--space-md);
    }


    .target-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }

    .target-row.three { grid-template-columns: 1fr 1fr 1fr; }

    .plan-form .form-input { min-height: 44px; }

    .plan-error { margin: 0; font-size: var(--font-size-sm); color: var(--color-danger); }

    .plan-hint { margin: 0; font-size: var(--font-size-xs); color: var(--text-muted); }

    .create-ex-inline-btn {
      width: 100%; padding: var(--space-sm) var(--space-md);
      background: none; border: 1px dashed var(--border-color);
      border-radius: var(--border-radius); color: var(--color-primary);
      font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
      text-align: center; transition: all 0.15s; font-family: inherit;
    }

    .create-ex-inline-btn:hover { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

    .inline-create-form {
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md);
      display: flex; flex-direction: column; gap: var(--space-sm);
    }

    .create-ex-error { font-size: var(--font-size-xs); color: var(--color-danger); margin: 0; }

    /* Share panel */
    .header-btns { display: flex; gap: var(--space-sm); align-items: center; }

    .share-panel {
      display: flex; align-items: center; gap: var(--space-sm);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-sm) var(--space-md);
      margin-bottom: var(--space-lg); flex-wrap: wrap;
    }

    .share-url-row { display: flex; flex: 1 1 100%; gap: var(--space-xs); min-width: 0; }

    .share-url-input {
      flex: 1; min-width: 0; min-height: 44px; padding: 6px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas); color: var(--text-secondary);
      font-size: var(--font-size-sm); font-family: monospace;
    }

    .share-copy-btn {
      display: inline-flex; align-items: center; gap: 5px;
      min-height: 44px; padding: 6px 12px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm); cursor: pointer;
      white-space: nowrap; transition: all 0.15s;
    }
    .share-copy-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .share-copy-btn.copied { border-color: var(--color-positive); color: var(--color-positive); }

    .share-expiry { color: var(--text-muted); font-size: var(--font-size-sm); white-space: nowrap; }

    .share-revoke-btn {
      margin-left: auto; background: none; border: none; color: var(--text-muted);
      font-size: var(--font-size-sm); cursor: pointer; white-space: nowrap;
      min-height: 44px; padding: 4px var(--space-sm); transition: color 0.15s;
    }
    .share-revoke-btn:hover { color: var(--color-danger); }


    @media (max-width: 600px) {
      .page-header { flex-direction: column; align-items: stretch; }
      .header-btns { flex-wrap: wrap; --jiro-btn-width: 100%; }
      .header-btns > jiro-button { flex: 1 1 auto; }
      .tag-input { width: 100%; }
    }

  `]
})
export class SplitDetailComponent implements OnInit {
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly settings = inject(SettingsService);
  readonly launcher = inject(WorkoutLauncher);

  /** Editing a template (route data `template`): one day, no split around it. */
  readonly templateMode = inject(ActivatedRoute).snapshot.data['template'] === true;
  split = signal<SplitWithRoutines | null>(null);
  routines = signal<(Routine & { items: RoutineItem[] })[]>([]);
  loading = signal(true);
  saving = signal(false);
  editingName = signal(false);
  showAddRoutine = signal(false);
  showExPicker = signal(false);

  // Series creation
  showSeriesModal = signal(false);

  // A template's Add to split sheet
  showAddToSplit = signal(false);
  splits = signal<Split[]>([]);
  splitsLoading = signal(false);
  copying = signal(false);
  readonly dayActions: JiroMenuItem[] = [
    { id: 'template', label: 'Save as template', icon: 'floppy-disk' },
    { id: 'delete', label: 'Delete day', icon: 'trash', danger: true },
  ];

  // Editing one exercise's target sets and reps
  targetEdit = signal<{ ri: number; ii: number; name: string; kind: ExerciseKind } | null>(null);
  /** A hold's time or a distance, as typed, for duration and distance plans. */
  editTarget = '';
  editSets = 3;
  editReps = 8;
  editRepsMax: number | null = null;
  editRpe: number | null = null;
  editRest: number | null = null;
  editNote = '';
  readonly rpeChoices = [6, 7, 8, 9, 10];
  readonly restChoices = REST_CHOICES;
  readonly planText = planText;
  readonly restText = restText;

  editName = '';
  editingTags = signal(false);
  editTagsRaw = '';
  newRoutineName = '';
  newRoutineDay = 1;

  // Share: the split's live links (Share reuses the newest)
  shares = signal<{ share_id: string; url: string; expires_at: string | null }[]>([]);
  sharing = signal(false);
  /** The link just copied, for its tick. */
  copied = signal('');

  // Days
  renamingDay = signal<string | null>(null);
  dayNameDraft = '';
  movingDay = signal(false);

  // Item saves run one after another; a response lands only if no newer edit of its days came since.
  private saveQueue: Promise<unknown> = Promise.resolve();
  private editStamp = new Map<string, number>();

  allExercises = signal<Exercise[]>([]);
  filteredExercises = signal<Exercise[]>([]);
  exSearch = '';
  pickerSelectedEx = signal<Exercise | null>(null);
  pickerSets = 3;
  pickerReps = 8;
  /** The picker's time or distance for a duration or distance exercise, as typed. */
  pickerTarget = '';
  private pickerRoutineIndex = 0;

  // Inline exercise creation
  creatingExercise = signal(false);
  newExName = '';
  newExMuscleGroup = '';
  newExKind: ExerciseKind = 'weight_reps';
  newExSaving = signal(false);
  newExError = signal('');
  readonly muscleGroups = MUSCLE_GROUPS;
  readonly exerciseKinds = EXERCISE_KINDS;
  readonly kindOf = kindOf;
  readonly isRepKind = isRepKind;
  /** Distances follow the weight unit: km for kg, miles for lbs. */
  readonly distUnit = computed(() => distanceUnit(this.settings.weightUnit()));

  splitId = '';

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    private router: Router,
  ) { }

  /** The page has something to show: the split, or the template. */
  readonly ready = computed(() => this.templateMode ? this.routines().length > 0 : !!this.split());
  readonly title = computed(() => this.templateMode ? this.routines()[0]?.name ?? '' : this.split()?.name ?? '');

  ngOnInit() {
    this.splitId = this.route.snapshot.paramMap.get('id') || '';
    this.loadSplit();
    this.jymService.listExercises().subscribe(exs => {
      this.allExercises.set(exs);
      this.filteredExercises.set(exs);
    });
  }

  loadSplit() {
    this.loading.set(true);
    if (this.templateMode) {
      this.jymService.getTemplate(this.splitId).subscribe({
        next: t => {
          this.routines.set([{ ...t, items: t.items || [] }]);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toast.error('Could not open that template.');
          this.goBack();
        },
      });
      return;
    }
    this.jymService.getSplit(this.splitId).subscribe({
      next: s => {
        this.split.set(s);
        this.routines.set(s.routines.map(r => ({ ...r, items: r.items || [] })).sort((a, b) => a.day_order - b.day_order));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
    this.jymService.listShares(this.splitId).subscribe({ next: links => this.shares.set(links), error: () => {} });
  }

  expiryLabel(iso: string): string {
    return formatInstant(iso, this.settings.timezone());
  }

  /** Opens Add day with the next day number, not always 1. */
  openAddRoutine() {
    this.newRoutineName = '';
    this.newRoutineDay = Math.max(0, ...this.routines().map(r => r.day_order)) + 1;
    this.showAddRoutine.set(true);
  }

  startRenameDay(routine: Routine) {
    this.dayNameDraft = routine.name;
    this.renamingDay.set(routine.id);
  }

  saveDayName(routine: Routine) {
    if (this.renamingDay() !== routine.id) return;
    const name = this.dayNameDraft.trim();
    this.renamingDay.set(null);
    if (!name || name === routine.name) return;
    this.routines.update(rs => rs.map(r => r.id === routine.id ? { ...r, name } : r));
    this.jymService.updateRoutine(routine.id, { name }).subscribe({
      error: () => {
        this.routines.update(rs => rs.map(r => r.id === routine.id ? { ...r, name: routine.name } : r));
        this.toast.error(this.templateMode ? 'Could not rename the template.' : 'Could not rename the day.');
      },
    });
  }

  /** Swaps a day with its neighbour: their day numbers trade places. */
  moveDay(ri: number, step: -1 | 1) {
    const rs = this.routines();
    const a = rs[ri];
    const b = rs[ri + step];
    if (!a || !b || this.movingDay()) return;
    this.movingDay.set(true);
    const swapped = rs.map(r => r.id === a.id ? { ...r, day_order: b.day_order } : r.id === b.id ? { ...r, day_order: a.day_order } : r);
    this.routines.set([...swapped].sort((x, y) => x.day_order - y.day_order));
    forkJoin([
      this.jymService.updateRoutine(a.id, { day_order: b.day_order }),
      this.jymService.updateRoutine(b.id, { day_order: a.day_order }),
    ]).subscribe({
      next: () => this.movingDay.set(false),
      error: () => { this.movingDay.set(false); this.saveFailed(); },
    });
  }

  /** Queues one save of whole day lists; applies its answer only if those days haven't been edited since. */
  private queueSave<T>(routineIds: string[], request: () => Observable<T>, apply: (res: T) => void) {
    const stamps = routineIds.map(id => {
      const n = (this.editStamp.get(id) ?? 0) + 1;
      this.editStamp.set(id, n);
      return [id, n] as const;
    });
    this.saveQueue = this.saveQueue.then(() => firstValueFrom(request()).then(
      res => { if (stamps.every(([id, n]) => this.editStamp.get(id) === n)) apply(res); },
      () => this.saveFailed(),
    ));
  }

  goBack() {
    this.router.navigate(['/jym/plan'], this.templateMode ? { queryParams: { tab: 'templates' } } : {});
  }

  startEditName() {
    this.editName = this.title();
    this.editingName.set(true);
  }

  saveName() {
    if (!this.editName.trim() || this.editName.trim() === this.title()) {
      this.editingName.set(false);
      return;
    }
    if (this.templateMode) {
      const t = this.routines()[0];
      this.dayNameDraft = this.editName;
      this.renamingDay.set(t.id);
      this.saveDayName(t);
      this.editingName.set(false);
      return;
    }
    this.jymService.updateSplit(this.splitId, { name: this.editName.trim() }).subscribe({
      next: s => {
        this.split.update(cur => cur ? { ...cur, name: s.name } : cur);
        this.editingName.set(false);
      },
      error: () => this.editingName.set(false),
    });
  }

  setVisibility(v: 'private' | 'public') {
    if (v === this.split()?.visibility) return;
    this.jymService.updateSplit(this.splitId, { visibility: v }).subscribe({
      next: s => this.split.update(cur => cur ? { ...cur, visibility: s.visibility } : cur),
      error: () => this.toast.error('Could not change who can see this split.'),
    });
  }

  startEditTags() {
    this.editTagsRaw = (this.split()?.tags || []).join(', ');
    this.editingTags.set(true);
  }

  saveTags() {
    const tags = this.editTagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
    this.jymService.updateSplit(this.splitId, { tags }).subscribe({
      next: s => {
        this.split.update(cur => cur ? { ...cur, tags: s.tags } : cur);
        this.editingTags.set(false);
      },
      error: () => this.editingTags.set(false),
    });
  }

  addRoutine() {
    if (!this.newRoutineName.trim()) return;
    this.saving.set(true);
    this.jymService.createRoutine(this.splitId, { name: this.newRoutineName.trim(), day_order: this.newRoutineDay }).subscribe({
      next: r => {
        this.routines.update(list => [...list, { ...r, items: [] }].sort((a, b) => a.day_order - b.day_order));
        this.showAddRoutine.set(false);
        this.newRoutineName = '';
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  async deleteRoutine(routine: Routine, ri: number) {
    const ok = await this.confirmService.confirm({
      title: `Delete ${routine.name}?`,
      message: 'The day and the exercises planned on it are removed from this split.',
      confirmLabel: 'Delete day',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteRoutine(routine.id).subscribe({
      next: () => {
        this.routines.update(list => list.filter((_, i) => i !== ri));
        this.toast.success(`${routine.name} deleted`);
      },
      error: () => this.toast.error('Could not delete the day.'),
    });
  }

  onDayAction(routine: Routine, ri: number, action: string) {
    if (action === 'template') this.saveDayAsTemplate(routine);
    else if (action === 'delete') this.deleteRoutine(routine, ri);
  }

  /** A copy of the day, plan and all, as a template; the day stays in the split. */
  async saveDayAsTemplate(routine: Routine) {
    await this.saveQueue;
    this.jymService.copyRoutine(routine.id).subscribe({
      next: t => this.toast.success(`${t.name} saved as a template`),
      error: () => this.toast.error('Could not save the day as a template.'),
    });
  }

  openAddToSplit() {
    this.showAddToSplit.set(true);
    this.splitsLoading.set(true);
    this.jymService.listSplits().subscribe({
      next: s => { this.splits.set(s); this.splitsLoading.set(false); },
      error: () => { this.splitsLoading.set(false); this.toast.error('Could not load your splits.'); },
    });
  }

  /** A copy of the template becomes the split's last day; the template stays. */
  async addToSplit(split: Split) {
    const t = this.routines()[0];
    if (!t || this.copying()) return;
    this.copying.set(true);
    await this.saveQueue;
    this.jymService.copyRoutine(t.id, { split_id: split.id }).subscribe({
      next: day => {
        this.copying.set(false);
        this.showAddToSplit.set(false);
        this.toast.success(`Added to ${split.name} as day ${day.day_order}`);
      },
      error: () => {
        this.copying.set(false);
        this.toast.error('Could not add it to that split.');
      },
    });
  }

  /** Starts a workout from the template once its last edit is saved. */
  async startTemplate() {
    const t = this.routines()[0];
    if (!t) return;
    await this.saveQueue;
    this.launcher.start({ routine_id: t.id });
  }

  async deleteTemplate() {
    const t = this.routines()[0];
    if (!t) return;
    const ok = await this.confirmService.confirm({
      title: `Delete ${t.name}?`,
      message: 'This removes the template only. Workouts you started from it are not affected.',
      confirmLabel: 'Delete template',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteTemplate(t.id).subscribe({
      next: () => {
        this.toast.success(`${t.name} deleted`);
        this.goBack();
      },
      error: () => this.toast.error('Could not delete the template.'),
    });
  }

  getConnectedLists(): string[] {
    return this.routines().map(r => 'routine-' + r.id);
  }

  onDrop(event: CdkDragDrop<RoutineItem[]>, routineIndex: number) {
    const lists = this.routines();
    const prevIdx = lists.findIndex(r => 'routine-' + r.id === event.previousContainer.id);
    const currIdx = routineIndex;
    if (prevIdx < 0) return;

    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      const moved = [...lists[currIdx].items];
      moveItemInArray(moved, event.previousIndex, event.currentIndex);
      const items = normalizeItems(moved);
      this.routines.update(rs => rs.map((r, i) => i === currIdx ? { ...r, items } : r));
      this.persistItems(currIdx);
      return;
    }

    // Save both days in one request so the exercise can't end up on both or neither.
    const prevItems = [...lists[prevIdx].items];
    const currItems = [...lists[currIdx].items];
    // An exercise moved to another day leaves its superset behind.
    const [moved] = prevItems.splice(event.previousIndex, 1);
    currItems.splice(event.currentIndex, 0, { ...moved, superset_group: null });
    this.routines.update(rs => rs.map((r, i) => {
      if (i === prevIdx) return { ...r, items: normalizeItems(prevItems) };
      if (i === currIdx) return { ...r, items: normalizeItems(currItems) };
      return r;
    }));

    const source = this.routines()[prevIdx];
    const target = this.routines()[currIdx];
    const body = [
      { routine_id: source.id, items: toEntries(source.items) },
      { routine_id: target.id, items: toEntries(target.items) },
    ];
    this.queueSave([source.id, target.id], () => this.jymService.replaceSplitItems(this.splitId, body), saved => {
      const byId = new Map(saved.map(r => [r.routine_id, r.items]));
      this.routines.update(rs => rs.map(r => byId.has(r.id) ? { ...r, items: byId.get(r.id)! } : r));
    });
  }

  /** Saves one day's full item list, after any save still running; on failure reloads so the page matches the server. */
  private persistItems(routineIndex: number) {
    const routine = this.routines()[routineIndex];
    const entries = toEntries(routine.items);
    this.queueSave([routine.id], () => this.jymService.replaceRoutineItems(routine.id, entries),
      saved => this.routines.update(rs => rs.map(r => r.id === routine.id ? { ...r, items: saved } : r)));
  }

  private saveFailed() {
    this.toast.error('Could not save that change. Showing the saved plan.');
    this.loadSplit();
  }

  openTargetEdit(ri: number, ii: number) {
    const item = this.routines()[ri]?.items[ii];
    if (!item) return;
    const kind = kindOf(item.exercise_kind);
    this.editSets = item.target_sets;
    this.editReps = item.target_reps;
    this.editRepsMax = item.target_reps_max;
    this.editRpe = item.target_rpe;
    this.editRest = item.rest_seconds;
    this.editNote = item.notes ?? '';
    this.editTarget = kind === 'duration' ? durationText(item.target_reps)
      : kind === 'distance' && item.target_distance_m ? String(toDistanceUnit(item.target_distance_m, this.distUnit())) : '';
    this.targetEdit.set({ ri, ii, name: item.exercise_name, kind });
  }

  /** What a plan's target means for this item: reps, seconds held, or a distance in the account's unit. */
  planKind(item: { exercise_kind?: string | null }): PlanKind {
    return { kind: kindOf(item.exercise_kind), distanceUnit: this.distUnit() };
  }

  /** The plan sheet's time (seconds, up to 1000) or distance (metres); null when not valid. */
  editTargetValue(): number | null {
    return this.targetValue(this.targetEdit()?.kind ?? 'weight_reps', this.editTarget);
  }

  private targetValue(kind: ExerciseKind, text: string): number | null {
    if (kind === 'duration') {
      const s = parseDuration(text);
      return s !== null && s <= 1000 ? s : null;
    }
    return kind === 'distance' ? parseDistance(text, this.distUnit()) : null;
  }

  planValid(): boolean {
    const te = this.targetEdit();
    if (!te || !this.validTarget(this.editSets, 20)) return false;
    return isRepKind(te.kind) ? this.validTarget(this.editReps, 100) && this.validRange() : this.editTargetValue() !== null;
  }

  /** The picker's target: reps, or the typed time or distance; null when not valid. */
  pickerTargetValue(): number | null {
    const kind = kindOf(this.pickerSelectedEx()?.kind);
    return isRepKind(kind) ? this.pickerReps : this.targetValue(kind, this.pickerTarget);
  }

  /** Cardio suggests Distance + time for a new exercise; it can still be changed. */
  setNewMuscle(muscle: string) {
    this.newExMuscleGroup = muscle;
    if (muscle === 'Cardio' && this.newExKind === 'weight_reps') this.newExKind = 'distance';
  }

  validTarget(v: number, max: number): boolean {
    return Number.isInteger(v) && v >= 1 && v <= max;
  }

  /** "Up to" is optional; when given it can't end below the reps. */
  validRange(): boolean {
    const max = this.editRepsMax;
    return max === null || max === undefined || (Number.isInteger(max) && max >= this.editReps && max <= 100);
  }

  /** A1, A2, B1 for superset members, null for the rest. */
  supersetLabels(items: RoutineItem[]): (string | null)[] {
    return groupLabels(items.map(it => it.superset_group));
  }

  linked(items: RoutineItem[], i: number): boolean {
    return linkedWithNext(items.map(it => it.superset_group), i);
  }

  /** Links an exercise with the next one in a superset, or unlinks them. */
  toggleSuperset(ri: number, ii: number) {
    const items = this.routines()[ri].items;
    const groups = toggleLink(items.map(it => it.superset_group), ii);
    this.routines.update(rs => rs.map((r, i) => i !== ri ? r : { ...r, items: r.items.map((it, j) => ({ ...it, superset_group: groups[j] })) }));
    this.persistItems(ri);
  }

  /** The chip's spoken text: the plan in words, and the cue. */
  planLabel(item: RoutineItem): string {
    return planText(item, 'long', this.planKind(item)) + (item.notes ? `. ${item.notes}` : '');
  }

  saveTargetEdit() {
    const te = this.targetEdit();
    if (!te || !this.planValid()) return;
    const sets = this.editSets;
    const value = this.editTargetValue();
    // A hold's seconds are its reps; a distance plan's reps only say there is a plan.
    const reps = te.kind === 'duration' ? value! : te.kind === 'distance' ? 1 : this.editReps;
    const details = {
      target_reps_max: isRepKind(te.kind) && this.editRepsMax && this.editRepsMax > reps ? this.editRepsMax : null,
      target_rpe: this.editRpe,
      rest_seconds: this.editRest,
      notes: this.editNote.trim() || null,
      target_distance_m: te.kind === 'distance' ? value : null,
    };
    this.routines.update(rs => rs.map((r, i) => i !== te.ri ? r : {
      ...r,
      items: r.items.map((it, j) => j !== te.ii ? it : { ...it, target_sets: sets, target_reps: reps, ...details }),
    }));
    this.targetEdit.set(null);
    this.persistItems(te.ri);
  }

  openExercisePicker(routineIndex: number) {
    this.pickerRoutineIndex = routineIndex;
    this.pickerSelectedEx.set(null);
    this.exSearch = '';
    this.creatingExercise.set(false);
    this.filteredExercises.set(this.allExercises());
    this.showExPicker.set(true);
  }

  filterExercises() {
    const q = this.exSearch.toLowerCase();
    this.filteredExercises.set(this.allExercises().filter(e =>
      e.name.toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q)
    ));
  }

  addExerciseToRoutine(ex: Exercise) {
    this.pickerSelectedEx.set(ex);
    const kind = kindOf(ex.kind);
    this.pickerSets = kind === 'distance' ? 1 : 3;
    this.pickerReps = 8;
    this.pickerTarget = kind === 'duration' ? '0:45' : kind === 'distance' ? (this.distUnit() === 'km' ? '5' : '3') : '';
    this.creatingExercise.set(false);
  }

  startCreateExercise() {
    this.newExName = this.exSearch.trim();
    this.newExMuscleGroup = '';
    this.newExKind = 'weight_reps';
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
      kind: this.newExKind,
    }).subscribe({
      next: ex => {
        // Add to local exercise list
        this.allExercises.update(list => [...list, ex]);
        this.filteredExercises.set(this.allExercises());
        this.newExSaving.set(false);
        this.creatingExercise.set(false);
        // Auto-select the newly created exercise
        this.addExerciseToRoutine(ex);
      },
      error: () => {
        this.newExSaving.set(false);
        this.newExError.set('Could not create exercise. The name may already be taken.');
      },
    });
  }

  confirmAddExercise() {
    const ex = this.pickerSelectedEx();
    if (!ex) return;
    const ri = this.pickerRoutineIndex;
    const routine = this.routines()[ri];
    const kind = kindOf(ex.kind);
    const value = this.pickerTargetValue();
    if (value === null) return;

    const newItem: RoutineItem = {
      id: '',
      routine_id: routine.id,
      exercise_id: ex.id,
      target_sets: this.pickerSets,
      target_reps: kind === 'distance' ? 1 : value,
      target_distance_m: kind === 'distance' ? value : null,
      exercise_kind: kind,
      target_reps_max: null,
      target_rpe: null,
      rest_seconds: null,
      notes: null,
      superset_group: null,
      order_index: routine.items.length,
      exercise_name: ex.name,
      muscle_group: ex.muscle_group,
    };

    const updatedItems = [...routine.items, newItem];
    this.routines.update(rs => rs.map((r, i) => i === ri ? { ...r, items: updatedItems } : r));
    this.persistItems(ri);

    this.showExPicker.set(false);
    this.pickerSelectedEx.set(null);
  }

  /** Shows the split's live link, making one only when there is none. */
  shareSplit() {
    this.sharing.set(true);
    this.jymService.createShare(this.splitId).subscribe({
      next: res => {
        this.shares.update(list => list.some(l => l.share_id === res.share_id) ? list : [res, ...list]);
        this.sharing.set(false);
      },
      error: () => {
        this.sharing.set(false);
        this.toast.error('Could not make a share link.');
      },
    });
  }

  revokeShare(shareId: string) {
    this.jymService.revokeShare(shareId).subscribe({
      next: () => this.shares.update(list => list.filter(l => l.share_id !== shareId)),
      error: () => this.toast.error('Could not turn off the link.'),
    });
  }

  copyLink(shareId: string, url: string) {
    navigator.clipboard.writeText(url).then(() => {
      this.copied.set(shareId);
      setTimeout(() => this.copied.set(''), 2000);
    });
  }

  removeItem(routineIndex: number, itemIndex: number) {
    const routine = this.routines()[routineIndex];
    const updatedItems = normalizeItems(routine.items.filter((_, i) => i !== itemIndex));
    this.routines.update(rs => rs.map((r, i) => i === routineIndex ? { ...r, items: updatedItems } : r));
    this.persistItems(routineIndex);
  }

  openSeriesModal() {
    this.showSeriesModal.set(true);
  }

  seriesDefaultName(): string {
    const name = this.split()?.name;
    return name ? name + ' Run' : '';
  }
}

/** Every field of each item, or a save (a drag included) would drop it. */
function toEntries(items: RoutineItem[]): ReplaceItemEntry[] {
  return items.map(item => ({
    exercise_id: item.exercise_id,
    target_sets: item.target_sets,
    target_reps: item.target_reps,
    target_reps_max: item.target_reps_max,
    target_rpe: item.target_rpe,
    rest_seconds: item.rest_seconds,
    notes: item.notes,
    superset_group: item.superset_group,
    target_distance_m: item.target_distance_m ?? null,
    detailed: true,
  }));
}
