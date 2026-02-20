import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { JymService, ExerciseWithHistory, SetHistory } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';

Chart.register(...registerables);

type ChartType = '1rm' | 'volume' | 'maxweight' | 'repsatweight';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule],
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

        <!-- History table -->
        <div class="history-section">
          <h2 class="section-title">Set History</h2>

          <div *ngIf="exercise()!.history.length === 0" class="no-history">
            <p class="text-secondary">No sets logged yet. Start a session and log this exercise.</p>
          </div>

          <table *ngIf="exercise()!.history.length > 0" class="history-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Reps</th>
                <th>Est. 1RM</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let entry of exercise()!.history" [class.is-pr]="entry.is_pr">
                <td class="date-cell">{{ formatDate(entry.date) }}</td>
                <td class="weight-cell">{{ settingsService.toDisplay(entry.weight) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</td>
                <td>{{ entry.reps }} reps</td>
                <td class="orm-cell">{{ settingsService.toDisplay(entry.est_1rm) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</td>
                <td class="pr-cell">
                  <span *ngIf="entry.is_pr" class="pr-badge" title="Personal Record">🏆</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

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

    .section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-md); }

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

    .pr-badge { font-size: 16px; }

    @keyframes spin { to { transform: rotate(360deg); } }
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

  plateauStatus = computed<'plateau' | 'decline' | null>(() => {
    const ex = this.exercise();
    if (!ex || ex.history.length === 0) return null;
    // Build per-session max weight (no deloads), chronological
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
  }

  ngAfterViewInit() {
    this.viewReady = true;
    this.maybeDrawChart();
  }

  ngOnDestroy() {
    this.chart?.destroy();
  }

  switchChart(type: ChartType) {
    this.selectedChart.set(type);
    if (type === 'repsatweight' && this.selectedWeight() === null && this.uniqueWeights().length > 0) {
      this.selectedWeight.set(this.uniqueWeights()[0]); // default to heaviest
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
    return Array.from(weights).sort((a, b) => b - a); // heaviest first
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

  goBack() { this.router.navigate(['/jym/exercises']); }
}
