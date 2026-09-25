import { Component, computed, inject, input } from '@angular/core';
import { SettingsService } from '../../../core/services/settings.service';
import { RouterLink } from '@angular/router';
import { DashboardLedger } from '../../../core/services/dashboard.service';
import { formatCurrency, formatSignedCurrency } from '../../ledger/shared/ledger-utils';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';

@Component({
  selector: 'dash-ledger-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent, JiroButtonComponent, JiroEmptyStateComponent, JiroIconComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()" skeleton="month">
      @if (data(); as d) {
        @if (!d.hasAccounts) {
          <jiro-empty-state compact heading="No accounts yet" message="Add an account to start tracking income, spending and budgets.">
            <jiro-button size="sm" routerLink="/ledger/accounts">Add your first account</jiro-button>
          </jiro-empty-state>
        } @else {
          <div class="mo-grid">
            <div class="mo-main">
              @if (d.summary; as s) {
                <span class="mo-label">Net this month</span>
                <span class="mo-net" [class.pos]="s.net > 0" [class.neg]="s.net < 0">{{ signed(s.net) }}</span>
                <div class="mo-rows">
                  <div class="mo-row"><span>Income</span><b>{{ money(s.income) }}</b></div>
                  <div class="mo-row"><span>Expenses</span><b>{{ money(s.expenses) }}</b></div>
                  <div class="mo-row"><span>Savings rate</span><b>{{ s.savings_rate.toFixed(1) }}%</b></div>
                </div>
              } @else {
                <p class="tile-muted">The monthly summary could not be loaded.</p>
              }
            </div>
            <div class="mo-budgets">
              <span class="mo-label">Budgets</span>
              @if (d.budgets.length === 0) {
                <p class="tile-sub">No budgets yet. <a routerLink="/ledger/budgets">Create one</a></p>
              }
              @for (b of d.budgets; track b.id) {
                <div class="bud">
                  <div class="bud-top">
                    <span class="bud-name">{{ b.category_name }}</span>
                    <span class="bud-pct" [class.warn]="b.pct_used >= 80 && b.pct_used < 100" [class.over]="b.pct_used >= 100">{{ pct(b.pct_used) }}%</span>
                  </div>
                  <div class="bud-track">
                    <div class="bud-fill" [style.width.%]="clampPct(b.pct_used)" [class.warn]="b.pct_used >= 80 && b.pct_used < 100" [class.over]="b.pct_used >= 100"></div>
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="tile-action">
            <a class="tile-link" routerLink="/ledger">Open ledger <jiro-icon name="arrow-right" [size]="14" /></a>
          </div>
        }
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES, `
    .mo-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      gap: var(--space-xl);
    }
    .mo-label { display: block; font-size: var(--font-size-xs); color: var(--text-muted); margin-bottom: var(--space-xs); }
    .mo-net {
      display: block;
      font-family: var(--font-family-display);
      font-size: var(--font-size-3xl);
      font-weight: 600;
      line-height: 1;
      font-variant-numeric: tabular-nums;
      color: var(--text-primary);
      margin-bottom: var(--space-md);
    }
    .mo-net.pos { color: var(--color-positive); }
    .mo-net.neg { color: var(--color-negative); }
    .mo-rows { display: flex; flex-direction: column; gap: 6px; max-width: 280px; }
    .mo-row { display: flex; justify-content: space-between; font-size: var(--font-size-sm); color: var(--text-secondary); }
    .mo-row b { color: var(--text-primary); font-weight: 600; font-variant-numeric: tabular-nums; }

    .bud { margin-top: var(--space-sm); }
    .bud-top { display: flex; justify-content: space-between; font-size: var(--font-size-sm); margin-bottom: 4px; }
    .bud-name { color: var(--text-primary); }
    .bud-pct { color: var(--text-secondary); font-variant-numeric: tabular-nums; }
    .bud-pct.warn { color: var(--color-warning); }
    .bud-pct.over { color: var(--color-negative); }
    .bud-track { height: 6px; border-radius: var(--border-radius-pill); background: var(--bg-surface-hover); overflow: hidden; }
    .bud-fill { height: 100%; border-radius: var(--border-radius-pill); background: var(--color-positive); transition: width 0.3s ease; }
    .bud-fill.warn { background: var(--color-warning); }
    .bud-fill.over { background: var(--color-negative); }
    .tile-action { padding-top: var(--space-sm); }

    @media (max-width: 900px) {
      .mo-grid { grid-template-columns: 1fr; gap: var(--space-lg); }
    }
  `],
})
export class LedgerWidgetComponent {
  data = input<WidgetData<DashboardLedger>>(undefined);

  readonly def = WIDGET_BY_ID.get('ledger_month')!;
  readonly state = computed(() => widgetState(this.data()));

  private readonly settings = inject(SettingsService);

  /** Amounts in the user's one currency (Settings). */
  money(v: number): string { return formatCurrency(v, this.settings.currency()); }
  signed(v: number): string { return formatSignedCurrency(v, this.settings.currency()); }
  pct(v: number): number { return Math.round(v); }
  clampPct(v: number): number { return Math.max(0, Math.min(100, v)); }
}
