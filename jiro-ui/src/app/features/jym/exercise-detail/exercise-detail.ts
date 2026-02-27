import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { JymService, ExerciseWithHistory, SetHistory, ExerciseFormCheck } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { UploadService } from '../../../core/services/upload.service';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

Chart.register(...registerables);

type ChartType = '1rm' | 'volume' | 'maxweight' | 'repsatweight';
type SectionTab = 'history' | 'form' | 'notes';
type SortCol = 'date' | 'weight' | 'reps' | 'est_1rm';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule, JiroModalComponent, JiroButtonComponent],
  template: `
    <div class="exercise-detail">
      <!-- Back -->
      <button class="back-btn" (click)="goBack()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
        Exercise Library
      </button>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading() && exercise()" class="detail-body">
        <!-- Header -->
        <div class="detail-header">
          <div class="detail-title">
            <h1>{{ exercise()!.name }}</h1>
            <span *ngIf="exercise()!.muscle_group" class="mg-badge">{{ exercise()!.muscle_group }}</span>
          </div>
          <div class="pr-stats" *ngIf="exercise()!.history.length > 0">
            <div class="stat">
              <span class="stat-label">Best Weight</span>
              <span class="stat-value">{{ settingsService.toDisplay(exercise()!.best_weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
            </div>
            <div class="stat">
              <span class="stat-label">Est. 1RM</span>
              <span class="stat-value primary">{{ settingsService.toDisplay(exercise()!.est_1rm) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
            </div>
          </div>
        </div>

        <p *ngIf="exercise()!.notes" class="exercise-notes text-secondary">{{ exercise()!.notes }}</p>

        <!-- Plateau / Decline banner -->
        <div *ngIf="plateauStatus() === 'plateau'" class="plateau-banner plateau">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <div>
            <strong>Plateau detected</strong> — your max weight has been the same for the last 3 sessions.
            Consider a small weight increase, extra reps, or a deload week to break through.
          </div>
        </div>
        <div *ngIf="plateauStatus() === 'decline'" class="plateau-banner decline">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/><polyline points="17,18 23,18 23,12"/>
          </svg>
          <div>
            <strong>Declining trend</strong> — your peak lift has dropped across the last 3 sessions.
            Consider a deload, technique check, or extra recovery before pushing again.
          </div>
        </div>

        <!-- Chart section — shown whenever there is any history -->
        <div class="chart-section" *ngIf="exercise()!.history.length > 0">

          <!-- Tab chips -->
          <div class="chart-tabs">
            <button class="chart-tab" [class.active]="selectedChart() === '1rm'"         (click)="switchChart('1rm')">Est. 1RM</button>
            <button class="chart-tab" [class.active]="selectedChart() === 'volume'"      (click)="switchChart('volume')">Volume</button>
            <button class="chart-tab" [class.active]="selectedChart() === 'maxweight'"   (click)="switchChart('maxweight')">Max Weight</button>
            <button class="chart-tab" [class.active]="selectedChart() === 'repsatweight'" (click)="switchChart('repsatweight')">Reps @ Weight</button>
          </div>

          <!-- Weight selector (Reps @ Weight only) -->
          <div class="weight-selector-row" *ngIf="selectedChart() === 'repsatweight' && uniqueWeights().length > 0">
            <label class="ws-label">Weight</label>
            <select class="weight-select" (change)="onWeightChange($event)">
              <option *ngFor="let w of uniqueWeights()" [value]="w" [selected]="w === selectedWeight()">
                {{ settingsService.toDisplay(w) | number:'1.1-1' }} {{ settingsService.unitLabel() }}
              </option>
            </select>
          </div>

          <!-- Chart wrapper -->
          <div class="chart-wrapper">
            <div *ngIf="chartEmpty()" class="chart-empty">
              <p class="text-secondary">Not enough data to display this chart.</p>
            </div>
            <canvas #chartCanvas [hidden]="chartEmpty()"></canvas>
          </div>
        </div>

        <!-- Section tabs + content -->
        <div class="section-panel">
        <div class="section-tabs-bar">
          <button class="section-tab" [class.active]="activeSection() === 'history'" (click)="setSection('history')">
            Set History
            <span class="tab-count">{{ exercise()!.history.length }}</span>
          </button>
          <button class="section-tab" [class.active]="activeSection() === 'form'" (click)="setSection('form')">
            Form Progression
            <span *ngIf="formChecks().length > 0" class="tab-count">{{ formChecks().length }}</span>
          </button>
          <button class="section-tab" [class.active]="activeSection() === 'notes'" (click)="setSection('notes')">
            Notes
            <span *ngIf="sessionNotes().length > 0" class="tab-count">{{ sessionNotes().length }}</span>
          </button>
        </div>

        <!-- ── History tab ─────────────────────────────────────────── -->
        <div *ngIf="activeSection() === 'history'" class="tab-panel">
          <div *ngIf="exercise()!.history.length === 0" class="no-history">
            <p class="text-secondary">No sets logged yet. Start a session and log this exercise.</p>
          </div>

          <table *ngIf="exercise()!.history.length > 0" class="history-table">
            <thead>
              <tr>
                <th class="th-sort" (click)="sortBy('date')">
                  Date
                  <svg class="sort-chevron" [class.col-active]="sortCol() === 'date'" [class.dir-asc]="sortCol() === 'date' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,9 12,15 18,9"/></svg>
                </th>
                <th class="th-sort" (click)="sortBy('weight')">
                  Weight
                  <svg class="sort-chevron" [class.col-active]="sortCol() === 'weight'" [class.dir-asc]="sortCol() === 'weight' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,9 12,15 18,9"/></svg>
                </th>
                <th class="th-sort" (click)="sortBy('reps')">
                  Reps
                  <svg class="sort-chevron" [class.col-active]="sortCol() === 'reps'" [class.dir-asc]="sortCol() === 'reps' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,9 12,15 18,9"/></svg>
                </th>
                <th class="th-sort" (click)="sortBy('est_1rm')">
                  Est. 1RM
                  <svg class="sort-chevron" [class.col-active]="sortCol() === 'est_1rm'" [class.dir-asc]="sortCol() === 'est_1rm' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6,9 12,15 18,9"/></svg>
                </th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of pagedHistory()" [class.is-pr]="entry.is_pr">
                <td class="date-cell">{{ formatDate(entry.date) }}</td>
                <td class="weight-cell">{{ settingsService.toDisplay(entry.weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</td>
                <td>{{ entry.reps }} reps</td>
                <td class="orm-cell">{{ settingsService.toDisplay(entry.est_1rm) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</td>
                <td class="pr-cell">
                  <img *ngIf="entry.is_pr" src="/icons/badge-icon.svg" class="pr-badge" title="Personal Record" alt="PR" />
                </td>
              </tr>
            </tbody>
          </table>

          <div *ngIf="historyTotalPages() > 1" class="pagination">
            <button class="page-btn" [disabled]="historyPage() === 0" (click)="historyPage.set(historyPage() - 1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <span class="page-info">{{ historyPage() + 1 }} / {{ historyTotalPages() }}</span>
            <button class="page-btn" [disabled]="historyPage() === historyTotalPages() - 1" (click)="historyPage.set(historyPage() + 1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Form tab ────────────────────────────────────────────── -->
        <div *ngIf="activeSection() === 'form'" class="tab-panel">
          <div *ngIf="formChecksLoading()" class="fc-loading">
            <div class="spinner-sm"></div>
            <span>Loading clips...</span>
          </div>

          <div *ngIf="!formChecksLoading() && groupedFormChecks().length === 0" class="no-history">
            <p class="text-secondary">No form check clips yet. Tap "+ Form Check" during a session to add one.</p>
          </div>

          <div *ngIf="!formChecksLoading() && groupedFormChecks().length > 0" class="fc-groups">
            <div *ngFor="let group of pagedFormGroups()" class="fc-group">
              <div class="fc-group-date">{{ group.date }}</div>
              <div class="fc-grid">
                <div *ngFor="let item of group.items" class="fc-item">
                  <div class="fc-media-wrap">
                    <video *ngIf="item.file_type.startsWith('video')"
                      [src]="item.file_url" controls playsinline class="fc-media">
                    </video>
                    <img *ngIf="item.file_type.startsWith('image')"
                      [src]="item.file_url" [alt]="item.label || 'Form check'" class="fc-media" />
                    <button class="fc-delete-btn"
                      [disabled]="deletingFormCheck().has(item.id)"
                      (click)="confirmingDeleteId.set(item.id)"
                      title="Delete clip">
                      <svg *ngIf="!deletingFormCheck().has(item.id)" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                      </svg>
                      <div *ngIf="deletingFormCheck().has(item.id)" class="spinner-xs"></div>
                    </button>
                  </div>
                  <p *ngIf="item.label" class="fc-label">{{ item.label }}</p>
                </div>
              </div>
            </div>
          </div>

          <div *ngIf="formTotalPages() > 1" class="pagination">
            <button class="page-btn" [disabled]="formPage() === 0" (click)="formPage.set(formPage() - 1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
            </button>
            <span class="page-info">{{ formPage() + 1 }} / {{ formTotalPages() }}</span>
            <button class="page-btn" [disabled]="formPage() === formTotalPages() - 1" (click)="formPage.set(formPage() + 1)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="9,18 15,12 9,6"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- ── Notes tab ────────────────────────────────────────── -->
        <div *ngIf="activeSection() === 'notes'" class="tab-panel">
          <div *ngIf="sessionNotes().length === 0" class="no-history">
            <p class="text-secondary">No notes yet. Add a note for this exercise during a session.</p>
          </div>
          <div *ngIf="sessionNotes().length > 0" class="notes-list">
            <div *ngFor="let n of sessionNotes()" class="notes-item">
              <span class="notes-item-date">{{ formatDate(n.date) }}</span>
              <p class="notes-item-text">{{ n.exercise_note }}</p>
            </div>
          </div>
        </div>

        </div><!-- /section-panel -->
      </div>
    </div>

    <!-- Delete form check confirmation -->
    <jiro-modal *ngIf="confirmingDeleteId()" title="Delete Clip?" maxWidth="400px" (close)="confirmingDeleteId.set(null)">
      <div class="delete-confirm">
        <p class="text-secondary" style="font-size: var(--font-size-sm);">
          This will permanently remove the clip. This cannot be undone.
        </p>
        <div class="confirm-actions">
          <jiro-button variant="secondary" type="button" (click)="confirmingDeleteId.set(null)">Cancel</jiro-button>
          <jiro-button variant="danger" type="button"
            [disabled]="deletingFormCheck().has(confirmingDeleteId()!)"
            (click)="deleteFormCheck(confirmingDeleteId()!)">
            {{ deletingFormCheck().has(confirmingDeleteId()!) ? 'Deleting...' : 'Delete' }}
          </jiro-button>
        </div>
      </div>
    </jiro-modal>
  `,
  styles: [`
    :host { display: block; }

    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-md); }

    .confirm-actions {
      display: flex; justify-content: flex-end; gap: var(--space-sm);
      margin-top: var(--space-xs);
    }

    .confirm-actions ::ng-deep .jiro-btn { width: auto; }

    .exercise-detail { max-width: 900px; width: 100%; overflow-x: hidden; }

    .back-btn {
      display: flex; align-items: center; gap: var(--space-xs);
      background: none; border: none; color: var(--text-muted);
      font-size: var(--font-size-sm); cursor: pointer; padding: 0;
      margin-bottom: var(--space-xl);
    }

    .back-btn:hover { color: var(--text-primary); }

    .state-message {
      display: flex; align-items: center; justify-content: center; padding: var(--space-2xl);
    }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .detail-body { display: flex; flex-direction: column; gap: var(--space-xl); }

    .detail-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--space-lg); flex-wrap: wrap;
    }

    .detail-title { display: flex; align-items: center; gap: var(--space-md); flex-wrap: wrap; }

    .detail-title h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .mg-badge {
      background: rgba(122,59,46,0.12); color: var(--color-primary);
      font-size: var(--font-size-sm); font-weight: 500;
      padding: 4px 12px; border-radius: 12px;
    }

    .pr-stats { display: flex; gap: var(--space-xl); }

    .stat { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }

    .stat-label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    .stat-value { font-size: var(--font-size-xl); font-weight: 700; color: var(--text-primary); }

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
    .plateau-banner svg { flex-shrink: 0; margin-top: 1px; }
    .plateau-banner.plateau { background: rgba(196,149,106,0.1); border-color: rgba(196,149,106,0.4); color: #8a5a2e; }
    .plateau-banner.decline { background: rgba(196,74,74,0.08); border-color: rgba(196,74,74,0.3); color: var(--color-danger); }
    .plateau-banner strong { font-weight: 600; }

    /* ── Chart tabs ── */
    .chart-tabs {
      display: flex; flex-wrap: wrap; gap: var(--space-xs);
      margin-bottom: var(--space-md);
    }

    .chart-tab {
      padding: 6px 14px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      transition: all 0.15s;
    }

    .chart-tab:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .chart-tab.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: white;
      font-weight: 500;
    }

    /* ── Weight selector ── */
    .weight-selector-row {
      display: flex; align-items: center; gap: var(--space-sm);
      margin-bottom: var(--space-sm);
    }

    .ws-label { font-size: var(--font-size-sm); color: var(--text-secondary); font-weight: 500; }

    .weight-select {
      padding: 6px 10px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm);
      outline: none; cursor: pointer; font-family: inherit;
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
      padding: 1px 7px; border-radius: 10px;
      font-weight: 400;
    }

    .section-tab.active .tab-count {
      background: rgba(122,59,46,0.1);
      border-color: rgba(122,59,46,0.2);
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

    .history-table {
      width: 100%; border-collapse: collapse;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .history-table th {
      padding: var(--space-sm) var(--space-md); text-align: left;
      font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-muted); background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
    }

    .th-sort {
      cursor: pointer; user-select: none;
      white-space: nowrap;
    }

    .th-sort:hover { color: var(--text-primary); }

    .sort-chevron {
      margin-left: 3px; vertical-align: middle;
      opacity: 0.25; transition: transform 0.15s, opacity 0.15s;
      color: var(--text-muted);
    }

    .sort-chevron.col-active { opacity: 1; color: var(--color-primary); }

    .sort-chevron.dir-asc { transform: rotate(180deg); }

    .history-table td {
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid var(--border-color);
      font-size: var(--font-size-sm);
    }

    .history-table tr:last-child td { border-bottom: none; }

    .history-table tr.is-pr { background: rgba(122,59,46,0.04); }

    .date-cell { color: var(--text-secondary); }

    .weight-cell { font-weight: 600; }

    .orm-cell { color: var(--color-primary); font-weight: 500; }

    .pr-cell { text-align: center; }

    .pr-badge { width: 24px; height: 24px; display: block; margin: auto; }

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
    .fc-loading {
      display: flex; align-items: center; gap: var(--space-sm);
      color: var(--text-secondary); font-size: var(--font-size-sm);
    }

    .spinner-sm {
      width: 16px; height: 16px; border: 2px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite; flex-shrink: 0;
    }

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
      background: rgba(0,0,0,0.55); color: #fff;
      border: none; border-radius: 50%; cursor: pointer;
      padding: 0; transition: background 0.15s;
    }

    .fc-delete-btn:hover:not(:disabled) { background: rgba(196,74,74,0.85); }

    .fc-delete-btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner-xs {
      width: 10px; height: 10px; border: 1.5px solid rgba(255,255,255,0.4);
      border-top-color: #fff; border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    .fc-label {
      font-size: var(--font-size-xs); color: var(--text-secondary); margin: 0; line-height: 1.4;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

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

  exercise = signal<ExerciseWithHistory | null>(null);
  loading = signal(true);
  selectedChart = signal<ChartType>('1rm');
  selectedWeight = signal<number | null>(null);
  uniqueWeights = signal<number[]>([]);
  chartEmpty = signal(false);

  activeSection = signal<SectionTab>('history');

  sortCol = signal<SortCol>('date');
  sortDir = signal<'asc' | 'desc'>('desc');

  readonly HISTORY_PAGE_SIZE = 25;
  readonly FORM_PAGE_SIZE = 3;

  historyPage = signal(0);
  formPage = signal(0);

  formChecks = signal<ExerciseFormCheck[]>([]);
  formChecksLoading = signal(true);
  deletingFormCheck = signal<Set<string>>(new Set());
  confirmingDeleteId = signal<string | null>(null);

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

  sortedHistory = computed(() => {
    const ex = this.exercise();
    if (!ex) return [];
    const col = this.sortCol();
    const dir = this.sortDir();
    const copy = [...ex.history];
    copy.sort((a, b) => {
      let cmp = 0;
      if      (col === 'date')    cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (col === 'weight')  cmp = a.weight - b.weight;
      else if (col === 'reps')    cmp = a.reps - b.reps;
      else if (col === 'est_1rm') cmp = a.est_1rm - b.est_1rm;
      return dir === 'asc' ? cmp : -cmp;
    });
    return copy;
  });

  pagedHistory = computed(() => {
    const start = this.historyPage() * this.HISTORY_PAGE_SIZE;
    return this.sortedHistory().slice(start, start + this.HISTORY_PAGE_SIZE);
  });

  historyTotalPages = computed(() => {
    const len = this.sortedHistory().length;
    return len === 0 ? 1 : Math.ceil(len / this.HISTORY_PAGE_SIZE);
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

  sessionNotes = computed(() => {
    const history = this.exercise()?.history ?? [];
    const seen = new Set<string>();
    return history.filter(h => {
      if (!h.exercise_note || seen.has(h.session_id)) return false;
      seen.add(h.session_id);
      return true;
    });
  });

  plateauStatus = computed<'plateau' | 'decline' | null>(() => {
    const ex = this.exercise();
    if (!ex || ex.history.length === 0) return null;
    const bySession = new Map<string, { date: string; weight: number }>();
    for (const h of ex.history) {
      if (h.session_type === 'deload') continue;
      const cur = bySession.get(h.session_id);
      if (!cur || h.weight > cur.weight) bySession.set(h.session_id, { date: h.date, weight: h.weight });
    }
    const sessions = Array.from(bySession.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    if (sessions.length < 3) return null;
    const last3 = sessions.slice(-3).map(s => s.weight);
    const [a, b, c] = last3;
    if (Math.abs(a - b) < 0.01 && Math.abs(b - c) < 0.01) return 'plateau';
    if (b < a - 0.01 && c < b - 0.01) return 'decline';
    return null;
  });

  private chart: Chart | null = null;
  private dataLoaded = false;
  private viewReady = false;

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    private router: Router,
    public settingsService: SettingsService,
    private uploadService: UploadService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id') || '';
    this.jymService.getExercise(id).subscribe({
      next: ex => {
        this.exercise.set(ex);
        this.loading.set(false);
        this.uniqueWeights.set(this.getUniqueWeights());
        this.dataLoaded = true;
        setTimeout(() => this.maybeDrawChart(), 0);
      },
      error: () => this.loading.set(false),
    });
    this.jymService.listExerciseFormChecks(id).subscribe({
      next: checks => { this.formChecks.set(checks); this.formChecksLoading.set(false); },
      error: () => this.formChecksLoading.set(false),
    });
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
    this.historyPage.set(0);
    this.formPage.set(0);
  }


  deleteFormCheck(id: string) {
    this.deletingFormCheck.update(s => new Set([...s, id]));
    this.uploadService.deleteSessionAttachment(id).subscribe({
      next: () => {
        this.formChecks.update(list => list.filter(c => c.id !== id));
        this.deletingFormCheck.update(s => { const n = new Set(s); n.delete(id); return n; });
        this.confirmingDeleteId.set(null);
      },
      error: () => {
        this.deletingFormCheck.update(s => { const n = new Set(s); n.delete(id); return n; });
      },
    });
  }

  sortBy(col: SortCol) {
    if (this.sortCol() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortCol.set(col);
      this.sortDir.set('desc');
    }
    this.historyPage.set(0);
  }

  switchChart(type: ChartType) {
    this.selectedChart.set(type);
    if (type === 'repsatweight' && this.selectedWeight() === null && this.uniqueWeights().length > 0) {
      this.selectedWeight.set(this.uniqueWeights()[0]);
    }
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
      case '1rm':          this.draw1rmChart(unit);          break;
      case 'volume':       this.drawVolumeChart(unit);       break;
      case 'maxweight':    this.drawMaxWeightChart(unit);    break;
      case 'repsatweight': this.drawRepsAtWeightChart();     break;
    }
  }

  // ── Chart builders ───────────────────────────────────────────────────────────

  private draw1rmChart(unit: string) {
    const data = this.get1rmData();
    if (data.length === 0) { this.chartEmpty.set(true); return; }
    this.chartEmpty.set(false);

    const labels = data.map(d => this.formatDate(d.date));
    const values = data.map(d => Math.round(this.settingsService.toDisplay(d.est_1rm) * 10) / 10);
    this.chart = new Chart(this.canvasRef.nativeElement,
      this.lineConfig(labels, values, `Est. 1RM (${unit})`, '#7a3b2e',
        'Estimated 1RM Progress', `Est. 1RM (${unit})`, unit));
  }

  private drawVolumeChart(unit: string) {
    const data = this.getVolumeData();
    if (data.length === 0) { this.chartEmpty.set(true); return; }
    this.chartEmpty.set(false);

    const labels = data.map(d => this.formatDate(d.date));
    const values = data.map(d => Math.round(this.settingsService.toDisplay(d.volume) * 10) / 10);
    this.chart = new Chart(this.canvasRef.nativeElement,
      this.lineConfig(labels, values, `Volume (${unit}×reps)`, '#c4956a',
        'Total Session Volume', `Volume (${unit}×reps)`, `${unit}×reps`));
  }

  private drawMaxWeightChart(unit: string) {
    const data = this.getMaxWeightData();
    if (data.length === 0) { this.chartEmpty.set(true); return; }
    this.chartEmpty.set(false);

    const labels = data.map(d => this.formatDate(d.date));
    const values = data.map(d => Math.round(this.settingsService.toDisplay(d.weight) * 10) / 10);
    this.chart = new Chart(this.canvasRef.nativeElement,
      this.lineConfig(labels, values, `Max Weight (${unit})`, '#4a6741',
        'Heaviest Set Per Session', `Weight (${unit})`, unit));
  }

  private drawRepsAtWeightChart() {
    const weight = this.selectedWeight();
    if (weight === null) { this.chartEmpty.set(true); return; }

    const sessions = this.getRepsAtWeightData(weight);
    if (sessions.length === 0) { this.chartEmpty.set(true); return; }
    this.chartEmpty.set(false);

    const unit = this.settingsService.unitLabel();
    const displayWeight = Math.round(this.settingsService.toDisplay(weight) * 10) / 10;
    const labels = sessions.map(s => this.formatDate(s.date));
    const maxSets = Math.max(...sessions.map(s => s.repsArr.length));
    const barColors = ['#7a3b2e', '#c4956a', '#4a6741', '#d4c5a9'];

    const datasets = Array.from({ length: maxSets }, (_, i) => ({
      label: `Set ${i + 1}`,
      data: sessions.map(s => s.repsArr[i] ?? null) as (number | null)[],
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
            color: '#2D2420',
            padding: { top: 0, bottom: 10 },
          },
          legend: { display: maxSets > 1, labels: { boxWidth: 12, font: { size: 11 } } },
          tooltip: { callbacks: { label: ctx => ` Set ${ctx.datasetIndex + 1}: ${ctx.parsed.y} reps` } },
        },
        scales: {
          x: {
            title: { display: true, text: 'Date', font: { size: 11 }, color: '#9B8F88' },
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: 'Reps', font: { size: 11 }, color: '#9B8F88' },
            grid: { color: 'rgba(0,0,0,0.05)' },
            beginAtZero: true,
            ticks: { font: { size: 11 }, stepSize: 1, callback: v => `${v}` },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, config);
  }

  private lineConfig(
    labels: string[], values: number[], label: string, color: string,
    chartTitle: string, yAxisLabel: string, tooltipUnit: string,
  ): ChartConfiguration {
    return {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderColor: color,
          backgroundColor: `${color}1a`,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: color,
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
            text: chartTitle,
            font: { size: 13, weight: 'bold' },
            color: '#2D2420',
            padding: { top: 0, bottom: 10 },
          },
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} ${tooltipUnit}` } },
        },
        scales: {
          x: {
            title: { display: true, text: 'Date', font: { size: 11 }, color: '#9B8F88' },
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 } },
          },
          y: {
            title: { display: true, text: yAxisLabel, font: { size: 11 }, color: '#9B8F88' },
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 }, callback: v => `${v}` },
          },
        },
      },
    };
  }

  // ── Data computations ────────────────────────────────────────────────────────

  private get1rmData(): SetHistory[] {
    const bySession = new Map<string, SetHistory>();
    for (const h of this.exercise()!.history) {
      if (h.session_type === 'deload') continue;
      if (!bySession.has(h.session_id) || h.est_1rm > bySession.get(h.session_id)!.est_1rm) {
        bySession.set(h.session_id, h);
      }
    }
    return Array.from(bySession.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getVolumeData(): { date: string; volume: number }[] {
    const bySession = new Map<string, { date: string; volume: number }>();
    for (const h of this.exercise()!.history) {
      if (h.session_type === 'deload') continue;
      if (!bySession.has(h.session_id)) bySession.set(h.session_id, { date: h.date, volume: 0 });
      bySession.get(h.session_id)!.volume += h.weight * h.reps;
    }
    return Array.from(bySession.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getMaxWeightData(): SetHistory[] {
    const bySession = new Map<string, SetHistory>();
    for (const h of this.exercise()!.history) {
      if (h.session_type === 'deload') continue;
      if (!bySession.has(h.session_id) || h.weight > bySession.get(h.session_id)!.weight) {
        bySession.set(h.session_id, h);
      }
    }
    return Array.from(bySession.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getRepsAtWeightData(weight: number): { date: string; repsArr: number[] }[] {
    const bySession = new Map<string, { date: string; repsArr: number[] }>();
    for (const h of this.exercise()!.history) {
      if (h.session_type === 'deload') continue;
      if (Math.abs(h.weight - weight) > 0.01) continue;
      if (!bySession.has(h.session_id)) bySession.set(h.session_id, { date: h.date, repsArr: [] });
      bySession.get(h.session_id)!.repsArr.push(h.reps);
    }
    return Array.from(bySession.values())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private getUniqueWeights(): number[] {
    const weights = new Set<number>();
    for (const h of (this.exercise()?.history ?? [])) {
      if (h.session_type !== 'deload') weights.add(h.weight);
    }
    return Array.from(weights).sort((a, b) => b - a);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  goBack() { this.router.navigate(['/jym/exercises']); }
}
