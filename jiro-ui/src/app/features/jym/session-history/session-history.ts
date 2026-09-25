import { Component, Injector, OnInit, afterNextRender, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { JymService, SessionSummary, SessionWithSets } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { UploadService } from '../../../core/services/upload.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { dayKey } from '../../../core/utils/day';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink, JiroButtonComponent, JiroIconComponent,
    JiroPageHeaderComponent, JiroEmptyStateComponent, JymPrBadgeComponent,
  ],
  template: `
    <div class="session-history">
      <!-- Header -->
      @if (!embedded()) {
        <jiro-page-header heading="Session history" subtitle="Your logged workouts">
          <jiro-button actions type="button" (click)="startNew()">New session</jiro-button>
        </jiro-page-header>
      } @else {
        <div class="header-actions">
          <jiro-button type="button" (click)="startNew()">New session</jiro-button>
        </div>
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

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Empty -->
      @if (!loading() && sessions().length === 0) {
        <jiro-empty-state
          icon="barbell"
          heading="No sessions yet"
          message="Start your first workout to see it here.">
          <jiro-button type="button" (click)="startNew()">Start a workout</jiro-button>
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
<div class="detail-loading">
              <div class="spinner-sm"></div>
            </div>
}

            @if (!detailLoading() && detail()) {
<div class="detail-sets">
              @for (group of groupedSets(detail()!.sets); track group.exerciseName) {
<div class="detail-ex">
                <div class="detail-ex-name">{{ group.exerciseName }}</div>
                <div class="detail-set-rows">
                  @for (set of group.sets; track set.id) {
<div class="detail-set-row">
                    <span class="ds-num">Set {{ set.set_number }}</span>
                    <span class="ds-weight">{{ settingsService.toDisplay(set.weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
                    <span class="ds-x">×</span>
                    <span class="ds-reps">{{ set.reps_performed }} reps</span>
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

              <a class="day-link" [routerLink]="['/day', sessionDay(detail()!.started_at)]" (click)="$event.stopPropagation()">See this day</a>

              <!-- Attachments panel -->
              @if (detail()!.attachments.length > 0) {
<div class="attachments-panel" (click)="$event.stopPropagation()">
                <div class="attachments-header">
                  <span class="section-label">Form Check / Photos</span>
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
}
    </div>

  `,
  styles: [`
    :host { display: block; }

    .session-history { max-width: 800px; width: 100%; }


    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions {
      display: flex; flex-direction: column; align-items: flex-end;
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

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

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
      font-size: var(--font-size-sm); color: var(--text-secondary);
      background: var(--color-secondary); padding: 2px 10px; border-radius: 10px;
    }

    .session-routine.freestyle { color: var(--text-muted); font-style: italic; background: none; }

    .type-badge {
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 2px 8px; border-radius: 10px;
    }

    .type-badge.deload { background: rgba(var(--color-danger-rgb), 0.1); color: var(--color-danger); }

    .type-badge.test { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }

    .session-right { display: flex; align-items: center; gap: var(--space-sm); }

    .session-stats { display: flex; gap: var(--space-sm); }

    .delete-session-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 6px; border-radius: 4px;
      display: flex; align-items: center; transition: all 0.15s;
      flex-shrink: 0;
    }

    .delete-session-btn:hover { color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.1); }

    .stat-pill {
      font-size: var(--font-size-xs); padding: 3px 10px;
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary);
      border-radius: 10px; font-weight: 500;
    }

    .vol-pill { background: var(--bg-canvas); color: var(--text-secondary); border: 1px solid var(--border-color); }

    .session-detail {
      border-top: 1px solid var(--border-color);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-canvas);
      animation: slideDown 0.2s ease;
    }

    .detail-loading { display: flex; align-items: center; justify-content: center; padding: var(--space-md); }

    .spinner-sm {
      width: 24px; height: 24px; border: 2px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .detail-sets { display: flex; flex-direction: column; gap: var(--space-md); }

    .detail-ex { }

    .detail-ex-name {
      font-size: var(--font-size-sm); font-weight: 600;
      color: var(--text-primary); margin-bottom: var(--space-xs);
    }

    .detail-set-rows { display: flex; flex-direction: column; gap: 2px; padding-left: var(--space-md); }

    .detail-set-row {
      display: flex; align-items: center; gap: var(--space-sm);
      font-size: var(--font-size-sm); color: var(--text-secondary);
    }

    .ds-num { color: var(--text-muted); min-width: 50px; }

    .ds-weight { font-weight: 500; color: var(--text-primary); }

    .ds-x { color: var(--text-muted); }

    .ds-reps { color: var(--text-primary); }



    .day-link {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      margin-top: var(--space-sm);
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
      background: none; border: none; border-radius: 4px;
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
  selectedId = signal<string | null>(null);
  detail = signal<SessionWithSets | null>(null);
  detailLoading = signal(false);
  deletingAttachment = signal<Set<string>>(new Set());
  exporting = signal(false);
  exportFrom = '';
  exportTo = '';

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
      .subscribe(() => { if (!this.loading()) this.focusSessionFromUrl(); });
  }

  ngOnInit() {
    this.jymService.listSessions().subscribe({
      next: s => { this.sessions.set(s); this.loading.set(false); this.focusSessionFromUrl(); },
      error: () => { this.loading.set(false); this.focusSessionFromUrl(); },
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
      document.getElementById('session-' + id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });
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
      next: d => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }

  groupedSets(sets: SessionWithSets['sets']): { exerciseName: string; sets: SessionWithSets['sets'] }[] {
    const map = new Map<string, { exerciseName: string; sets: SessionWithSets['sets'] }>();
    for (const s of sets) {
      if (!map.has(s.exercise_id)) {
        map.set(s.exercise_id, { exerciseName: s.exercise_name, sets: [] });
      }
      map.get(s.exercise_id)!.sets.push(s);
    }
    return Array.from(map.values());
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
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
    this.jymService.startSession({}).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  downloadCSV() {
    this.exporting.set(true);
    this.jymService.exportSessionsCSV(this.exportFrom || undefined, this.exportTo || undefined).subscribe({
      next: (blob) => {
        const date = new Date().toISOString().slice(0, 10);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `jym-export-${date}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => this.exporting.set(false),
    });
  }
}

/**
 * A list row for a session fetched on its own (outside the capped list).
 * Totals mirror the list query: every set counts towards set_count and
 * total_volume, warm-ups included.
 */
function summaryFromDetail(d: SessionWithSets): SessionSummary {
  const { sets, attachments: _attachments, ...session } = d;
  return {
    ...session,
    set_count: sets.length,
    pr_count: sets.filter(x => x.is_pr).length,
    total_volume: sets.reduce((sum, x) => sum + x.weight * x.reps_performed, 0),
    muscle_groups: [],
  };
}
