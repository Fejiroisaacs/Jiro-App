import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  NgZone,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import { chartTones } from '../../../shared/chart-theme';
import { parseDateOnly } from '../shared/ledger-utils';
import { SettingsService } from '../../../core/services/settings.service';
import { todayKey } from '../../../core/utils/day';
import {
  LedgerService,
  NetWorthSnapshot,
  LedgerAccount,
} from '../../../core/services/ledger.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

Chart.register(...registerables);

@Component({
  selector: 'app-networth-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent,
    JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent,
  ],
  template: `
    <div class="networth-page">

      <!-- Header -->
      <jiro-page-header heading="Net worth" subtitle="Track your financial position over time">
        <jiro-button actions type="button" (click)="openSnapshotModal()">
          <jiro-icon name="chart-line-up" [size]="14" />
          Take snapshot
        </jiro-button>
      </jiro-page-header>

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Empty state (no snapshots at all) -->
      @if (!loading() && snapshots().length === 0) {
        <jiro-empty-state
          icon="chart-line-up"
          heading="No snapshots yet"
          message="Take your first snapshot to start tracking your net worth over time.">
          <jiro-button type="button" (click)="openSnapshotModal()">Take your first snapshot</jiro-button>
        </jiro-empty-state>
      }

      <!-- Content (has snapshots) -->
      @if (!loading() && snapshots().length > 0) {


        <!-- Current snapshot summary -->
        <jiro-card class="summary-card">
          <div class="summary-grid">
            <div class="summary-main">
              <span class="summary-label">Current Net Worth</span>
              <span
                class="summary-networth"
                [class.positive]="latestSnapshot()!.net_worth >= 0"
                [class.negative]="latestSnapshot()!.net_worth < 0">
                {{ formatNetWorth(latestSnapshot()!.net_worth) }}
              </span>
              <span class="summary-date">as of {{ formatDate(latestSnapshot()!.snapshot_date) }}</span>
            </div>
            <div class="summary-side">
              <div class="side-stat">
                <span class="side-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
                  </svg>
                  Assets
                </span>
                <span class="side-value assets">\${{ latestSnapshot()!.assets_total | number:'1.2-2' }}</span>
              </div>
              <div class="side-stat">
                <span class="side-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/><polyline points="17,18 23,18 23,12"/>
                  </svg>
                  Liabilities
                </span>
                <span class="side-value liabilities">\${{ latestSnapshot()!.liabilities_total | number:'1.2-2' }}</span>
              </div>
            </div>
          </div>
        </jiro-card>

        <!-- Chart -->
        <jiro-card class="chart-card">
          <div class="chart-title">Net Worth Over Time</div>
          <div class="chart-wrapper">
            <canvas #networthChart></canvas>
          </div>
        </jiro-card>

        <!-- Snapshot list -->
        <div class="snapshot-list-section">
          <h2 class="section-heading">Snapshot History</h2>
          <div class="snapshot-list">
            @for (snap of displayedSnapshots(); track snap) {
<div class="snapshot-row">
              <div class="snap-date">{{ formatDate(snap.snapshot_date) }}</div>
              <div class="snap-values">
                <div class="snap-stat">
                  <span class="snap-label">Net Worth</span>
                  <span
                    class="snap-value networth"
                    [class.positive]="snap.net_worth >= 0"
                    [class.negative]="snap.net_worth < 0">
                    {{ snap.net_worth >= 0 ? '+' : '' }}\${{ snap.net_worth | number:'1.2-2' }}
                  </span>
                </div>
                <div class="snap-stat">
                  <span class="snap-label">Assets</span>
                  <span class="snap-value">\${{ snap.assets_total | number:'1.2-2' }}</span>
                </div>
                <div class="snap-stat">
                  <span class="snap-label">Liabilities</span>
                  <span class="snap-value liabilities">\${{ snap.liabilities_total | number:'1.2-2' }}</span>
                </div>
              </div>
            </div>
}
          </div>
        </div>

      
}

      <!-- Take Snapshot Modal -->
      @if (showSnapshotModal()) {
<jiro-modal title="Take Snapshot" maxWidth="480px" (close)="closeSnapshotModal()">

        @if (loadingAccounts()) {
<div class="accounts-loading">
          <div class="spinner-sm"></div>
          <span>Loading accounts...</span>
        </div>
}

        @if (!loadingAccounts()) {
<form class="modal-form" (ngSubmit)="submitSnapshot()">

          <div class="form-group">
            <label class="form-label">Snapshot Date</label>
            <input
              class="form-input"
              type="date"
              [(ngModel)]="snapDate"
              name="snapDate"
              required />
          </div>

          <div class="form-group">
            <label class="form-label">Total Assets ($)</label>
            <input
              class="form-input"
              type="number"
              [(ngModel)]="snapAssets"
              name="snapAssets"
              min="0"
              step="0.01"
              placeholder="e.g. 25000.00"
              required />
          </div>

          <div class="form-group">
            <label class="form-label">Total Liabilities ($)</label>
            <input
              class="form-input"
              type="number"
              [(ngModel)]="snapLiabilities"
              name="snapLiabilities"
              min="0"
              step="0.01"
              placeholder="e.g. 5000.00"
              required />
          </div>

          <!-- Net worth preview -->
          <div class="networth-preview" [class.positive]="netWorthPreview >= 0" [class.negative]="netWorthPreview < 0">
            <span class="preview-label">Computed Net Worth</span>
            <span class="preview-value">
              {{ netWorthPreview >= 0 ? '' : '-' }}\${{ absNetWorthPreview | number:'1.2-2' }}
            </span>
          </div>

          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="closeSnapshotModal()">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="savingSnapshot()">
              {{ savingSnapshot() ? 'Saving...' : 'Save Snapshot' }}
            </jiro-button>
          </div>

        </form>
}
      </jiro-modal>
}

    </div>
  `,
  styles: [`
    :host { display: block; }

    .networth-page { max-width: 900px; width: 100%; display: flex; flex-direction: column; gap: var(--space-xl); }

    /* ── Header ── */



    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
    }

    /* ── Loading ── */
    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }


    .spinner-sm {
      width: 16px; height: 16px;
      border: 2px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    /* ── Empty state ── */




    /* ── Summary card ── */
    .summary-card { width: 100%; }

    .summary-grid {
      display: flex;
      align-items: center;
      gap: var(--space-xl);
      flex-wrap: wrap;
    }

    .summary-main {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      flex: 1;
      min-width: 180px;
    }

    .summary-label {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .summary-networth {
      font-size: 2.25rem;
      font-weight: 800;
      line-height: 1;
      color: var(--text-primary);
    }

    .summary-networth.positive { color: var(--color-accent); }
    .summary-networth.negative { color: var(--color-danger); }

    .summary-date {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
    }

    .summary-side {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .side-stat { display: flex; flex-direction: column; gap: 2px; }

    .side-label {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .side-value {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--text-primary);
    }

    .side-value.assets { color: var(--color-accent); }
    .side-value.liabilities { color: var(--color-danger); }

    /* ── Chart card ── */
    .chart-card { width: 100%; }

    .chart-title {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--space-md);
    }

    .chart-wrapper {
      position: relative;
      height: 300px;
    }

    .chart-wrapper canvas {
      width: 100% !important;
      height: 100% !important;
    }

    @media (max-width: 600px) {
      .chart-wrapper { height: 200px; }
    }

    /* ── Snapshot history list ── */
    .section-heading {
      font-size: var(--font-size-lg);
      font-weight: 700;
      color: var(--text-primary);
      margin-bottom: var(--space-md);
    }

    .snapshot-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      max-height: 400px;
      overflow-y: auto;
    }

    .snapshot-row {
      display: flex;
      align-items: center;
      gap: var(--space-lg);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      transition: background 0.15s;
      flex-wrap: wrap;
    }

    .snapshot-row:hover { background: var(--bg-canvas); }

    .snap-date {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-secondary);
      min-width: 100px;
      flex-shrink: 0;
    }

    .snap-values {
      display: flex;
      gap: var(--space-xl);
      flex-wrap: wrap;
      flex: 1;
    }

    .snap-stat { display: flex; flex-direction: column; gap: 2px; }

    .snap-label {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.4px;
      color: var(--text-muted);
      font-weight: 500;
    }

    .snap-value {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
    }

    .snap-value.networth.positive { color: var(--color-accent); }
    .snap-value.networth.negative { color: var(--color-danger); }
    .snap-value.liabilities { color: var(--color-danger); }

    /* ── Modal form ── */
    .accounts-loading {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-lg);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .modal-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-sm); }

    .form-label {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      font-family: 'Newsreader', serif;
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

    /* ── Net worth preview ── */
    .networth-preview {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md) var(--space-lg);
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      background: var(--bg-canvas);
      margin-top: var(--space-xs);
    }

    .networth-preview.positive { border-color: rgba(var(--color-accent-rgb), 0.3); background: rgba(var(--color-accent-rgb), 0.06); }
    .networth-preview.negative { border-color: rgba(var(--color-danger-rgb), 0.3); background: rgba(var(--color-danger-rgb), 0.06); }

    .preview-label {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-weight: 500;
    }

    .preview-value {
      font-size: var(--font-size-xl);
      font-weight: 700;
    }

    .networth-preview.positive .preview-value { color: var(--color-accent); }
    .networth-preview.negative .preview-value { color: var(--color-danger); }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      margin-top: var(--space-xs);
    }


  `]
})
export class NetWorthPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('networthChart') canvasRef!: ElementRef<HTMLCanvasElement>;

  snapshots = signal<NetWorthSnapshot[]>([]);
  loading = signal(true);
  loadingAccounts = signal(false);
  savingSnapshot = signal(false);
  showSnapshotModal = signal(false);

  // Modal fields
  snapDate = '';
  snapAssets: number | null = null;
  snapLiabilities: number | null = null;

  latestSnapshot = computed(() => {
    const snaps = this.snapshots();
    if (snaps.length === 0) return null;
    return snaps[snaps.length - 1];
  });

  displayedSnapshots = computed(() =>
    [...this.snapshots()].reverse()
  );

  get netWorthPreview(): number {
    return (this.snapAssets ?? 0) - (this.snapLiabilities ?? 0);
  }

  get absNetWorthPreview(): number {
    return Math.abs(this.netWorthPreview);
  }

  private chart: Chart | null = null;
  private dataLoaded = false;
  private viewReady = false;

  private readonly settings = inject(SettingsService);

  constructor(private ledgerService: LedgerService, private zone: NgZone) {}

  ngOnInit() {
    this.ledgerService.listSnapshots().subscribe({
      next: snaps => {
        this.snapshots.set(snaps);
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

  openSnapshotModal() {
    this.snapDate = this.todayIso();
    this.snapAssets = null;
    this.snapLiabilities = null;
    this.showSnapshotModal.set(true);

    this.loadingAccounts.set(true);
    this.ledgerService.listAccounts().subscribe({
      next: accounts => {
        const assetTypes: LedgerAccount['type'][] = ['checking', 'savings', 'investment', 'cash'];
        const assetsSum = accounts
          .filter(a => assetTypes.includes(a.type) && a.balance > 0 && a.is_active)
          .reduce((sum, a) => sum + a.balance, 0);
        const liabilitiesSum = accounts
          .filter(a => a.type === 'credit' && a.is_active)
          .reduce((sum, a) => sum + Math.abs(a.balance), 0);

        this.snapAssets = Math.round(assetsSum * 100) / 100;
        this.snapLiabilities = Math.round(liabilitiesSum * 100) / 100;
        this.loadingAccounts.set(false);
      },
      error: () => this.loadingAccounts.set(false),
    });
  }

  closeSnapshotModal() {
    this.showSnapshotModal.set(false);
  }

  submitSnapshot() {
    if (this.snapAssets === null || this.snapLiabilities === null) return;
    this.savingSnapshot.set(true);
    this.ledgerService.createSnapshot({
      assets_total: this.snapAssets,
      liabilities_total: this.snapLiabilities,
      snapshot_date: this.snapDate,
    }).subscribe({
      next: snap => {
        this.snapshots.update(list => [...list, snap].sort(
          (a, b) => parseDateOnly(a.snapshot_date).getTime() - parseDateOnly(b.snapshot_date).getTime()
        ));
        this.savingSnapshot.set(false);
        this.closeSnapshotModal();
        setTimeout(() => this.maybeDrawChart(), 0);
      },
      error: () => this.savingSnapshot.set(false),
    });
  }

  formatDate(iso: string): string {
    return parseDateOnly(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  formatNetWorth(value: number): string {
    const abs = Math.abs(value).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return value < 0 ? `-$${abs}` : `$${abs}`;
  }

  private maybeDrawChart() {
    if (!this.dataLoaded || !this.viewReady || !this.canvasRef) return;
    const snaps = this.snapshots();
    if (snaps.length === 0) return;

    const sorted = [...snaps].sort(
      (a, b) => parseDateOnly(a.snapshot_date).getTime() - parseDateOnly(b.snapshot_date).getTime()
    );
    const labels = sorted.map(s => this.formatDate(s.snapshot_date));
    const values = sorted.map(s => s.net_worth);
    // Read at draw time so a theme or dark-mode change lands on the next redraw.
    const tone = chartTones();
    const canvas = this.canvasRef.nativeElement;

    // Run outside Angular's zone so Chart.js's ResizeObserver doesn't trigger CD cycles
    this.zone.runOutsideAngular(() => {
      // If chart already exists, update data in-place rather than destroy/recreate
      if (this.chart) {
        this.chart.data.labels = labels;
        this.chart.data.datasets[0].data = values;
        this.chart.update();
        return;
      }
      this.chart = new Chart(canvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Net Worth',
            data: values,
            borderColor: tone.accent,
            backgroundColor: `${tone.accent}1a`,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: tone.accent,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` $${(ctx.parsed.y as number).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              },
            },
          },
          scales: {
            x: {
              title: { display: false },
              grid: { color: tone.grid },
              ticks: { font: { size: 11 }, color: tone.tick },
            },
            y: {
              title: { display: false },
              grid: { color: tone.grid },
              ticks: {
                font: { size: 11 },
                color: tone.tick,
                callback: v => `$${Number(v).toLocaleString()}`,
              },
            },
          },
        },
      });
    });
  }

  private todayIso(): string {
    return todayKey(this.settings.timezone());
  }
}
