import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  JymService,
  RoutineItem,
  CreateSetRequest,
  SetHistory,
} from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { AuthService } from '../../../core/services/auth.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

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
  imports: [CommonModule, FormsModule, JiroButtonComponent, JiroModalComponent],
  template: `
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
          <jiro-button variant="secondary" type="button" (click)="showExitConfirm.set(true)">Exit</jiro-button>
          <jiro-button variant="primary" type="button" (click)="finishSession()" [disabled]="finishing()">
            {{ finishing() ? 'Finishing...' : 'Finish' }}
          </jiro-button>
        </div>
      </div>
      <!-- Rest timer row — expands the bar after logging a set -->
      <div *ngIf="restTimerActive()" class="rest-row" [class.rest-done]="restTimerDone()">
        <span class="rest-label">Rest</span>
        <span class="rest-countdown">{{ restTimerDisplay() }}</span>
        <div class="rest-presets">
          <button *ngFor="let d of restPresets" class="rest-chip"
            [class.active]="restTimerDuration() === d"
            (click)="setRestDuration(d)">{{ restPresetLabel(d) }}</button>
          <button class="rest-chip rest-add-btn" (click)="addRestTime(30)" title="Add 30 seconds">+30s</button>
        </div>
        <button class="rest-skip-btn" (click)="skipRestTimer()">✕</button>
        <div class="rest-progress">
          <div class="rest-progress-fill"
            [style.width.%]="(restTimerRemaining() / restTimerDuration()) * 100"></div>
        </div>
      </div>
    </div>

    <!-- Deload / Test notice -->
    <div *ngIf="sessionType() === 'deload'" class="type-notice deload-notice">
      Deload session: take it easy and foucus on recovery.
    </div>
    <div *ngIf="sessionType() === 'test'" class="type-notice test-notice">
      Light weight baby!!! Use this session to find new 1RMs and set new PRs.
    </div>

    <!-- Loading -->
    <div class="player-body">
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading session...</p>
      </div>

      <!-- Session notes -->
      <div *ngIf="!loading()" class="notes-panel">
        <textarea
          class="notes-input"
          [(ngModel)]="sessionNotes"
          placeholder="Session notes (optional)..."
          rows="2"
          (blur)="saveNotes()">
        </textarea>
      </div>

      <!-- Body weight panel -->
      <div *ngIf="!loading()" class="bw-panel">
        <span class="bw-label">Body weight</span>
        <div *ngIf="!bwLogged()" class="bw-row">
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
        <span *ngIf="bwLogged()" class="bw-logged">✓ {{ bwValue }} kg logged</span>
      </div>

      <!-- Session body -->
      <div *ngIf="!loading()" class="exercises">
        <!-- Empty state -->
        <div *ngIf="blocks().length === 0" class="no-exercises">
          <h3>No exercises yet</h3>
          <p class="text-secondary">Tap "+ Add Exercise" below to add your first lift.</p>
        </div>

        <!-- Exercise blocks -->
        <div *ngFor="let block of blocks(); let bi = index" class="ex-block">
          <div class="block-header" [class.block-open]="!isCollapsed(bi)" (click)="toggleBlock(bi)">
            <div class="block-title">
              <h3>{{ block.exerciseName }}</h3>
              <span *ngIf="block.muscleGroup" class="mg-tag">{{ block.muscleGroup }}</span>
              <span *ngIf="isCollapsed(bi) && savedCount(bi) > 0" class="sets-done-tag">{{ savedCount(bi) }} sets</span>
            </div>
            <svg class="chevron" [class.open]="!isCollapsed(bi)" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6,9 12,15 18,9"/>
            </svg>
          </div>

          <ng-container *ngIf="!isCollapsed(bi)">
            <!-- Progressive overload suggestion -->
            <div *ngIf="block.suggestion && !allSaved(bi)" class="overload-hint">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
              </svg>
              {{ block.suggestion }}
            </div>

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
              <span class="sh warmup-col" title="Warm-up set">W</span>
              <span class="sh action"></span>
            </div>

            <!-- Set rows -->
            <ng-container *ngFor="let row of block.sets; let si = index">
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
                  <span *ngIf="row.ghostWeight && !row.weight" class="ghost-hint">{{ row.ghostWeight }}</span>
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
                  <span *ngIf="row.ghostReps && !row.reps" class="ghost-hint">{{ row.ghostReps }}</span>
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
                  class="warmup-btn"
                  [class.warmup-active]="row.isWarmup"
                  title="{{ row.isWarmup ? 'Warm-up set' : 'Mark as warm-up' }}"
                  (click)="toggleWarmup(bi, si)">W</button>

                <div class="action-cell">
                  <img *ngIf="row.saved && row.isPR" src="/icons/badge-icon.svg" class="pr-badge" title="Personal Record" alt="PR" />
                  <button
                    *ngIf="!row.saved"
                    class="log-btn"
                    [disabled]="row.saving || !row.weight || !row.reps || (!!row.rpe && rpeInvalid(row.rpe))"
                    (click)="logSet(bi, si)">
                    <span *ngIf="!row.saving">✓</span>
                    <span *ngIf="row.saving" class="spinner-sm"></span>
                  </button>
                  <button *ngIf="row.saved" class="del-btn" (click)="deleteSet(bi, si)">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </div>
              </div>
              <div *ngIf="!row.saved && !!row.rpe && rpeInvalid(row.rpe)" class="rpe-err-msg">
                RPE must be between 1 and 10
              </div>
            </ng-container>

            <!-- Add set -->
            <button class="add-set-btn" (click)="addSet(bi)">+ Add Set</button>
          </ng-container>
        </div>

        <!-- Add exercise -->
        <button class="add-exercise-btn" (click)="addExercise()">+ Add Exercise</button>
      </div>
    </div>

    <!-- Exit confirmation modal -->
    <jiro-modal *ngIf="showExitConfirm()" title="Exit Workout?" maxWidth="400px" (close)="showExitConfirm.set(false)">
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

    <!-- Exercise picker overlay -->
    <div *ngIf="showExPicker()" class="overlay">
      <div class="picker-panel">
        <div class="picker-header">
          <h3>Add Exercise</h3>
          <button class="close-btn" (click)="showExPicker.set(false)">✕</button>
        </div>
        <input class="picker-search" type="text" [(ngModel)]="exSearch" (input)="filterExercises()" placeholder="Search..." />
        <div class="picker-list">
          <button *ngFor="let ex of filteredExercises()" class="picker-item" (click)="pickExercise(ex)">
            <span class="pi-name">{{ ex.name }}</span>
            <span *ngIf="ex.muscle_group" class="pi-mg">{{ ex.muscle_group }}</span>
          </button>
          <p *ngIf="filteredExercises().length === 0" class="text-secondary" style="padding:var(--space-md);text-align:center">No exercises found</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* Sticky bar */
    .session-bar {
      position: sticky; top: 0; z-index: 200;
      background: var(--color-primary); color: white;
      box-shadow: 0 2px 12px rgba(0,0,0,0.2);
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
      background: rgba(0,0,0,0.15);
      border-top: 1px solid rgba(255,255,255,0.1);
      position: relative; overflow: hidden;
      transition: background 0.4s;
    }

    .rest-row.rest-done { background: rgba(74,103,65,0.45); }

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
      padding: 2px 8px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.3); background: none;
      color: rgba(255,255,255,0.65); font-size: var(--font-size-xs);
      cursor: pointer; transition: all 0.15s; font-family: inherit; white-space: nowrap;
    }

    .rest-chip:hover { border-color: rgba(255,255,255,0.7); color: white; }

    .rest-chip.active {
      background: rgba(255,255,255,0.2); border-color: rgba(255,255,255,0.7);
      color: white; font-weight: 600;
    }

    .rest-add-btn { border-style: dashed; }

    .rest-skip-btn {
      padding: 3px 8px; border-radius: 10px;
      border: 1px solid rgba(255,255,255,0.25); background: none;
      color: rgba(255,255,255,0.55); cursor: pointer;
      font-size: var(--font-size-xs); transition: all 0.15s; font-family: inherit;
    }

    .rest-skip-btn:hover { border-color: rgba(255,255,255,0.7); color: white; }

    .rest-progress {
      position: absolute; bottom: 0; left: 0; right: 0;
      height: 3px; background: rgba(255,255,255,0.15);
    }

    .rest-progress-fill {
      height: 100%; background: rgba(255,255,255,0.75);
      transition: width 1s linear;
    }

    .rest-row.rest-done .rest-progress-fill { background: rgba(144,238,144,0.8); }

    .type-toggle {
      display: flex; border-radius: 6px; overflow: hidden;
      border: 1px solid rgba(255,255,255,0.3);
    }

    .type-btn {
      padding: 5px 10px; background: transparent; border: none;
      color: rgba(255,255,255,0.7); font-size: var(--font-size-xs);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .type-btn + .type-btn { border-left: 1px solid rgba(255,255,255,0.3); }

    .type-btn.active { background: rgba(255,255,255,0.2); color: white; font-weight: 600; }

    .type-notice {
      text-align: center; font-size: var(--font-size-sm); font-weight: 500;
      padding: var(--space-xs) var(--space-md); margin-bottom: var(--space-md);
      border-radius: var(--border-radius);
    }

    .deload-notice { background: rgba(196,74,74,0.1); color: var(--color-danger); border: 1px solid rgba(196,74,74,0.2); }

    .test-notice { background: rgba(122,59,46,0.1); color: var(--color-primary); border: 1px solid rgba(122,59,46,0.2); }

    .session-bar ::ng-deep .jiro-btn { width: auto; }

    .session-bar ::ng-deep .btn-secondary {
      background: rgba(255,255,255,0.15);
      border-color: rgba(255,255,255,0.3);
      color: white;
    }

    .session-bar ::ng-deep .btn-primary {
      background: white; color: var(--color-primary);
    }

    /* Body */
    .player-body { max-width: 700px; overflow-x: hidden; }

    /* Notes panel */
    .notes-panel { margin-bottom: var(--space-md); }

    .notes-input {
      width: 100%; box-sizing: border-box;
      padding: var(--space-sm) var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-sm); font-family: inherit;
      resize: vertical; outline: none; line-height: 1.5;
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
      font-size: var(--font-size-sm); outline: none; font-family: inherit;
    }

    .bw-input:focus { border-color: var(--color-primary); }

    .bw-save-btn {
      padding: 6px 14px; background: var(--color-primary); color: white;
      border: none; border-radius: var(--border-radius);
      font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
      transition: opacity 0.15s;
    }

    .bw-save-btn:hover:not(:disabled) { opacity: 0.85; }

    .bw-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    .bw-logged {
      font-size: var(--font-size-sm); color: var(--color-accent); font-weight: 500;
    }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
    }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .no-exercises {
      text-align: center; padding: var(--space-2xl);
      display: flex; flex-direction: column; align-items: center; gap: var(--space-md);
    }

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

    .overload-hint {
      display: flex; align-items: center; gap: 6px;
      padding: 6px var(--space-lg);
      font-size: var(--font-size-xs); color: var(--color-primary);
      background: rgba(122,59,46,0.06); border-bottom: 1px solid var(--border-color);
    }

    .block-header:hover { background: var(--bg-surface); }

    .block-title { display: flex; align-items: center; gap: var(--space-sm); flex: 1; min-width: 0; }

    .block-title h3 { font-size: var(--font-size-md); font-weight: 600; }

    .sets-done-tag {
      font-size: var(--font-size-xs); padding: 2px 8px; border-radius: 10px;
      background: rgba(122,59,46,0.1); color: var(--color-primary); font-weight: 500;
    }

    .chevron {
      flex-shrink: 0; color: var(--text-muted);
      transform: rotate(-90deg); transition: transform 0.2s ease;
    }
    .chevron.open { transform: rotate(0deg); }

    .mg-tag {
      background: rgba(122,59,46,0.12); color: var(--color-primary);
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
      resize: none; outline: none; line-height: 1.5;
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
      grid-template-columns: 40px 1fr 1fr 64px 34px 52px;
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
      grid-template-columns: 40px 1fr 1fr 64px 34px 52px;
      gap: var(--space-sm);
      align-items: center;
      padding: var(--space-xs) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
      transition: background 0.2s;
    }

    .set-row:last-of-type { border-bottom: none; }

    .set-row.set-done { background: rgba(122,59,46,0.04); }

    .set-row.set-warmup { background: rgba(200,160,80,0.06); }

    .warmup-btn {
      width: 28px; height: 28px; border-radius: 4px;
      background: none; border: 1px solid var(--border-color);
      color: var(--text-muted); font-size: var(--font-size-xs);
      font-weight: 700; cursor: pointer; transition: all 0.15s;
      font-family: inherit; display: flex; align-items: center; justify-content: center;
    }

    .warmup-btn:hover { border-color: #c8a050; color: #c8a050; }

    .warmup-btn.warmup-active {
      background: rgba(200,160,80,0.15); border-color: #c8a050; color: #c8a050;
    }

    .set-num-cell { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-muted); text-align: center; }

    .input-wrap { position: relative; }

    .set-input {
      width: 100%; padding: 8px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-canvas); color: var(--text-primary);
      font-size: var(--font-size-md); outline: none; box-sizing: border-box;
      font-family: inherit; transition: border-color 0.15s;
    }

    .set-input:focus { border-color: var(--color-primary); }

    .set-input:disabled { opacity: 0.7; background: transparent; border-color: transparent; }

    .set-input.has-ghost::placeholder { color: rgba(122,59,46,0.5); font-style: italic; }

    .ghost-hint {
      position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
      font-size: var(--font-size-xs); color: rgba(122,59,46,0.5);
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
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--color-primary); color: white; border: none;
      cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center;
      transition: opacity 0.15s;
    }

    .log-btn:hover:not(:disabled) { opacity: 0.85; }

    .log-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .del-btn {
      width: 28px; height: 28px; border-radius: 4px;
      background: none; color: var(--text-muted); border: 1px solid var(--border-color);
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }

    .del-btn:hover { color: var(--color-danger); border-color: var(--color-danger); }

    .pr-badge { width: 28px; height: 28px; display: block; }

    .spinner-sm {
      width: 14px; height: 14px;
      border: 2px solid rgba(255,255,255,0.4);
      border-top-color: white; border-radius: 50%;
      animation: spin 0.6s linear infinite; display: inline-block;
    }

    .add-set-btn {
      width: 100%; padding: var(--space-sm);
      background: none; border: none; border-top: 1px solid var(--border-color);
      color: var(--text-muted); font-size: var(--font-size-sm); cursor: pointer;
      transition: all 0.15s;
    }

    .add-set-btn:hover { color: var(--color-primary); background: rgba(122,59,46,0.04); }

    .add-exercise-btn {
      width: 100%; padding: var(--space-md);
      background: none; border: 2px dashed var(--border-color);
      border-radius: var(--border-radius); color: var(--text-muted);
      font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
      transition: all 0.15s; font-family: inherit; margin-top: var(--space-sm);
    }

    .add-exercise-btn:hover { color: var(--color-primary); border-color: var(--color-primary); background: rgba(122,59,46,0.04); }

    /* Exercise picker overlay */
    .overlay {
      position: fixed; inset: 0; background: rgba(0,0,0,0.45);
      display: flex; align-items: flex-end; justify-content: center;
      z-index: 500; animation: fadeIn 0.15s ease;
    }

    .picker-panel {
      width: 100%; max-width: 480px;
      background: var(--bg-surface); border-radius: var(--border-radius) var(--border-radius) 0 0;
      max-height: 60vh; display: flex; flex-direction: column;
      box-shadow: 0 -4px 24px rgba(0,0,0,0.2);
    }

    .picker-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
    }

    .picker-header h3 { font-size: var(--font-size-md); font-weight: 600; }

    .close-btn {
      background: none; border: none; color: var(--text-muted);
      font-size: 18px; cursor: pointer; padding: var(--space-xs);
    }

    .picker-search {
      margin: var(--space-sm) var(--space-md);
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-canvas);
      color: var(--text-primary); font-size: var(--font-size-md);
      outline: none; font-family: inherit;
    }

    .picker-search:focus { border-color: var(--color-primary); }

    .picker-list { overflow-y: auto; flex: 1; padding: var(--space-xs) var(--space-md); }

    .picker-item {
      display: flex; align-items: center; justify-content: space-between;
      width: 100%; padding: var(--space-sm) var(--space-md);
      background: none; border: none; border-radius: var(--border-radius);
      cursor: pointer; text-align: left; transition: background 0.15s;
    }

    .picker-item:hover { background: rgba(122,59,46,0.08); }

    .pi-name { font-size: var(--font-size-md); color: var(--text-primary); font-weight: 500; }

    .pi-mg { font-size: var(--font-size-xs); color: var(--text-muted); }

    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

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
      .session-bar ::ng-deep .jiro-btn {
        padding: 8px 10px;
        font-size: var(--font-size-xs);
        white-space: nowrap;
      }
    }

    /* ── Set table on very small screens ── */
    @media (max-width: 480px) {
      .set-header-row,
      .set-row {
        grid-template-columns: 28px 1fr 1fr 46px 28px 40px;
        padding: var(--space-xs) var(--space-md);
        gap: 4px;
      }

      .set-input { padding: 6px 6px; font-size: var(--font-size-sm); }

      .log-btn { width: 30px; height: 30px; font-size: 14px; }

      .warmup-btn { width: 24px; height: 24px; font-size: 0.6rem; }

      .ex-note-wrap { padding: var(--space-xs) var(--space-md); }
    }

    /* ── Body weight panel on mobile ── */
    @media (max-width: 480px) {
      .bw-panel { flex-wrap: wrap; }
      .bw-label { flex: 0 0 100%; }
    }
  `]
})
export class SessionPlayerComponent implements OnInit, OnDestroy {
  loading = signal(true);
  finishing = signal(false);
  showExPicker = signal(false);
  showExitConfirm = signal(false);
  discarding = signal(false);
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

