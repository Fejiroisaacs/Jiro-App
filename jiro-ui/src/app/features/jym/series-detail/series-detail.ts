import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { JymService, SplitSeriesDetail, ExerciseProgression, Routine } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

Chart.register(...registerables);

@Component({
  selector: 'app-series-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent, JiroModalComponent],
  template: `
    <div class="series-detail">
      <!-- Back -->
      <button class="back-btn" (click)="goBack()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15,18 9,12 15,6"/>
        </svg>
        My Series
      </button>

      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading() && series()" class="content">
        <!-- Header -->
        <div class="detail-header">
          <div>
            <div class="split-label">{{ series()!.split_name }}</div>
            <h1>{{ series()!.name }}</h1>
            <div class="header-meta">
              <span class="status-badge" [class.active]="!series()!.ended_at">
                {{ series()!.ended_at ? 'Ended' : 'Active' }}
              </span>
              <span class="meta-text">Started {{ formatDate(series()!.started_at) }}</span>
              <span *ngIf="series()!.ended_at" class="meta-text">· Ended {{ formatDate(series()!.ended_at!) }}</span>
              <span class="meta-text">· {{ series()!.session_count }} sessions</span>
            </div>
          </div>
          <div *ngIf="!series()!.ended_at" class="header-btns">
            <jiro-button variant="primary" type="button" (click)="openRoutinePicker()">
              Start Session
            </jiro-button>
            <jiro-button variant="secondary" type="button" (click)="endSeries()">
              End Series
            </jiro-button>
          </div>
        </div>

        <!-- Progress bar (for fixed-length series) -->
        <div *ngIf="series()!.duration_type !== 'open'" class="progress-section">
          <div class="progress-label">
            <span>Progress</span>
            <span class="progress-value">{{ progressText() }}</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" [style.width.%]="progressPct()"></div>
          </div>
        </div>

        <!-- No sessions yet -->
        <div *ngIf="series()!.sessions.length === 0" class="state-message">
          <h3>No sessions logged yet</h3>
          <p class="text-secondary">Start a session linked to this series to see progression data.</p>
        </div>

        <div *ngIf="series()!.sessions.length > 0">
          <!-- Tab bar -->
          <div class="tab-bar">
            <button class="tab-btn" [class.active]="activeTab() === 'volume'" (click)="activeTab.set('volume')">Volume</button>
            <button class="tab-btn" [class.active]="activeTab() === 'orm'" (click)="activeTab.set('orm')">Est. 1RM</button>
            <button class="tab-btn" [class.active]="activeTab() === 'compare'" (click)="activeTab.set('compare')">Compare</button>
          </div>

          <!-- Volume chart -->
          <div *ngIf="activeTab() === 'volume'" class="chart-block">
            <h2 class="section-title">Total Volume per Session</h2>
            <p class="section-sub">Sum of weight × reps across all sets. Excludes deload sessions.</p>
            <div class="chart-wrapper">
              <canvas #volumeCanvas></canvas>
            </div>
          </div>

          <!-- 1RM chart -->
          <div *ngIf="activeTab() === 'orm'" class="chart-block">
            <div class="orm-header">
              <h2 class="section-title">Estimated 1RM Progression</h2>
              <select class="ex-select" [(ngModel)]="selectedExId" (ngModelChange)="drawOrmChart()">
                <option *ngFor="let ex of series()!.exercise_progressions" [value]="ex.exercise_id">
                  {{ ex.exercise_name }}
                </option>
              </select>
            </div>
            <div class="chart-wrapper">
              <canvas #ormCanvas></canvas>
            </div>
          </div>

          <!-- Compare tab -->
          <div *ngIf="activeTab() === 'compare'" class="compare-block">
            <h2 class="section-title">Series Comparison</h2>
            <p class="section-sub">Compare performance with another series of the same split.</p>
            <div *ngIf="otherSeries().length === 0" class="no-compare">
              <p class="text-secondary">No other series for <strong>{{ series()!.split_name }}</strong> to compare with yet.</p>
            </div>
            <div *ngIf="otherSeries().length > 0" class="compare-controls">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Compare with</label>
                  <select class="ex-select" [(ngModel)]="compareSeriesId" (ngModelChange)="loadCompare()">
                    <option value="">Select a series...</option>
                    <option *ngFor="let s of otherSeries()" [value]="s.id">{{ s.name }}</option>
                  </select>
                </div>
                <div class="form-group" *ngIf="compareSeriesId">
                  <label class="form-label">Exercise</label>
                  <select class="ex-select" [(ngModel)]="compareExId" (ngModelChange)="drawCompareChart()">
                    <option value="">Select exercise...</option>
                    <option *ngFor="let ex of compareExercises()" [value]="ex.exercise_id">{{ ex.exercise_name }}</option>
                  </select>
                </div>
              </div>
              <div *ngIf="compareSeriesId && compareExId" class="chart-wrapper">
                <canvas #compareCanvas></canvas>
              </div>
            </div>
          </div>

          <!-- Sessions table -->
          <div class="sessions-section">
            <h2 class="section-title">Sessions</h2>
            <table class="sessions-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Sets</th>
                  <th>Volume</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let s of series()!.sessions; let i = index" [class.deload-row]="s.session_type === 'deload'">
                  <td class="num-cell">{{ i + 1 }}</td>
                  <td>{{ formatDate(s.date) }}</td>
                  <td>
                    <span *ngIf="s.session_type === 'normal'" class="type-dot normal"></span>
                    <span *ngIf="s.session_type === 'deload'" class="type-chip deload">Deload</span>
                    <span *ngIf="s.session_type === 'test'" class="type-chip test">Test</span>
                  </td>
                  <td>{{ s.set_count }}</td>
                  <td>{{ s.total_volume | number:'1.0-0' }} kg</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Routine picker modal -->
      <jiro-modal *ngIf="showRoutinePicker()" title="Start Session" maxWidth="440px" (close)="showRoutinePicker.set(false)">
        <div class="routine-picker">
          <p class="picker-sub">Pick a routine for this session, or go freestyle.</p>
          <div *ngIf="loadingRoutines()" class="picker-loading">
            <div class="spinner-sm"></div>
          </div>
          <div *ngIf="!loadingRoutines()" class="routine-list">
            <button *ngFor="let r of splitRoutines()" class="routine-row" (click)="startWithRoutine(r.id)">
              <div class="routine-row-name">{{ r.name }}</div>
              <span class="routine-row-count">{{ r.items.length }} exercises</span>
            </button>
            <button class="routine-row freestyle-row" (click)="startFreestyle()">
              <div class="routine-row-name">Freestyle</div>
              <span class="routine-row-count">No template</span>
            </button>
          </div>
        </div>
      </jiro-modal>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .series-detail { max-width: 900px; width: 100%; }

    .back-btn {
      display: flex; align-items: center; gap: var(--space-xs);
      background: none; border: none; color: var(--text-muted);
      font-size: var(--font-size-sm); cursor: pointer; padding: 0; margin-bottom: var(--space-xl);
    }
    .back-btn:hover { color: var(--text-primary); }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
    }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .content { display: flex; flex-direction: column; gap: var(--space-xl); }

    .detail-header {
      display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-lg);
    }
    .detail-header ::ng-deep .jiro-btn { width: auto; flex-shrink: 0; }

    .header-btns { display: flex; gap: var(--space-sm); flex-shrink: 0; }

    .split-label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }

    .detail-header h1 { font-size: var(--font-size-2xl); font-weight: 700; margin-bottom: var(--space-xs); }

    .header-meta { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }

    .status-badge {
      font-size: var(--font-size-xs); font-weight: 600; padding: 2px 8px; border-radius: 10px;
      background: rgba(76,175,80,0.12); color: #4caf50;
    }
    .status-badge:not(.active) { background: var(--bg-canvas); color: var(--text-muted); border: 1px solid var(--border-color); }

    .meta-text { font-size: var(--font-size-sm); color: var(--text-secondary); }

    .progress-section { }

    .progress-label { display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: var(--space-xs); }

    .progress-value { color: var(--color-primary); font-weight: 600; }

    .progress-bar {
      height: 8px; background: var(--bg-canvas); border-radius: 4px;
      border: 1px solid var(--border-color); overflow: hidden;
    }

    .progress-fill { height: 100%; background: var(--color-primary); border-radius: 4px; transition: width 0.3s; }

    .tab-bar { display: flex; gap: 0; border-bottom: 2px solid var(--border-color); }

    .tab-btn {
      padding: var(--space-sm) var(--space-lg); background: none; border: none;
      font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary);
      cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s;
    }
    .tab-btn.active { color: var(--color-primary); border-bottom-color: var(--color-primary); }

    .chart-block { }

    .section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-xs); }

    .section-sub { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-md); }

    .orm-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-md); margin-bottom: var(--space-md); }
    .orm-header .section-title { margin-bottom: 0; }

    .chart-wrapper {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      height: 280px; position: relative;
    }
    .chart-wrapper canvas { width: 100% !important; height: 100% !important; }

    .ex-select {
      padding: 8px 12px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-sm); outline: none; cursor: pointer;
    }
    .ex-select:focus { border-color: var(--color-primary); }

    .compare-block { }
    .no-compare { padding: var(--space-xl); text-align: center; border: 1px dashed var(--border-color); border-radius: var(--border-radius); }

    .compare-controls { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-row { display: flex; gap: var(--space-md); flex-wrap: wrap; }
    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }
    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }

    .sessions-section { }

    .sessions-table {
      width: 100%; border-collapse: collapse;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }
    .sessions-table th {
      padding: var(--space-sm) var(--space-md); text-align: left;
      font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-muted); background: var(--bg-canvas); border-bottom: 1px solid var(--border-color);
    }
    .sessions-table td {
      padding: var(--space-sm) var(--space-md); border-bottom: 1px solid var(--border-color);
      font-size: var(--font-size-sm);
    }
    .sessions-table tr:last-child td { border-bottom: none; }
    .sessions-table tr.deload-row { opacity: 0.6; }

    .num-cell { color: var(--text-muted); font-weight: 500; }

    .type-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #4caf50; }
    .type-chip {
      font-size: var(--font-size-xs); font-weight: 600; padding: 1px 6px; border-radius: 8px;
    }
    .type-chip.deload { background: rgba(196,74,74,0.1); color: var(--color-danger); }
    .type-chip.test { background: rgba(122,59,46,0.12); color: var(--color-primary); }

    .routine-picker { display: flex; flex-direction: column; gap: var(--space-md); }

    .picker-sub { font-size: var(--font-size-sm); color: var(--text-secondary); }

    .picker-loading { display: flex; justify-content: center; padding: var(--space-lg); }

    .spinner-sm {
      width: 24px; height: 24px; border: 2px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; text-align: left; transition: border-color 0.15s, box-shadow 0.15s;
      width: 100%;
    }
    .routine-row:hover { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.08); }

    .routine-row-name { font-size: var(--font-size-md); font-weight: 500; color: var(--text-primary); }

    .routine-row-count { font-size: var(--font-size-xs); color: var(--text-muted); flex-shrink: 0; }

    .freestyle-row { border-style: dashed; }
    .freestyle-row .routine-row-name { color: var(--text-secondary); }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class SeriesDetailComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('volumeCanvas') volumeCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ormCanvas') ormCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('compareCanvas') compareCanvasRef!: ElementRef<HTMLCanvasElement>;

  series = signal<SplitSeriesDetail | null>(null);
  loading = signal(true);
  activeTab = signal<'volume' | 'orm' | 'compare'>('volume');
  showRoutinePicker = signal(false);
  splitRoutines = signal<Routine[]>([]);
  loadingRoutines = signal(false);

  selectedExId = '';
  compareSeriesId = '';
  compareExId = '';
  otherSeries = signal<{ id: string; name: string }[]>([]);
  compareExercises = signal<ExerciseProgression[]>([]);
  compareSeries = signal<SplitSeriesDetail | null>(null);

  private volumeChart: Chart | null = null;
  private ormChart: Chart | null = null;
  private compareChart: Chart | null = null;
  private viewReady = false;
  private seriesId = '';

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.seriesId = this.route.snapshot.paramMap.get('id') || '';
    this.jymService.getSeries(this.seriesId).subscribe({
      next: s => {
        this.series.set(s);
        this.loading.set(false);
        if (s.exercise_progressions.length > 0) {
          this.selectedExId = s.exercise_progressions[0].exercise_id;
        }
        setTimeout(() => {
          this.drawVolumeChart();
          this.drawOrmChart();
        }, 0);
        // Load other series for same split for comparison
        this.jymService.listSeries().subscribe(all => {
          this.otherSeries.set(all.filter(sr => sr.split_id === s.split_id && sr.id !== s.id).map(sr => ({ id: sr.id, name: sr.name })));
        });
      },
      error: () => this.loading.set(false),
    });
  }

  ngAfterViewInit() {
    this.viewReady = true;
  }

  ngOnDestroy() {
    this.volumeChart?.destroy();
    this.ormChart?.destroy();
    this.compareChart?.destroy();
  }

  drawVolumeChart() {
    const s = this.series();
    if (!s || !this.volumeCanvasRef) return;
    this.volumeChart?.destroy();

    const sessions = s.sessions.filter(sess => sess.session_type !== 'deload');
    if (sessions.length === 0) return;

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels: sessions.map((_, i) => `S${i + 1}`),
        datasets: [{
          label: 'Volume (kg)',
          data: sessions.map(sess => sess.total_volume),
          backgroundColor: 'rgba(122,59,46,0.7)',
          borderColor: '#7a3b2e',
          borderWidth: 1,
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Session ${items[0].label} — ${this.formatDate(sessions[items[0].dataIndex].date)}`,
              label: ctx => ` ${(ctx.parsed.y as number).toLocaleString()} kg total volume`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: v => `${v} kg` } },
        },
      },
    };
    this.volumeChart = new Chart(this.volumeCanvasRef.nativeElement, config);
  }

  drawOrmChart() {
    const s = this.series();
    if (!s || !this.ormCanvasRef || !this.selectedExId) return;
    this.ormChart?.destroy();

    const ex = s.exercise_progressions.find(e => e.exercise_id === this.selectedExId);
    if (!ex || ex.points.length === 0) return;

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: ex.points.map((_, i) => `S${i + 1}`),
        datasets: [{
          label: 'Est. 1RM (kg)',
          data: ex.points.map(p => p.best_est_1rm),
          borderColor: '#7a3b2e',
          backgroundColor: 'rgba(122,59,46,0.1)',
          fill: true, tension: 0.3,
          pointBackgroundColor: '#7a3b2e', pointRadius: 4, pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: (items) => `Session ${items[0].label} — ${this.formatDate(ex.points[items[0].dataIndex].date)}`,
              label: ctx => ` ${ctx.parsed.y} kg`,
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: v => `${v} kg` } },
        },
      },
    };
    this.ormChart = new Chart(this.ormCanvasRef.nativeElement, config);
  }

  loadCompare() {
    if (!this.compareSeriesId) return;
    this.jymService.getSeries(this.compareSeriesId).subscribe(s => {
      this.compareSeries.set(s);
      this.compareExercises.set(s.exercise_progressions);
      this.compareExId = '';
    });
  }

  drawCompareChart() {
    const current = this.series();
    const other = this.compareSeries();
    if (!current || !other || !this.compareExId || !this.compareCanvasRef) return;
    this.compareChart?.destroy();

    const currentEx = current.exercise_progressions.find(e => e.exercise_id === this.compareExId);
    const otherEx = other.exercise_progressions.find(e => e.exercise_id === this.compareExId);
    if (!currentEx && !otherEx) return;

    const maxLen = Math.max(currentEx?.points.length ?? 0, otherEx?.points.length ?? 0);
    const labels = Array.from({ length: maxLen }, (_, i) => `S${i + 1}`);

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: current.name,
            data: (currentEx?.points ?? []).map(p => p.best_est_1rm),
            borderColor: '#7a3b2e',
            backgroundColor: 'rgba(122,59,46,0.1)',
            fill: false, tension: 0.3,
            pointBackgroundColor: '#7a3b2e', pointRadius: 4,
          },
          {
            label: other.name,
            data: (otherEx?.points ?? []).map(p => p.best_est_1rm),
            borderColor: '#9e9e9e',
            backgroundColor: 'rgba(158,158,158,0.1)',
            fill: false, tension: 0.3,
            pointBackgroundColor: '#9e9e9e', pointRadius: 4,
            borderDash: [5, 3],
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, position: 'top' },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} kg` } },
        },
        scales: {
          x: { grid: { display: false }, ticks: { font: { size: 11 } } },
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: v => `${v} kg` } },
        },
      },
    };
    this.compareChart = new Chart(this.compareCanvasRef.nativeElement, config);
  }

  openRoutinePicker() {
    const s = this.series();
    if (!s) return;
    this.showRoutinePicker.set(true);
    this.loadingRoutines.set(true);
    this.jymService.getSplit(s.split_id).subscribe({
      next: split => {
        this.splitRoutines.set(split.routines);
        this.loadingRoutines.set(false);
      },
      error: () => this.loadingRoutines.set(false),
    });
  }

  startWithRoutine(routineId: string) {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({ routine_id: routineId, series_id: this.seriesId }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } }),
    });
  }

  startFreestyle() {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({ series_id: this.seriesId }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  endSeries() {
    this.jymService.updateSeries(this.seriesId, { ended_at: new Date().toISOString() }).subscribe({
      next: updated => this.series.update(s => s ? { ...s, ended_at: updated.ended_at } : s),
    });
  }

  progressPct(): number {
    const s = this.series();
    if (!s) return 0;
    if (s.duration_type === 'sessions' && s.target_sessions) {
      return Math.min(100, (s.session_count / s.target_sessions) * 100);
    }
    if (s.duration_type === 'weeks' && s.target_weeks) {
      const elapsed = (Date.now() - new Date(s.started_at).getTime()) / 86400000 / 7;
      return Math.min(100, (elapsed / s.target_weeks) * 100);
    }
    return 0;
  }

  progressText(): string {
    const s = this.series();
    if (!s) return '';
    if (s.duration_type === 'sessions' && s.target_sessions) return `${s.session_count} / ${s.target_sessions} sessions`;
    if (s.duration_type === 'weeks' && s.target_weeks) {
      const wks = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 86400000 / 7);
      return `${wks} / ${s.target_weeks} weeks`;
    }
    return '';
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  goBack() { this.router.navigate(['/jym/series']); }
}
