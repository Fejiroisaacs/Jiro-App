import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LedgerQuickNavComponent } from '../ledger-quick-nav/ledger-quick-nav';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { LedgerService, ComparisonResponse } from '../../../core/services/ledger.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

Chart.register(...registerables);

type Preset = 'month' | 'week' | 'quarter' | 'custom';

interface DateRange {
  aFrom: string;
  aTo: string;
  bFrom: string;
  bTo: string;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computePresetRanges(preset: Preset): DateRange | null {
  const now = new Date();
  if (preset === 'month') {
    const aFrom = isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
    const aTo   = isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const bFrom = isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const bTo   = isoDate(new Date(now.getFullYear(), now.getMonth(), 0));
    return { aFrom, aTo, bFrom, bTo };
  }
  if (preset === 'week') {
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6);
    return {
      aFrom: isoDate(monday),
      aTo:   isoDate(sunday),
      bFrom: isoDate(lastMonday),
      bTo:   isoDate(lastSunday),
    };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const aFrom = isoDate(new Date(now.getFullYear(), q * 3, 1));
    const aTo   = isoDate(new Date(now.getFullYear(), q * 3 + 3, 0));
    const prevQ = q === 0 ? 3 : q - 1;
    const prevYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const bFrom = isoDate(new Date(prevYear, prevQ * 3, 1));
    const bTo   = isoDate(new Date(prevYear, prevQ * 3 + 3, 0));
    return { aFrom, aTo, bFrom, bTo };
  }
  return null;
}

