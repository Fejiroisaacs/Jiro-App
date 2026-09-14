import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DashboardService, DashboardData, utcDateKey } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { MODULES } from '../../core/navigation';
import { formatCurrency, formatSignedCurrency } from '../ledger/shared/ledger-utils';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroSkeletonComponent } from '../../shared/components/jiro-skeleton/jiro-skeleton';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';

interface ActivityDay {
  key: string;
  label: string;
  workout: boolean;
  journal: boolean;
  today: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink, JiroPageHeaderComponent, JiroCardComponent, JiroButtonComponent,
    JiroEmptyStateComponent, JiroSkeletonComponent, JiroMarkComponent, JiroIconComponent,
  ],
  template: `
    <div class="dash">
      <jiro-page-header [heading]="greeting()" [subtitle]="dateLabel" />

      @if (loading()) {
        <section class="today" aria-busy="true" aria-label="Loading">
          @for (i of [1, 2, 3]; track i) {
            <jiro-card>
              <jiro-skeleton height="12px" width="35%" />
              <jiro-skeleton height="34px" width="60%" />
              <jiro-skeleton [lines]="2" />
            </jiro-card>
          }
        </section>
        <jiro-card class="month-card">
          <jiro-skeleton height="12px" width="25%" />
          <jiro-skeleton height="40px" width="40%" />
          <jiro-skeleton [lines]="3" />
        </jiro-card>
      } @else if (data(); as d) {

        <!-- Today -->
        <section class="today" aria-label="Today">
          <jiro-card>
            <div class="tile-head"><jiro-mark name="jym" [size]="22" /><span>Workout</span></div>
            @if (!d.jym) {
              <p class="tile-muted">Jym is not available right now.</p>
            } @else if (d.jym.inProgress) {
              <p class="tile-big">{{ d.jym.inProgress.routine_name || 'Freestyle session' }}</p>
              <p class="tile-sub">In progress, started {{ ago(d.jym.inProgress.started_at) }}, {{ d.jym.inProgress.set_count }} {{ d.jym.inProgress.set_count === 1 ? 'set' : 'sets' }} logged</p>
              <div class="tile-action"><jiro-button [routerLink]="['/jym/session', d.jym.inProgress.id]">Resume</jiro-button></div>
            } @else if (d.jym.lastCompleted) {
              <p class="tile-big">{{ d.jym.lastCompleted.routine_name || 'Freestyle session' }}</p>
              <p class="tile-sub">Last workout {{ ago(d.jym.lastCompleted.ended_at!) }}, {{ volume(d.jym.lastCompleted.total_volume) }}</p>
              <div class="tile-action"><jiro-button variant="secondary" routerLink="/jym">Start a session</jiro-button></div>
            } @else {
              <jiro-empty-state compact heading="No workouts yet" message="Plan a split, then start your first session.">
                <jiro-button size="sm" routerLink="/jym/plan">Plan your first split</jiro-button>
              </jiro-empty-state>
            }
          </jiro-card>

          <jiro-card>
            <div class="tile-head"><jiro-mark name="journaly" [size]="22" /><span>Journal</span></div>
            @if (!d.journal) {
              <p class="tile-muted">Journaly is not available right now.</p>
            } @else if (d.journal.streak.total_entries === 0) {
              <jiro-empty-state compact heading="No entries yet" message="A sentence is enough. Just begin.">
                <jiro-button size="sm" routerLink="/journal/new">Start your first entry</jiro-button>
              </jiro-empty-state>
            } @else {
              <p class="tile-num">{{ d.journal.streak.current_streak }}<span class="tile-unit">day streak</span></p>
              <p class="tile-sub">Best {{ d.journal.streak.longest_streak }}, {{ d.journal.streak.total_entries }} {{ d.journal.streak.total_entries === 1 ? 'entry' : 'entries' }} in all</p>
              <div class="tile-action">
                @if (d.journal.wroteToday) {
                  <span class="tile-done"><jiro-icon name="check-circle" [size]="18" /> Written today</span>
                } @else {
                  <jiro-button routerLink="/journal/new">Write today</jiro-button>
                }
              </div>
            }
          </jiro-card>

          <jiro-card>
            <div class="tile-head"><jiro-mark name="culinara" [size]="22" /><span>Kitchen</span></div>
            @if (!d.kitchen) {
              <p class="tile-muted">Culinara is not available right now.</p>
            } @else if (d.kitchen.total_cook_days === 0) {
              <jiro-empty-state compact heading="Nothing cooked yet" message="Add a recipe and log the first time you make it.">
                <jiro-button size="sm" routerLink="/culinara">Add your first recipe</jiro-button>
              </jiro-empty-state>
            } @else {
              <p class="tile-num">{{ d.kitchen.current_streak }}<span class="tile-unit">day cook streak</span></p>
              <p class="tile-sub">Best {{ d.kitchen.longest_streak }}, {{ d.kitchen.total_cook_days }} {{ d.kitchen.total_cook_days === 1 ? 'day' : 'days' }} cooked in all</p>
              <div class="tile-action"><jiro-button variant="secondary" routerLink="/culinara">Log a cook</jiro-button></div>
            }
          </jiro-card>
        </section>

        <!-- This month -->
        <section aria-label="This month">
          <jiro-card class="month-card">
            <div class="tile-head"><jiro-mark name="ledger" [size]="22" /><span>{{ monthLabel }}</span></div>
            @if (!d.ledger) {
              <p class="tile-muted">Ledger is not available right now.</p>
            } @else if (!d.ledger.hasAccounts) {
              <jiro-empty-state compact heading="No accounts yet" message="Add an account to start tracking income, spending and budgets.">
                <jiro-button size="sm" routerLink="/ledger/accounts">Add your first account</jiro-button>
              </jiro-empty-state>
            } @else {
              <div class="mo-grid">
                <div class="mo-main">
                  @if (d.ledger.summary) {
                    <span class="mo-label">Net this month</span>
                    <span class="mo-net" [class.pos]="d.ledger.summary.net > 0" [class.neg]="d.ledger.summary.net < 0">{{ signed(d.ledger.summary.net) }}</span>
                    <div class="mo-rows">
                      <div class="mo-row"><span>Income</span><b>{{ money(d.ledger.summary.income) }}</b></div>
                      <div class="mo-row"><span>Expenses</span><b>{{ money(d.ledger.summary.expenses) }}</b></div>
                      <div class="mo-row"><span>Savings rate</span><b>{{ d.ledger.summary.savings_rate.toFixed(1) }}%</b></div>
                    </div>
                  } @else {
                    <p class="tile-muted">The monthly summary could not be loaded.</p>
                  }
                </div>
                <div class="mo-budgets">
                  <span class="mo-label">Budgets</span>
                  @if (d.ledger.budgets.length === 0) {
                    <p class="tile-sub">No budgets yet. <a routerLink="/ledger/budgets">Create one</a></p>
                  }
                  @for (b of d.ledger.budgets; track b.id) {
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
              <a class="tile-link" routerLink="/ledger">Open ledger <jiro-icon name="arrow-right" [size]="14" /></a>
            }
          </jiro-card>
        </section>

        <!-- Activity -->
        <section aria-label="Activity, last 14 days">
          <jiro-card class="act-card">
            <div class="tile-head"><span>Last 14 days</span>
              <span class="act-legend"><i class="act-dot act-dot--w"></i> Workouts <i class="act-dot act-dot--j"></i> Journal</span>
            </div>
            <div class="act-grid" role="img" [attr.aria-label]="activitySummary()">
              @for (day of activity(); track day.key) {
                <div class="act-col" [class.act-col--today]="day.today" [title]="day.key">
                  <span class="act-cell" [class.on-w]="day.workout"></span>
                  <span class="act-cell" [class.on-j]="day.journal"></span>
                  <span class="act-day">{{ day.label }}</span>
                </div>
              }
            </div>
          </jiro-card>
        </section>

      } @else {
        <jiro-empty-state icon="warning-circle" heading="Your dashboard could not load" message="Check your connection and try again.">
          <jiro-button (click)="reload()">Try again</jiro-button>
        </jiro-empty-state>
      }

      <!-- Shortcuts -->
      <section class="shortcuts" aria-label="Modules">
        @for (m of modules; track m.id) {
          <a class="sc" [routerLink]="m.home">
            <jiro-mark [name]="m.mark" [size]="32" />
            <span>{{ m.label }}</span>
          </a>
        }
        <div class="sc sc--disabled" aria-disabled="true">
          <jiro-mark name="echo" [size]="32" />
          <span>Echo</span>
          <span class="sc-soon">Soon</span>
        </div>
      </section>
    </div>
  `,
  styles: [`
    .dash { max-width: 1100px; }

    .today {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-lg);
      margin-bottom: var(--space-lg);
    }
    .month-card, .act-card { display: block; margin-bottom: var(--space-lg); }

    .tile-head {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .tile-big {
      font-family: var(--font-family-display);
      font-size: var(--font-size-xl);
      font-weight: 600;
      color: var(--text-primary);
      line-height: var(--line-height-tight);
    }
    .tile-num {
      display: flex;
      align-items: baseline;
      gap: var(--space-sm);
      font-family: var(--font-family-display);
      font-size: var(--font-size-3xl);
      font-weight: 600;
      line-height: 1;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }
    .tile-unit { font-family: var(--font-family); font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }
    .tile-sub { margin-top: var(--space-xs); font-size: var(--font-size-sm); color: var(--text-secondary); }
    .tile-muted { font-size: var(--font-size-sm); color: var(--text-muted); }
    .tile-action { margin-top: var(--space-md); }
    .tile-done { display: inline-flex; align-items: center; gap: 6px; color: var(--color-positive); font-size: var(--font-size-sm); font-weight: 600; }
    .tile-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: var(--space-md);
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    /* This month */
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
    .bud-track { height: 6px; border-radius: 3px; background: var(--bg-surface-hover); overflow: hidden; }
    .bud-fill { height: 100%; border-radius: 3px; background: var(--color-positive); transition: width 0.3s ease; }
    .bud-fill.warn { background: var(--color-warning); }
    .bud-fill.over { background: var(--color-negative); }

    /* Activity strip */
    .act-legend { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; text-transform: none; letter-spacing: 0; font-weight: 500; }
    .act-dot { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-left: 10px; }
    .act-dot:first-child { margin-left: 0; }
    .act-dot--w { background: var(--color-primary); }
    .act-dot--j { background: var(--color-accent); }
    .act-grid { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 6px; }
    .act-col { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .act-cell {
      display: block;
      width: 100%;
      max-width: 24px;
      aspect-ratio: 1;
      border-radius: 4px;
      background: var(--bg-surface-hover);
    }
    .act-cell.on-w { background: var(--color-primary); }
    .act-cell.on-j { background: var(--color-accent); }
    .act-day { font-size: 10px; color: var(--text-muted); }
    .act-col--today .act-day { color: var(--color-primary); font-weight: 700; }

    /* Shortcuts */
    .shortcuts { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
    .sc {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 8px 14px 8px 8px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-weight: 500;
      text-decoration: none;
      transition: transform 0.15s, box-shadow 0.15s;
    }
    .sc:hover { text-decoration: none; transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
    .sc--disabled { opacity: 0.55; cursor: not-allowed; }
    .sc-soon { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    @media (max-width: 900px) {
      .today { grid-template-columns: 1fr; }
      .mo-grid { grid-template-columns: 1fr; gap: var(--space-lg); }
    }
    @media (max-width: 480px) {
      .act-grid { gap: 3px; }
      .act-day { font-size: 9px; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private readonly dashboard = inject(DashboardService);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);

  readonly modules = MODULES;
  readonly loading = signal(true);
  readonly data = signal<DashboardData | null>(null);

  readonly dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  readonly monthLabel = new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const user = this.auth.user();
    const name = (user?.display_name || user?.email.split('@')[0] || '').split(' ')[0];
    return name ? `${part}, ${name}` : part;
  });

  // Days are UTC calendar days, the unit the API uses for streaks and calendars.
  readonly activity = computed<ActivityDay[]>(() => {
    const d = this.data();
    const todayKey = utcDateKey(new Date());
    const days: ActivityDay[] = [];
    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setUTCDate(date.getUTCDate() - i);
      const key = utcDateKey(date);
      days.push({
        key,
        label: date.toLocaleDateString('en-GB', { weekday: 'narrow', timeZone: 'UTC' }),
        workout: !!d?.jym?.workoutDays.has(key),
        journal: !!d?.journal?.days.has(key),
        today: key === todayKey,
      });
    }
    return days;
  });

  readonly activitySummary = computed(() => {
    const a = this.activity();
    const w = a.filter(x => x.workout).length;
    const j = a.filter(x => x.journal).length;
    return `${w} workout ${w === 1 ? 'day' : 'days'} and ${j} journal ${j === 1 ? 'day' : 'days'} in the last 14 days`;
  });

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading.set(true);
    this.dashboard.load().subscribe({
      next: d => { this.data.set(d); this.loading.set(false); },
      error: () => { this.data.set(null); this.loading.set(false); },
    });
  }

  money(v: number): string { return formatCurrency(v); }
  signed(v: number): string { return formatSignedCurrency(v); }
  pct(v: number): number { return Math.round(v); }
  clampPct(v: number): number { return Math.max(0, Math.min(100, v)); }

  volume(kg: number): string {
    const v = this.settings.toDisplay(kg);
    return `${Math.round(v).toLocaleString('en-US')} ${this.settings.unitLabel()} lifted`;
  }

  ago(iso: string): string {
    const ms = Date.now() - new Date(iso).getTime();
    const minutes = Math.max(0, Math.round(ms / 60000));
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }
}
