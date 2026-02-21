import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { JymService, Split, SplitSeriesSummary, SessionSummary, CreateSeriesRequest } from '../../../core/services/jym.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';

@Component({
  selector: 'app-split-list',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent, JymQuickNavComponent],
  template: `
    <div class="split-list">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Jym</h1>
          <p class="text-secondary">Structured progressive overload tracking</p>
        </div>
        <div class="header-actions">
          <jiro-button variant="secondary" type="button" (click)="startFreeSession()">
            Freestyle Session
          </jiro-button>
          <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">
            + New Routine Split
          </jiro-button>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <!-- Activity Stats -->
      <div *ngIf="hasCompletedSessions()" class="stats-section">
        <div class="stats-panels">
          <!-- Heatmap -->
          <div class="stats-panel heatmap-panel">
            <div class="stats-header">
              <span class="stats-title">Activity</span>
              <span class="stats-sub text-secondary">Past 16 weeks</span>
            </div>
            <div class="heatmap-wrap">
              <div class="heatmap-grid">
                <div
                  *ngFor="let day of heatmapDays()"
                  class="heat-cell"
                  [class.heat-none]="day.count === 0 && !day.future"
                  [class.heat-future]="day.future"
                  [class.heat-low]="day.count === 1"
                  [class.heat-high]="day.count >= 2"
                  [title]="day.label + (day.count > 0 ? ' · ' + day.count + (day.count === 1 ? ' session' : ' sessions') : '')">
                </div>
              </div>
              <div class="heatmap-legend">
                <span class="legend-label text-secondary">Less</span>
                <div class="heat-cell heat-none legend-cell"></div>
                <div class="heat-cell heat-low legend-cell"></div>
                <div class="heat-cell heat-high legend-cell"></div>
                <span class="legend-label text-secondary">More</span>
              </div>
            </div>
          </div>

          <!-- Muscle Group Tracker -->
          <div class="stats-panel mg-panel" *ngIf="muscleGroupStats().length > 0">
            <div class="stats-header">
              <span class="stats-title">Muscle Groups</span>
              <span class="stats-sub text-secondary">Last 4 weeks</span>
            </div>
            <div class="mg-list">
              <div *ngFor="let mg of muscleGroupStats()" class="mg-row">
                <span class="mg-name">{{ mg.name }}</span>
                <div class="mg-bar">
                  <div class="mg-fill"
                    [style.width.%]="(mg.sessionsLast28 / maxMgCount()) * 100"
                    [class.mg-fill-fresh]="mg.daysSinceLast <= 7"
                    [class.mg-fill-warm]="mg.daysSinceLast > 7 && mg.daysSinceLast <= 14"
                    [class.mg-fill-cold]="mg.daysSinceLast > 14">
                  </div>
                </div>
                <span class="mg-days"
                  [class.day-fresh]="mg.daysSinceLast <= 7"
                  [class.day-stale]="mg.daysSinceLast > 14">
                  {{ mg.daysSinceLast === 0 ? 'Today' : mg.daysSinceLast + 'd ago' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- In Progress Sessions -->
      <div *ngIf="inProgressSessions().length > 0" class="in-progress-section">
        <h2 class="section-title">In Progress</h2>
        <div *ngFor="let s of inProgressSessions()" class="ipc" (click)="router.navigate(['/jym/session', s.id])">
          <div class="ipc-info">
            <div class="ipc-name">{{ s.routine_name || 'Freestyle Session' }}</div>
            <div class="ipc-meta">Started {{ formatSessionTime(s.started_at) }}
              <span *ngIf="s.set_count > 0"> · {{ s.set_count }} sets logged</span>
            </div>
          </div>
          <div class="ipc-actions">
            <jiro-button variant="primary" type="button" (click)="$event.stopPropagation(); router.navigate(['/jym/session', s.id])">
              Resume
            </jiro-button>
            <button class="ipc-discard-btn" title="Discard session" (click)="$event.stopPropagation(); confirmDiscardSession(s)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Discard Session Confirmation Modal -->
      <jiro-modal *ngIf="discardingSession()" title="Discard Session?" maxWidth="420px" (close)="discardingSession.set(null)">
        <div class="delete-confirm">
          <p>Discard <strong>{{ discardingSession()!.routine_name || 'Freestyle Session' }}</strong>?</p>
          <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
            This will permanently delete the session and all sets logged so far. This cannot be undone.
          </p>
          <div class="form-actions" style="margin-top: var(--space-lg);">
            <jiro-button variant="secondary" type="button" (click)="discardingSession.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="discardingInProgress()" (click)="doDiscardSession()">
              {{ discardingInProgress() ? 'Discarding...' : 'Discard' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>

      <!-- Active Series -->
      <div *ngIf="activeSeries().length > 0" class="active-series-section">
        <h2 class="section-title">Active Series</h2>
        <div class="active-series-list">
          <div *ngFor="let sr of activeSeries()" class="asc">
            <div class="asc-info">
              <div class="asc-split-label">{{ sr.split_name }}</div>
              <div class="asc-name">{{ sr.name }}</div>
              <div class="asc-pills">
                <span class="asc-pill" *ngIf="!(sr.duration_type === 'sessions' && sr.target_sessions)">{{ sr.session_count }} sessions</span>
                <span *ngIf="sr.duration_type === 'weeks' && sr.target_weeks" class="asc-pill">
                  {{ progressWeeks(sr) }} / {{ sr.target_weeks }} wks
                </span>
                <span *ngIf="sr.duration_type === 'sessions' && sr.target_sessions" class="asc-pill">
                  {{ sr.session_count }} / {{ sr.target_sessions }} sessions
                </span>
              </div>
            </div>
            <div class="asc-actions">
              <button class="asc-view-btn" (click)="router.navigate(['/jym/series', sr.id])">View</button>
              <jiro-button variant="primary" type="button" (click)="startFromSeriesSplit(sr.split_id, sr.id)">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Start
              </jiro-button>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading splits...</p>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading() && splits().length === 0" class="state-message">
        <h3>No training splits yet</h3>
        <p class="text-secondary">Create your first split to organise your training week.</p>
        <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">
          Create First Split
        </jiro-button>
      </div>

      <!-- Splits grid -->
      <div *ngIf="!loading() && splits().length > 0" class="splits-grid">
        <jiro-card *ngFor="let split of splits()" class="split-card">
          <div class="split-header">
            <div class="split-info">
              <h3 class="split-name">{{ split.name }}</h3>
              <p class="split-desc text-secondary" *ngIf="split.description">{{ split.description }}</p>
            </div>
            <span class="routine-badge">{{ split.routine_count || 0 }} {{ (split.routine_count || 0) === 1 ? 'day' : 'days' }}</span>
          </div>

          <div class="split-actions">
            <div class="btn-slot">
              <jiro-button variant="secondary" type="button" (click)="viewSplit(split.id)">
                Build
              </jiro-button>
            </div>
            <div class="btn-slot">
              <jiro-button variant="secondary" type="button" (click)="openNewSeries(split.id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
                Series
              </jiro-button>
            </div>
            <div class="btn-slot">
              <jiro-button variant="primary" type="button" (click)="startFromSplitCard(split)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Start
              </jiro-button>
            </div>
            <button class="delete-split-btn" (click)="confirmDelete(split)" title="Delete split">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
              </svg>
            </button>
          </div>
        </jiro-card>
      </div>

      <!-- Create Split Modal -->
      <jiro-modal *ngIf="showCreate()" title="New Training Split" maxWidth="480px" (close)="showCreate.set(false)">
        <form class="create-form" (ngSubmit)="createSplit()">
          <div class="form-group">
            <label class="form-label">Split Name</label>
            <input
              class="form-input"
              type="text"
              [(ngModel)]="newName"
              name="name"
              placeholder="e.g. Push Pull Legs"
              required />
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea
              class="form-input form-textarea"
              [(ngModel)]="newDesc"
              name="desc"
              rows="2"
              placeholder="Brief description of this split..."></textarea>
          </div>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="showCreate.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !newName.trim()">
              {{ saving() ? 'Creating...' : 'Create Split' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- New Series Modal -->
      <jiro-modal *ngIf="showNewSeries()" title="Start New Series" maxWidth="480px" (close)="showNewSeries.set(false)">
        <form class="create-form" (ngSubmit)="createSeries()">
          <div class="form-group">
            <label class="form-label">Series Name</label>
            <input class="form-input" type="text" [(ngModel)]="seriesName" name="sname" placeholder="e.g. PPL Run #1" required />
          </div>
          <div class="form-group">
            <label class="form-label">Duration Type</label>
            <div class="duration-type-group">
              <button type="button" class="dtype-btn" [class.active]="seriesDurationType === 'weeks'" (click)="seriesDurationType = 'weeks'">Fixed Weeks</button>
              <button type="button" class="dtype-btn" [class.active]="seriesDurationType === 'sessions'" (click)="seriesDurationType = 'sessions'">Session Count</button>
              <button type="button" class="dtype-btn" [class.active]="seriesDurationType === 'open'" (click)="seriesDurationType = 'open'">Open-ended</button>
            </div>
          </div>
          <div class="form-group" *ngIf="seriesDurationType === 'weeks'">
            <label class="form-label">Target Weeks</label>
            <input class="form-input" type="number" min="1" [(ngModel)]="seriesTargetWeeks" name="tweeks" placeholder="e.g. 8" />
          </div>
          <div class="form-group" *ngIf="seriesDurationType === 'sessions'">
            <label class="form-label">Target Sessions</label>
            <input class="form-input" type="number" min="1" [(ngModel)]="seriesTargetSessions" name="tsessions" placeholder="e.g. 24" />
          </div>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="showNewSeries.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="savingSeries() || !seriesName.trim()">
              {{ savingSeries() ? 'Starting...' : 'Start Series' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- Delete Split Confirmation Modal -->
      <jiro-modal *ngIf="deletingSplit()" title="Delete Split?" maxWidth="420px" (close)="deletingSplit.set(null)">
        <div class="delete-confirm">
          <p>Delete <strong>{{ deletingSplit()!.name }}</strong>?</p>
          <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
            This will permanently delete the split and all its routines. Sessions that used these routines are not affected.
          </p>
          <div class="form-actions" style="margin-top: var(--space-lg);">
            <jiro-button variant="secondary" type="button" (click)="deletingSplit.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="deleteSplit()">
              {{ deleting() ? 'Deleting...' : 'Delete' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>

      <!-- Start Session: choose routine modal -->
      <jiro-modal *ngIf="showRoutinePicker()" title="Choose Routine" maxWidth="420px" (close)="showRoutinePicker.set(false)">
        <div *ngIf="loadingRoutines()" class="picker-loading">
          <div class="spinner-lg"></div>
        </div>
        <div *ngIf="!loadingRoutines()" class="routine-list">
          <button
            *ngFor="let r of pickerRoutines()"
            class="routine-pick-btn"
            (click)="startWithRoutine(r.id)">
            <span class="routine-pick-name">{{ r.name }}</span>
            <span class="routine-pick-day">Day {{ r.day_order }}</span>
          </button>
          <button class="routine-pick-btn freestyle" (click)="startFreeWithSplit()">
            Freestyle (no routine)
          </button>
        </div>
      </jiro-modal>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .split-list { max-width: 1000px; width: 100%; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions { display: flex; gap: var(--space-sm); flex-shrink: 0; }

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
      .header-actions { flex-shrink: 1; }
      .header-actions ::ng-deep .jiro-btn { width: auto; }
    }

    /* ── In Progress ── */
    .in-progress-section { margin-bottom: var(--space-xl); }

    .ipc {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-md); padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-left: 3px solid #4caf50;
      border-radius: var(--border-radius); cursor: pointer;
      transition: box-shadow 0.15s;
    }

    .ipc:hover { box-shadow: 0 0 0 3px rgba(76,175,80,0.12); }

    .ipc-info { display: flex; flex-direction: column; gap: 2px; }

    .ipc-name { font-size: var(--font-size-md); font-weight: 600; }

    .ipc-meta { font-size: var(--font-size-xs); color: var(--text-muted); }

    .ipc-actions { display: flex; align-items: center; gap: var(--space-xs); flex-shrink: 0; }

    .ipc-actions ::ng-deep .jiro-btn { width: auto; }

    .ipc-discard-btn {
      background: none; border: 1px solid var(--border-color);
      color: var(--text-muted); cursor: pointer;
      width: 34px; height: 34px; border-radius: var(--border-radius);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }

    .ipc-discard-btn:hover { color: var(--color-danger); border-color: var(--color-danger); background: rgba(196,74,74,0.08); }

    /* ── Active Series ── */
    .active-series-section { margin-bottom: var(--space-xl); }

    .section-title {
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-secondary); margin-bottom: var(--space-md);
    }

    .active-series-list { display: flex; flex-direction: column; gap: var(--space-sm); }

    .asc {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-md);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-left: 3px solid var(--color-primary);
      border-radius: var(--border-radius);
      padding: var(--space-md) var(--space-lg);
    }

    .asc-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }

    .asc-split-label {
      font-size: var(--font-size-xs); color: var(--text-muted);
      text-transform: uppercase; letter-spacing: 0.5px;
    }

    .asc-name { font-size: var(--font-size-md); font-weight: 600; }

    .asc-pills { display: flex; gap: var(--space-xs); flex-wrap: wrap; margin-top: 4px; }

    .asc-pill {
      font-size: var(--font-size-xs); padding: 2px 8px; border-radius: 10px;
      background: rgba(122,59,46,0.1); color: var(--color-primary); font-weight: 500;
    }

    .asc-actions { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

    .asc-actions ::ng-deep .jiro-btn { width: auto; }

    .asc-view-btn {
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: 7px 14px;
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .asc-view-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    /* ── State messages ── */
    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }

    .state-message ::ng-deep .jiro-btn { width: auto; }

    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .empty-icon { font-size: 48px; }

    .splits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
      gap: var(--space-lg);
    }

    .split-card { display: flex; flex-direction: column; gap: var(--space-md); }

    .split-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-info { flex: 1; min-width: 0; }

    .split-name { font-size: var(--font-size-lg); font-weight: 600; }

    .split-desc { font-size: var(--font-size-sm); margin-top: var(--space-xs); line-height: 1.4; }

    .routine-badge {
      background: rgba(122, 59, 46, 0.12);
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      white-space: nowrap;
    }

    .split-actions { display: flex; gap: var(--space-sm); margin-top: var(--space-lg); align-items: center; }

    .btn-slot { flex: 1; display: flex; flex-direction: column; }
    .btn-slot ::ng-deep .jiro-btn { flex: 1; width: 100%; }

    .delete-split-btn {
      flex-shrink: 0;
      background: none; border: 1px solid var(--border-color);
      color: var(--text-muted); cursor: pointer;
      width: 36px; height: 36px; border-radius: var(--border-radius);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
    }

    .delete-split-btn:hover {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: rgba(196,74,74,0.08);
    }

    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-xs); }

    .create-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }

    .form-input {
      padding: 10px 14px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-md);
      outline: none;
      transition: border-color 0.2s;
      font-family: inherit;
    }

    .form-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.15); }

    .form-textarea { resize: vertical; min-height: 60px; }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }

    .form-actions ::ng-deep .jiro-btn { width: auto; }

    .picker-loading { display: flex; justify-content: center; padding: var(--space-xl); }

    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; font-size: var(--font-size-md); color: var(--text-primary);
      transition: all 0.15s; text-align: left; width: 100%;
    }

    .routine-pick-btn:hover { border-color: var(--color-primary); background: rgba(122,59,46,0.05); }

    .routine-pick-btn.freestyle { color: var(--text-secondary); font-size: var(--font-size-sm); }

    .routine-pick-name { font-weight: 500; }

    .routine-pick-day { font-size: var(--font-size-xs); color: var(--text-muted); }

    .duration-type-group { display: flex; gap: var(--space-xs); }

    .dtype-btn {
      flex: 1; padding: var(--space-xs) var(--space-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); cursor: pointer; transition: all 0.15s;
    }

    .dtype-btn.active {
      border-color: var(--color-primary); background: rgba(122,59,46,0.08);
      color: var(--color-primary); font-weight: 600;
    }

    /* ── Activity Stats ── */
    .stats-section { margin-bottom: var(--space-xl); }

    .stats-panels { display: flex; gap: var(--space-lg); flex-wrap: wrap; }

    .stats-panel {
      flex: 1; min-width: 260px;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
    }

    .mg-panel { flex: 0 1 280px; }

    .stats-header {
      display: flex; align-items: baseline; justify-content: space-between;
      margin-bottom: var(--space-md); gap: var(--space-sm);
    }

    .stats-title { font-size: var(--font-size-sm); font-weight: 600; }

    .stats-sub { font-size: var(--font-size-xs); }

    /* Heatmap */
    .heatmap-wrap { overflow-x: auto; }

    .heatmap-grid {
      display: grid;
      grid-template-rows: repeat(7, 11px);
      grid-auto-flow: column;
      grid-auto-columns: 11px;
      gap: 3px;
      width: max-content;
    }

    .heat-cell { width: 11px; height: 11px; border-radius: 2px; }

    .heat-none { background: var(--bg-canvas); border: 1px solid var(--border-color); }

    .heat-future { background: transparent; }

    .heat-low { background: color-mix(in srgb, var(--color-primary) 35%, transparent); }

    .heat-high { background: color-mix(in srgb, var(--color-primary) 75%, transparent); }

    .heatmap-legend {
      display: flex; align-items: center; gap: 4px;
      margin-top: var(--space-sm); width: max-content;
    }

    .legend-cell { flex-shrink: 0; }

    .legend-label { font-size: var(--font-size-xs); }

    /* Muscle group tracker */
    .mg-list { display: flex; flex-direction: column; gap: 8px; }

    .mg-row { display: flex; align-items: center; gap: var(--space-sm); }

    .mg-name { font-size: var(--font-size-xs); font-weight: 500; min-width: 72px; color: var(--text-secondary); }

    .mg-bar { flex: 1; height: 6px; background: var(--bg-canvas); border-radius: 3px; overflow: hidden; }

    .mg-fill { height: 100%; border-radius: 3px; transition: width 0.3s; min-width: 3px; }

    .mg-fill-fresh { background: #4caf50; }

    .mg-fill-warm { background: #c4956a; }

    .mg-fill-cold { background: var(--border-color); }

    .mg-days { font-size: var(--font-size-xs); min-width: 54px; text-align: right; color: var(--text-muted); }

    .day-fresh { color: #4caf50; font-weight: 500; }

    .day-stale { color: var(--color-danger); }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 600px) {
      .asc { flex-wrap: wrap; gap: var(--space-sm); padding: var(--space-md); }

      .asc-actions { width: 100%; justify-content: flex-end; }

      .asc-view-btn { padding: 0.3rem 0.6rem; font-size: 0.7rem; }

      .asc-actions ::ng-deep .jiro-btn { font-size: 0.7rem; padding: 0.3rem 0.6rem; }

      /* Split card: shrink the whole actions row to fit in one line */
      .split-actions { gap: 0.3rem; }

      .split-actions ::ng-deep .jiro-btn {
        padding: 0.4rem 0.55rem;
        font-size: 0.7rem;
        gap: 0.2rem;
      }

      .split-actions svg { width: 10px; height: 10px; }

      .delete-split-btn { width: 2rem; height: 2rem; }
    }
  `]
})
export class SplitListComponent implements OnInit {
  splits = signal<Split[]>([]);
  activeSeries = signal<SplitSeriesSummary[]>([]);
  allSessions = signal<SessionSummary[]>([]);
  inProgressSessions = signal<SessionSummary[]>([]);
  loading = signal(true);

