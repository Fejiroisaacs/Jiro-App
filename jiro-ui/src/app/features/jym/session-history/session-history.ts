import { Component, Injector, OnInit, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { Exercise, JymService, SessionListOptions, SessionSummary, SessionType, SessionWithSets } from '../../../core/services/jym.service';
import { WorkoutLauncher } from '../shared/workout-launcher';
import { distanceText, distanceUnit, durationText } from '../exercise-kind';
import { SettingsService } from '../../../core/services/settings.service';
import { UploadService } from '../../../core/services/upload.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { LogPastDialogComponent } from '../shared/log-past-dialog';
import { dayKey, isDayKey, todayKey } from '../../../core/utils/day';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { formatDay, formatInstant } from '../../../core/utils/format-date';
import { countByDay, monthBounds, shiftMonth } from '../history-month';
import { HistoryCalendarComponent } from './history-calendar';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [JiroSkeletonComponent, 
    CommonModule, FormsModule, RouterLink, JiroButtonComponent, JiroIconComponent,
    JiroPageHeaderComponent, JiroEmptyStateComponent, JymPrBadgeComponent, LogPastDialogComponent, HistoryCalendarComponent,
  ],
  template: `
    <div class="session-history">
      <!-- Header -->
      @if (!embedded()) {
        <jiro-page-header heading="Session history" subtitle="Your logged workouts">
          <div actions class="header-buttons">
            <jiro-button variant="secondary" type="button" (click)="showLogPast.set(true)">Log past workout</jiro-button>
            <jiro-button type="button" (click)="startNew()">New session</jiro-button>
          </div>
        </jiro-page-header>
      } @else {
        <div class="header-actions">
          <jiro-button variant="secondary" type="button" (click)="showLogPast.set(true)">Log past workout</jiro-button>
          <jiro-button type="button" (click)="startNew()">New session</jiro-button>
        </div>
      }
      @if (showLogPast()) {
        <jym-log-past-dialog (close)="showLogPast.set(false)" />
      }

      <!-- Export row -->
      <div class="export-row">
        <div class="date-range">
          <div class="date-field">
            <label class="date-label" for="hist-from">From</label>
            <div class="date-wrapper">
              <input id="hist-from" type="date" class="date-input" [(ngModel)]="exportFrom" />
              @if (!exportFrom) {
                <span class="date-placeholder">Select date</span>
              }
            </div>
          </div>
          <div class="date-field">
            <label class="date-label" for="hist-to">To</label>
            <div class="date-wrapper">
              <input id="hist-to" type="date" class="date-input" [(ngModel)]="exportTo" />
              @if (!exportTo) {
                <span class="date-placeholder">Select date</span>
              }
            </div>
          </div>
        </div>
        <jiro-button variant="secondary" type="button" [disabled]="exporting()" (click)="downloadCSV()">
          {{ exporting() ? 'Exporting...' : 'Export CSV' }}
        </jiro-button>
      </div>

      <!-- Filters -->
      <div class="filter-row">
        <div class="date-field">
          <label class="date-label" for="hist-ex">Exercise</label>
          <select id="hist-ex" class="filter-select" (change)="setExercise($any($event.target).value)">
            <option value="" [selected]="!exerciseFilter()">All exercises</option>
            @for (e of exercises(); track e.id) {
              <option [value]="e.id" [selected]="e.id === exerciseFilter()">{{ e.name }}</option>
            }
          </select>
        </div>
        <div class="date-field">
          <label class="date-label" for="hist-type">Type</label>
          <select id="hist-type" class="filter-select" (change)="setType($any($event.target).value)">
            @for (t of types; track t.value) {
              <option [value]="t.value" [selected]="t.value === (typeFilter() ?? '')">{{ t.label }}</option>
            }
          </select>
        </div>
      </div>
      <div class="filter-actions">
        <button type="button" class="filter-btn" [class.on]="calendarOpen()" [attr.aria-expanded]="calendarOpen()" (click)="toggleCalendar()">
          <jiro-icon name="calendar-blank" [size]="16" />Calendar
        </button>
        @if (filtering()) {
          <button type="button" class="filter-btn" (click)="clearFilters()"><jiro-icon name="x" [size]="14" />Clear filters</button>
        }
      </div>
      @if (calendarOpen()) {
        <jym-history-calendar class="history-cal" [month]="month()" [counts]="monthCounts()" [selected]="dayFilter()" [today]="today()"
          (pick)="pickDay($event)" (monthChange)="changeMonth($event)" />
      }
      @if (dayFilter(); as day) {
        <p class="day-line">Workouts on {{ dayLabel(day) }}
          <button type="button" class="day-all" (click)="pickDay(day)">Show all days</button>
        </p>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="sessions-list" role="status" aria-label="Loading sessions">@for (i of [1, 2, 3, 4]; track i) { <jiro-skeleton height="88px" /> }</div>
      }

      <!-- Load error -->
      @if (!loading() && loadError()) {
        <jiro-empty-state
          icon="warning-circle"
          heading="Could not load your sessions"
          message="Check your connection and try again.">
          <jiro-button variant="secondary" type="button" (click)="load()">Try again</jiro-button>
        </jiro-empty-state>
      }

      <!-- Nothing matches the filters -->
      @if (!loading() && !loadError() && sessions().length === 0 && filtering()) {
        <jiro-empty-state icon="funnel-simple" [heading]="emptyFilteredText()" message="Try another exercise, type or day.">
          <jiro-button variant="secondary" type="button" (click)="clearFilters()">Clear filters</jiro-button>
        </jiro-empty-state>
      }

      <!-- Empty -->
      @if (!loading() && !loadError() && sessions().length === 0 && !filtering()) {
        <jiro-empty-state
          icon="barbell"
          heading="No sessions yet"
          message="Start your first workout to see it here, or log one you did earlier.">
          <jiro-button type="button" (click)="startNew()">Start a workout</jiro-button>
          <jiro-button variant="secondary" type="button" (click)="showLogPast.set(true)">Log past workout</jiro-button>
        </jiro-empty-state>
      }

      <!-- Session list -->
      @if (!loading() && sessions().length > 0) {
<div class="sessions-list">
        @for (s of sessions(); track s) {
<div
          [id]="'session-' + s.id"
          class="session-card"
          [class.selected]="selectedId() === s.id"
          (click)="loadDetail(s)">

          <div class="session-card-header">
            <div class="session-meta">
              <span class="session-date">{{ formatDate(s.started_at) }}</span>
              @if (s.routine_name) {
<span class="session-routine">{{ s.routine_name }}</span>
}
              @if (!s.routine_name) {
<span class="session-routine freestyle">Freestyle</span>
}
              @if (s.session_type === 'deload') {
<span class="type-badge deload">Deload</span>
}
              @if (s.session_type === 'test') {
<span class="type-badge test">Test</span>
}
              @if (!s.ended_at) {
                <span class="type-badge open">In progress</span>
              }
            </div>
            <div class="session-right">
              <div class="session-stats">
                <span class="stat-pill">{{ s.set_count }} sets</span>
                @if (s.ended_at) {
<span class="stat-pill">{{ formatDuration(s.started_at, s.ended_at) }}</span>
}
                @if (s.total_volume > 0) {
<span class="stat-pill vol-pill">{{ settingsService.toDisplay(s.total_volume) | number:'1.0-0' }} {{ settingsService.unitLabel() }}</span>
}
                @if (s.total_distance_m > 0) {
                  <span class="stat-pill">{{ distance(s.total_distance_m) }}</span>
                }
                @if (s.total_duration_s > 0) {
                  <span class="stat-pill" [attr.aria-label]="held(s.total_duration_s) + ' held'">{{ held(s.total_duration_s) }} held</span>
                }
              </div>
              <button class="delete-session-btn" type="button" (click)="deleteSession($event, s)" title="Delete session"
                [attr.aria-label]="'Delete session from ' + formatDate(s.started_at)">
                <jiro-icon name="trash" [size]="16" />
              </button>
            </div>
          </div>

          <!-- Expanded detail -->
          @if (selectedId() === s.id) {
<div class="session-detail">
            @if (detailLoading()) {
<div class="detail-loading" role="status" aria-label="Loading session">
              <jiro-skeleton width="30%" height="16px" />
              <jiro-skeleton [lines]="3" height="28px" />
            </div>
}

            @if (!detailLoading() && detail()) {
<div class="detail-sets">
              @for (group of groupedSets(detail()!.sets); track group.exerciseName) {
<div class="detail-ex">
                <div class="detail-ex-name">{{ group.exerciseName }}</div>
                @if (group.note) {
                  <p class="detail-ex-note">{{ group.note }}</p>
                }
                <div class="detail-set-rows">
                  @for (set of group.sets; track set.id) {
<div class="detail-set-row" [class.is-warmup]="set.is_warmup">
                    <span class="ds-num">Set {{ set.set_number }}</span>
                    <span class="ds-weight">{{ settingsService.toDisplay(set.weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
                    <span class="ds-x">×</span>
                    <span class="ds-reps">{{ set.reps_performed }} reps</span>
                    @if (set.rpe != null) {
                      <span class="ds-rpe">RPE {{ set.rpe }}</span>
                    }
                    @if (set.is_warmup) {
<span class="ds-warmup"><jiro-icon name="fire" [size]="12" />Warm-up</span>
}
                    @if (set.is_pr) {
<jym-pr-badge />
}
                  </div>
}
                </div>
              </div>
}

              <div class="detail-notes">
                <span class="detail-notes-label">Notes</span>
                @if (detail()!.notes) {
<p class="detail-notes-text">{{ detail()!.notes }}</p>
}
                @if (!detail()!.notes) {
<p class="detail-notes-text text-muted" style="font-style: italic;">No notes for this session.</p>
}
              </div>

              <div class="detail-links">
                @if (detail()!.ended_at) {
                  <a class="day-link" [routerLink]="['/jym/sessions', detail()!.id, 'summary']" [state]="{ back: backUrl(detail()!.id) }" (click)="$event.stopPropagation()">View summary</a>
                  <a class="day-link" [routerLink]="['/jym/sessions', detail()!.id, 'edit']" [state]="{ back: backUrl(detail()!.id) }" (click)="$event.stopPropagation()">Edit workout</a>
                } @else {
                  <a class="day-link" [routerLink]="['/jym/session', detail()!.id]" (click)="$event.stopPropagation()">Resume workout</a>
                }
                <a class="day-link" [routerLink]="['/day', sessionDay(detail()!.started_at)]" (click)="$event.stopPropagation()">See this day</a>
              </div>

              <!-- Attachments panel -->
              @if (detail()!.attachments.length > 0) {
<div class="attachments-panel" (click)="$event.stopPropagation()">
                <div class="attachments-header">
                  <span class="section-label">Form check / photos</span>
                </div>

                <div class="attachments-grid">
                  @for (a of detail()!.attachments; track a) {
<div class="attachment-item">
                    @if (a.file_type === 'video/mp4' || a.file_type === 'video/webm') {
<video
                     
                      [src]="a.file_url"
                      class="attachment-media"
                      controls
                      preload="none"
                      (click)="$event.stopPropagation()">
                    </video>
}
                    @if (a.file_type === 'image/jpeg' || a.file_type === 'image/png') {
<img
                     
                      [src]="a.file_url"
                      [alt]="a.label || 'Attachment'"
                      class="attachment-media attachment-img" />
}
                    <div class="attachment-footer">
                      <span class="attachment-label">{{ a.label || (a.file_type.startsWith('video') ? 'Video' : 'Photo') }}</span>
                      <button class="attachment-delete-btn" type="button"
                        [disabled]="deletingAttachment().has(a.id)"
                        (click)="$event.stopPropagation(); deleteAttachment($event, a.id)"
                        title="Delete clip" aria-label="Delete clip">
                        @if (!deletingAttachment().has(a.id)) {
                          <jiro-icon name="x" [size]="12" />
                        } @else {
                          <span class="spinner spinner--sm spinner-xs" aria-hidden="true"></span>
                        }
                      </button>
                    </div>
                  </div>
}
                </div>
              </div>
}
            </div>
}
          </div>
}
        </div>
}
      </div>
        @if (hasMore()) {
          <div class="load-more">
            <jiro-button variant="secondary" type="button" [loading]="loadingMore()" (click)="loadMore()">Show older sessions</jiro-button>
          </div>
        }
}
    </div>

  `,
  styles: [`
    :host { display: block; }

    .session-history { max-width: 800px; width: 100%; }
    .load-more { display: flex; justify-content: center; margin-top: var(--space-lg); }


    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions, .header-buttons {
      display: flex; flex-wrap: wrap; justify-content: flex-end;
      gap: var(--space-sm); flex-shrink: 0;
    }


    .export-row {
      display: flex; flex-direction: column; gap: var(--space-sm);
      margin-bottom: var(--space-lg);
    }


    .date-range {
      display: flex; gap: var(--space-sm);
    }

    .date-field {
      display: flex; flex-direction: column; gap: 4px; flex: 1;
    }

    .date-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .date-wrapper { position: relative; }

    .date-input {
      padding: 6px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      cursor: pointer;
      position: relative; z-index: 1;
      width: 100%; box-sizing: border-box;
    }

    .date-input:focus {
      border-color: var(--color-primary);
    }

    .date-placeholder {
      position: absolute; inset: 0;
      padding: 6px 10px;
      color: var(--text-muted);
      font-size: var(--font-size-sm);
      pointer-events: none;
      display: flex; align-items: center;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      z-index: 0;
    }



    .filter-row { display: flex; gap: var(--space-sm); margin-bottom: var(--space-sm); }

    .filter-select {
      width: 100%; min-height: 44px; padding: 6px 10px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-sm); font-family: inherit;
    }

    .filter-select:focus { border-color: var(--color-primary); }

    .filter-actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); margin-bottom: var(--space-md); }

    .filter-btn {
      display: inline-flex; align-items: center; gap: var(--space-xs);
      min-height: 44px; padding: 0 var(--space-md);
      background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--border-radius-pill);
      color: var(--text-secondary); font: inherit; font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
    }

    .filter-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .filter-btn.on { border-color: var(--color-primary); color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.08); }

    .history-cal { margin-bottom: var(--space-md); }

    .day-line {
      display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: var(--space-sm);
      margin: 0 0 var(--space-sm); font-size: var(--font-size-sm); font-weight: 600;
    }

    .day-all {
      min-height: 44px; padding: 0 var(--space-xs); background: none; border: none;
      color: var(--color-primary); font: inherit; font-weight: 600; cursor: pointer;
    }

    .sessions-list { display: flex; flex-direction: column; gap: var(--space-md); }

    .session-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s; overflow: hidden;
    }

    .session-card:hover { border-color: var(--color-primary); }

    .session-card.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.1); }

    .session-card-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md) var(--space-lg); gap: var(--space-md);
    }

    .session-meta { display: flex; align-items: center; gap: var(--space-md); }

    .session-date { font-weight: 600; font-size: var(--font-size-md); }

    .session-routine {
      font-size: var(--font-size-sm); color: var(--text-primary);
      background: var(--color-secondary); padding: 2px 10px; border-radius: var(--border-radius-pill);
    }

    .session-routine.freestyle { color: var(--text-muted); font-style: italic; background: none; }

    .type-badge {
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 2px 8px; border-radius: var(--border-radius-pill);
    }

    .type-badge.deload { background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger); }

    .type-badge.test { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }

    .type-badge.open { background: rgba(var(--color-accent-rgb), 0.14); color: var(--color-accent); }

    .session-right { display: flex; align-items: center; gap: var(--space-sm); }

    .session-stats { display: flex; gap: var(--space-sm); }

    .delete-session-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); width: 44px; height: 44px; justify-content: center; border-radius: var(--border-radius-sm);
      display: flex; align-items: center; transition: all 0.15s;
      flex-shrink: 0;
    }

    .delete-session-btn:hover { color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.1); }

    .stat-pill {
      font-size: var(--font-size-xs); padding: 3px 10px;
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary-text);
      border-radius: var(--border-radius-pill); font-weight: 500;
    }

    .vol-pill { background: var(--bg-canvas); color: var(--text-secondary); border: 1px solid var(--border-color); }

    .session-detail {
      border-top: 1px solid var(--border-color);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-canvas);
      animation: slideDown 0.2s ease;
    }

    .detail-loading { display: flex; flex-direction: column; gap: var(--space-sm); padding: var(--space-md); }

    .detail-sets { display: flex; flex-direction: column; gap: var(--space-md); }

    .detail-ex { }

    .detail-ex-name {
      font-size: var(--font-size-sm); font-weight: 600;
      color: var(--text-primary); margin-bottom: var(--space-xs);
    }

    .detail-ex-note { font-size: var(--font-size-xs); color: var(--text-secondary); font-style: italic; margin: 0 0 var(--space-xs) var(--space-md); }

    .ds-rpe { font-size: var(--font-size-xs); color: var(--text-muted); }

    .detail-set-rows { display: flex; flex-direction: column; gap: 2px; padding-left: var(--space-md); }

    .detail-set-row {
      display: flex; align-items: center; gap: var(--space-sm);
      font-size: var(--font-size-sm); color: var(--text-secondary);
    }

    .ds-num { color: var(--text-muted); min-width: 50px; }

    .ds-weight { font-weight: 500; color: var(--text-primary); }

    .ds-x { color: var(--text-muted); }

    .ds-reps { color: var(--text-primary); }

    .detail-set-row.is-warmup .ds-weight,
    .detail-set-row.is-warmup .ds-reps { color: var(--text-secondary); }

    .ds-warmup {
      display: inline-flex; align-items: center; gap: 3px;
      padding: 1px 6px; border-radius: var(--border-radius-pill);
      background: rgba(var(--color-warning-rgb), 0.12); color: var(--text-secondary);
      font-size: var(--font-size-xs); font-weight: 600;
    }



    .detail-links { display: flex; flex-wrap: wrap; gap: 0 var(--space-lg); margin-top: var(--space-sm); }

    .day-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
    }

    .detail-notes {
      margin-top: var(--space-md);
      padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
    }

    .detail-notes-label {
      display: block;
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted);
      font-weight: 500; margin-bottom: var(--space-xs);
    }

    .detail-notes-text {
      font-size: var(--font-size-sm); color: var(--text-secondary);
      line-height: 1.6; white-space: pre-wrap; margin: 0;
    }

    /* ─── Attachments ─────────────────────────────────────────── */

    .attachments-panel {
      margin-top: var(--space-md);
      padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
    }

    .attachments-header {
      margin-bottom: var(--space-sm);
    }

    .section-label {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted); font-weight: 500;
    }

    .attachments-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: var(--space-sm);
      margin-top: var(--space-sm);
    }

    .attachment-item {
      border-radius: var(--border-radius); overflow: hidden;
      border: 1px solid var(--border-color); background: var(--bg-surface);
    }

    .attachment-media {
      width: 100%; display: block;
      max-height: 200px; object-fit: cover;
    }

    .attachment-img { cursor: zoom-in; }

    .attachment-footer {
      display: flex; align-items: center; justify-content: space-between;
      padding: 4px 6px 4px 8px;
    }

    .attachment-label {
      font-size: var(--font-size-xs); color: var(--text-secondary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      flex: 1; min-width: 0;
    }

    .attachment-delete-btn {
      flex-shrink: 0; width: 20px; height: 20px;
      display: flex; align-items: center; justify-content: center;
      background: none; border: none; border-radius: var(--border-radius-sm);
      color: var(--text-muted); cursor: pointer; padding: 0;
      transition: background 0.15s, color 0.15s;
    }

    .attachment-delete-btn:hover:not(:disabled) {
      background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger);
    }

    .attachment-delete-btn:disabled { opacity: 0.5; cursor: not-allowed; }

    /* narrower than the global .spinner--sm, which is 18px */
    .spinner-xs { width: 12px; height: 12px; border-width: 1.5px; }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 768px) {
      .session-card-header {
        flex-direction: column;
        align-items: flex-start;
        padding: var(--space-md);
        gap: var(--space-xs);
        position: relative;
      }

      .session-meta { flex-wrap: wrap; gap: var(--space-xs); }

      .session-right {
        width: 100%;
        justify-content: flex-start;
      }

      .session-stats { flex-wrap: wrap; }

      .delete-session-btn {
        position: absolute;
        top: var(--space-sm);
        right: var(--space-sm);
      }

      .attachments-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    }
  `]
})
export class SessionHistoryComponent implements OnInit {
  embedded = input(false);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly injector = inject(Injector);
  sessions = signal<SessionSummary[]>([]);
  loading = signal(true);
  loadError = signal(false);
  hasMore = signal(false);
  loadingMore = signal(false);
  showLogPast = signal(false);
  selectedId = signal<string | null>(null);
  detail = signal<SessionWithSets | null>(null);
  detailLoading = signal(false);
  deletingAttachment = signal<Set<string>>(new Set());
  exporting = signal(false);
  exportFrom = '';
  exportTo = '';