  // Re-sync both timers when the user returns from a locked screen
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
      this.tickRestTimer();
      this.updateElapsed();
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
          this.blocks.set(buildRoutineBlocks(routerTargets));
        } else {
          // Returning: merge logged sets with any un-logged routine exercises
          const savedStr = localStorage.getItem(targetsKey);
          const savedTargets: RoutineItem[] = savedStr ? JSON.parse(savedStr) : [];
          if (savedTargets.length > 0 && existingBlocks.length > 0) {
            const existingIds = new Set(existingBlocks.map(b => b.exerciseId));
            const missing = buildRoutineBlocks(savedTargets.filter(t => !existingIds.has(t.exercise_id)));
            this.blocks.set([...existingBlocks, ...missing]);
          } else if (savedTargets.length > 0 && existingBlocks.length === 0) {
            this.blocks.set(buildRoutineBlocks(savedTargets));
          } else {
            this.blocks.set(existingBlocks);
          }
        }

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
    this.jymService.deleteSet(row.id).subscribe({
      next: () => {
        this.blocks.update(bs => bs.map((b, bi) => bi === blockIndex ? {
          ...b,
          sets: b.sets
            .filter((_, si) => si !== setIndex)
            .map((s, i) => ({ ...s, setNumber: i + 1 })),
        } : b));
      },
    });
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

  finishSession() {
    this.finishing.set(true);
    this.jymService.updateSession(this.sessionId, {
      ended_at: new Date().toISOString(),
      notes: this.sessionNotes,
    }).subscribe({
      next: () => {
        localStorage.removeItem(`jiro_session_targets_${this.sessionId}`);
        this.router.navigate(['/jym/sessions']);
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
    this.filteredExercises.set(this.allExercises());
    this.showExPicker.set(true);
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