  hasCompletedSessions = computed(() => this.allSessions().some(s => !!s.ended_at));

  heatmapDays = computed(() => {
    const sessions = this.allSessions();
    const countByDay = new Map<string, number>();
    for (const s of sessions) {
      if (!s.ended_at) continue;
      const key = new Date(s.started_at).toISOString().slice(0, 10);
      countByDay.set(key, (countByDay.get(key) || 0) + 1);
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayDow = (today.getDay() + 6) % 7; // Mon=0 … Sun=6
    const start = new Date(today);
    start.setDate(today.getDate() - todayDow - 15 * 7);
    const end = new Date(today);
    end.setDate(today.getDate() + (6 - todayDow));
    const days: { date: string; count: number; label: string; future: boolean }[] = [];
    const d = new Date(start);
    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      days.push({
        date: key,
        count: countByDay.get(key) || 0,
        label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        future: d > today,
      });
      d.setDate(d.getDate() + 1);
    }
    return days;
  });

  muscleGroupStats = computed(() => {
    const sessions = this.allSessions();
    const now = Date.now();
    const cutoff28 = now - 28 * 86400000;
    const mgMap = new Map<string, { lastMs: number; sessionsLast28: number }>();
    for (const s of sessions) {
      if (!s.ended_at || !s.muscle_groups?.length) continue;
      const ms = new Date(s.started_at).getTime();
      for (const mg of s.muscle_groups) {
        const cur = mgMap.get(mg);
        mgMap.set(mg, {
          lastMs: cur ? Math.max(cur.lastMs, ms) : ms,
          sessionsLast28: (cur?.sessionsLast28 || 0) + (ms >= cutoff28 ? 1 : 0),
        });
      }
    }
    return Array.from(mgMap.entries())
      .map(([name, { lastMs, sessionsLast28 }]) => ({
        name,
        daysSinceLast: Math.floor((now - lastMs) / 86400000),
        sessionsLast28,
      }))
      .sort((a, b) => a.daysSinceLast - b.daysSinceLast);
  });

