import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, inject, signal, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { JymService, BodyWeight } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { chartTones } from '../../../shared/chart-theme';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

Chart.register(...registerables);

@Component({
  selector: 'app-body-weight',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent, JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent],
  template: `
    <div class="body-weight">
      @if (!embedded()) {
        <jiro-page-header heading="Body weight" subtitle="Track your weight and see how it moves with your strength" />
      }

      <!-- Log weight form -->
      <div class="log-card">
        <h2 class="section-title">Log weight</h2>
        <form class="log-form" (ngSubmit)="logWeight()">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label" for="bw-date">Date</label>
              <input id="bw-date" class="form-input" type="date" [(ngModel)]="logDate" name="date" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="bw-weight">Weight ({{ settingsService.unitLabel() }})</label>
              <input id="bw-weight" class="form-input" type="number" step="0.1" min="20" max="400"
                [(ngModel)]="weightValue" name="weight" placeholder="e.g. 82.5" required />
            </div>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !weightValue || !logDate">
              {{ saving() ? 'Saving...' : 'Log' }}
            </jiro-button>
          </div>
        </form>
      </div>

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      @if (!loading()) {
<div>
        <!-- Chart -->
        <div class="chart-section" [hidden]="weights().length < 2">
          <h2 class="section-title">Weight over time</h2>
          <div class="chart-wrapper">
            <canvas #chartCanvas></canvas>
          </div>
        </div>

        <!-- Empty state -->
        @if (weights().length === 0) {
          <jiro-empty-state
            icon="chart-line-up"
            heading="No weight logged yet"
            message="Log your first weight above to start tracking." />
        }

        <!-- Recent weights table -->
        @if (weights().length > 0) {
<div class="table-section">
          <h2 class="section-title">Recent entries</h2>
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
              @for (w of weights(); track w; let i = $index) {
<tr>
                <td class="date-cell">{{ formatDate(w.recorded_at) }}</td>
                <td class="weight-cell">{{ settingsService.toDisplay(w.weight_kg) | number:'1.1-1' }} {{ settingsService.unitLabel() }}</td>
                <td class="change-cell">
                  @if (i < weights().length - 1) {
<span [class.positive]="delta(i) > 0" [class.negative]="delta(i) < 0">
                    {{ delta(i) > 0 ? '+' : '' }}{{ settingsService.toDisplay(delta(i)) | number:'1.1-1' }} {{ settingsService.unitLabel() }}
                  </span>
}
                  @if (i === weights().length - 1) {
<span class="text-muted">—</span>
}
                </td>
                <td class="del-cell">
                  <button class="del-btn" type="button" (click)="deleteWeight(w)" title="Delete entry"
                    [attr.aria-label]="'Delete weight entry for ' + formatDate(w.recorded_at)">
                    <jiro-icon name="trash" [size]="15" />
                  </button>
                </td>
              </tr>
}
            </tbody>
          </table>
        </div>
}
      </div>
}
    </div>
  `,
  styles: [`
    :host { display: block; }

    .body-weight { max-width: 800px; width: 100%; overflow-x: hidden; }

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
      transition: border-color 0.2s; 
      font-family: inherit; 
      width: 100%; 
      box-sizing: border-box;
    }

    .form-input:focus { border-bottom-color: var(--color-primary); }

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

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
    .change-cell .negative { color: var(--color-positive); }

    .del-cell { text-align: right; }

    .del-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); border-radius: var(--border-radius-sm);
      width: 40px; height: 40px;
      display: inline-flex; align-items: center; justify-content: center; transition: all 0.15s;
    }

    .del-btn:hover { color: var(--color-danger); background: rgba(var(--color-danger-rgb), 0.1); }

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

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

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

    const tone = chartTones();
    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: `Weight (${unit})`,
          data: values,
          borderColor: tone.primary,
          backgroundColor: tone.primaryFill,
          fill: true,
          tension: 0.3,
          pointBackgroundColor: tone.primary,
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
          x: { grid: { color: tone.grid }, ticks: { font: { size: 11 }, color: tone.tick } },
          y: {
            grid: { color: tone.grid },
            ticks: { font: { size: 11 }, color: tone.tick, callback: v => `${v} ${unit}` },
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

  async deleteWeight(bw: BodyWeight) {
    const ok = await this.confirmService.confirm({
      title: 'Delete this entry?',
      message: `The weight logged on ${this.formatDate(bw.recorded_at)} will be removed.`,
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteBodyWeight(bw.id).subscribe({
      next: () => {
        this.weights.update(ws => ws.filter(w => w.id !== bw.id));
        setTimeout(() => this.maybeDrawChart(), 0);
        this.toast.success('Entry deleted');
      },
      error: () => this.toast.error('Could not delete the entry.'),
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

