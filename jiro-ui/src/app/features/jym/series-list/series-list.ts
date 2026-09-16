import { Component, OnInit, inject, signal, input, output } from '@angular/core';

import { Router } from '@angular/router';
import { JymService, SplitSeriesSummary } from '../../../core/services/jym.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

@Component({
  selector: 'app-series-list',
  standalone: true,
  imports: [
    JiroButtonComponent, JiroModalComponent, JiroIconComponent,
    JiroPageHeaderComponent, JiroEmptyStateComponent,
  ],
  template: `
    <div class="series-list">
      @if (!embedded()) {
        <jiro-page-header heading="My series" subtitle="Structured program runs and progression tracking" />
      }

      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Active Series -->
      @if (!loading() && activeSeries().length > 0) {
<div class="section">
        <h2 class="section-title">Active series</h2>
        <div class="series-grid">
          @for (sr of activeSeries(); track sr) {
<div class="series-card">
            <div class="card-top">
              <div>
                <div class="split-name">{{ sr.split_name }}</div>
                <h3 class="series-name">{{ sr.name }}</h3>
              </div>
              <span class="status-badge active">Active</span>
            </div>

            <div class="card-meta">
              <span class="meta-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                Started {{ formatDate(sr.started_at) }}
              </span>
            </div>

            <div class="card-footer">
              @if (!(sr.duration_type === 'sessions' && sr.target_sessions)) {
<span class="sessions-pill">{{ sr.session_count }} sessions</span>
}
              @if (sr.duration_type === 'weeks' && sr.target_weeks) {
<span class="duration-pill">
                {{ progressWeeks(sr) }} / {{ sr.target_weeks }} wks
              </span>
}
              @if (sr.duration_type === 'sessions' && sr.target_sessions) {
<span class="duration-pill">
                {{ sr.session_count }} / {{ sr.target_sessions }} sessions
              </span>
}
              @if (sr.duration_type === 'open') {
<span class="duration-pill open">Open-ended</span>
}

              <div class="card-footer-actions">
                <jiro-button variant="primary" type="button" (click)="$event.stopPropagation(); startFromSeriesSplit(sr.split_id, sr.id)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                  Start
                </jiro-button>
                <button class="view-btn" (click)="view(sr.id)">View</button>
                <button class="del-btn" type="button" (click)="deleteSeries($event, sr)" title="Delete series"
                  [attr.aria-label]="'Delete series ' + sr.name">
                  <jiro-icon name="trash" [size]="15" />
                </button>
              </div>
            </div>
          </div>
}
        </div>
      </div>
}

      <!-- Ended Series -->
      @if (!loading() && endedSeries().length > 0) {
<div class="section">
        <h2 class="section-title">Ended series</h2>
        <div class="series-grid">
          @for (sr of endedSeries(); track sr) {
<div class="series-card" (click)="view(sr.id)">
            <div class="card-top">
              <div>
                <div class="split-name">{{ sr.split_name }}</div>
                <h3 class="series-name">{{ sr.name }}</h3>
              </div>
              <span class="status-badge ended">Ended</span>
            </div>

            <div class="card-meta">
              <span class="meta-item">
                Started {{ formatDate(sr.started_at) }}
              </span>
              <span class="meta-item">
                Ended {{ formatDate(sr.ended_at!) }}
              </span>
            </div>

            <div class="card-footer">
              <span class="sessions-pill">{{ sr.session_count }} sessions</span>
              <button class="del-btn" type="button" (click)="deleteSeries($event, sr)" title="Delete series"
                [attr.aria-label]="'Delete series ' + sr.name">
                <jiro-icon name="trash" [size]="15" />
              </button>
            </div>
          </div>
}
        </div>
      </div>
}

      <!-- Empty State -->
      @if (!loading() && series().length === 0) {
        <jiro-empty-state
          icon="chart-line-up"
          heading="No series yet"
          message="Start a series from any of your splits to track structured progression.">
          <jiro-button variant="secondary" type="button" (click)="goToSplits.emit()">Go to splits</jiro-button>
        </jiro-empty-state>
      }

      <!-- Start a new series CTA (shown when series exist) -->
      @if (!loading() && series().length > 0) {
<div class="start-cta">
        <a (click)="goToSplits.emit()" class="start-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Start a new series from your Splits
        </a>
      </div>
}

      <!-- Routine Picker Modal -->
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

    .series-list { max-width: 900px; width: 100%; }

    .section { margin-bottom: var(--space-xl); }

    .section-title {
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-secondary); margin-bottom: var(--space-md);
    }

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

    /* Series grid */
    .series-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-lg);
    }

    .series-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      display: flex; flex-direction: column; gap: var(--space-md);
      position: relative;
    }

    .series-card:hover { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.08); }

    .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-name { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }

    .series-name { font-size: var(--font-size-lg); font-weight: 600; margin: 0; }

    .status-badge {
      font-size: var(--font-size-xs); font-weight: 600; padding: 3px 10px;
      border-radius: 10px; white-space: nowrap; flex-shrink: 0;
    }
    .status-badge.active { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-positive); }
    .status-badge.ended { background: var(--bg-canvas); color: var(--text-muted); border: 1px solid var(--border-color); }

    .card-meta { display: flex; flex-direction: column; gap: 2px; }

    .meta-item {
      display: flex; align-items: center; gap: var(--space-xs);
      font-size: var(--font-size-xs); color: var(--text-muted);
    }

    .card-footer { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }

    .card-footer-actions {
      display: flex; align-items: center; gap: var(--space-xs);
      margin-left: auto;
    }


    .sessions-pill, .duration-pill {
      font-size: var(--font-size-xs); padding: 3px 10px; border-radius: 10px;
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary); font-weight: 500;
    }

    .duration-pill.open { background: var(--bg-canvas); color: var(--text-muted); }

    .view-btn {
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); min-height: 32px; padding: 5px 12px; font-family: inherit;
      color: var(--text-secondary); font-size: var(--font-size-xs);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .view-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .del-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); width: 40px; height: 40px; border-radius: var(--border-radius-sm);
      display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;
    }
    .del-btn:hover { color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.1); }

    /* Start CTA */
    .start-cta {
      padding: var(--space-md) 0;
      text-align: center;
    }

    .start-link {
      display: inline-flex; align-items: center; gap: var(--space-xs);
      color: var(--color-primary); text-decoration: none;
      font-size: var(--font-size-sm); font-weight: 500;
      padding: var(--space-sm) var(--space-md);
      border: 1px dashed var(--border-color);
      border-radius: var(--border-radius);
      transition: all 0.15s;
    }

    .start-link:hover {
      border-color: var(--color-primary);
      background: rgba(var(--color-primary-rgb), 0.04);
    }

    /* Routine picker */

    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; font-size: var(--font-size-md); color: var(--text-primary);
      transition: all 0.15s; text-align: left; width: 100%; font-family: inherit;
    }

    .routine-pick-btn:hover { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

    .routine-pick-btn.freestyle { color: var(--text-secondary); font-size: var(--font-size-sm); }

    .routine-pick-name { font-weight: 500; }

    .routine-pick-day { font-size: var(--font-size-xs); color: var(--text-muted); }

    @media (max-width: 768px) {
      .del-btn {
        position: absolute;
        top: var(--space-md);
        right: var(--space-md);
        margin-left: 0;
      }

      .card-top { padding-right: 32px; }

      .sessions-pill, .duration-pill {
        font-size: 10px;
        padding: 2px 8px;
      }

      .card-footer-actions { width: 100%; justify-content: flex-end; }
    }
  `]
})
export class SeriesListComponent implements OnInit {
  embedded = input(false);
  goToSplits = output<void>();
  series = signal<SplitSeriesSummary[]>([]);
  loading = signal(true);

