import { Component, OnInit, signal, ElementRef, ViewChild, AfterViewInit } from '@angular/core';

import { Router } from '@angular/router';
import { AdminService, AdminStats, EventDayStat } from '../../core/services/admin.service';
import { chartTones } from '../../shared/chart-theme';
import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [],
  template: `
    <div class="dashboard">
      <h1 class="page-title">Dashboard</h1>

      @if (loading()) {
<div class="loading">Loading...</div>
}
      @if (error()) {
<div class="error-msg">{{ error() }}</div>
}

      @if (stats() && !loading()) {
<div class="content">
        <!-- Stat cards -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_users }}</div>
            <div class="stat-label">Total Users</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_sessions }}</div>
            <div class="stat-label">Total Sessions</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_recipes }}</div>
            <div class="stat-label">Total Recipes</div>
          </div>
        </div>

        <!-- Events chart -->
        <div class="chart-card">
          <h2 class="chart-title">Events: Last 30 Days</h2>
          <div class="chart-wrap">
            <canvas #chartCanvas></canvas>
          </div>
        </div>
      </div>
}
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 24px; }
    .loading { color: var(--text-secondary); }
    .error-msg { color: var(--color-negative); }
    .stat-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 10px; padding: 20px; display: flex; flex-direction: column; gap: 6px;
    }
    .stat-value { font-size: 32px; font-weight: 700; color: var(--color-primary); }
    .stat-label { font-size: 13px; color: var(--text-secondary); }
    .chart-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: 10px; padding: 24px;
    }
    .chart-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; }
    .chart-wrap { position: relative; height: 280px; }
    @media (max-width: 600px) {
      .page-title { font-size: 20px; margin-bottom: 16px; }
      .stat-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px; }
      .stat-value { font-size: 26px; }
      .chart-card { padding: 16px; }
      .chart-wrap { height: 200px; }
    }
  `]
})
export class AdminDashboardComponent implements OnInit, AfterViewInit {
  @ViewChild('chartCanvas') chartCanvas!: ElementRef<HTMLCanvasElement>;

  stats = signal<AdminStats | null>(null);
  loading = signal(true);
  error = signal('');
  private chart: Chart | null = null;

  constructor(private adminService: AdminService, private router: Router) {}

  ngOnInit() {
    this.adminService.getStats().subscribe({
      next: s => {
        this.stats.set(s);
        this.loading.set(false);
      },
      error: err => {
        this.loading.set(false);
        if (err.status === 401 || err.status === 404) {
          this.router.navigate(['/dashboard']);
        } else {
          this.error.set('Failed to load stats');
        }
      }
    });
  }

  ngAfterViewInit() {
    // The chart is built in ngDoCheck once stats arrive.
  }

  ngDoCheck() {
    if (this.stats() && this.chartCanvas && !this.chart) {
      this.buildChart(this.stats()!.events_by_day);
    }
  }

  private buildChart(data: EventDayStat[]) {
    if (!data || data.length === 0) return;
    if (!this.chartCanvas) return;
    const ctx = this.chartCanvas.nativeElement.getContext('2d');
    if (!ctx) return;

    // Collect unique dates and events
    const dates = [...new Set(data.map(d => d.date))].sort();
    const events = [...new Set(data.map(d => d.event))];

    const tone = chartTones();
    const palette = [tone.primary, tone.warning, tone.accent, tone.secondary, tone.muted, tone.tick];

    const datasets = events.map((ev, i) => ({
      label: ev,
      data: dates.map(date => {
        const found = data.find(d => d.date === date && d.event === ev);
        return found ? found.count : 0;
      }),
      backgroundColor: palette[i % palette.length],
      borderRadius: 4,
    }));

    this.chart = new Chart(ctx, {
      type: 'bar',
      data: { labels: dates, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { stacked: true, ticks: { color: tone.tick, maxTicksLimit: 10 }, grid: { color: tone.grid } },
          y: { stacked: true, ticks: { color: tone.tick }, grid: { color: tone.grid } },
        },
        plugins: {
          legend: { labels: { color: tone.tick, boxWidth: 12, font: { size: 12 } } },
          tooltip: { mode: 'index' },
        },
      }
    });
  }
}
