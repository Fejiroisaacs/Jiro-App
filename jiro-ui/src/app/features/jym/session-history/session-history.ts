import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';
import { JymService, SessionSummary, SessionWithSets } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-session-history',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent, JiroModalComponent, JymQuickNavComponent],
  template: `
    <div class="session-history">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Session History</h1>
          <p class="text-secondary">Your logged workouts</p>
        </div>
        <div class="header-actions">
          <jiro-button variant="primary" type="button" (click)="startNew()">+ New Session</jiro-button>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading sessions...</p>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading() && sessions().length === 0" class="state-message">
        <h3>No sessions yet</h3>
        <p class="text-secondary">Start your first workout session to see history here.</p>
        <jiro-button variant="primary" type="button" (click)="startNew()">Start Workout</jiro-button>
      </div>

      <!-- Session list -->
      <div *ngIf="!loading() && sessions().length > 0" class="sessions-list">
        <div
          *ngFor="let s of sessions()"
          class="session-card"
          [class.selected]="selectedId() === s.id"
          (click)="loadDetail(s)">

          <div class="session-card-header">
            <div class="session-meta">
              <span class="session-date">{{ formatDate(s.started_at) }}</span>
              <span class="session-routine" *ngIf="s.routine_name">{{ s.routine_name }}</span>
              <span class="session-routine freestyle" *ngIf="!s.routine_name">Freestyle</span>
              <span *ngIf="s.session_type === 'deload'" class="type-badge deload">Deload</span>
              <span *ngIf="s.session_type === 'test'" class="type-badge test">Test</span>
            </div>
            <div class="session-right">
              <div class="session-stats">
                <span class="stat-pill">{{ s.set_count }} sets</span>
                <span *ngIf="s.ended_at" class="stat-pill">{{ formatDuration(s.started_at, s.ended_at) }}</span>
                <span *ngIf="s.total_volume > 0" class="stat-pill vol-pill">{{ settingsService.toDisplay(s.total_volume) | number:'1.0-0' }} {{ settingsService.unitLabel() }}</span>
              </div>
              <button class="delete-session-btn" (click)="deleteSession($event, s)" title="Delete session">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                  <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Expanded detail -->
          <div *ngIf="selectedId() === s.id" class="session-detail">
            <div *ngIf="detailLoading()" class="detail-loading">
              <div class="spinner-sm"></div>
            </div>

            <div *ngIf="!detailLoading() && detail()" class="detail-sets">
              <div *ngFor="let group of groupedSets(detail()!.sets)" class="detail-ex">
                <div class="detail-ex-name">{{ group.exerciseName }}</div>
                <div class="detail-set-rows">
                  <div *ngFor="let set of group.sets" class="detail-set-row">
                    <span class="ds-num">Set {{ set.set_number }}</span>
                    <span class="ds-weight">{{ settingsService.toDisplay(set.weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</span>
                    <span class="ds-x">×</span>
                    <span class="ds-reps">{{ set.reps_performed }} reps</span>
                    <span *ngIf="set.is_pr" class="pr-badge">🏆</span>
                  </div>
                </div>
              </div>

              <div *ngIf="detail()!.notes" class="detail-notes">
                <span class="detail-notes-label">Notes</span>
                <p class="detail-notes-text">{{ detail()!.notes }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete session confirmation -->
    <jiro-modal *ngIf="deletingSession()" title="Delete Session?" maxWidth="420px" (close)="deletingSession.set(null)">
      <div class="delete-confirm">
        <p>Delete this session from <strong>{{ formatDate(deletingSession()!.started_at) }}</strong>?</p>
        <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
          This will permanently remove the session and all {{ deletingSession()!.set_count }} sets logged. This cannot be undone.
        </p>
        <div class="form-actions" style="margin-top: var(--space-lg);">
          <jiro-button variant="secondary" type="button" (click)="deletingSession.set(null)">Cancel</jiro-button>
          <jiro-button variant="danger" type="button" [disabled]="deletingInProgress()" (click)="confirmDeleteSession()">
            {{ deletingInProgress() ? 'Deleting...' : 'Delete Session' }}
          </jiro-button>
        </div>
      </div>
    </jiro-modal>
  `,
  styles: [`
    :host { display: block; }

    .session-history { max-width: 800px; width: 100%; overflow-x: hidden; }

    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }
    .form-actions ::ng-deep .jiro-btn { width: auto; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: var(--space-sm); flex-shrink: 0;
    }

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }

    .state-message ::ng-deep .jiro-btn { width: auto; }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .empty-icon { font-size: 48px; }

    .sessions-list { display: flex; flex-direction: column; gap: var(--space-md); }

    .session-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); cursor: pointer;
      transition: border-color 0.15s, box-shadow 0.15s; overflow: hidden;
    }

    .session-card:hover { border-color: var(--color-primary); }

    .session-card.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.1); }

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

    .type-badge.deload { background: rgba(196,74,74,0.1); color: var(--color-danger); }

    .type-badge.test { background: rgba(122,59,46,0.12); color: var(--color-primary); }

    .session-right { display: flex; align-items: center; gap: var(--space-sm); }

    .session-stats { display: flex; gap: var(--space-sm); }

    .delete-session-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 6px; border-radius: 4px;
      display: flex; align-items: center; transition: all 0.15s;
      flex-shrink: 0;
    }

    .delete-session-btn:hover { color: var(--color-danger); background: rgba(196,74,74,0.1); }

    .stat-pill {
      font-size: var(--font-size-xs); padding: 3px 10px;
      background: rgba(122,59,46,0.1); color: var(--color-primary);
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

    .pr-badge { font-size: 14px; }

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

    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes slideDown {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class SessionHistoryComponent implements OnInit {
  sessions = signal<SessionSummary[]>([]);
  loading = signal(true);
  selectedId = signal<string | null>(null);
  detail = signal<SessionWithSets | null>(null);
  detailLoading = signal(false);
  deletingSession = signal<SessionSummary | null>(null);
  deletingInProgress = signal(false);

  constructor(
    private jymService: JymService,
    public router: Router,
    public settingsService: SettingsService,
  ) {}

  ngOnInit() {
    this.jymService.listSessions().subscribe({
      next: s => { this.sessions.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  loadDetail(s: SessionSummary) {
    if (this.selectedId() === s.id) {
      this.selectedId.set(null);
      this.detail.set(null);
      return;
    }
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

  deleteSession(event: Event, s: SessionSummary) {
    event.stopPropagation();
    if (s.set_count > 1) {
      this.deletingSession.set(s);
      return;
    }
    this.doDeleteSession(s.id);
  }

  confirmDeleteSession() {
    const s = this.deletingSession();
    if (!s) return;
    this.deletingInProgress.set(true);
    this.doDeleteSession(s.id, () => {
      this.deletingSession.set(null);
      this.deletingInProgress.set(false);
    }, () => this.deletingInProgress.set(false));
  }

  private doDeleteSession(id: string, onSuccess?: () => void, onError?: () => void) {
    this.jymService.deleteSession(id).subscribe({
      next: () => {
        this.sessions.update(list => list.filter(x => x.id !== id));
        if (this.selectedId() === id) {
          this.selectedId.set(null);
          this.detail.set(null);
        }
        onSuccess?.();
      },
      error: () => onError?.(),
    });
  }

  startNew() {
    this.jymService.startSession({}).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }
}