  maxMgCount = computed(() => {
    const stats = this.muscleGroupStats();
    return stats.length > 0 ? Math.max(...stats.map(s => s.sessionsLast28), 1) : 1;
  });
  saving = signal(false);
  showCreate = signal(false);
  deletingSplit = signal<Split | null>(null);
  deleting = signal(false);
  discardingSession = signal<SessionSummary | null>(null);
  discardingInProgress = signal(false);
  showRoutinePicker = signal(false);
  loadingRoutines = signal(false);
  pickerRoutines = signal<{ id: string; name: string; day_order: number }[]>([]);

  newName = '';
  newDesc = '';
  private selectedSplitId = '';
  private selectedSeriesId = '';

  // Series
  showNewSeries = signal(false);
  savingSeries = signal(false);
  seriesName = '';
  seriesDurationType: 'weeks' | 'sessions' | 'open' = 'open';
  seriesTargetWeeks: number | null = null;
  seriesTargetSessions: number | null = null;
  private seriesSplitId = '';

  constructor(private jymService: JymService, public router: Router) {}

  ngOnInit() {
    this.jymService.listSplits().subscribe({
      next: s => { this.splits.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
    this.jymService.listSeries().subscribe({
      next: s => this.activeSeries.set(s.filter(sr => !sr.ended_at)),
    });
    this.jymService.listSessions().subscribe({
      next: s => {
        this.allSessions.set(s);
        this.inProgressSessions.set(s.filter(sess => !sess.ended_at));
      },
    });
  }

  viewSplit(id: string) {
    this.router.navigate(['/jym/splits', id]);
  }

  createSplit() {
    if (!this.newName.trim()) return;
    this.saving.set(true);
    this.jymService.createSplit({ name: this.newName.trim(), description: this.newDesc.trim() || undefined }).subscribe({
      next: s => {
        this.splits.update(list => [s, ...list]);
        this.showCreate.set(false);
        this.newName = '';
        this.newDesc = '';
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  startFreeSession() {
    this.jymService.startSession({}).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  startFromSplitCard(split: Split) {
    this.selectedSeriesId = '';
    this.startFromSplit(split);
  }

  startFromSplit(split: Split) {
    this.selectedSplitId = split.id;
    this.loadingRoutines.set(true);
    this.showRoutinePicker.set(true);
    this.jymService.getSplit(split.id).subscribe({
      next: s => {
        this.pickerRoutines.set(s.routines.map(r => ({ id: r.id, name: r.name, day_order: r.day_order })));
        this.loadingRoutines.set(false);
      },
      error: () => { this.loadingRoutines.set(false); this.showRoutinePicker.set(false); },
    });
  }

  startWithRoutine(routineId: string) {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({
      routine_id: routineId,
      ...(this.selectedSeriesId ? { series_id: this.selectedSeriesId } : {}),
    }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } }),
    });
  }

  startFreeWithSplit() {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({
      ...(this.selectedSeriesId ? { series_id: this.selectedSeriesId } : {}),
    }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  confirmDelete(split: Split) {
    this.deletingSplit.set(split);
  }

  deleteSplit() {
    const split = this.deletingSplit();
    if (!split) return;
    this.deleting.set(true);
    this.jymService.deleteSplit(split.id).subscribe({
      next: () => {
        this.splits.update(list => list.filter(s => s.id !== split.id));
        this.deletingSplit.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }

  confirmDiscardSession(s: SessionSummary) {
    this.discardingSession.set(s);
  }

  doDiscardSession() {
    const s = this.discardingSession();
    if (!s) return;
    this.discardingInProgress.set(true);
    this.jymService.deleteSession(s.id).subscribe({
      next: () => {
        this.inProgressSessions.update(list => list.filter(x => x.id !== s.id));
        this.discardingSession.set(null);
        this.discardingInProgress.set(false);
      },
      error: () => this.discardingInProgress.set(false),
    });
  }

  formatSessionTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const h = Math.floor(mins / 60);
    return `${h}h ${mins % 60}m ago`;
  }

  startFromSeriesSplit(splitId: string, seriesId: string) {
    this.selectedSeriesId = seriesId;
    this.startFromSplit({ id: splitId } as Split);
  }

  progressWeeks(sr: SplitSeriesSummary): number {
    const days = Math.floor((Date.now() - new Date(sr.started_at).getTime()) / 86400000);
    return Math.floor(days / 7);
  }

  openNewSeries(splitId: string) {
    this.seriesSplitId = splitId;
    this.seriesName = '';
    this.seriesDurationType = 'open';
    this.seriesTargetWeeks = null;
    this.seriesTargetSessions = null;
    this.showNewSeries.set(true);
  }

  createSeries() {
    if (!this.seriesName.trim()) return;
    this.savingSeries.set(true);
    const req: CreateSeriesRequest = {
      split_id: this.seriesSplitId,
      name: this.seriesName.trim(),
      duration_type: this.seriesDurationType,
      target_weeks: this.seriesDurationType === 'weeks' ? (this.seriesTargetWeeks ?? undefined) : undefined,
      target_sessions: this.seriesDurationType === 'sessions' ? (this.seriesTargetSessions ?? undefined) : undefined,
    };
    this.jymService.createSeries(req).subscribe({
      next: sr => {
        this.savingSeries.set(false);
        this.showNewSeries.set(false);
        this.router.navigate(['/jym/series', sr.id]);
      },
      error: () => this.savingSeries.set(false),
    });
  }
}