  /** Filters, mirrored in the URL as ?exercise=&type=&day= (and ?calendar=1 while it's open). */
  exerciseFilter = signal<string | null>(null);
  typeFilter = signal<SessionType | null>(null);
  dayFilter = signal<string | null>(null);
  calendarOpen = signal(false);
  exercises = signal<Exercise[]>([]);
  /** The calendar's month (YYYY-MM) and its workouts per day. */
  month = signal('');
  monthCounts = signal(new Map<string, number>());
  readonly types: { value: SessionType | ''; label: string }[] = [
    { value: '', label: 'All types' }, { value: 'normal', label: 'Regular' }, { value: 'deload', label: 'Deload' }, { value: 'test', label: 'Test' },
  ];
  readonly filtering = computed(() => !!(this.exerciseFilter() || this.typeFilter() || this.dayFilter()));
  readonly today = computed(() => todayKey(this.settingsService.timezone()));

  /** "No deload workouts with Bench press on Tue 14 Oct". */
  readonly emptyFilteredText = computed(() => {
    const type = this.typeFilter() ? this.types.find(t => t.value === this.typeFilter())!.label.toLowerCase() + ' ' : '';
    const ex = this.exercises().find(e => e.id === this.exerciseFilter());
    const day = this.dayFilter();
    return `No ${type}workouts${ex ? ' with ' + ex.name : ''}${day ? ' on ' + this.dayLabel(day) : ''}`;
  });

