import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { DecimalPipe } from '@angular/common';

import { Router, RouterLink } from '@angular/router';
import { JymService, Split, SplitSeriesSummary, SessionSummary, Routine } from '../../../core/services/jym.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ToastService } from '../../../core/services/toast.service';
import { addDays, dayKey, mondayOfKey, relativeDayName, todayKey } from '../../../core/utils/day';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { suggestDeload } from '../deload-rule';

/** Snooze stamp for the deload suggestion: the epoch ms of the last "Not now". */
const DELOAD_SNOOZED_KEY = 'jiro_jym_deload_snoozed';
const DELOAD_SNOOZE_DAYS = 7;

@Component({
  selector: 'app-jym-dashboard',
  standalone: true,
  imports: [
    RouterLink, DecimalPipe, JiroButtonComponent, JiroModalComponent, JiroIconComponent,
    JiroPageHeaderComponent, JiroEmptyStateComponent,
  ],
  template: `
    <div class="jym-dash">
      <!-- Header -->
      <jiro-page-header heading="Jym" subtitle="Structured progressive overload tracking">
        <jiro-button actions variant="secondary" type="button" (click)="startFreeSession()">
          Freestyle session
        </jiro-button>
      </jiro-page-header>

      <!-- Deload suggestion -->
      @if (deloadSuggestion(); as d) {
        <section class="deload-card" aria-labelledby="deload-heading">
          <div class="deload-info">
            <h2 class="deload-heading" id="deload-heading">Time for a lighter week?</h2>
            <p class="deload-note">
              Volume is down {{ d.dropPercent | number:'1.0-1' }}% across your last {{ d.sessionCount }} sessions,
              {{ settingsService.toDisplay(d.olderMeanVolume) | number:'1.0-0' }} to
              {{ settingsService.toDisplay(d.newerMeanVolume) | number:'1.0-0' }} {{ settingsService.unitLabel() }} a session,
              and none of them set a PR.
            </p>
          </div>
          <div class="deload-actions">
            <jiro-button variant="primary" type="button" [loading]="startingDeload()" (click)="startDeloadSession()">
              Start next session as a deload
            </jiro-button>
            <jiro-button variant="secondary" type="button" (click)="snoozeDeload()">
              Not now
            </jiro-button>
          </div>
        </section>
      }

      <!-- Activity Stats -->
      @if (hasCompletedSessions()) {
<div class="stats-section">
        <div class="stats-panels">
          <!-- Heatmap -->
          <div class="stats-panel heatmap-panel">
            <div class="stats-header">
              <span class="stats-title">Activity</span>
              <span class="stats-sub text-secondary">Past 16 weeks</span>
            </div>
            <div class="heatmap-wrap">
              <div class="heatmap-grid">
                @for (day of heatmapDays(); track day) {
<div
                 
                  class="heat-cell"
                  [class.heat-none]="day.count === 0 && !day.future"
                  [class.heat-future]="day.future"
                  [class.heat-low]="day.count === 1"
                  [class.heat-high]="day.count >= 2"
                  [title]="day.label + (day.count > 0 ? ' · ' + day.count + (day.count === 1 ? ' session' : ' sessions') : '')">
                </div>
}
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
          @if (muscleGroupStats().length > 0) {
<div class="stats-panel mg-panel">
            <div class="stats-header">
              <span class="stats-title">Muscle Groups</span>
              <span class="stats-sub text-secondary">Last 4 weeks</span>
            </div>
            <div class="mg-list">
              @for (mg of muscleGroupStats(); track mg) {
<div class="mg-row">
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
                  {{ mg.label }}
                </span>
              </div>
}
            </div>
          </div>
}
        </div>
      </div>
}

      <!-- In Progress Sessions -->
      @if (inProgressSessions().length > 0) {
<div class="in-progress-section">
        <h2 class="section-title">In Progress</h2>
        @for (s of inProgressSessions(); track s) {
<div class="ipc" (click)="router.navigate(['/jym/session', s.id])">
          <div class="ipc-info">
            <div class="ipc-name">{{ s.routine_name || 'Freestyle Session' }}</div>
            <div class="ipc-meta">Started {{ formatSessionTime(s.started_at) }}
              @if (s.set_count > 0) {
<span> · {{ s.set_count }} sets logged</span>
}
            </div>
          </div>
          <div class="ipc-actions">
            <jiro-button variant="primary" type="button" (click)="$event.stopPropagation(); router.navigate(['/jym/session', s.id])">
              Resume
            </jiro-button>
            <button class="ipc-discard-btn" type="button" title="Discard session"
              [attr.aria-label]="'Discard ' + (s.routine_name || 'freestyle session')"
              (click)="$event.stopPropagation(); discardSession(s)">
              <jiro-icon name="trash" [size]="15" />
            </button>
          </div>
        </div>
}
      </div>
}

      <!-- Active Series -->
      @if (activeSeries().length > 0) {
<div class="active-series-section">
        <h2 class="section-title">Active series</h2>
        <div class="active-series-list">
          @for (sr of activeSeries(); track sr) {
<div class="asc">
            <div class="asc-info">
              <div class="asc-split-label">{{ sr.split_name }}</div>
              <div class="asc-name">{{ sr.name }}</div>
              <div class="asc-pills">
                @if (!(sr.duration_type === 'sessions' && sr.target_sessions)) {
<span class="asc-pill">{{ sr.session_count }} sessions</span>
}
                @if (sr.duration_type === 'weeks' && sr.target_weeks) {
<span class="asc-pill">
                  {{ progressWeeks(sr) }} / {{ sr.target_weeks }} wks
                </span>
}
                @if (sr.duration_type === 'sessions' && sr.target_sessions) {
<span class="asc-pill">
                  {{ sr.session_count }} / {{ sr.target_sessions }} sessions
                </span>
}
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
}
        </div>
      </div>
}

      <!-- Your Splits summary -->
      <div class="splits-summary">
        <div class="splits-summary-header">
          <h2 class="section-title">Your splits</h2>
          <a routerLink="/jym/plan" class="manage-link">
            Manage splits →
          </a>
        </div>
        @if (loading()) {
          <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
        }
        @if (!loading() && splits().length === 0) {
          <jiro-empty-state compact heading="No splits yet" message="A split organises your training week.">
            <jiro-button size="sm" variant="secondary" routerLink="/jym/plan">Create your first split</jiro-button>
          </jiro-empty-state>
        }
        @if (!loading() && splits().length > 0) {
<div class="splits-row">
          @for (split of splits().slice(0, 4); track split) {
<div class="split-chip">
            <div class="split-chip-info" (click)="router.navigate(['/jym/splits', split.id])">
              <span class="split-chip-name">{{ split.name }}</span>
              <span class="split-chip-days">{{ split.routine_count || 0 }} {{ (split.routine_count || 0) === 1 ? 'day' : 'days' }}</span>
            </div>
            <button class="split-start-btn" type="button" title="Start workout from this split"
              [attr.aria-label]="'Start a workout from ' + split.name" (click)="startFromSplit(split.id)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
            </button>
          </div>
}
          @if (splits().length > 4) {
<a routerLink="/jym/plan" class="split-chip more-chip">
            +{{ splits().length - 4 }} more
          </a>
}
        </div>
}
      </div>

      <!-- Templates -->
      <div class="splits-summary">
        <div class="splits-summary-header">
          <h2 class="section-title">Templates</h2>
          <a routerLink="/jym/templates" class="manage-link">Manage →</a>
        </div>
        @if (loading()) {
          <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
        }
        @if (!loading() && templates().length === 0) {
          <jiro-empty-state
            compact
            heading="No templates yet"
            message="During a session, use Save as template to keep its layout for next time." />
        }
        @if (!loading() && templates().length > 0) {
<div class="splits-row">
          @for (t of templates().slice(0, 4); track t) {
<div class="split-chip" (click)="startFromTemplate(t)">
            <span class="split-chip-name">{{ t.name }}</span>
            <span class="split-chip-days">{{ t.items.length }} {{ t.items.length === 1 ? 'exercise' : 'exercises' }}</span>
          </div>
}
          @if (templates().length > 4) {
<a routerLink="/jym/templates" class="split-chip more-chip">
            +{{ templates().length - 4 }} more
          </a>
}
        </div>
}
      </div>

      <!-- Start Session: choose routine modal -->
      @if (showRoutinePicker()) {
<jiro-modal title="Choose Routine" maxWidth="420px" (close)="showRoutinePicker.set(false)">
        @if (loadingRoutines()) {
          <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
        }
        @if (!loadingRoutines()) {
<div class="routine-list">
          @for (r of pickerRoutines(); track r) {
<button
           
            class="routine-pick-btn"
            (click)="startWithRoutine(r.id)">
            <span class="routine-pick-name">{{ r.name }}</span>
            <span class="routine-pick-day">Day {{ r.day_order }}</span>
          </button>
}
          <button class="routine-pick-btn freestyle" (click)="startFreeWithSplit()">
            Freestyle (no routine)
          </button>
        </div>
}
      </jiro-modal>
}
    </div>
  `,
  styles: [`
    :host { display: block; }

    .jym-dash { max-width: 1000px; width: 100%; }




    @media (max-width: 600px) {
    }

    /* ── Deload suggestion ── */
    .deload-card {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-md); margin-bottom: var(--space-xl);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-left: 3px solid var(--color-warning);
      border-radius: var(--border-radius);
      padding: var(--space-md) var(--space-lg);
    }

    .deload-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }

    .deload-heading {
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-primary); margin: 0;
    }

    .deload-note {
      font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0;
    }

    .deload-actions {
      display: flex; align-items: center; gap: var(--space-sm);
      flex-wrap: wrap; flex-shrink: 0;
    }

    /* ── In Progress ── */
    .in-progress-section { margin-bottom: var(--space-xl); }

    .ipc {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-md); padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-left: 3px solid var(--color-positive);
      border-radius: var(--border-radius); cursor: pointer;
      transition: box-shadow 0.15s;
    }

    .ipc:hover { box-shadow: 0 0 0 3px rgba(var(--color-accent-rgb), 0.12); }

    .ipc-info { display: flex; flex-direction: column; gap: 2px; }

    .ipc-name { font-size: var(--font-size-md); font-weight: 600; }

    .ipc-meta { font-size: var(--font-size-xs); color: var(--text-muted); }

    .ipc-actions { display: flex; align-items: center; gap: var(--space-xs); flex-shrink: 0; }


    .ipc-discard-btn {
      background: none; border: 1px solid var(--border-color);
      color: var(--text-muted); cursor: pointer;
      width: 34px; height: 34px; border-radius: var(--border-radius);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }

    .ipc-discard-btn:hover { color: var(--color-danger); border-color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.08); }

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
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); font-weight: 500;
    }

    .asc-actions { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }


    .asc-view-btn {
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: 7px 14px;
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .asc-view-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    /* ── Splits summary ── */
    .splits-summary { margin-bottom: var(--space-xl); }

    .splits-summary-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: var(--space-md);
    }

    .splits-summary-header .section-title { margin-bottom: 0; }

    .manage-link {
      font-size: var(--font-size-sm); color: var(--color-primary);
      text-decoration: none; font-weight: 500; transition: opacity 0.15s;
    }

    .manage-link:hover { opacity: 0.8; text-decoration: none; }


    .splits-row { display: flex; gap: var(--space-sm); flex-wrap: wrap; }

    .split-chip {
      padding: var(--space-sm) var(--space-md);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); cursor: pointer;
      transition: all 0.15s; display: flex; flex-direction: row;
      align-items: center; gap: var(--space-sm);
      min-width: 120px;
    }

    .split-chip:hover { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.04); }

    .split-chip-info { display: flex; flex-direction: column; gap: 2px; flex: 1; cursor: pointer; }

    .split-chip-name { font-size: var(--font-size-sm); font-weight: 600; }

    .split-chip-days { font-size: var(--font-size-xs); color: var(--text-muted); }

    .split-start-btn {
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(var(--color-primary-rgb), 0.08); border: 1px solid transparent;
      color: var(--color-primary); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0; transition: all 0.15s;
    }

    .split-start-btn:hover {
      background: var(--color-primary); color: white;
      border-color: var(--color-primary);
    }

    .more-chip {
      align-items: center; justify-content: center; text-decoration: none;
      color: var(--color-primary); font-size: var(--font-size-sm); font-weight: 500;
    }

    /* ── State ── */
    .state-loading { display: flex; justify-content: center; padding: var(--space-xl); }


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

    .mg-fill-fresh { background: var(--color-positive); }

    .mg-fill-warm { background: var(--color-warning); }

    .mg-fill-cold { background: var(--border-color); }

    .mg-days { font-size: var(--font-size-xs); min-width: 54px; text-align: right; color: var(--text-muted); }

    .day-fresh { color: var(--color-positive); font-weight: 500; }

    .day-stale { color: var(--color-danger); }

    /* Routine picker */

    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; font-size: var(--font-size-md); color: var(--text-primary);
      transition: all 0.15s; text-align: left; width: 100%;
    }

    .routine-pick-btn:hover { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

    .routine-pick-btn.freestyle { color: var(--text-secondary); font-size: var(--font-size-sm); }

    .routine-pick-name { font-weight: 500; }

    .routine-pick-day { font-size: var(--font-size-xs); color: var(--text-muted); }


    @media (max-width: 600px) {
      .asc { flex-wrap: wrap; gap: var(--space-sm); padding: var(--space-md); }

      .asc-actions { width: 100%; justify-content: flex-end; }

      .asc-view-btn { padding: 0.3rem 0.6rem; font-size: 0.7rem; }

      /* Stack the suggestion at phone width; the buttons go full width so the
         long primary label never has to wrap or overflow at 360px. */
      .deload-card {
        flex-direction: column; align-items: stretch;
        padding: var(--space-md);
      }

      .deload-actions { --jiro-btn-width: 100%; flex-direction: column; align-items: stretch; }
    }
  `]
})
export class JymDashboardComponent implements OnInit {
  splits = signal<Split[]>([]);
  activeSeries = signal<SplitSeriesSummary[]>([]);
  allSessions = signal<SessionSummary[]>([]);
  inProgressSessions = signal<SessionSummary[]>([]);
  templates = signal<Routine[]>([]);
  loading = signal(true);

