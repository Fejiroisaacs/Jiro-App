import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';
import { JymService, SplitSeriesSummary } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-series-list',
  standalone: true,
  imports: [CommonModule, RouterModule, JiroButtonComponent, JiroModalComponent, JymQuickNavComponent],
  template: `
    <div class="series-list">
      <div class="page-header">
        <div>
          <h1>My Series</h1>
          <p class="text-secondary">Structured program runs and progression tracking</p>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading...</p>
      </div>

      <!-- Active Series -->
      <div *ngIf="!loading() && activeSeries().length > 0" class="section">
        <h2 class="section-title">Active Series</h2>
        <div class="series-grid">
          <div *ngFor="let sr of activeSeries()" class="series-card">
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
              <span class="sessions-pill" *ngIf="!(sr.duration_type === 'sessions' && sr.target_sessions)">{{ sr.session_count }} sessions</span>
              <span class="duration-pill" *ngIf="sr.duration_type === 'weeks' && sr.target_weeks">
                {{ progressWeeks(sr) }} / {{ sr.target_weeks }} wks
              </span>
              <span class="duration-pill" *ngIf="sr.duration_type === 'sessions' && sr.target_sessions">
                {{ sr.session_count }} / {{ sr.target_sessions }} sessions
              </span>
              <span class="duration-pill open" *ngIf="sr.duration_type === 'open'">Open-ended</span>

              <div class="card-footer-actions">
                <jiro-button variant="primary" type="button" (click)="$event.stopPropagation(); startFromSeriesSplit(sr.split_id, sr.id)">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <polygon points="5,3 19,12 5,21"/>
                  </svg>
                  Start
                </jiro-button>
                <button class="view-btn" (click)="view(sr.id)">View</button>
                <button class="del-btn" (click)="deleteSeries($event, sr)" title="Delete series">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/>
                    <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Ended Series -->
      <div *ngIf="!loading() && endedSeries().length > 0" class="section">
        <h2 class="section-title">Ended Series</h2>
        <div class="series-grid">
          <div *ngFor="let sr of endedSeries()" class="series-card" (click)="view(sr.id)">
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
              <button class="del-btn" (click)="deleteSeries($event, sr)" title="Delete series">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div *ngIf="!loading() && series().length === 0" class="state-message">
        <h3>No series yet</h3>
        <p class="text-secondary">Start a series from any of your splits to track structured progression.</p>
        <a routerLink="/jym/splits" class="start-link">Go to Splits →</a>
      </div>

      <!-- Start a new series CTA (shown when series exist) -->
      <div *ngIf="!loading() && series().length > 0" class="start-cta">
        <a routerLink="/jym/splits" class="start-link">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Start a new series from your Splits
        </a>
      </div>

      <!-- Routine Picker Modal -->
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

    .series-list { max-width: 900px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .section { margin-bottom: var(--space-xl); }

    .section-title {
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-secondary); margin-bottom: var(--space-md);
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

    .series-card:hover { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.08); }

    .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-name { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }

    .series-name { font-size: var(--font-size-lg); font-weight: 600; margin: 0; }

    .status-badge {
      font-size: var(--font-size-xs); font-weight: 600; padding: 3px 10px;
      border-radius: 10px; white-space: nowrap; flex-shrink: 0;
    }
    .status-badge.active { background: rgba(76,175,80,0.12); color: #4caf50; }
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

    .card-footer-actions ::ng-deep .jiro-btn { width: auto; }

    .sessions-pill, .duration-pill {
      font-size: var(--font-size-xs); padding: 3px 10px; border-radius: 10px;
      background: rgba(122,59,46,0.1); color: var(--color-primary); font-weight: 500;
    }

    .duration-pill.open { background: var(--bg-canvas); color: var(--text-muted); }

    .view-btn {
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: 5px 12px;
      color: var(--text-secondary); font-size: var(--font-size-xs);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .view-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .del-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 4px; border-radius: 4px;
      display: inline-flex; align-items: center; transition: all 0.15s;
    }
    .del-btn:hover { color: var(--color-danger); background: rgba(196,74,74,0.1); }

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
      background: rgba(122,59,46,0.04);
    }

    /* Routine picker */
    .picker-loading { display: flex; justify-content: center; padding: var(--space-xl); }

    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; font-size: var(--font-size-md); color: var(--text-primary);
      transition: all 0.15s; text-align: left; width: 100%; font-family: inherit;
    }

    .routine-pick-btn:hover { border-color: var(--color-primary); background: rgba(122,59,46,0.05); }

    .routine-pick-btn.freestyle { color: var(--text-secondary); font-size: var(--font-size-sm); }

    .routine-pick-name { font-weight: 500; }

    .routine-pick-day { font-size: var(--font-size-xs); color: var(--text-muted); }

    @keyframes spin { to { transform: rotate(360deg); } }

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
  series = signal<SplitSeriesSummary[]>([]);
  loading = signal(true);

  activeSeries = signal<SplitSeriesSummary[]>([]);
  endedSeries = signal<SplitSeriesSummary[]>([]);

  // Routine picker for starting sessions from active series
  showRoutinePicker = signal(false);
  loadingRoutines = signal(false);
  pickerRoutines = signal<{ id: string; name: string; day_order: number }[]>([]);
  private selectedSeriesId = '';

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

  deleteSeries(event: Event, sr: SplitSeriesSummary) {
    event.stopPropagation();
    this.jymService.deleteSeries(sr.id).subscribe({
      next: () => {
        this.series.update(list => list.filter(s => s.id !== sr.id));
        this.activeSeries.update(list => list.filter(s => s.id !== sr.id));
        this.endedSeries.update(list => list.filter(s => s.id !== sr.id));
      },
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