  private readonly launcher = inject(WorkoutLauncher);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);

  constructor(
    private jymService: JymService,
    public router: Router,
    public settingsService: SettingsService,
    private uploadService: UploadService,
  ) {
    // Global search links completed sessions here as ?session=<id>. It navigates
    // with onSameUrlNavigation: 'reload', so a NavigationEnd arrives even when
    // the page is already open on that exact URL.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        // A link into the open page (e.g. an exercise's "See all workouts") carries new filters.
        if (this.readFiltersFromUrl()) { this.load(); this.loadMonth(); return; }
        if (!this.loading()) this.focusSessionFromUrl();
      });
  }

  ngOnInit() {
    this.readFiltersFromUrl();
    this.load();
    this.loadMonth();
    this.jymService.listExercises().subscribe({
      next: list => this.exercises.set([...list].sort((a, b) => a.name.localeCompare(b.name))),
      error: () => {},
    });
  }

  /** Takes the filters from the URL; true when they changed. */
  private readFiltersFromUrl(): boolean {
    const q = this.router.parseUrl(this.router.url).queryParamMap;
    const exercise = q.get('exercise') || null;
    const type = (['normal', 'deload', 'test'] as const).find(t => t === q.get('type')) ?? null;
    const day = isDayKey(q.get('day')) ? q.get('day') : null;
    const calendar = q.get('calendar') === '1' || !!day;
    const changed = exercise !== this.exerciseFilter() || type !== this.typeFilter() || day !== this.dayFilter() || calendar !== this.calendarOpen();
    this.exerciseFilter.set(exercise);
    this.typeFilter.set(type);
    this.dayFilter.set(day);
    this.calendarOpen.set(calendar);
    if (!this.month() || (day && day.slice(0, 7) !== this.month())) this.month.set((day ?? this.today()).slice(0, 7));
    return changed;
  }

  /** Mirrors the filters into the URL without a navigation (which would scroll to the top). */
  private writeFiltersToUrl() {
    const tree = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: {
        exercise: this.exerciseFilter(), type: this.typeFilter(), day: this.dayFilter(),
        calendar: this.calendarOpen() ? '1' : null, session: null,
      },
      queryParamsHandling: 'merge',
    });
    this.location.replaceState(this.router.serializeUrl(tree));
  }

  private filters(): SessionListOptions {
    return { exerciseId: this.exerciseFilter(), type: this.typeFilter() };
  }

  private applyFilters() {
    this.writeFiltersToUrl();
    this.selectedId.set(null);
    this.detail.set(null);
    this.load();
    this.loadMonth();
  }

  setExercise(id: string) { this.exerciseFilter.set(id || null); this.applyFilters(); }

  setType(type: string) { this.typeFilter.set((type || null) as SessionType | null); this.applyFilters(); }

  /** Picks a day from the calendar; the same day again shows every day. */
  pickDay(day: string) {
    this.dayFilter.set(this.dayFilter() === day ? null : day);
    this.applyFilters();
  }

  toggleCalendar() {
    this.calendarOpen.update(v => !v);
    this.writeFiltersToUrl();
    this.loadMonth();
  }

  changeMonth(delta: number) {
    this.month.set(shiftMonth(this.month(), delta));
    this.loadMonth();
  }

  clearFilters() {
    this.exerciseFilter.set(null);
    this.typeFilter.set(null);
    this.dayFilter.set(null);
    this.applyFilters();
  }

  dayLabel(day: string): string {
    return formatDay(day, { weekday: true });
  }

  /** The calendar month's workouts per day, with the exercise and type filters. */
  private loadMonth() {
    if (!this.calendarOpen()) return;
    const month = this.month();
    const { from, to } = monthBounds(month);
    this.jymService.listSessions({ from, to, ...this.filters() }).subscribe({
      next: list => { if (this.month() === month) this.monthCounts.set(countByDay(list, this.settingsService.timezone())); },
      error: () => this.toast.error('Could not load the calendar.'),
    });
  }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    const day = this.dayFilter();
    const request = day ? { from: day, to: day, ...this.filters() } : { limit: HISTORY_PAGE, ...this.filters() };
    this.jymService.listSessions(request).subscribe({
      next: s => {
        this.sessions.set(s);
        // One day comes whole; a page may have more behind it.
        this.hasMore.set(!day && s.length === HISTORY_PAGE);
        this.loading.set(false);
        this.focusSessionFromUrl();
      },
      error: () => { this.loadError.set(true); this.loading.set(false); this.focusSessionFromUrl(); },
    });
  }

  /** The next page, continuing after the oldest row loaded. */
  loadMore() {
    const last = this.sessions().at(-1);
    if (!last || this.loadingMore()) return;
    this.loadingMore.set(true);
    this.jymService.listSessions({ before: last.started_at, beforeId: last.id, limit: HISTORY_PAGE, ...this.filters() }).subscribe({
      next: page => {
        // A session opened on its own from ?session= may already be in the list.
        const seen = new Set(this.sessions().map(x => x.id));
        this.sessions.update(list => [...list, ...page.filter(x => !seen.has(x.id))]);
        this.hasMore.set(page.length === HISTORY_PAGE);
        this.loadingMore.set(false);
      },
      error: () => {
        this.loadingMore.set(false);
        this.toast.error('Could not load older sessions.');
      },
    });
  }

  /**
   * Opens the session named by ?session=<id>. A session in the loaded list
   * opens exactly as a click would and is scrolled to. The list is capped, so
   * an older one is fetched on its own and shown expanded at the top.
   */
  private focusSessionFromUrl() {
    const id = this.router.parseUrl(this.router.url).queryParamMap.get('session');
    if (!id) return;
    const inList = this.sessions().find(x => x.id === id);
    if (inList) {
      this.openDetail(inList);
      this.scrollToSession(id);
      return;
    }
    this.selectedId.set(id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.jymService.getSession(id).subscribe({
      next: d => {
        // Guard against the user having opened something else meanwhile.
        if (this.selectedId() !== id) return;
        this.sessions.update(list => list.some(x => x.id === id) ? list : [summaryFromDetail(d), ...list]);
        this.detail.set(d);
        this.detailLoading.set(false);
        this.scrollToSession(id);
      },
      error: () => {
        if (this.selectedId() === id) {
          this.selectedId.set(null);
          this.detailLoading.set(false);
        }
        this.toast.error('Could not open that session.');
      },
    });
  }

  private scrollToSession(id: string) {
    afterNextRender(() => {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById('session-' + id)?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
    }, { injector: this.injector });
  }

  /** The user's day a session started on, for the day view link. */
  sessionDay(startedAt: string): string {
    return dayKey(startedAt, this.settingsService.timezone());
  }

  loadDetail(s: SessionSummary) {
    if (this.selectedId() === s.id) {
      this.selectedId.set(null);
      this.detail.set(null);
      return;
    }
    this.openDetail(s);
  }

  /** Expands a session (never collapses it) and loads its sets. */
  private openDetail(s: SessionSummary) {
    if (this.selectedId() === s.id && (this.detail() || this.detailLoading())) return;
    this.selectedId.set(s.id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.jymService.getSession(s.id).subscribe({
      next: d => {
        if (this.selectedId() !== s.id) return;
        this.detail.set(d);
        this.detailLoading.set(false);
      },
      error: () => {
        if (this.selectedId() === s.id) this.detailLoading.set(false);
      },
    });
  }

  /** Sets by exercise, with the exercise note (it's stored on each of its sets). */
  groupedSets(sets: SessionWithSets['sets']): { exerciseName: string; note: string | null; sets: SessionWithSets['sets'] }[] {
    const map = new Map<string, { exerciseName: string; note: string | null; sets: SessionWithSets['sets'] }>();
    for (const s of sets) {
      if (!map.has(s.exercise_id)) {
        map.set(s.exercise_id, { exerciseName: s.exercise_name, note: null, sets: [] });
      }
      const group = map.get(s.exercise_id)!;
      group.note ??= s.exercise_note || null;
      group.sets.push(s);
    }
    return Array.from(map.values());
  }

  /** Where the summary's Done returns to: this workout, open in history. */
  backUrl(id: string): string {
    return `/jym/track?tab=sessions&session=${id}`;
  }

  formatDate(instant: string): string {
    return formatInstant(instant, this.settingsService.timezone(), { weekday: true });
  }

  /** A workout's distance in the account's unit (km for kg, miles for lbs). */
  distance(metres: number): string {
    return distanceText(metres, distanceUnit(this.settingsService.weightUnit()));
  }

  held(seconds: number): string {
    return durationText(seconds);
  }

  formatDuration(start: string, end: string): string {
    const mins = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  async deleteSession(event: Event, s: SessionSummary) {
    event.stopPropagation();
    const sets = s.set_count === 1 ? '1 set' : `${s.set_count} sets`;
    const ok = await this.confirmService.confirm({
      title: `Delete the session from ${this.formatDate(s.started_at)}?`,
      message: `This removes the session and the ${sets} logged in it. It cannot be undone.`,
      confirmLabel: 'Delete session',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteSession(s.id).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(x => x.id !== s.id));
        if (this.selectedId() === s.id) {
          this.selectedId.set(null);
          this.detail.set(null);
        }
        this.toast.success('Session deleted');
      },
      error: () => this.toast.error('Could not delete the session.'),
    });
  }

  async deleteAttachment(event: Event, id: string) {
    event.stopPropagation();
    const ok = await this.confirmService.confirm({
      title: 'Delete this clip?',
      message: 'The form check clip is removed permanently.',
      confirmLabel: 'Delete clip',
      danger: true,
    });
    if (!ok) return;
    this.deletingAttachment.update(s => new Set([...s, id]));
    this.uploadService.deleteSessionAttachment(id).subscribe({
      next: () => {
        this.detail.update(d => d ? { ...d, attachments: d.attachments.filter(a => a.id !== id) } : d);
        this.deletingAttachment.update(s => { const n = new Set(s); n.delete(id); return n; });
        this.toast.success('Clip deleted');
      },
      error: () => {
        this.deletingAttachment.update(s => { const n = new Set(s); n.delete(id); return n; });
        this.toast.error('Could not delete the clip.');
      },
    });
  }

  startNew() {
    this.launcher.start({});
  }

  downloadCSV() {
    this.exporting.set(true);
    this.jymService.exportSessionsCSV(this.exportFrom || undefined, this.exportTo || undefined).subscribe({
      next: (blob) => {
        const date = todayKey(this.settingsService.timezone());
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jym-export-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.toast.error('Could not export your sessions.');
      },
    });
  }
}

const HISTORY_PAGE = 50;

/** A list row for a session fetched on its own, counted like the list: working sets, and lifts with a record. */
function summaryFromDetail(d: SessionWithSets): SessionSummary {
  const { sets, attachments: _attachments, targets: _targets, exercises: _exercises, ...session } = d;
  const working = sets.filter(x => !x.is_warmup);
  const times = sets.map(x => x.created_at).sort((a, b) => Date.parse(a) - Date.parse(b));
  return {
    ...session,
    set_count: working.length,
    pr_count: new Set(sets.filter(x => x.is_pr).map(x => x.exercise_id)).size,
    total_volume: working.reduce((sum, x) => sum + (x.weight + (x.body_weight_kg ?? 0)) * x.reps_performed, 0),
    muscle_groups: [],
    first_set_at: times[0] ?? null,
    last_set_at: times.at(-1) ?? null,
    total_distance_m: working.reduce((sum, x) => sum + (x.distance_m ?? 0), 0),
    total_duration_s: working.reduce((sum, x) => sum + (x.distance_m ? 0 : x.duration_s ?? 0), 0),
  };
}
