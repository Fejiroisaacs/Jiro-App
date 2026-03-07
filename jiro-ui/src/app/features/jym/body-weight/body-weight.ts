import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { JymService, BodyWeight } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

Chart.register(...registerables);

@Component({
  selector: 'app-body-weight',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent],
  template: `
    <div class="body-weight">
      @if (!embedded()) {
      <div class="page-header">
        <div>
          <h1>Body Weight</h1>
          <p class="text-secondary">Track your weight and see how it correlates with strength</p>
        </div>
      </div>
      }

      <!-- Log weight form -->
      <div class="log-card">
        <h2 class="section-title">Log Weight</h2>
        <form class="log-form" (ngSubmit)="logWeight()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date</label>
              <input class="form-input" type="date" [(ngModel)]="logDate" name="date" required />
            </div>
            <div class="form-group">
              <label class="form-label">Weight ({{ settingsService.unitLabel() }})</label>
              <input class="form-input" type="number" step="0.1" min="20" max="400"
                [(ngModel)]="weightValue" name="weight" placeholder="e.g. 82.5" required />
            </div>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !weightValue || !logDate">
              {{ saving() ? 'Saving...' : 'Log' }}
            </jiro-button>
          </div>
        </form>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading()">
        <!-- Chart -->
        <div class="chart-section" [hidden]="weights().length < 2">
          <h2 class="section-title">Weight Over Time</h2>
          <div class="chart-wrapper">
            <canvas #chartCanvas></canvas>
          </div>
        </div>

        <!-- Empty state -->
        <div *ngIf="weights().length === 0" class="state-message">
          <h3>No weight logged yet</h3>
          <p class="text-secondary">Log your first weight above to start tracking.</p>
        </div>

        <!-- Recent weights table -->
        <div *ngIf="weights().length > 0" class="table-section">
          <h2 class="section-title">Recent Entries</h2>
          <table class="weight-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Weight</th>
                <th>Change</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let w of weights(); let i = index">
                <td class="date-cell">{{ formatDate(w.recorded_at) }}</td>
                <td class="weight-cell">{{ settingsService.toDisplay(w.weight_kg) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</td>
                <td class="change-cell">
                  <span *ngIf="i < weights().length - 1" [class.positive]="delta(i) > 0" [class.negative]="delta(i) < 0">
                    {{ delta(i) > 0 ? '+' : '' }}{{ settingsService.toDisplay(delta(i)) | number:'1.1-1' }} {{ settingsService.unitLabel() }}
                  </span>
                  <span *ngIf="i === weights().length - 1" class="text-muted">—</span>
                </td>
                <td class="del-cell">
                  <button class="del-btn" (click)="deleteWeight(w)" title="Delete">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="3,6 5,6 21,6"/>
                      <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                    </svg>
                  </button>
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

    .body-weight { max-width: 800px; width: 100%; overflow-x: hidden; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .log-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      margin-bottom: var(--space-xl);
    }

    .section-title { font-size: var(--font-size-lg); font-weight: 600; margin-bottom: var(--space-md); }

    .log-form { }

    .form-row {
      display: flex; align-items: flex-end; gap: var(--space-md); flex-wrap: wrap;
    }

    .form-row ::ng-deep .jiro-btn { width: auto; flex-shrink: 0; margin-bottom: 0; }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); flex: 1; min-width: 120px; }

    .form-label { 
      font-size: var(--font-size-lg); 
      font-weight: 600; 
      color: var(--text-primary); 
      font-family: 'Newsreader', serif;
      margin-bottom: var(--space-xs);
    }

    .form-input {
      padding: 10px 0; 
      border: none;
      border-bottom: 2px dashed var(--border-color);
      border-radius: 0; 
      background: transparent;
      color: var(--text-primary); 
      font-size: var(--font-size-md);
      outline: none; 
      transition: border-color 0.2s; 
      font-family: inherit; 
      width: 100%; 
      box-sizing: border-box;
    }

    .form-input:focus { border-bottom-color: var(--color-primary); }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
    }
    
    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .chart-section { margin-bottom: var(--space-xl); }

    .chart-wrapper {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      height: 280px; position: relative;
    }

    .chart-wrapper canvas { width: 100% !important; height: 100% !important; }

    .table-section { }

    .weight-table {
      width: 100%; border-collapse: collapse;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .weight-table th {
      padding: var(--space-sm) var(--space-md); text-align: left;
      font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-muted); background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
    }

    .weight-table td {
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid var(--border-color);
      font-size: var(--font-size-sm);
    }

    .weight-table tr:last-child td { border-bottom: none; }

    .date-cell { color: var(--text-secondary); }

    .weight-cell { font-weight: 600; }

    .change-cell .positive { color: var(--color-danger); }
    .change-cell .negative { color: #4caf50; }

    .del-cell { text-align: right; }

    .del-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 4px; border-radius: 4px;
      display: inline-flex; align-items: center; transition: all 0.15s;
    }

    .del-btn:hover { color: var(--color-danger); background: rgba(196,74,74,0.1); }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class BodyWeightComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  embedded = input(false);

  weights = signal<BodyWeight[]>([]);
  loading = signal(true);
  saving = signal(false);

  logDate = new Date().toISOString().split('T')[0];
  weightValue: number | null = null;

  private chart: Chart | null = null;
  private dataLoaded = false;
  private viewReady = false;

  constructor(
    private jymService: JymService,
    public settingsService: SettingsService,
  ) { }

  ngOnInit() {
    this.jymService.listBodyWeights().subscribe({
      next: ws => {
        this.weights.set(ws);
        this.loading.set(false);
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

  private maybeDrawChart() {
    const ws = this.weights();
    if (!this.dataLoaded || !this.viewReady || !this.canvasRef || ws.length < 2) return;
    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const sorted = [...ws].sort((a, b) => a.recorded_at.localeCompare(b.recorded_at));
    const unit = this.settingsService.unitLabel();
    const labels = sorted.map(w => this.formatDate(w.recorded_at));
    const values = sorted.map(w => this.settingsService.toDisplay(w.weight_kg));

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Weight (${unit})`,
          data: values,
          borderColor: '#7a3b2e',
          backgroundColor: 'rgba(122,59,46,0.1)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: '#7a3b2e',
          pointRadius: 4,
          pointHoverRadius: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} ${unit}` } },
        },
        scales: {
          x: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 } } },
          y: {
            grid: { color: 'rgba(0,0,0,0.05)' },
            ticks: { font: { size: 11 }, callback: v => `${v} ${unit}` },
          },
        },
      },
    };

    this.chart = new Chart(this.canvasRef.nativeElement, config);
  }

  logWeight() {
    if (!this.weightValue || !this.logDate) return;
    this.saving.set(true);
    this.jymService.logBodyWeight({ recorded_at: this.logDate, weight_kg: this.settingsService.toKg(this.weightValue) }).subscribe({
      next: bw => {
        this.weights.update(ws => {
          const filtered = ws.filter(w => w.recorded_at.split('T')[0] !== this.logDate);
          return [bw, ...filtered].sort((a, b) => b.recorded_at.localeCompare(a.recorded_at));
        });
        this.weightValue = null;
        this.saving.set(false);
        setTimeout(() => this.maybeDrawChart(), 0);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteWeight(bw: BodyWeight) {
    this.jymService.deleteBodyWeight(bw.id).subscribe({
      next: () => {
        this.weights.update(ws => ws.filter(w => w.id !== bw.id));
        setTimeout(() => this.maybeDrawChart(), 0);
      },
    });
  }

  delta(index: number): number {
    const ws = this.weights();
    return ws[index].weight_kg - ws[index + 1].weight_kg;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }

}