@Component({
  selector: 'app-comparison-page',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, LedgerQuickNavComponent],
  template: `
    <div class="comparison-page">

      <!-- ── Header ── -->
      <div class="page-header">
        <div>
          <h1>Compare Periods</h1>
          <p class="text-secondary">Analyse how your finances changed between two periods</p>
        </div>
      </div>

      <ledger-quick-nav />

      <!-- ── Period Selector ── -->
      <jiro-card>
        <div class="selector-card">
          <div class="selector-label">Select periods</div>

          <!-- Preset toggle group -->
          <div class="preset-group">
            <button class="preset-btn" [class.active]="selectedPreset() === 'month'"   (click)="selectPreset('month')">
              This Month vs Last
            </button>
            <button class="preset-btn" [class.active]="selectedPreset() === 'week'"    (click)="selectPreset('week')">
              This Week vs Last
            </button>
            <button class="preset-btn" [class.active]="selectedPreset() === 'quarter'" (click)="selectPreset('quarter')">
              This Quarter vs Last
            </button>
            <button class="preset-btn" [class.active]="selectedPreset() === 'custom'"  (click)="selectPreset('custom')">
              Custom
            </button>
          </div>

          <!-- Custom date pickers -->
          <div *ngIf="selectedPreset() === 'custom'" class="custom-ranges">
            <div class="range-group">
              <div class="range-label">
                <span class="period-dot dot-a"></span>
                Period A
              </div>
              <div class="date-inputs">
                <div class="date-field">
                  <label class="date-field-label">From</label>
                  <input type="date" class="date-input" [(ngModel)]="customAFrom" />
                </div>
                <div class="date-sep">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/>
                  </svg>
                </div>
                <div class="date-field">
                  <label class="date-field-label">To</label>
                  <input type="date" class="date-input" [(ngModel)]="customATo" />
                </div>
              </div>
            </div>

            <div class="range-group">
              <div class="range-label">
                <span class="period-dot dot-b"></span>
                Period B
              </div>
              <div class="date-inputs">
                <div class="date-field">
                  <label class="date-field-label">From</label>
                  <input type="date" class="date-input" [(ngModel)]="customBFrom" />
                </div>
                <div class="date-sep">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/>
                  </svg>
                </div>
                <div class="date-field">
                  <label class="date-field-label">To</label>
                  <input type="date" class="date-input" [(ngModel)]="customBTo" />
                </div>
              </div>
            </div>

            <div class="custom-apply">
              <jiro-button variant="primary" type="button" [loading]="loading()" (click)="applyCustom()">
                Apply Comparison
              </jiro-button>
            </div>
          </div>

          <!-- Active range summary (shown for presets) -->
          <div *ngIf="selectedPreset() !== 'custom' && activeRange()" class="range-summary">
            <span class="range-chip">
              <span class="period-dot dot-a"></span>
              A: {{ activeRange()!.aFrom | date:'mediumDate' }} — {{ activeRange()!.aTo | date:'mediumDate' }}
            </span>
            <span class="range-sep">vs</span>
            <span class="range-chip">
              <span class="period-dot dot-b"></span>
              B: {{ activeRange()!.bFrom | date:'mediumDate' }} — {{ activeRange()!.bTo | date:'mediumDate' }}
            </span>
          </div>
        </div>
      </jiro-card>

      <!-- ── Loading ── -->
      <div *ngIf="loading()" class="state-center">
        <div class="spinner-lg"></div>
        <span class="state-label">Loading comparison...</span>
      </div>

      <!-- ── Empty / No data state ── -->
      <div *ngIf="!loading() && !result() && !loadError()" class="state-center state-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="empty-icon">
          <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        <p class="state-label">Select a period to compare</p>
        <p class="state-sub">Choose a preset above or enter custom date ranges</p>
      </div>

      <!-- ── Error state ── -->
      <div *ngIf="!loading() && loadError()" class="state-center state-error">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p class="state-label">Failed to load comparison</p>
        <p class="state-sub">{{ loadError() }}</p>
      </div>

      <!-- ── Results ── -->
      <div *ngIf="!loading() && result()" class="results-body">

        <!-- Summary cards -->
        <div class="summary-grid">

          <!-- Income -->
          <jiro-card>
            <div class="summary-card">
              <div class="summary-card-header">
                <div class="summary-icon income-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23,6 13.5,15.5 8.5,10.5 1,18"/><polyline points="17,6 23,6 23,12"/>
                  </svg>
                </div>
                <span class="summary-title">Total Income</span>
              </div>
              <div class="summary-periods">
                <div class="summary-period">
                  <span class="period-dot dot-a"></span>
                  <span class="period-val">{{ result()!.summary.income.a | currency }}</span>
                </div>
                <div class="summary-period">
                  <span class="period-dot dot-b"></span>
                  <span class="period-val">{{ result()!.summary.income.b | currency }}</span>
                </div>
              </div>
              <div class="summary-delta" [ngClass]="incomeDeltaClass()">
                <span class="delta-arrow">{{ result()!.summary.income.delta >= 0 ? '↑' : '↓' }}</span>
                {{ formatDelta(result()!.summary.income.delta, result()!.summary.income.delta_pct) }}
              </div>
            </div>
          </jiro-card>

          <!-- Expenses -->
          <jiro-card>
            <div class="summary-card">
              <div class="summary-card-header">
                <div class="summary-icon expense-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23,18 13.5,8.5 8.5,13.5 1,6"/><polyline points="17,18 23,18 23,12"/>
                  </svg>
                </div>
                <span class="summary-title">Total Expenses</span>
              </div>
              <div class="summary-periods">
                <div class="summary-period">
                  <span class="period-dot dot-a"></span>
                  <span class="period-val">{{ result()!.summary.expenses.a | currency }}</span>
                </div>
                <div class="summary-period">
                  <span class="period-dot dot-b"></span>
                  <span class="period-val">{{ result()!.summary.expenses.b | currency }}</span>
                </div>
              </div>
              <div class="summary-delta" [ngClass]="expenseDeltaClass()">
                <span class="delta-arrow">{{ result()!.summary.expenses.delta >= 0 ? '↑' : '↓' }}</span>
                {{ formatDelta(result()!.summary.expenses.delta, result()!.summary.expenses.delta_pct) }}
              </div>
            </div>
          </jiro-card>

          <!-- Net Cashflow -->
          <jiro-card>
            <div class="summary-card">
              <div class="summary-card-header">
                <div class="summary-icon net-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                </div>
                <span class="summary-title">Net Cashflow</span>
              </div>
              <div class="summary-periods">
                <div class="summary-period">
                  <span class="period-dot dot-a"></span>
                  <span class="period-val" [class.negative-val]="result()!.summary.net.a < 0">
                    {{ result()!.summary.net.a | currency }}
                  </span>
                </div>
                <div class="summary-period">
                  <span class="period-dot dot-b"></span>
                  <span class="period-val" [class.negative-val]="result()!.summary.net.b < 0">
                    {{ result()!.summary.net.b | currency }}
                  </span>
                </div>
              </div>
              <div class="summary-delta" [ngClass]="netDeltaClass()">
                <span class="delta-arrow">{{ result()!.summary.net.delta >= 0 ? '↑' : '↓' }}</span>
                {{ formatDelta(result()!.summary.net.delta, result()!.summary.net.delta_pct) }}
              </div>
            </div>
          </jiro-card>

        </div>

        <!-- ── Bar Chart ── -->
        <jiro-card>
          <div class="chart-section">
            <div class="chart-header">
              <h2 class="chart-title">Period Overview</h2>
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-dot" style="background: #7A3B2E;"></span>
                  Period A
                </span>
                <span class="legend-item">
                  <span class="legend-dot" style="background: #4A6741;"></span>
                  Period B
                </span>
              </div>
            </div>
            <div class="chart-wrap">
              <canvas #compareChart></canvas>
            </div>
          </div>
        </jiro-card>

        <!-- ── Category detail — desktop table ── -->
        <jiro-card>
          <div class="cat-section">
            <div class="cat-header">
              <h2 class="cat-title">Category Breakdown</h2>
              <span class="cat-count">{{ result()!.categories.length }} categories</span>
            </div>

            <!-- Desktop table -->
            <div class="table-wrap">
              <table class="cat-table">
                <thead>
                  <tr>
                    <th class="th-sort" (click)="toggleSort('name')">
                      Category
                      <svg class="sort-icon" [class.active-col]="sortColumn() === 'name'" [class.dir-asc]="sortColumn() === 'name' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </th>
                    <th class="th-sort th-num" (click)="toggleSort('a')">
                      Period A
                      <svg class="sort-icon" [class.active-col]="sortColumn() === 'a'" [class.dir-asc]="sortColumn() === 'a' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </th>
                    <th class="th-sort th-num" (click)="toggleSort('b')">
                      Period B
                      <svg class="sort-icon" [class.active-col]="sortColumn() === 'b'" [class.dir-asc]="sortColumn() === 'b' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </th>
                    <th class="th-sort th-num" (click)="toggleSort('delta')">
                      Delta ($)
                      <svg class="sort-icon" [class.active-col]="sortColumn() === 'delta'" [class.dir-asc]="sortColumn() === 'delta' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </th>
                    <th class="th-sort th-num" (click)="toggleSort('delta_pct')">
                      Delta (%)
                      <svg class="sort-icon" [class.active-col]="sortColumn() === 'delta_pct'" [class.dir-asc]="sortColumn() === 'delta_pct' && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <polyline points="6,9 12,15 18,9"/>
                      </svg>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr *ngFor="let cat of sortedCategories()">
                    <td class="cat-name-cell">
                      <span class="cat-color-dot" [style.background]="cat.color || '#9B8F88'"></span>
                      {{ cat.name }}
                    </td>
                    <td class="num-cell">{{ cat.a | currency }}</td>
                    <td class="num-cell">{{ cat.b | currency }}</td>
                    <td class="num-cell">
                      <span class="delta-badge" [ngClass]="catDeltaClass(cat.delta)">
                        {{ cat.delta >= 0 ? '+' : '' }}{{ cat.delta | currency }}
                      </span>
                    </td>
                    <td class="num-cell">
                      <span class="delta-badge" [ngClass]="catDeltaClass(cat.delta)">
                        {{ cat.delta_pct >= 0 ? '+' : '' }}{{ cat.delta_pct | number:'1.1-1' }}%
                      </span>
                    </td>
                  </tr>
                  <!-- Total row -->
                  <tr class="total-row" *ngIf="result()!.categories.length > 0">
                    <td class="total-label">Total</td>
                    <td class="num-cell total-val">{{ totalA() | currency }}</td>
                    <td class="num-cell total-val">{{ totalB() | currency }}</td>
                    <td class="num-cell">
                      <span class="delta-badge" [ngClass]="catDeltaClass(totalDelta())">
                        {{ totalDelta() >= 0 ? '+' : '' }}{{ totalDelta() | currency }}
                      </span>
                    </td>
                    <td class="num-cell">
                      <span class="delta-badge" [ngClass]="catDeltaClass(totalDelta())">
                        {{ totalA() !== 0 ? ((totalDelta() / totalA()) * 100 | number:'1.1-1') + '%' : '—' }}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <!-- Mobile card list -->
            <div class="mobile-cat-list">
              <div class="mobile-cat-card" *ngFor="let cat of sortedCategories()">
                <div class="mcc-header">
                  <span class="cat-color-dot" [style.background]="cat.color || '#9B8F88'"></span>
                  <span class="mcc-name">{{ cat.name }}</span>
                </div>
                <div class="mcc-periods">
                  <div class="mcc-period">
                    <span class="mcc-period-label">Period A</span>
                    <span class="mcc-period-val">{{ cat.a | currency }}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mcc-arrow">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/>
                  </svg>
                  <div class="mcc-period">
                    <span class="mcc-period-label">Period B</span>
                    <span class="mcc-period-val">{{ cat.b | currency }}</span>
                  </div>
                </div>
                <div class="mcc-delta">
                  <span class="delta-badge" [ngClass]="catDeltaClass(cat.delta)">
                    {{ cat.delta >= 0 ? '↑' : '↓' }}
                    {{ cat.delta >= 0 ? '+' : '' }}{{ cat.delta | currency }}
                    ({{ cat.delta_pct >= 0 ? '+' : '' }}{{ cat.delta_pct | number:'1.1-1' }}%)
                  </span>
                </div>
              </div>

              <!-- Mobile total -->
              <div class="mobile-cat-card total-card" *ngIf="result()!.categories.length > 0">
                <div class="mcc-header">
                  <span class="mcc-name total-label">Total</span>
                </div>
                <div class="mcc-periods">
                  <div class="mcc-period">
                    <span class="mcc-period-label">Period A</span>
                    <span class="mcc-period-val total-val">{{ totalA() | currency }}</span>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" class="mcc-arrow">
                    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="13,6 19,12 13,18"/>
                  </svg>
                  <div class="mcc-period">
                    <span class="mcc-period-label">Period B</span>
                    <span class="mcc-period-val total-val">{{ totalB() | currency }}</span>
                  </div>
                </div>
                <div class="mcc-delta">
                  <span class="delta-badge" [ngClass]="catDeltaClass(totalDelta())">
                    {{ totalDelta() >= 0 ? '↑' : '↓' }}
                    {{ totalDelta() >= 0 ? '+' : '' }}{{ totalDelta() | currency }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Empty categories -->
            <div *ngIf="result()!.categories.length === 0" class="no-categories">
              <p class="text-secondary">No category data found for the selected periods.</p>
            </div>
          </div>
        </jiro-card>

      </div><!-- /results-body -->
    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Page layout ── */
    .comparison-page {
      max-width: 960px;
      width: 100%;
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    /* ── Header ── */
    .page-header { display: flex; flex-direction: column; gap: var(--space-xs); }

    .page-title-row {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      flex-wrap: wrap;
    }

    .back-btn {
      display: inline-flex; align-items: center; gap: var(--space-xs);
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); font-size: var(--font-size-sm);
      padding: 0; font-family: inherit;
      transition: color 0.15s;
    }
    .back-btn:hover { color: var(--text-primary); }

    .page-title {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .page-subtitle {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      margin: 0;
    }

    /* ── Selector card ── */
    .selector-card { display: flex; flex-direction: column; gap: var(--space-md); }

    .selector-label {
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
    }

    /* ── Preset toggle group ── */
    .preset-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-xs);
    }

    .preset-btn {
      padding: 7px 16px;
      border: 1px solid var(--border-color);
      border-radius: 20px;
      background: none;
      cursor: pointer;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      font-family: inherit;
      transition: all 0.15s;
      white-space: nowrap;
    }
    .preset-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .preset-btn.active {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: white;
      font-weight: 600;
    }

    /* ── Period dots ── */
    .period-dot {
      display: inline-block;
      width: 8px; height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .dot-a { background: #7A3B2E; }
    .dot-b { background: #4A6741; }

    /* ── Range summary (presets) ── */
    .range-summary {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-md);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
    }

    .range-chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    .range-sep {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* ── Custom ranges ── */
    .custom-ranges {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      padding-top: var(--space-sm);
      border-top: 1px solid var(--border-color);
    }

    .range-group { display: flex; flex-direction: column; gap: var(--space-sm); }

    .range-label {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }

    .date-inputs {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }

    .date-field { display: flex; flex-direction: column; gap: 3px; }

    .date-field-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-weight: 500;
    }

    .date-input {
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s;
    }
    .date-input:focus { border-color: var(--color-primary); }

    .date-sep {
      color: var(--text-muted);
      display: flex;
      align-items: center;
      margin-top: 18px;
    }

    .custom-apply { display: flex; justify-content: flex-end; }
    .custom-apply ::ng-deep .jiro-btn { width: auto; }

    /* ── State messages ── */
    .state-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-md);
      padding: var(--space-xl) var(--space-md);
      text-align: center;
    }

    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .state-label {
      font-size: var(--font-size-md);
      color: var(--text-secondary);
      font-weight: 500;
      margin: 0;
    }

    .state-sub {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      margin: 0;
    }

    .empty-icon { color: var(--text-muted); }

    .state-error .state-label { color: var(--color-danger); }

    /* ── Results body ── */
    .results-body {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
      animation: fadeIn 0.2s ease;
    }

    /* ── Summary grid ── */
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-md);
    }

    .summary-card { display: flex; flex-direction: column; gap: var(--space-sm); }

    .summary-card-header {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .summary-icon {
      width: 32px; height: 32px;
      border-radius: var(--border-radius);
      display: flex; align-items: center; justify-content: center;
      flex-shrink: 0;
    }
    .income-icon  { background: rgba(74, 103, 65, 0.12); color: #4A6741; }
    .expense-icon { background: rgba(193, 88, 42, 0.12); color: var(--color-danger); }
    .net-icon     { background: rgba(122, 59, 46, 0.12); color: var(--color-primary); }

    .summary-title {
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
    }

    .summary-periods {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .summary-period {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .period-val {
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--text-primary);
    }

    .negative-val { color: var(--color-danger); }

    .summary-delta {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      font-size: var(--font-size-sm);
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 12px;
      align-self: flex-start;
    }

    .delta-positive {
      background: rgba(74, 103, 65, 0.12);
      color: #3a6a31;
    }

    .delta-negative {
      background: rgba(193, 88, 42, 0.12);
      color: var(--color-danger);
    }

    .delta-neutral {
      background: var(--bg-canvas);
      color: var(--text-muted);
    }

    .delta-arrow { font-size: 12px; }

    /* ── Chart ── */
    .chart-section { display: flex; flex-direction: column; gap: var(--space-md); }

    .chart-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-sm);
    }

    .chart-title {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .chart-legend {
      display: flex;
      gap: var(--space-md);
    }

    .legend-item {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      font-weight: 500;
    }

    .legend-dot {
      width: 10px; height: 10px;
      border-radius: 2px;
      flex-shrink: 0;
    }

    .chart-wrap {
      height: 280px;
      position: relative;
    }

    .chart-wrap canvas {
      width: 100% !important;
      height: 100% !important;
    }

    /* ── Category section ── */
    .cat-section { display: flex; flex-direction: column; gap: var(--space-md); }

    .cat-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .cat-title {
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .cat-count {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      padding: 2px 8px;
      border-radius: 10px;
    }

    /* ── Desktop table ── */
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
    }

    .cat-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 560px;
      background: var(--bg-surface);
    }

    .cat-table th {
      padding: var(--space-sm) var(--space-md);
      text-align: left;
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
      white-space: nowrap;
      font-weight: 600;
    }

    .th-num { text-align: right; }

    .th-sort {
      cursor: pointer;
      user-select: none;
    }
    .th-sort:hover { color: var(--text-primary); }

    .sort-icon {
      margin-left: 3px;
      vertical-align: middle;
      opacity: 0.25;
      transition: opacity 0.15s, transform 0.15s;
    }
    .sort-icon.active-col { opacity: 1; color: var(--color-primary); }
    .sort-icon.dir-asc { transform: rotate(180deg); }

    .cat-table td {
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid var(--border-color);
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }

    .cat-table tr:last-child td { border-bottom: none; }

    .cat-table tr:hover td { background: var(--bg-canvas); }

    .cat-name-cell {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .cat-color-dot {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .num-cell {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    /* delta badges */
    .delta-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: var(--font-size-xs);
      font-weight: 600;
      white-space: nowrap;
    }

    .delta-badge.delta-positive {
      background: rgba(74, 103, 65, 0.12);
      color: #3a6a31;
    }

    .delta-badge.delta-negative {
      background: rgba(193, 88, 42, 0.12);
      color: var(--color-danger);
    }

    .delta-badge.delta-neutral {
      background: var(--bg-canvas);
      color: var(--text-muted);
    }

    /* ── Total row ── */
    .total-row td {
      font-weight: 700;
      background: var(--bg-canvas);
      border-top: 2px solid var(--border-color);
    }
    .total-label { font-weight: 700; color: var(--text-primary); }
    .total-val { color: var(--text-primary); }

    /* ── No categories ── */
    .no-categories {
      padding: var(--space-xl);
      text-align: center;
      border: 1px dashed var(--border-color);
      border-radius: var(--border-radius);
    }
    .text-secondary { color: var(--text-secondary); font-size: var(--font-size-sm); margin: 0; }

    /* ── Mobile card list ── */
    .mobile-cat-list {
      display: none;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .mobile-cat-card {
      padding: var(--space-md);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .total-card {
      background: var(--bg-surface);
      border-color: var(--color-primary);
    }

    .mcc-header {
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .mcc-name {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }

    .mcc-periods {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .mcc-period {
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    .mcc-period-label {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    .mcc-period-val {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .mcc-arrow { color: var(--text-muted); flex-shrink: 0; }

    .mcc-delta { display: flex; }

    /* ── Keyframes ── */
    @keyframes spin { to { transform: rotate(360deg); } }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* ── Responsive ── */
    @media (max-width: 720px) {
      .summary-grid { grid-template-columns: 1fr; }
      .chart-wrap { height: 200px; }

      /* Hide desktop table, show mobile cards */
      .table-wrap { display: none; }
      .mobile-cat-list { display: flex; }
    }

    @media (max-width: 520px) {
      .preset-btn { font-size: var(--font-size-xs); padding: 6px 10px; }
      .date-inputs { flex-direction: column; align-items: flex-start; }
      .date-sep { display: none; }
    }
  `],
})
export class ComparisonPageComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('compareChart') chartCanvasRef!: ElementRef<HTMLCanvasElement>;

  // ── State ──────────────────────────────────────────────────────────────────
  selectedPreset = signal<Preset>('month');
  loading        = signal(false);
  result         = signal<ComparisonResponse | null>(null);
  loadError      = signal<string | null>(null);
  activeRange    = signal<DateRange | null>(null);

  // Custom date pickers (two-way bound via ngModel)
  customAFrom = '';
  customATo   = '';
  customBFrom = '';
  customBTo   = '';

  // ── Sorting ────────────────────────────────────────────────────────────────
  sortColumn = signal<string>('delta');
  sortDir    = signal<'asc' | 'desc'>('desc');

  sortedCategories = computed(() => {
    const col = this.sortColumn();
    const dir = this.sortDir();
    const cats = this.result()?.categories ?? [];
    return [...cats].sort((a, b) => {
      const av = (a as any)[col] ?? 0;
      const bv = (b as any)[col] ?? 0;
      if (col === 'name') {
        const cmp = String(av).localeCompare(String(bv));
        return dir === 'asc' ? cmp : -cmp;
      }
      return dir === 'asc' ? av - bv : bv - av;
    });
  });

  // ── Totals ─────────────────────────────────────────────────────────────────
  totalA = computed(() =>
    (this.result()?.categories ?? []).reduce((acc, c) => acc + c.a, 0)
  );

  totalB = computed(() =>
    (this.result()?.categories ?? []).reduce((acc, c) => acc + c.b, 0)
  );

  totalDelta = computed(() => this.totalB() - this.totalA());

  // ── Delta class helpers ────────────────────────────────────────────────────
  incomeDeltaClass = computed(() => {
    const d = this.result()?.summary.income.delta ?? 0;
    if (d > 0) return 'delta-positive';
    if (d < 0) return 'delta-negative';
    return 'delta-neutral';
  });

  expenseDeltaClass = computed(() => {
    // For expenses: negative delta (less spending) = green, positive = red
    const d = this.result()?.summary.expenses.delta ?? 0;
    if (d < 0) return 'delta-positive';
    if (d > 0) return 'delta-negative';
    return 'delta-neutral';
  });

  netDeltaClass = computed(() => {
    const d = this.result()?.summary.net.delta ?? 0;
    if (d > 0) return 'delta-positive';
    if (d < 0) return 'delta-negative';
    return 'delta-neutral';
  });

  private chart: Chart | null = null;
  private dataReady  = false;
  private viewReady  = false;

  constructor(private ledgerService: LedgerService) {}

  // ── Lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    // Auto-load with the default preset on init
    this.selectPreset('month');
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.maybeDrawChart();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  // ── Preset selection ───────────────────────────────────────────────────────
  selectPreset(preset: Preset): void {
    this.selectedPreset.set(preset);
    if (preset === 'custom') return;

    const range = computePresetRanges(preset);
    if (!range) return;
    this.activeRange.set(range);
    this.fetch(range.aFrom, range.aTo, range.bFrom, range.bTo);
  }

  applyCustom(): void {
    if (!this.customAFrom || !this.customATo || !this.customBFrom || !this.customBTo) return;
    this.activeRange.set({
      aFrom: this.customAFrom,
      aTo:   this.customATo,
      bFrom: this.customBFrom,
      bTo:   this.customBTo,
    });
    this.fetch(this.customAFrom, this.customATo, this.customBFrom, this.customBTo);
  }

  // ── Data fetch ─────────────────────────────────────────────────────────────
  private fetch(aFrom: string, aTo: string, bFrom: string, bTo: string): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.result.set(null);
    this.dataReady = false;

    this.ledgerService.getComparison(aFrom, aTo, bFrom, bTo).subscribe({
      next: data => {
        this.result.set(data);
        this.loading.set(false);
        this.dataReady = true;
        // Give Angular one tick to render the canvas before drawing
        setTimeout(() => this.maybeDrawChart(), 0);
      },
      error: (err) => {
        this.loadError.set(err?.error?.error ?? 'An error occurred. Please try again.');
        this.loading.set(false);
      },
    });
  }

  // ── Chart ──────────────────────────────────────────────────────────────────
  private maybeDrawChart(): void {
    if (!this.dataReady || !this.viewReady || !this.chartCanvasRef) return;

    const res = this.result();
    if (!res) return;

    if (this.chart) { this.chart.destroy(); this.chart = null; }

    const labels = ['Income', 'Expenses', 'Net Cashflow'];
    const aData  = [res.summary.income.a, res.summary.expenses.a, res.summary.net.a];
    const bData  = [res.summary.income.b, res.summary.expenses.b, res.summary.net.b];

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Period A',
            data: aData,
            backgroundColor: '#7A3B2E',
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: 'Period B',
            data: bData,
            backgroundColor: '#4A6741',
            borderRadius: 4,
            borderSkipped: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const val = ctx.parsed.y ?? 0;
                const sign = val < 0 ? '-' : '';
                return ` ${ctx.dataset.label}: ${sign}$${Math.abs(val).toFixed(2)}`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: { font: { size: 12 }, color: '#6B5E57' },
          },
          y: {
            grid: { color: 'rgba(0,0,0,0.04)' },
            ticks: {
              font: { size: 11 },
              color: '#9B8F88',
              callback: v => `$${Number(v).toLocaleString()}`,
            },
          },
        },
      },
    };

    this.chart = new Chart(this.chartCanvasRef.nativeElement, config);
  }

  // ── Sorting ────────────────────────────────────────────────────────────────
  toggleSort(col: string): void {
    if (this.sortColumn() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDir.set('desc');
    }
  }

  // ── Category delta class ───────────────────────────────────────────────────
  // Without category type context we treat a positive delta as negative
  // (more spending / less income) and a negative delta as positive (improvement).
  // This is conservative — the badge is at least consistently meaningful.
  catDeltaClass(delta: number): string {
    if (delta < 0) return 'delta-positive';
    if (delta > 0) return 'delta-negative';
    return 'delta-neutral';
  }

  // ── Formatting ─────────────────────────────────────────────────────────────
  formatDelta(delta: number, deltaPct: number): string {
    const sign = delta >= 0 ? '+' : '';
    return `${sign}$${Math.abs(delta).toFixed(2)} (${sign}${deltaPct.toFixed(1)}%)`;
  }
}
