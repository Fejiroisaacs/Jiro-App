import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BodyWeight } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { WIDGET_BY_ID } from '../widget-catalog';
import { WIDGET_TEXT_STYLES, WidgetData, WidgetShellComponent, widgetState } from './widget-shell';
import { daysAgo, plural } from './format';

const DAY_MS = 86_400_000;
const WINDOW_DAYS = 30;

/** Sparkline drawing box; the SVG stretches it to the card width. */
const VB_W = 100;
const VB_H = 40;
const VB_PAD = 3;

function fmt(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

@Component({
  selector: 'dash-body-weight-widget',
  standalone: true,
  imports: [RouterLink, WidgetShellComponent, JiroButtonComponent, JiroEmptyStateComponent],
  template: `
    <dash-widget-shell [def]="def" [state]="state()">
      @if (data()) {
        @if (view(); as v) {
          <div class="bw" role="img" [attr.aria-label]="v.label">
            <p class="tile-num">{{ v.latest }}<span class="tile-unit">{{ v.unit }}</span></p>
            <p class="tile-sub">{{ v.change }}</p>
            @if (v.points) {
              <svg class="spark" [attr.viewBox]="viewBox" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                <polyline [attr.points]="v.points" />
              </svg>
            }
          </div>
          <p class="tile-muted">Last weighed {{ v.when }}</p>
          <div class="tile-action">
            <jiro-button variant="secondary" routerLink="/jym/track" [queryParams]="{ tab: 'bodyweight' }">Log weight</jiro-button>
          </div>
        } @else {
          <jiro-empty-state compact heading="No weigh-ins yet" message="Log your weight to see the trend here.">
            <jiro-button size="sm" routerLink="/jym/track" [queryParams]="{ tab: 'bodyweight' }">Log your weight</jiro-button>
          </jiro-empty-state>
        }
      }
    </dash-widget-shell>
  `,
  styles: [WIDGET_TEXT_STYLES, `
    .bw { margin-bottom: var(--space-xs); }
    .spark {
      display: block;
      width: 100%;
      height: 40px;
      margin-top: var(--space-sm);
      overflow: visible;
    }
    .spark polyline {
      fill: none;
      stroke: var(--color-primary);
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
      vector-effect: non-scaling-stroke;
    }
  `],
})
export class BodyWeightWidgetComponent {
  private readonly settings = inject(SettingsService);

  data = input<WidgetData<BodyWeight[]>>(undefined);

  readonly def = WIDGET_BY_ID.get('body_weight')!;
  readonly state = computed(() => widgetState(this.data()));
  readonly viewBox = `0 0 ${VB_W} ${VB_H}`;

  readonly view = computed(() => {
    const list = this.data();
    if (!list || list.length === 0) return null;

    const unit = this.settings.unitLabel();
    const entries = list
      .map(e => ({ t: new Date(e.recorded_at).getTime(), kg: e.weight_kg, at: e.recorded_at }))
      .filter(e => Number.isFinite(e.t))
      .sort((a, b) => a.t - b.t);
    if (entries.length === 0) return null;

    const latest = entries[entries.length - 1];
    const latestDisplay = this.settings.toDisplay(latest.kg);

    // Compare with the weigh-in nearest to 30 days before today.
    const target = Date.now() - WINDOW_DAYS * DAY_MS;
    let prev: (typeof entries)[number] | null = null;
    for (const e of entries.slice(0, -1)) {
      if (!prev || Math.abs(e.t - target) < Math.abs(prev.t - target)) prev = e;
    }

    let change = 'No earlier weigh-in to compare with';
    let spoken = '';
    const days = prev ? Math.round((latest.t - prev.t) / DAY_MS) : 0;
    if (prev && days > 0) {
      // Convert both values first, then subtract, so the delta matches what is shown.
      const delta = Math.round((latestDisplay - this.settings.toDisplay(prev.kg)) * 10) / 10;
      const span = plural(days, 'day', 'days');
      if (delta === 0) {
        change = `No change over ${span}`;
      } else {
        change = `${delta < 0 ? 'Down' : 'Up'} ${fmt(Math.abs(delta))} ${unit} over ${span}`;
      }
      spoken = `, ${change.charAt(0).toLowerCase()}${change.slice(1)}`;
    }

    return {
      latest: fmt(latestDisplay),
      unit,
      change,
      when: daysAgo(latest.at),
      label: `Body weight ${fmt(latestDisplay)} ${unit}${spoken}`,
      points: sparkline(entries.filter(e => e.t >= Date.now() - WINDOW_DAYS * DAY_MS)),
    };
  });
}

/** Polyline points for the last 30 days, or null with fewer than two weigh-ins. */
function sparkline(entries: { t: number; kg: number }[]): string | null {
  if (entries.length < 2) return null;
  const t0 = entries[0].t;
  const tSpan = entries[entries.length - 1].t - t0 || 1;
  const kgs = entries.map(e => e.kg);
  const min = Math.min(...kgs);
  const range = Math.max(...kgs) - min;
  const innerH = VB_H - VB_PAD * 2;
  return entries
    .map(e => {
      const x = ((e.t - t0) / tSpan) * VB_W;
      const y = range === 0 ? VB_H / 2 : VB_PAD + (1 - (e.kg - min) / range) * innerH;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
