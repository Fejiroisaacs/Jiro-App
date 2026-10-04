import { Component, DestroyRef, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import {
  JymService, Exercise, ExerciseStats, ExerciseStatsWorkout, ExerciseWorkout, ExerciseFormCheck, RepsAtWeight,
} from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { chartTones } from '../../../shared/chart-theme';
import { UploadService } from '../../../core/services/upload.service';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { formatInstant } from '../../../core/utils/format-date';
import { detectPlateau, type PlateauStatus } from '../plateau-rule';
import {
  defaultRange, inRange, monthTickLabel, monthTicks, notesOf, statsSeries, type StatsMeasure, type StatsPoint, type StatsRange,
} from '../exercise-stats';

Chart.register(...registerables);

type ChartType = '1rm' | 'volume' | 'maxweight' | 'repsatweight';
type SectionTab = 'history' | 'form' | 'notes';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, JiroIconComponent, JiroSkeletonComponent, JiroPageHeaderComponent, JiroButtonComponent, JymPrBadgeComponent],
  template: `
    <div class="exercise-detail">
      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" role="status" aria-label="Loading exercise">
          <jiro-skeleton width="40%" height="32px" />
          <jiro-skeleton width="20%" height="24px" />
          <jiro-skeleton height="310px" />
          <jiro-skeleton [lines]="5" height="20px" />
        </div>
      }

      @if (!loading() && exercise()) {
<div class="detail-body">
        <!-- Header -->
        <jiro-page-header [heading]="exercise()!.name" backLink="/jym/exercises" backLabel="Exercises" />
        <div class="detail-header">
          <div class="detail-title">
            @if (exercise()!.muscle_group) {
<span class="mg-badge">{{ exercise()!.muscle_group }}</span>
}
            @for (m of exercise()!.secondary_muscles; track m) {
              <span class="mg-also" [attr.aria-label]="'Also works ' + m">{{ m }}</span>
            }
          </div>
          @if (hasHistory()) {
<div class="pr-stats">
            <div class="stat">
              <span class="stat-label">Best weight</span>
              <span class="stat-value">{{ settingsService.toDisplay(exercise()!.best_weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Est. 1RM</span>
              <span class="stat-value primary">{{ settingsService.toDisplay(exercise()!.est_1rm) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
            </div>
          </div>
}
        </div>

        @if (exercise()!.notes) {
<p class="exercise-notes text-secondary">{{ exercise()!.notes }}</p>
}

        <!-- Plateau / Decline banner -->
        @if (plateauStatus() === 'plateau') {
<div class="plateau-banner plateau">
          <jiro-icon name="warning-circle" [size]="16" />
          <div>
            <strong>Plateau detected.</strong> Your best set hasn't improved in your last 3 sessions.
            Consider a small weight increase, extra reps, or a deload week to break through.
          </div>
        </div>
}
        @if (plateauStatus() === 'decline') {
<div class="plateau-banner decline">
          <jiro-icon name="trend-down" [size]="16" />
          <div>
            <strong>Declining trend.</strong> Your best set in your last 3 sessions is down more than 5% on the sessions before.
            Consider a deload, technique check, or extra recovery before pushing again.
          </div>
        </div>
}

        <!-- Chart section, shown whenever there is any history -->
        @if (hasHistory()) {
<div class="chart-section">

          <!-- Tab chips -->
          <div class="chart-tabs">
            <button class="chart-tab" [class.active]="selectedChart() === '1rm'"         (click)="switchChart('1rm')">Est. 1RM</button>
            <button class="chart-tab" [class.active]="selectedChart() === 'volume'"      (click)="switchChart('volume')">Volume</button>
            <button class="chart-tab" [class.active]="selectedChart() === 'maxweight'"   (click)="switchChart('maxweight')">Max weight</button>
            <button class="chart-tab" [class.active]="selectedChart() === 'repsatweight'" (click)="switchChart('repsatweight')">Reps @ Weight</button>
          </div>

          <!-- Range -->
          <div class="range-chips" role="group" aria-label="Chart range">
            @for (r of ranges; track r.value) {
              <button type="button" class="range-chip" [class.active]="range() === r.value" [attr.aria-pressed]="range() === r.value"
                (click)="setRange(r.value)">{{ r.label }}</button>
            }
          </div>

          <!-- Weight selector (Reps @ Weight only) -->
          @if (selectedChart() === 'repsatweight' && uniqueWeights().length > 0) {
<div class="weight-selector-row">
            <label class="ws-label">Weight</label>
            <select class="weight-select" aria-label="Weight" (change)="onWeightChange($event)">
              @for (w of uniqueWeights(); track w) {
<option [value]="w" [selected]="w === selectedWeight()">
                {{ settingsService.toDisplay(w) | number:'1.1-1' }} {{ settingsService.unitLabel() }}
              </option>
}
            </select>
          </div>
}

          <!-- Chart wrapper -->
          <div class="chart-wrapper">
            @if (chartEmpty()) {
<div class="chart-empty">
              <p class="text-secondary">{{ chartEmptyText() }}</p>
            </div>
}
            <canvas #chartCanvas [hidden]="chartEmpty()"></canvas>
          </div>
        </div>
}

        <!-- Section tabs + content -->
        <div class="section-panel">
        <div class="section-tabs-bar">
          <button class="section-tab" [class.active]="activeSection() === 'history'" (click)="setSection('history')">
            Workouts
            <span class="tab-count">{{ stats()?.workouts?.length ?? 0 }}</span>
          </button>
          <button class="section-tab" [class.active]="activeSection() === 'form'" (click)="setSection('form')">
            Form progression
            @if (formChecks().length > 0) {
<span class="tab-count">{{ formChecks().length }}</span>
}
          </button>
          <button class="section-tab" [class.active]="activeSection() === 'notes'" (click)="setSection('notes')">
            Notes
            @if (sessionNotes().length > 0) {
<span class="tab-count">{{ sessionNotes().length }}</span>
}
          </button>
        </div>

        <!-- ── Workouts tab ────────────────────────────────────────── -->
        @if (activeSection() === 'history') {
<div class="tab-panel">
          @if (!hasHistory()) {
<div class="no-history">
            <p class="text-secondary">No sets logged yet. Start a session and log this exercise.</p>
          </div>
}

          @if (workoutsLoading() && workouts().length === 0) {
            <div class="wk-list" role="status" aria-label="Loading workouts">
              @for (i of [1, 2, 3]; track i) { <jiro-skeleton height="96px" /> }
            </div>
          }

          @if (workouts().length > 0) {
<ol class="wk-list">
            @for (w of workouts(); track w.session_id) {
<li class="wk">
              <a class="wk-head" [routerLink]="workoutLink(w)" [state]="{ back: '/jym/exercises/' + exercise()!.id }">
                <span class="wk-date">{{ formatDate(w.started_at, true) }}</span>
                <span class="wk-day">{{ w.routine_name || 'Freestyle' }}</span>
                @if (w.session_type === 'deload') { <span class="type-badge deload">Deload</span> }
                @if (w.session_type === 'test') { <span class="type-badge test">Test</span> }
                @if (!w.ended_at) { <span class="type-badge open">In progress</span> }
                <span class="wk-go">{{ w.ended_at ? 'Summary' : 'Resume' }}<jiro-icon name="caret-right" [size]="12" /></span>
              </a>
              @if (w.note) { <p class="wk-note">{{ w.note }}</p> }
              <ul class="wk-sets">
                @for (set of w.sets; track set.id) {
<li class="wk-set" [class.is-warmup]="set.is_warmup">
                  <span class="ws-num">{{ set.is_warmup ? 'W' : set.set_number }}</span>
                  <span class="ws-load">{{ settingsService.toDisplay(set.weight) | number:'1.0-1' }} {{ settingsService.unitLabel() }} × {{ set.reps }}</span>
                  @if (set.rpe != null) { <span class="ws-rpe">RPE {{ set.rpe }}</span> }
                  @if (!set.is_warmup) { <span class="ws-orm">e1RM {{ settingsService.toDisplay(set.est_1rm) | number:'1.0-1' }}</span> }
                  @if (set.is_pr) { <jym-pr-badge /> }
                </li>
}
              </ul>
            </li>
}
          </ol>
}

          @if (workoutsMore()) {
            <div class="load-more">
              <jiro-button variant="secondary" type="button" [loading]="workoutsLoading()" (click)="loadWorkouts()">Show older workouts</jiro-button>
            </div>
          }
          @if (hasHistory()) {
            <a class="all-link" routerLink="/jym/track" [queryParams]="{ tab: 'sessions', exercise: exercise()!.id }">See all workouts with {{ exercise()!.name }}</a>
          }
          @if (workoutsError()) {
            <p class="text-secondary load-error" role="alert">Could not load the workouts. <button type="button" class="retry" (click)="loadWorkouts()">Try again</button></p>
          }
        </div>
}

        <!-- ── Form tab ────────────────────────────────────────────── -->
        @if (activeSection() === 'form') {
<div class="tab-panel">
          @if (formChecksLoading()) {
<div class="fc-grid" role="status" aria-label="Loading clips">
            @for (i of [1, 2, 3]; track i) {
              <jiro-skeleton height="160px" />
            }
          </div>
}

          @if (!formChecksLoading() && groupedFormChecks().length === 0) {
<div class="no-history">
            <p class="text-secondary">No form check clips yet. Tap "+ Form check" during a session to add one.</p>
          </div>
}

          @if (!formChecksLoading() && groupedFormChecks().length > 0) {
<div class="fc-groups">
            @for (group of pagedFormGroups(); track group) {
<div class="fc-group">
              <div class="fc-group-date">{{ group.date }}</div>
              <div class="fc-grid">
                @for (item of group.items; track item) {
<div class="fc-item">
                  <div class="fc-media-wrap">
                    @if (item.file_type.startsWith('video')) {
<video
                      [src]="item.file_url" controls playsinline class="fc-media">
                    </video>
}
                    @if (item.file_type.startsWith('image')) {
<img
                      [src]="item.file_url" [alt]="item.label || 'Form check'" class="fc-media" />
}
                    <button class="fc-delete-btn" type="button"
                      [disabled]="deletingFormCheck().has(item.id)"
                      (click)="deleteFormCheck(item.id)"
                      title="Delete clip" aria-label="Delete clip">
                      @if (!deletingFormCheck().has(item.id)) {
                        <jiro-icon name="x" [size]="12" />
                      } @else {
                        <span class="spinner spinner--sm spinner-xs" aria-hidden="true"></span>
                      }
                    </button>
                  </div>
                  @if (item.label) {
<p class="fc-label">{{ item.label }}</p>
}
                </div>
}
              </div>
            </div>
}
          </div>
}

          @if (formTotalPages() > 1) {
<div class="pagination">
            <button class="page-btn" type="button" aria-label="Previous page of clips" title="Previous page"
              [disabled]="formPage() === 0" (click)="formPage.set(formPage() - 1)">
              <jiro-icon name="caret-left" [size]="14" />
            </button>
            <span class="page-info">{{ formPage() + 1 }} / {{ formTotalPages() }}</span>
            <button class="page-btn" type="button" aria-label="Next page of clips" title="Next page"
              [disabled]="formPage() === formTotalPages() - 1" (click)="formPage.set(formPage() + 1)">
              <jiro-icon name="caret-right" [size]="14" />
            </button>
          </div>
}
        </div>
}

        <!-- ── Notes tab ────────────────────────────────────────── -->
        @if (activeSection() === 'notes') {
<div class="tab-panel">
          @if (sessionNotes().length === 0) {
<div class="no-history">
            <p class="text-secondary">No notes yet. Add a note for this exercise during a session.</p>
          </div>
}
          @if (sessionNotes().length > 0) {
<div class="notes-list">
            @for (n of sessionNotes(); track n.session_id) {
<div class="notes-item">
              <span class="notes-item-date">{{ formatDate(n.started_at) }}</span>
              <p class="notes-item-text">{{ n.note }}</p>
            </div>
}
          </div>
}
        </div>
}

        </div><!-- /section-panel -->
      </div>
}
    </div>

  `,
  styles: [`
    :host { display: block; }

    .exercise-detail { max-width: 900px; width: 100%; overflow-x: hidden; position: relative; }

    .state-loading { display: flex; flex-direction: column; gap: var(--space-lg); }

    .detail-body { display: flex; flex-direction: column; gap: var(--space-xl); }

    .detail-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-lg); flex-wrap: wrap;
    }

    .detail-title { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }

    .detail-title h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .mg-badge {
      background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary);
      font-size: var(--font-size-sm); font-weight: 500;
      padding: 4px 12px; border-radius: var(--border-radius-pill);
    }

    .pr-stats { display: flex; gap: var(--space-xl); }

    .stat { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }

    .stat-label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    .stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--text-primary); }

    .mg-also {
      font-size: var(--font-size-xs); color: var(--text-muted);
      padding: 3px 10px; border: 1px solid var(--border-color); border-radius: var(--border-radius-pill);
    }

    .stat-value.primary { color: var(--color-primary); }

    .exercise-notes {
      font-size: var(--font-size-sm); line-height: 1.6;
      padding: var(--space-md); background: var(--bg-surface);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
    }

    .plateau-banner {
      display: flex; align-items: flex-start; gap: var(--space-sm);
      padding: var(--space-md) var(--space-lg);
      border-radius: var(--border-radius); border: 1px solid;
      font-size: var(--font-size-sm); line-height: 1.5;
    }
    .plateau-banner jiro-icon { margin-top: 2px; }
    .plateau-banner.plateau { background: rgba(var(--color-warning-rgb), 0.1); border-color: rgba(var(--color-warning-rgb), 0.4); color: var(--color-warning); }
    .plateau-banner.decline { background: rgba(var(--color-danger-rgb), 0.08); border-color: rgba(var(--color-danger-rgb), 0.3); color: var(--color-danger); }
    .plateau-banner strong { font-weight: 600; }

    /* ── Chart tabs ── */
    .chart-tabs {
      display: flex; flex-wrap: wrap; gap: var(--space-xs);
      margin-bottom: var(--space-md);
    }

    .chart-tab, .range-chip {
      min-height: 44px; padding: 6px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-pill);
      background: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      transition: all 0.15s;
    }

    .chart-tab:hover, .range-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .chart-tab.active, .range-chip.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--text-on-primary);
      font-weight: 500;
    }

    .range-chips { display: flex; gap: var(--space-xs); margin-bottom: var(--space-md); }

    /* ── Weight selector ── */
    .weight-selector-row {
      display: flex; align-items: center; gap: var(--space-sm);
      margin-bottom: var(--space-sm);
    }

    .ws-label { font-size: var(--font-size-sm); color: var(--text-secondary); font-weight: 500; }

    .weight-select {
      min-height: 44px; padding: 6px 10px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm);
 cursor: pointer; font-family: inherit;
    }

    .weight-select:focus { border-color: var(--color-primary); }

    /* ── Chart wrapper ── */
    .chart-wrapper {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      height: 310px; position: relative;
    }

    .chart-wrapper canvas { width: 100% !important; height: 100% !important; }

    .chart-empty {
      display: flex; align-items: center; justify-content: center; height: 100%;
    }

    /* ── Section tabs ── */
    .section-tabs-bar {
      display: flex;
      border-bottom: 2px solid var(--border-color);
      margin-bottom: 0;
    }

    .section-tab {
      display: flex; align-items: center; gap: var(--space-xs);
      padding: var(--space-sm) var(--space-lg);
      background: none; border: none; cursor: pointer;
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s;
    }

    .section-tab:hover { color: var(--text-primary); }

    .section-tab.active {
      color: var(--color-primary);
      border-bottom-color: var(--color-primary);
    }

    .tab-count {
      font-size: var(--font-size-xs);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      color: var(--text-muted);
      padding: 1px 7px; border-radius: var(--border-radius-pill);
      font-weight: 400;
    }

    .section-tab.active .tab-count {
      background: rgba(var(--color-primary-rgb), 0.1);
      border-color: rgba(var(--color-primary-rgb), 0.2);
      color: var(--color-primary);
    }

    /* ── Section panel (tabs + content as one unit) ── */
    .section-panel { display: flex; flex-direction: column; }

    /* ── Tab panel ── */
    .tab-panel {
      padding-top: var(--space-md);
      animation: fadeIn 0.15s ease;
    }

    /* ── History ── */
    .no-history {
      padding: var(--space-xl); text-align: center;
      border: 1px dashed var(--border-color); border-radius: var(--border-radius);
    }

    .wk-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-md); }

    .wk {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .wk-head {
      display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-xs) var(--space-sm);
      min-height: 44px; padding: var(--space-xs) var(--space-md);
      color: var(--text-primary); text-decoration: none;
      border-bottom: 1px solid var(--border-color);
    }

    .wk-head:hover { background: var(--bg-canvas); }

    .wk-date { font-weight: 600; font-size: var(--font-size-sm); }

    .wk-day { font-size: var(--font-size-sm); color: var(--text-secondary); }

    .wk-go {
      margin-left: auto; display: inline-flex; align-items: center; gap: 2px;
      font-size: var(--font-size-sm); font-weight: 600; color: var(--color-primary);
    }

    .type-badge { font-size: var(--font-size-xs); font-weight: 600; padding: 2px 8px; border-radius: var(--border-radius-pill); }
    .type-badge.deload { background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger); }
    .type-badge.test { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }
    .type-badge.open { background: rgba(var(--color-accent-rgb), 0.14); color: var(--color-accent); }

    .wk-note { margin: var(--space-sm) var(--space-md) 0; font-size: var(--font-size-sm); color: var(--text-secondary); font-style: italic; }

    .wk-sets { list-style: none; margin: 0; padding: var(--space-sm) var(--space-md); display: flex; flex-direction: column; gap: 4px; }

    .wk-set { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-sm); font-size: var(--font-size-sm); }

    .ws-num { min-width: 20px; color: var(--text-muted); font-variant-numeric: tabular-nums; }

    .ws-load { font-weight: 600; font-variant-numeric: tabular-nums; }

    .wk-set.is-warmup .ws-load { font-weight: 400; color: var(--text-secondary); }

    .ws-rpe { font-size: var(--font-size-xs); color: var(--text-muted); }

    .ws-orm { font-size: var(--font-size-xs); color: var(--color-primary); }

    .load-more { display: flex; justify-content: center; margin-top: var(--space-lg); }

    .load-error { margin-top: var(--space-md); font-size: var(--font-size-sm); }

    .all-link {
      display: inline-flex; align-items: center; min-height: 44px; margin-top: var(--space-sm);
      font-size: var(--font-size-sm); font-weight: 600; color: var(--color-primary);
    }

    .retry {
      min-height: 44px; padding: 0 var(--space-xs); background: none; border: none;
      color: var(--color-primary); font: inherit; font-weight: 600; cursor: pointer;
    }

    /* ── Pagination ── */
    .pagination {
      display: flex; align-items: center; justify-content: center;
      gap: var(--space-md); margin-top: var(--space-lg);
      padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
    }

    .page-btn {
      display: flex; align-items: center; justify-content: center;
      width: 32px; height: 32px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      cursor: pointer; transition: all 0.15s;
    }

    .page-btn:hover:not(:disabled) { border-color: var(--color-primary); color: var(--color-primary); }

    .page-btn:disabled { opacity: 0.35; cursor: not-allowed; }

    .page-info { font-size: var(--font-size-sm); color: var(--text-secondary); min-width: 60px; text-align: center; }

    /* ── Form Progression ── */

    .fc-groups { display: flex; flex-direction: column; gap: var(--space-xl); }

    .fc-group-date {
      font-size: var(--font-size-sm); font-weight: 600; color: var(--text-secondary);
      margin-bottom: var(--space-sm);
      padding-bottom: var(--space-xs); border-bottom: 1px solid var(--border-color);
    }

    .fc-grid {
      display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-md);
    }

    .fc-item { display: flex; flex-direction: column; gap: 4px; }

    .fc-media-wrap { position: relative; }

    .fc-media {
      width: 100%; border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      object-fit: cover; max-height: 240px; display: block;
      background: var(--bg-canvas);
    }

    .fc-delete-btn {
      position: absolute; top: 6px; right: 6px;
      width: 24px; height: 24px;
      display: flex; align-items: center; justify-content: center;
      background: var(--scrim); color: var(--text-on-dark);
      border: none; border-radius: 50%; cursor: pointer;
      padding: 0; transition: background 0.15s;
    }

    .fc-delete-btn:hover:not(:disabled) { background: rgba(var(--color-danger-rgb), 0.85); }

    .fc-delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner-xs {
      width: 10px; height: 10px; border: 1.5px solid color-mix(in srgb, currentColor 40%, transparent);
      border-top-color: currentColor; border-radius: 50%;
      animation: jiro-spin 0.7s linear infinite;
    }

    .fc-label {
      font-size: var(--font-size-xs); color: var(--text-secondary); margin: 0; line-height: 1.4;
    }

    .notes-list { display: flex; flex-direction: column; gap: var(--space-sm); padding: var(--space-md); }
    .notes-item {
      padding: var(--space-sm) var(--space-md);
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
    }
    .notes-item-date {
      display: block; font-size: var(--font-size-xs); color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;
    }
    .notes-item-text { margin: 0; font-size: var(--font-size-sm); color: var(--text-primary); line-height: 1.5; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 600px) {
      .section-tab { padding: var(--space-sm) var(--space-md); }
      .fc-grid { grid-template-columns: 1fr 1fr; }
    }
  `]
})
export class ExerciseDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  /** The header: name, muscle group, notes and best numbers (sent without the set list). */
  exercise = signal<(Exercise & { best_weight: number; est_1rm: number }) | null>(null);
  stats = signal<ExerciseStats | null>(null);
  loading = signal(true);
  selectedChart = signal<ChartType>('1rm');
  selectedWeight = signal<number | null>(null);
  chartEmpty = signal(false);
  range = signal<StatsRange>('all');
  readonly ranges: { value: StatsRange; label: string }[] = [
    { value: '3m', label: '3M' }, { value: '1y', label: '1Y' }, { value: 'all', label: 'All' },
  ];

  activeSection = signal<SectionTab>('history');

  /** Workouts with this exercise, newest first, a page at a time. */
  workouts = signal<ExerciseWorkout[]>([]);
  workoutsLoading = signal(false);
  workoutsMore = signal(false);
  workoutsError = signal(false);
  readonly WORKOUT_PAGE = 10;

  readonly FORM_PAGE_SIZE = 3;
  formPage = signal(0);

  formChecks = signal<ExerciseFormCheck[]>([]);
  formChecksLoading = signal(true);
  deletingFormCheck = signal<Set<string>>(new Set());
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  hasHistory = computed(() => (this.stats()?.workouts.length ?? 0) > 0);
  uniqueWeights = computed(() => this.stats()?.weights ?? []);

  groupedFormChecks = computed(() => {
    const checks = this.formChecks();
    if (checks.length === 0) return [];
    const byDate = new Map<string, ExerciseFormCheck[]>();
    for (const c of checks) {
      const date = this.formatDate(c.session_date);
      const arr = byDate.get(date) ?? [];
      arr.push(c);
      byDate.set(date, arr);
    }
    const seen = new Set<string>();
    const result: { date: string; items: ExerciseFormCheck[] }[] = [];
    for (const c of checks) {
      const date = this.formatDate(c.session_date);
      if (!seen.has(date)) {
        seen.add(date);
        result.push({ date, items: byDate.get(date)! });
      }
    }
    return result;
  });

  pagedFormGroups = computed(() => {
    const groups = this.groupedFormChecks();
    const start = this.formPage() * this.FORM_PAGE_SIZE;
    return groups.slice(start, start + this.FORM_PAGE_SIZE);
  });

  formTotalPages = computed(() => {
    const groups = this.groupedFormChecks();
    if (groups.length === 0) return 1;
    return Math.ceil(groups.length / this.FORM_PAGE_SIZE);
  });

  sessionNotes = computed(() => notesOf(this.stats()?.workouts ?? []));

  plateauStatus = computed<PlateauStatus>(() => detectPlateau(this.stats()?.workouts ?? []));

  /** Says why a chart is empty: nothing in this range, or nothing at all. */
  chartEmptyText = computed(() => {
    const r = this.range();
    if (r === 'all') return 'Not enough data to display this chart.';
    return `No workouts in the last ${r === '3m' ? '3 months' : 'year'}. Try All.`;
  });

  private chart: Chart | null = null;
  private currentId = '';
  private readonly destroyRef = inject(DestroyRef);
  private dataLoaded = false;
  private viewReady = false;
  /** Reps @ Weight data by weight, fetched when that chart is shown. */
  private repsAt = new Map<number, RepsAtWeight[]>();

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    private router: Router,
    public settingsService: SettingsService,
    private uploadService: UploadService,
  ) {}

  ngOnInit() {
    // The page is reused when Ctrl K opens another exercise from this one, so follow the id.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p => this.load(p.get('id') || ''));
  }

  private load(id: string) {
    this.currentId = id;
    this.exercise.set(null);
    this.stats.set(null);
    this.loading.set(true);
    this.formChecks.set([]);
    this.formChecksLoading.set(true);
    this.selectedWeight.set(null);
    this.workouts.set([]);
    this.workoutsMore.set(false);
    this.workoutsError.set(false);
    this.repsAt.clear();
    this.formPage.set(0);
    this.dataLoaded = false;
    this.chart?.destroy();
    this.chart = null;
    forkJoin([this.jymService.getExercise(id, { limit: 0 }), this.jymService.getExerciseStats(id)]).subscribe({
      next: ([ex, stats]) => {
        if (id !== this.currentId) return;
        const { history: _history, ...header } = ex;
        this.exercise.set(header);
        this.stats.set(stats);
        this.range.set(defaultRange(stats.workouts, Date.now()));
        this.loading.set(false);
        this.dataLoaded = true;
        setTimeout(() => this.maybeDrawChart(), 0);
      },
      error: () => { if (id === this.currentId) this.loading.set(false); },
    });
    this.loadWorkouts();
    this.jymService.listExerciseFormChecks(id).subscribe({
      next: checks => {
        if (id !== this.currentId) return;
        this.formChecks.set(checks);
        this.formChecksLoading.set(false);
      },
      error: () => { if (id === this.currentId) this.formChecksLoading.set(false); },
    });
  }

  /** The next page of workouts, continuing after the oldest one loaded. */
  loadWorkouts() {
    if (this.workoutsLoading()) return;
    const id = this.currentId;
    const last = this.workouts().at(-1);
    this.workoutsLoading.set(true);
    this.workoutsError.set(false);
    this.jymService.listExerciseWorkouts(id, { before: last?.started_at, beforeId: last?.session_id, limit: this.WORKOUT_PAGE }).subscribe({
      next: page => {
        if (id !== this.currentId) return;
        this.workouts.update(list => [...list, ...page]);
        this.workoutsMore.set(page.length === this.WORKOUT_PAGE);
        this.workoutsLoading.set(false);
      },
      error: () => {
        if (id !== this.currentId) return;
        this.workoutsLoading.set(false);
        this.workoutsError.set(true);
      },
    });
  }

  /** A finished workout opens its summary; one still going opens the player. */
  workoutLink(w: ExerciseWorkout): unknown[] {
    return w.ended_at ? ['/jym/sessions', w.session_id, 'summary'] : ['/jym/session', w.session_id];
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.maybeDrawChart();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  setSection(s: SectionTab) {
    this.activeSection.set(s);
    this.formPage.set(0);
  }

  async deleteFormCheck(id: string) {
    const ok = await this.confirmService.confirm({
      title: 'Delete this clip?',
      message: 'The form check clip is removed permanently.',
      confirmLabel: 'Delete clip',
      danger: true,
    });
    if (!ok) return;
    this.deletingFormCheck.update(s => new Set([...s, id]));
    this.uploadService.deleteSessionAttachment(id).subscribe({
      next: () => {
        this.formChecks.update(list => list.filter(c => c.id !== id));
        this.formPage.update(p => Math.min(p, this.formTotalPages() - 1));
        this.deletingFormCheck.update(s => { const n = new Set(s); n.delete(id); return n; });
        this.toast.success('Clip deleted');
      },
      error: () => {
        this.deletingFormCheck.update(s => { const n = new Set(s); n.delete(id); return n; });
        this.toast.error('Could not delete the clip.');
      },
    });
  }

  switchChart(type: ChartType) {
    this.selectedChart.set(type);
    if (type === 'repsatweight' && this.selectedWeight() === null && this.uniqueWeights().length > 0) {
      this.selectedWeight.set(this.uniqueWeights()[0]);
    }
    setTimeout(() => this.maybeDrawChart(), 0);
  }

  setRange(r: StatsRange) {
    this.range.set(r);
    setTimeout(() => this.maybeDrawChart(), 0);
  }

  onWeightChange(event: Event) {
    this.selectedWeight.set(parseFloat((event.target as HTMLSelectElement).value));
    setTimeout(() => this.maybeDrawChart(), 0);
  }

  // ── Chart dispatch ───────────────────────────────────────────────────────────

  private maybeDrawChart() {
    if (!this.dataLoaded || !this.viewReady || !this.canvasRef) return;
    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const unit = this.settingsService.unitLabel();
    switch (this.selectedChart()) {
      case '1rm':          this.drawLine('e1rm', unit);      break;
      case 'volume':       this.drawLine('volume', unit);    break;
      case 'maxweight':    this.drawLine('maxweight', unit); break;
      case 'repsatweight': this.drawRepsAtWeightChart();     break;
    }
  }

  // ── Chart builders ───────────────────────────────────────────────────────────

  private drawLine(measure: StatsMeasure, unit: string) {
    const now = Date.now();
    const points = statsSeries(this.stats()?.workouts ?? [], measure, this.range(), now);
    if (points.length === 0) { this.chartEmpty.set(true); return; }
    this.chartEmpty.set(false);

    const tone = chartTones();
    const shown = points.map(p => ({ ...p, y: Math.round(this.settingsService.toDisplay(p.y) * 10) / 10 }));
    const spec = {
      e1rm:      { color: tone.primary, title: 'Estimated 1RM progress', axis: `Est. 1RM (${unit})`, unit },
      volume:    { color: tone.warning, title: 'Total session volume', axis: `Volume (${unit}×reps)`, unit: `${unit}×reps` },
      maxweight: { color: tone.accent,  title: 'Heaviest set per session', axis: `Weight (${unit})`, unit },
    }[measure];
    this.chart = new Chart(this.canvasRef.nativeElement, this.lineConfig(shown, spec, this.rangeMin(now), now));
  }

  /** The axis starts at the range's start, so a break from training shows as a gap. */
  private rangeMin(now: number): number | undefined {
    const r = this.range();
    return r === 'all' ? undefined : now - (r === '3m' ? 91 : 365) * 86_400_000;
  }

  private drawRepsAtWeightChart() {
    const weight = this.selectedWeight();
    if (weight === null) { this.chartEmpty.set(true); return; }
    const cached = this.repsAt.get(weight);
    if (!cached) {
      const id = this.currentId;
      this.jymService.getRepsAtWeight(id, weight).subscribe({
        next: list => {
          if (id !== this.currentId) return;
          this.repsAt.set(weight, list);
          if (this.selectedChart() === 'repsatweight' && this.selectedWeight() === weight) this.maybeDrawChart();
        },
        error: () => this.toast.error('Could not load reps at that weight.'),
      });
      return;
    }

    const sessions = inRange(cached.map(r => ({ ...r, session_type: 'normal', working_sets: r.reps.length, max_weight: weight, best_e1rm: 0, volume: 0, note: null })),
      this.range(), Date.now());
    if (sessions.length === 0) { this.chartEmpty.set(true); return; }
    this.chartEmpty.set(false);

    const unit = this.settingsService.unitLabel();
    const displayWeight = Math.round(this.settingsService.toDisplay(weight) * 10) / 10;
    const labels = sessions.map(s => this.formatDate(s.started_at));
    const maxSets = Math.max(...sessions.map(s => s.reps.length));
    const tone = chartTones();
    const barColors = [tone.primary, tone.warning, tone.accent, tone.secondary];

    const datasets = Array.from({ length: maxSets }, (_, i) => ({
      label: `Set ${i + 1}`,
      data: sessions.map(s => s.reps[i] ?? null) as (number | null)[],
      backgroundColor: barColors[i % barColors.length],
      borderRadius: 4,
      borderSkipped: false as const,
    }));

    const config: ChartConfiguration = {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: `Reps at ${displayWeight} ${unit}`,
            font: { size: 13, weight: 'bold' },
            color: tone.tick,
            padding: { top: 0, bottom: 10 },
          },
          legend: { display: maxSets > 1, labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` Set ${ctx.datasetIndex + 1}: ${ctx.parsed.y} reps` } },
        },
        scales: {
          x: {
            title: { display: true, text: 'Date', font: { size: 11 }, color: tone.muted },
            grid: { color: tone.grid },
            ticks: { font: { size: 11 }, color: tone.tick },
          },
          y: {
            title: { display: true, text: 'Reps', font: { size: 11 }, color: tone.muted },
            grid: { color: tone.grid },
            beginAtZero: true,
            ticks: { font: { size: 11 }, color: tone.tick, stepSize: 1, callback: v => `${v}` },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, config);
  }

  /** A line over a date-scaled axis: workouts sit at their real distance apart. */
  private lineConfig(
    points: StatsPoint[], spec: { color: string; title: string; axis: string; unit: string }, min: number | undefined, max: number,
  ): ChartConfiguration<'line', StatsPoint[]> {
    const tone = chartTones();
    const workouts = new Map((this.stats()?.workouts ?? []).map(w => [w.session_id, w]));
    // All runs from the first workout to today; a lone workout gets a week either side.
    const lo = min ?? (points.length === 1 ? points[0].x - 7 * 86_400_000 : points[0].x);
    const hi = points.length === 1 && min === undefined ? Math.max(max, points[0].x + 7 * 86_400_000) : max;
    const ticks = monthTicks(lo, hi);
    return {
      type: 'line',
      data: {
        datasets: [{
          label: spec.axis,
          data: points,
          borderColor: spec.color,
          backgroundColor: `${spec.color}1a`,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: spec.color,
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: spec.title,
            font: { size: 13, weight: 'bold' },
            color: tone.tick,
            padding: { top: 0, bottom: 10 },
          },
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: items => items.length ? this.formatDate(new Date(items[0].parsed.x ?? 0).toISOString(), true) : '',
              label: ctx => ` ${ctx.parsed.y} ${spec.unit}${this.bestSetText(workouts.get((ctx.raw as StatsPoint).sessionId))}`,
            },
          },
        },
        scales: {
          x: {
            type: 'linear',
            min: lo,
            max: hi,
            // Ticks on month starts, not wherever round milliseconds fall.
            afterBuildTicks: axis => { axis.ticks = ticks.map(value => ({ value })); },
            title: { display: true, text: 'Date', font: { size: 11 }, color: tone.muted },
            grid: { color: tone.grid },
            ticks: { font: { size: 11 }, color: tone.tick, maxRotation: 0, callback: v => monthTickLabel(Number(v), Number(v) === ticks[0]) },
          },
          y: {
            title: { display: true, text: spec.axis, font: { size: 11 }, color: tone.muted },
            grid: { color: tone.grid },
            ticks: { font: { size: 11 }, callback: v => `${v}` },
          },
        },
      },
    };
  }

  /** " (100 kg × 5)" after an e1RM point's value; nothing for the other charts' points. */
  private bestSetText(w: ExerciseStatsWorkout | undefined): string {
    if (!w?.best_set || this.selectedChart() !== '1rm') return '';
    const weight = Math.round(this.settingsService.toDisplay(w.best_set.weight) * 10) / 10;
    return ` (${weight} ${this.settingsService.unitLabel()} × ${w.best_set.reps})`;
  }

  formatDate(instant: string, weekday = false): string {
    return formatInstant(instant, this.settingsService.timezone(), { weekday });
  }

  goBack() { this.router.navigate(['/jym/exercises']); }
}
