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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart, registerables } from 'chart.js';
import {
  LedgerService,
  NetWorthSnapshot,
  LedgerAccount,
} from '../../../core/services/ledger.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { LedgerQuickNavComponent } from '../ledger-quick-nav/ledger-quick-nav';

Chart.register(...registerables);

@Component({
  selector: 'app-networth-page',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent, LedgerQuickNavComponent],
  template: `
    <div class="networth-page">

      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Net Worth</h1>
          <p class="text-secondary">Track your financial position over time</p>
        </div>
        <jiro-button variant="primary" type="button" (click)="openSnapshotModal()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="3"/>
            <path d="M20.188 10.934a8.714 8.714 0 1 1-8.188-5.868"/>
            <path d="M20.188 4v4h-4"/>
          </svg>
          Take Snapshot
        </jiro-button>
      </div>

      <ledger-quick-nav />

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading snapshots...</p>
      </div>

      <!-- Empty state (no snapshots at all) -->
      <div *ngIf="!loading() && snapshots().length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
          </svg>
        </div>
        <h3>No snapshots yet</h3>
        <p class="text-secondary">Take your first snapshot to start tracking your net worth over time.</p>
        <jiro-button variant="primary" type="button" (click)="openSnapshotModal()">
          Take your first snapshot
        </jiro-button>
      </div>

      <!-- Content (has snapshots) -->
      <ng-container *ngIf="!loading() && snapshots().length > 0">

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
            <div *ngFor="let snap of displayedSnapshots()" class="snapshot-row">
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
          </div>
        </div>

      </ng-container>

      <!-- Take Snapshot Modal -->
      <jiro-modal *ngIf="showSnapshotModal()" title="Take Snapshot" maxWidth="480px" (close)="closeSnapshotModal()">

        <div *ngIf="loadingAccounts()" class="accounts-loading">
          <div class="spinner-sm"></div>
          <span>Loading accounts...</span>
        </div>

        <form *ngIf="!loadingAccounts()" class="modal-form" (ngSubmit)="submitSnapshot()">

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
      </jiro-modal>

    </div>
  `,
  styles: [`
    :host { display: block; }

    .networth-page { max-width: 900px; width: 100%; display: flex; flex-direction: column; gap: var(--space-xl); }

    /* ── Header ── */
    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-md);
      margin-bottom: 0;
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .page-header ::ng-deep .jiro-btn { width: auto; }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
    }

    /* ── Loading ── */
    .state-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl);
      gap: var(--space-md);
      text-align: center;
    }

    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner-sm {
      width: 16px; height: 16px;
      border: 2px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }

    /* ── Empty state ── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: var(--space-2xl) var(--space-lg);
      gap: var(--space-md);
      text-align: center;
      border: 1px dashed var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
    }

    .empty-icon { color: var(--text-muted); opacity: 0.45; }

    .empty-state h3 { font-size: var(--font-size-xl); font-weight: 600; }

    .empty-state ::ng-deep .jiro-btn { width: auto; margin-top: var(--space-xs); }

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

    .summary-networth.positive { color: #4A6741; }
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

    .side-value.assets { color: #4A6741; }
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

    .snap-value.networth.positive { color: #4A6741; }
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
      outline: none;
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

    .networth-preview.positive { border-color: rgba(74,103,65,0.3); background: rgba(74,103,65,0.06); }
    .networth-preview.negative { border-color: rgba(193,88,42,0.3); background: rgba(193,88,42,0.06); }

    .preview-label {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-weight: 500;
    }

    .preview-value {
      font-size: var(--font-size-xl);
      font-weight: 700;
    }

    .networth-preview.positive .preview-value { color: #4A6741; }
    .networth-preview.negative .preview-value { color: var(--color-danger); }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-sm);
      margin-top: var(--space-xs);
    }

    .form-actions ::ng-deep .jiro-btn { width: auto; }

    @keyframes spin { to { transform: rotate(360deg); } }
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
          (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
        ));
        this.savingSnapshot.set(false);
        this.closeSnapshotModal();
        setTimeout(() => this.maybeDrawChart(), 0);
      },
      error: () => this.savingSnapshot.set(false),
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', {
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
      (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
    );
    const labels = sorted.map(s => this.formatDate(s.snapshot_date));
    const values = sorted.map(s => s.net_worth);
    const accentColor = '#4A6741';
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
            borderColor: accentColor,
            backgroundColor: `${accentColor}1a`,
            fill: true,
            tension: 0.3,
            pointBackgroundColor: accentColor,
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
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: { font: { size: 11 }, color: '#9B8F88' },
            },
            y: {
              title: { display: false },
              grid: { color: 'rgba(0,0,0,0.05)' },
              ticks: {
                font: { size: 11 },
                color: '#9B8F88',
                callback: v => `$${Number(v).toLocaleString()}`,
              },
            },
          },
        },
      });
    });
  }

  private todayIso(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