  activeSeries = signal<SplitSeriesSummary[]>([]);
  endedSeries = signal<SplitSeriesSummary[]>([]);

  // Routine picker for starting sessions from active series
  showRoutinePicker = signal(false);
  loadingRoutines = signal(false);
  pickerRoutines = signal<{ id: string; name: string; day_order: number }[]>([]);
  private selectedSeriesId = '';

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  constructor(private jymService: JymService, public router: Router) { }

  ngOnInit() {
    this.jymService.listSeries().subscribe({
      next: s => {
        this.series.set(s);
        this.activeSeries.set(s.filter(sr => !sr.ended_at));
        this.endedSeries.set(s.filter(sr => !!sr.ended_at));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  view(id: string) { this.router.navigate(['/jym/series', id]); }

  startFromSeriesSplit(splitId: string, seriesId: string) {
    this.selectedSeriesId = seriesId;
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
      series_id: this.selectedSeriesId,
    }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } }),
    });
  }

  startFreeWithSplit() {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({
      series_id: this.selectedSeriesId,
    }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  async deleteSeries(event: Event, sr: SplitSeriesSummary) {
    event.stopPropagation();
    const ok = await this.confirmService.confirm({
      title: `Delete ${sr.name}?`,
      message: 'This removes the series and its progression history. The sessions themselves stay in your history.',
      confirmLabel: 'Delete series',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteSeries(sr.id).subscribe({
      next: () => {
        this.series.update(list => list.filter(s => s.id !== sr.id));
        this.activeSeries.update(list => list.filter(s => s.id !== sr.id));
        this.endedSeries.update(list => list.filter(s => s.id !== sr.id));
        this.toast.success(`${sr.name} deleted`);
      },
      error: () => this.toast.error('Could not delete the series.'),
    });
  }

  progressWeeks(sr: SplitSeriesSummary): number {
    const days = Math.floor((Date.now() - new Date(sr.started_at).getTime()) / 86400000);
    return Math.floor(days / 7);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