  hasCompletedSessions = computed(() => this.allSessions().some(s => !!s.ended_at));

  startingDeload = signal(false);
  private readonly deloadSnoozed = signal(readDeloadSnoozed());

  /**
   * The deload suggestion, or null when the rule does not fire or the user
   * said "Not now" inside the last week. The rule itself lives in
   * ../deload-rule.ts; this only decides whether to show what it found.
   */
  readonly deloadSuggestion = computed(() =>
    this.deloadSnoozed() ? null : suggestDeload(this.allSessions())
  );

  heatmapDays = computed(() => {
    const sessions = this.allSessions();
    // Days are the user's calendar days (settings zone), like the day view.
    const tz = this.settingsService.timezone();
    const countByDay = new Map<string, number>();
    for (const s of sessions) {
      if (!s.ended_at) continue;
      const key = dayKey(s.started_at, tz);
      countByDay.set(key, (countByDay.get(key) || 0) + 1);
    }
    // 16 weeks, Monday to Sunday, ending with the current week.
    const today = todayKey(tz);
    const start = addDays(mondayOfKey(today), -15 * 7);
    const days: { date: string; count: number; label: string; future: boolean }[] = [];
    for (let i = 0; i < 16 * 7; i++) {
      const key = addDays(start, i);
      const [y, m, d] = key.split('-').map(Number);
      days.push({
        date: key,
        count: countByDay.get(key) || 0,
        label: new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }),
        future: key > today,
      });
    }
    return days;
  });

  // Recency in the user's calendar days: last night's workout is "Yesterday" this morning.
  muscleGroupStats = computed(() => {
    const sessions = this.allSessions();
    const tz = this.settingsService.timezone();
    const today = todayKey(tz);
    const cutoff28 = addDays(today, -27);
    const mgMap = new Map<string, { lastKey: string; sessionsLast28: number }>();
    for (const s of sessions) {
      if (!s.ended_at || !s.muscle_groups?.length) continue;
      const key = dayKey(s.started_at, tz);
      for (const mg of s.muscle_groups) {
        const cur = mgMap.get(mg);
        mgMap.set(mg, {
          lastKey: cur && cur.lastKey > key ? cur.lastKey : key,
          sessionsLast28: (cur?.sessionsLast28 || 0) + (key >= cutoff28 ? 1 : 0),
        });
      }
    }
    return Array.from(mgMap.entries())
      .map(([name, { lastKey, sessionsLast28 }]) => {
        const daysSinceLast = daysBetween(lastKey, today);
        return {
          name,
          daysSinceLast,
          label: relativeDayName(lastKey, today) ?? `${daysSinceLast}d ago`,
          sessionsLast28,
        };
      })
      .sort((a, b) => a.daysSinceLast - b.daysSinceLast);
  });

  maxMgCount = computed(() => {
    const stats = this.muscleGroupStats();
    return stats.length > 0 ? Math.max(...stats.map(s => s.sessionsLast28), 1) : 1;
  });

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  readonly settingsService = inject(SettingsService);
  showRoutinePicker = signal(false);
  loadingRoutines = signal(false);
  pickerRoutines = signal<{ id: string; name: string; day_order: number }[]>([]);

  private selectedSeriesId = '';

  constructor(private jymService: JymService, public router: Router) { }

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
    this.jymService.listTemplates().subscribe({
      next: t => this.templates.set(t),
    });
  }

  startFreeSession() {
    this.jymService.startSession({}).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  /**
   * Opens the next session already marked as a deload, so the player shows
   * Deload selected without a second call.
   */
  startDeloadSession() {
    this.startingDeload.set(true);
    this.jymService.startSession({ session_type: 'deload' }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
      error: () => {
        this.startingDeload.set(false);
        this.toast.error('Could not start the session.');
      },
    });
  }

  /** Quiets the suggestion for a week. A suggestion you cannot quiet is nagging. */
  snoozeDeload() {
    try { localStorage.setItem(DELOAD_SNOOZED_KEY, String(Date.now())); } catch { /* storage unavailable */ }
    this.deloadSnoozed.set(true);
  }

  startFromTemplate(t: Routine) {
    this.jymService.startSession({ routine_id: t.id }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } }),
    });
  }

  async discardSession(s: SessionSummary) {
    const name = s.routine_name || 'this freestyle session';
    const ok = await this.confirmService.confirm({
      title: `Discard ${name}?`,
      message: 'The session and every set logged in it so far are deleted. This cannot be undone.',
      confirmLabel: 'Discard session',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteSession(s.id).subscribe({
      next: () => {
        this.inProgressSessions.update(list => list.filter(x => x.id !== s.id));
        this.toast.success('Session discarded');
      },
      error: () => this.toast.error('Could not discard the session.'),
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
    this.startFromSplit(splitId);
  }

  startFromSplit(splitId: string) {
    this.loadingRoutines.set(true);
    this.showRoutinePicker.set(true);
    this.jymService.getSplit(splitId).subscribe({
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

  progressWeeks(sr: SplitSeriesSummary): number {
    const days = Math.floor((Date.now() - new Date(sr.started_at).getTime()) / 86400000);
    return Math.floor(days / 7);
  }
}

/**
 * True while a "Not now" from the last week still stands. Storage throws in a
 * private window, and a missing or junk stamp reads as NaN, so both fall
 * through to false: the suggestion shows rather than being silently lost.
 */
function readDeloadSnoozed(): boolean {
  try {
    const stamp = Number(localStorage.getItem(DELOAD_SNOOZED_KEY));
    return stamp > 0 && Date.now() - stamp < DELOAD_SNOOZE_DAYS * 86400000;
  } catch { return false; }
}

/** Whole calendar days from day key `from` to day key `to`. */
function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}
