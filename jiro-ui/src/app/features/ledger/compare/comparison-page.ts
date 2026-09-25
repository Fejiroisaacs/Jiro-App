import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { chartTones } from '../../../shared/chart-theme';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { LedgerService, ComparisonResponse, ComparisonCategory, ComparisonValue } from '../../../core/services/ledger.service';
import { formatCurrency, formatPctChange, formatSignedCurrency, parseDateOnly } from '../shared/ledger-utils';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { SettingsService } from '../../../core/services/settings.service';
import { todayKey } from '../../../core/utils/day';

Chart.register(...registerables);

type Preset = 'month' | 'week' | 'quarter' | 'custom';

interface DateRange {
  aFrom: string;
  aTo: string;
  bFrom: string;
  bTo: string;
}

/**
 * The calendar date a Date's local fields name, as YYYY-MM-DD. The ranges
 * below are built with local-field arithmetic, so reading them back through
 * toISOString (UTC) would shift every bound a day early east of UTC.
 */
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The preset's two periods. A is the previous period (the base) and B the
 * current one, so the change (B - A) reads naturally: up means the current
 * period is higher. `today` is the user's day key (settings zone).
 */
export function computePresetRanges(preset: Preset, today: string): DateRange | null {
  const [ty, tm, td] = today.split('-').map(Number);
  const now = new Date(ty, tm - 1, td);
  if (preset === 'month') {
    return {
      aFrom: isoDate(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
      aTo:   isoDate(new Date(now.getFullYear(), now.getMonth(), 0)),
      bFrom: isoDate(new Date(now.getFullYear(), now.getMonth(), 1)),
      bTo:   isoDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
    };
  }
  if (preset === 'week') {
    const day = now.getDay(); // 0=Sun
    const monday = new Date(now); monday.setDate(now.getDate() - ((day + 6) % 7));
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const lastMonday = new Date(monday); lastMonday.setDate(monday.getDate() - 7);
    const lastSunday = new Date(lastMonday); lastSunday.setDate(lastMonday.getDate() + 6);
    return {
      aFrom: isoDate(lastMonday),
      aTo:   isoDate(lastSunday),
      bFrom: isoDate(monday),
      bTo:   isoDate(sunday),
    };
  }
  if (preset === 'quarter') {
    const q = Math.floor(now.getMonth() / 3);
    const prevQ = q === 0 ? 3 : q - 1;
    const prevYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
    return {
      aFrom: isoDate(new Date(prevYear, prevQ * 3, 1)),
      aTo:   isoDate(new Date(prevYear, prevQ * 3 + 3, 0)),
      bFrom: isoDate(new Date(now.getFullYear(), q * 3, 1)),
      bTo:   isoDate(new Date(now.getFullYear(), q * 3 + 3, 0)),
    };
  }
  return null;
}

/** The two periods' names for each preset: [earlier, later]. */
const PRESET_NAMES: Record<Preset, [string, string]> = {
  month:   ['Last month', 'This month'],
  week:    ['Last week', 'This week'],
  quarter: ['Last quarter', 'This quarter'],
  custom:  ['Period A', 'Period B'],
};

type SortColumn = 'name' | 'a' | 'b' | 'delta' | 'delta_pct';

@Component({
  selector: 'app-comparison-page',
  standalone: true,
  imports: [
    CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent,
    JiroPageHeaderComponent, JiroEmptyStateComponent,
  ],
  template: `
    <div class="comparison-page">

      <!-- ── Header ── -->
      <jiro-page-header heading="Compare periods" subtitle="See how your money changed from one period to the next" />

      <!-- ── Period Selector ── -->
      <jiro-card>
        <div class="selector-card">
          <div class="selector-label" id="compare-presets">Compare</div>

          <!-- Preset toggle group -->
          <div class="preset-group" role="group" aria-labelledby="compare-presets">
            <button type="button" class="preset-btn" [class.active]="selectedPreset() === 'month'" [attr.aria-pressed]="selectedPreset() === 'month'" (click)="selectPreset('month')">
              This month vs last
            </button>
            <button type="button" class="preset-btn" [class.active]="selectedPreset() === 'week'" [attr.aria-pressed]="selectedPreset() === 'week'" (click)="selectPreset('week')">
              This week vs last
            </button>
            <button type="button" class="preset-btn" [class.active]="selectedPreset() === 'quarter'" [attr.aria-pressed]="selectedPreset() === 'quarter'" (click)="selectPreset('quarter')">
              This quarter vs last
            </button>
            <button type="button" class="preset-btn" [class.active]="selectedPreset() === 'custom'" [attr.aria-pressed]="selectedPreset() === 'custom'" (click)="selectPreset('custom')">
              Custom
            </button>
          </div>

          <!-- Custom date pickers -->
          @if (selectedPreset() === 'custom') {
<div class="custom-ranges">
            <p class="custom-help">Period A is the one you compare against; the change shows how Period B differs from it.</p>
            <fieldset class="range-group">
              <legend class="range-label">
                <span class="period-dot dot-a" aria-hidden="true"></span>
                Period A (earlier)
              </legend>
              <div class="date-inputs">
                <div class="date-field">
                  <label class="date-field-label" for="cmp-a-from">From</label>
                  <input id="cmp-a-from" type="date" class="date-input" [(ngModel)]="customAFrom" />
                </div>
                <div class="date-field">
                  <label class="date-field-label" for="cmp-a-to">To</label>
                  <input id="cmp-a-to" type="date" class="date-input" [(ngModel)]="customATo" />
                </div>
              </div>
            </fieldset>

            <fieldset class="range-group">
              <legend class="range-label">
                <span class="period-dot dot-b" aria-hidden="true"></span>
                Period B (later)
              </legend>
              <div class="date-inputs">
                <div class="date-field">
                  <label class="date-field-label" for="cmp-b-from">From</label>
                  <input id="cmp-b-from" type="date" class="date-input" [(ngModel)]="customBFrom" />
                </div>
                <div class="date-field">
                  <label class="date-field-label" for="cmp-b-to">To</label>
                  <input id="cmp-b-to" type="date" class="date-input" [(ngModel)]="customBTo" />
                </div>
              </div>
            </fieldset>

            <div class="custom-apply">
              <jiro-button variant="primary" type="button" [loading]="loading()" (click)="applyCustom()">
                Compare
              </jiro-button>
            </div>
          </div>
}

          <!-- Active range summary (shown for presets) -->
          @if (selectedPreset() !== 'custom' && activeRange()) {
<div class="range-summary">
            <span class="range-chip">
              <span class="period-dot dot-a" aria-hidden="true"></span>
              {{ names()[0] }}: {{ rangeText(activeRange()!.aFrom, activeRange()!.aTo) }}
            </span>
            <span class="range-sep">then</span>
            <span class="range-chip">
              <span class="period-dot dot-b" aria-hidden="true"></span>
              {{ names()[1] }}: {{ rangeText(activeRange()!.bFrom, activeRange()!.bTo) }}
            </span>
          </div>
}
        </div>
      </jiro-card>

      <!-- ── Loading ── -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- ── Empty / No data state ── -->
      @if (!loading() && !result() && !loadError()) {
        <jiro-empty-state
          icon="arrows-left-right"
          heading="Select a period to compare"
          message="Choose a preset above, or enter two custom date ranges." />
      }

      <!-- ── Error state ── -->
      @if (!loading() && loadError()) {
        <jiro-empty-state
          icon="warning-circle"
          heading="Could not load the comparison"
          [message]="loadError()!" />
      }

      <!-- ── Results ── -->
      @if (!loading() && result(); as res) {
<div class="results-body">

        <!-- Summary cards -->
        <div class="summary-grid">
          @for (card of summaryCards(); track card.key) {
            <jiro-card>
              <div class="summary-card">
                <div class="summary-card-header">
                  <span class="summary-title">{{ card.title }}</span>
                </div>
                <dl class="summary-periods">
                  <div class="summary-period">
                    <dt><span class="period-dot dot-a" aria-hidden="true"></span>{{ names()[0] }}</dt>
                    <dd class="period-val" [class.negative-val]="card.value.a < 0">{{ money(card.value.a) }}</dd>
                  </div>
                  <div class="summary-period">
                    <dt><span class="period-dot dot-b" aria-hidden="true"></span>{{ names()[1] }}</dt>
                    <dd class="period-val" [class.negative-val]="card.value.b < 0">{{ money(card.value.b) }}</dd>
                  </div>
                </dl>
                <p class="summary-delta" [ngClass]="deltaClass(card.value.delta, card.upIsGood)">
                  {{ changeSentence(card.value) }}
                </p>
              </div>
            </jiro-card>
          }
        </div>

        <!-- ── Bar Chart ── -->
        <jiro-card>
          <div class="chart-section">
            <div class="chart-header">
              <h2 class="chart-title">Period overview</h2>
              <div class="chart-legend">
                <span class="legend-item">
                  <span class="legend-dot" [style.background]="seriesColors().a" aria-hidden="true"></span>
                  {{ names()[0] }}
                </span>
                <span class="legend-item">
                  <span class="legend-dot" [style.background]="seriesColors().b" aria-hidden="true"></span>
                  {{ names()[1] }}
                </span>
              </div>
            </div>
            <div class="chart-wrap">
              <canvas #compareChart role="img" [attr.aria-label]="chartLabel()"></canvas>
            </div>
          </div>
        </jiro-card>

        <!-- ── Category detail ── -->
        <jiro-card>
          <div class="cat-section">
            <div class="cat-header">
              <h2 class="cat-title">By category</h2>
              <span class="cat-count">{{ res.categories.length }} {{ res.categories.length === 1 ? 'category' : 'categories' }}</span>
            </div>

            <!-- Desktop table: each header is a sort button -->
            @if (res.categories.length > 0) {
            <div class="table-wrap">
              <table class="cat-table">
                <caption class="sr-only">Income and spending by category, {{ names()[0] }} then {{ names()[1] }}</caption>
                <thead>
                  <tr>
                    @for (col of columns(); track col.key) {
                      <th scope="col" [class.th-num]="col.key !== 'name'" [attr.aria-sort]="ariaSort(col.key)">
                        <button type="button" class="sort-btn" (click)="toggleSort(col.key)">
                          {{ col.label }}
                          <svg class="sort-icon" [class.active-col]="sortColumn() === col.key" [class.dir-asc]="sortColumn() === col.key && sortDir() === 'asc'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                            <polyline points="6,9 12,15 18,9"/>
                          </svg>
                        </button>
                      </th>
                    }
                  </tr>
                </thead>
                <tbody>
                  @for (cat of sortedCategories(); track cat.type + (cat.category_id ?? 'none')) {
<tr>
                    <th scope="row" class="cat-name-cell">
                      <span class="cat-color-dot" aria-hidden="true" [style.background]="cat.color || 'var(--text-muted)'"></span>
                      <span class="cat-name-text">{{ cat.name }}</span>
                      <span class="cat-type">{{ cat.type === 'income' ? 'Income' : 'Spending' }}</span>
                    </th>
                    <td class="num-cell">{{ money(cat.a) }}</td>
                    <td class="num-cell">{{ money(cat.b) }}</td>
                    <td class="num-cell">
                      <span class="delta-badge" [ngClass]="deltaClass(cat.delta, cat.type === 'income')">{{ signed(cat.delta) }}</span>
                    </td>
                    <td class="num-cell">
                      <span class="delta-badge" [ngClass]="deltaClass(cat.delta, cat.type === 'income')">{{ pct(cat.delta_pct, cat.b) }}</span>
                    </td>
                  </tr>
}
                </tbody>
              </table>
            </div>

            <!-- Mobile card list -->
            <ul class="mobile-cat-list">
              @for (cat of sortedCategories(); track cat.type + (cat.category_id ?? 'none')) {
<li class="mobile-cat-card">
                <div class="mcc-header">
                  <span class="cat-color-dot" aria-hidden="true" [style.background]="cat.color || 'var(--text-muted)'"></span>
                  <span class="mcc-name">{{ cat.name }}</span>
                  <span class="cat-type">{{ cat.type === 'income' ? 'Income' : 'Spending' }}</span>
                </div>
                <dl class="mcc-periods">
                  <div class="mcc-period">
                    <dt class="mcc-period-label">{{ names()[0] }}</dt>
                    <dd class="mcc-period-val">{{ money(cat.a) }}</dd>
                  </div>
                  <div class="mcc-period">
                    <dt class="mcc-period-label">{{ names()[1] }}</dt>
                    <dd class="mcc-period-val">{{ money(cat.b) }}</dd>
                  </div>
                </dl>
                <div class="mcc-delta">
                  <span class="delta-badge" [ngClass]="deltaClass(cat.delta, cat.type === 'income')">
                    {{ signed(cat.delta) }} ({{ pct(cat.delta_pct, cat.b) }})
                  </span>
                </div>
              </li>
}
            </ul>
            }

            <!-- Empty categories -->
            @if (res.categories.length === 0) {
<div class="no-categories">
              <p class="text-secondary">No income or spending in either period.</p>
            </div>
}
          </div>
        </jiro-card>

      </div>
}<!-- /results-body -->
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
    .dot-a { background: var(--color-primary); }
    .dot-b { background: var(--color-accent); }

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

    /* ── State messages ── */
    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }




    .empty-icon { color: var(--text-muted); }


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
    .income-icon  { background: rgba(var(--color-accent-rgb), 0.12); color: var(--color-accent); }
    .expense-icon { background: rgba(var(--color-danger-rgb), 0.12); color: var(--color-danger); }
    .net-icon     { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }

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
      background: rgba(var(--color-accent-rgb), 0.12);
      color: var(--color-accent);
    }

    .delta-negative {
      background: rgba(var(--color-danger-rgb), 0.12);
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

    .sort-btn {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      min-height: 32px;
      padding: 0;
      border: none;
      background: none;
      font: inherit;
      color: inherit;
      text-transform: inherit;
      letter-spacing: inherit;
      cursor: pointer;
    }
    .sort-btn:hover { color: var(--text-primary); }
    .sort-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .th-num .sort-btn { justify-content: flex-end; width: 100%; }

    .cat-type {
      font-size: var(--font-size-xs);
      font-weight: 500;
      color: var(--text-muted);
      white-space: nowrap;
    }
    .cat-name-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; }

    .custom-help { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0; }
    fieldset.range-group { border: none; margin: 0; padding: 0; min-width: 0; }
    dl, dd { margin: 0; }
    .summary-period dt { display: inline-flex; align-items: center; gap: 6px; font-size: var(--font-size-xs); color: var(--text-muted); }
    .summary-delta { margin: 0; }

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
      font-weight: 500;
      text-align: left;
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
      background: rgba(var(--color-accent-rgb), 0.12);
      color: var(--color-accent);
    }

    .delta-badge.delta-negative {
      background: rgba(var(--color-danger-rgb), 0.12);
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

  /**
   * The two period colours, read once per redraw so the legend dots and the
   * chart bars come from the same place and cannot drift apart.
   */
  seriesColors = signal<{ a: string; b: string }>({ a: 'var(--color-primary)', b: 'var(--color-accent)' });

  // ── Sorting ────────────────────────────────────────────────────────────────
  sortColumn = signal<SortColumn>('delta');
  sortDir    = signal<'asc' | 'desc'>('desc');

  /** The two periods' names: "Last month" / "This month", or "Period A" / "Period B" for custom ranges. */
  names = computed(() => PRESET_NAMES[this.selectedPreset()]);

  columns = computed<{ key: SortColumn; label: string }[]>(() => [
    { key: 'name', label: 'Category' },
    { key: 'a', label: this.names()[0] },
    { key: 'b', label: this.names()[1] },
    { key: 'delta', label: 'Change' },
    { key: 'delta_pct', label: 'Change %' },
  ]);

  sortedCategories = computed(() => {
    const col = this.sortColumn();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    const cats = this.result()?.categories ?? [];
    const value = (c: ComparisonCategory): number => {
      if (col === 'delta_pct') {
        // "new" (no base) sorts above every percentage, "n/a" below.
        if (c.delta_pct === null) return c.b !== 0 ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER;
        return c.delta_pct;
      }
      return col === 'name' ? 0 : c[col];
    };
    return [...cats].sort((a, b) => {
      if (col === 'name') return dir * a.name.localeCompare(b.name);
      return dir * (value(a) - value(b)) || a.name.localeCompare(b.name);
    });
  });

  /** Income, spending and net, each with whether a rise is good news. */
  summaryCards = computed(() => {
    const s = this.result()?.summary;
    if (!s) return [];
    return [
      { key: 'income', title: 'Income', value: s.income, upIsGood: true },
      { key: 'expenses', title: 'Spending', value: s.expenses, upIsGood: false },
      { key: 'net', title: 'Net cash flow', value: s.net, upIsGood: true },
    ];
  });

  chartLabel = computed(() => {
    const s = this.result()?.summary;
    if (!s) return 'Comparison chart';
    const [a, b] = this.names();
    return `Bar chart. Income: ${a} ${this.money(s.income.a)}, ${b} ${this.money(s.income.b)}. `
      + `Spending: ${a} ${this.money(s.expenses.a)}, ${b} ${this.money(s.expenses.b)}. `
      + `Net cash flow: ${a} ${this.money(s.net.a)}, ${b} ${this.money(s.net.b)}.`;
  });

  private chart: Chart | null = null;
  private dataReady  = false;
  private viewReady  = false;

  private readonly settings = inject(SettingsService);

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

    const range = computePresetRanges(preset, todayKey(this.settings.timezone()));
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

    // Read at draw time so a theme or dark-mode change lands on the next redraw.
    const tone = chartTones();
    this.seriesColors.set({ a: tone.primary, b: tone.accent });
    const labels = ['Income', 'Spending', 'Net cash flow'];
    const [nameA, nameB] = this.names();
    const aData  = [res.summary.income.a, res.summary.expenses.a, res.summary.net.a];
    const bData  = [res.summary.income.b, res.summary.expenses.b, res.summary.net.b];

    const config: ChartConfiguration = {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: nameA,
            data: aData,
            backgroundColor: tone.primary,
            borderRadius: 4,
            borderSkipped: false,
          },
          {
            label: nameB,
            data: bData,
            backgroundColor: tone.accent,
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
              label: ctx => ` ${ctx.dataset.label}: ${this.money(ctx.parsed.y ?? 0)}`,
            },
          },
        },
        scales: {
          x: {
            grid: { color: tone.grid },
            ticks: { font: { size: 12 }, color: tone.tick },
          },
          y: {
            grid: { color: tone.grid },
            ticks: {
              font: { size: 11 },
              color: tone.muted,
              callback: v => new Intl.NumberFormat('en-US', { style: 'currency', currency: this.settings.currency(), maximumFractionDigits: 0 }).format(Number(v)),
            },
          },
        },
      },
    };

    this.chart = new Chart(this.chartCanvasRef.nativeElement, config);
  }

  // ── Sorting ────────────────────────────────────────────────────────────────
  toggleSort(col: SortColumn): void {
    if (this.sortColumn() === col) {
      this.sortDir.set(this.sortDir() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortColumn.set(col);
      this.sortDir.set('desc');
    }
  }

  ariaSort(col: SortColumn): 'ascending' | 'descending' | 'none' {
    if (this.sortColumn() !== col) return 'none';
    return this.sortDir() === 'asc' ? 'ascending' : 'descending';
  }

  // ── Formatting ─────────────────────────────────────────────────────────────

  /** Green when the change is good news: more income, or less spending. */
  deltaClass(delta: number, upIsGood: boolean): string {
    if (delta === 0) return 'delta-neutral';
    return (delta > 0) === upIsGood ? 'delta-positive' : 'delta-negative';
  }

  money(v: number): string {
    return formatCurrency(v, this.settings.currency());
  }

  signed(v: number): string {
    return formatSignedCurrency(v, this.settings.currency());
  }

  pct(p: number | null, current: number): string {
    return formatPctChange(p, current);
  }

  /** "Up $120.00 (+12.5%) on last month", "Down ...", "No change ...", or "New ..." from zero. */
  changeSentence(v: ComparisonValue): string {
    const [earlier] = this.names();
    const base = this.selectedPreset() === 'custom' ? 'on Period A' : `on ${earlier.toLowerCase()}`;
    if (v.delta === 0) return `No change ${base}`;
    const amount = this.money(Math.abs(v.delta));
    const pct = formatPctChange(v.delta_pct, v.b);
    const dir = v.delta > 0 ? 'Up' : 'Down';
    return pct === 'new' || pct === 'n/a'
      ? `${dir} ${amount} ${base} (${pct === 'new' ? 'nothing before' : 'n/a'})`
      : `${dir} ${amount} (${pct}) ${base}`;
  }

  rangeText(from: string, to: string): string {
    const fmt = (s: string) => parseDateOnly(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(from)} to ${fmt(to)}`;
  }
}
