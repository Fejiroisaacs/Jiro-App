import { Component, ElementRef, Injector, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, combineLatest, of } from 'rxjs';
import { catchError, filter, map, startWith, switchMap } from 'rxjs/operators';
import { DayService, DayTransaction, DayView } from '../../core/services/day.service';
import { SessionSummary } from '../../core/services/jym.service';
import { MOODS } from '../../core/services/journal.service';
import { SettingsService } from '../../core/services/settings.service';
import {
  addDays, isDayKey, longDayLabel, relativeDayName, timeInZone, todayKey,
} from '../../core/utils/day';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';
import { JiroSkeletonComponent } from '../../shared/components/jiro-skeleton/jiro-skeleton';
import { formatCurrency, formatSignedCurrency, transactionColor } from '../ledger/shared/ledger-utils';

type LoadState =
  | { status: 'loading'; key: string }
  | { status: 'ready'; key: string; day: DayView }
  | { status: 'error'; key: string };

const SLOT_LABELS: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

/** One of the user's days across all modules (/day/:date); arrows push history, bad dates become today. */
@Component({
  selector: 'app-day-page',
  standalone: true,
  imports: [RouterLink, JiroButtonComponent, JiroIconComponent, JiroMarkComponent, JiroSkeletonComponent],
  template: `
    <div class="day">
      <header class="day-head">
        <h1 #heading tabindex="-1" class="day-title">
          @if (relative(); as r) {
            <span class="day-rel">{{ r }}</span><span class="sr-only">, </span>
          }
          <span class="day-date">{{ label() }}</span>
        </h1>
        <nav class="day-nav" aria-label="Change day">
          <a class="day-arrow" [routerLink]="['/day', prevKey()]" [attr.aria-label]="'Previous day, ' + prevLabel()">
            <jiro-icon name="caret-left" [size]="18" />
          </a>
          @if (isToday()) {
            <button type="button" class="day-arrow" disabled aria-label="Next day">
              <jiro-icon name="caret-right" [size]="18" />
            </button>
          } @else {
            <a class="day-arrow" [routerLink]="['/day', nextKey()]" [attr.aria-label]="'Next day, ' + nextLabel()">
              <jiro-icon name="caret-right" [size]="18" />
            </a>
            <a class="day-today" [routerLink]="['/day', today()]">Today</a>
          }
        </nav>
      </header>

      @switch (state().status) {
        @case ('loading') {
          <div class="sections" aria-busy="true">
            <span class="sr-only" role="status">Loading</span>
            @for (m of skeletonMarks; track m) {
              <div class="sec sec--sk" aria-hidden="true">
                <div class="sec-head">
                  <jiro-mark [name]="m" [size]="32" />
                  <jiro-skeleton height="14px" width="90px" />
                </div>
                <div class="sk-rows">
                  <jiro-skeleton height="16px" width="70%" />
                  <jiro-skeleton height="12px" width="45%" />
                </div>
              </div>
            }
          </div>
        }
        @case ('error') {
          <div class="day-error" role="alert">
            <p>This day could not be loaded.</p>
            <jiro-button variant="secondary" size="sm" (click)="retry()">Retry</jiro-button>
          </div>
        }
        @case ('ready') {
          @if (day(); as d) {
            <div class="sections">

              <!-- Jym -->
              <section class="sec" aria-labelledby="day-jym">
                <div class="sec-head">
                  <jiro-mark name="jym" [size]="32" />
                  <h2 id="day-jym" class="sec-title">Jym</h2>
                </div>
                @if (d.jym.sessions.length) {
                  <ul class="rows">
                    @for (s of d.jym.sessions; track s.id) {
                      <li>
                        <a class="row" [routerLink]="sessionLink(s).path" [queryParams]="sessionLink(s).query">
                          <span class="row-main">
                            <span class="row-title">{{ s.routine_name || 'Freestyle' }}</span>
                            @if (!s.ended_at) { <span class="pill">In progress</span> }
                            @if (s.pr_count > 0) { <span class="pill pill--pr">{{ plural(s.pr_count, 'PR', 'PRs') }}</span> }
                          </span>
                          <span class="row-meta">{{ sessionMeta(s) }}</span>
                          @if (s.muscle_groups.length) {
                            <span class="row-meta row-meta--soft">{{ s.muscle_groups.join(', ') }}</span>
                          }
                        </a>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="quiet">
                    No workout
                    @if (isToday()) { <a class="add" routerLink="/jym">Start a workout</a> }
                  </p>
                }
                @if (d.jym.body_weight; as bw) {
                  <a class="row row--inline" routerLink="/jym/track" [queryParams]="{ tab: 'bodyweight' }">
                    <span class="row-title">Weigh-in</span>
                    <span class="row-value">{{ weight(bw.weight_kg) }}</span>
                  </a>
                }
              </section>

              <!-- Culinara -->
              <section class="sec" aria-labelledby="day-culinara">
                <div class="sec-head">
                  <jiro-mark name="culinara" [size]="32" />
                  <h2 id="day-culinara" class="sec-title">Culinara</h2>
                </div>
                @if (d.culinara.cooked.length) {
                  <ul class="rows">
                    @for (c of d.culinara.cooked; track c.trial_id) {
                      <li>
                        <a class="row" [routerLink]="['/culinara', c.recipe_id]">
                          <span class="row-main"><span class="row-title">{{ c.recipe_title }}</span></span>
                          <span class="row-meta">Cooked {{ time(c.date_cooked) }}@if (c.rating) {, rated {{ c.rating }} of 5}</span>
                          @if (c.notes) { <span class="row-text">{{ c.notes }}</span> }
                        </a>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="quiet">
                    Nothing cooked
                    @if (isToday()) { <a class="add" routerLink="/culinara">Log a cook</a> }
                  </p>
                }
                @if (d.culinara.planned.length) {
                  <h3 class="sub-title">Planned</h3>
                  <ul class="plan">
                    @for (p of d.culinara.planned; track p.id) {
                      <li class="plan-item">
                        <span class="plan-slot">{{ slot(p.meal_slot) }}</span>
                        @if (p.recipe_id && p.recipe_title) {
                          <a class="plan-link" [routerLink]="['/culinara', p.recipe_id]">{{ p.recipe_title }}</a>
                        } @else {
                          <span class="plan-text">{{ p.custom_label || p.recipe_title || 'Meal' }}</span>
                        }
                      </li>
                    }
                  </ul>
                }
              </section>

              <!-- Journaly -->
              <section class="sec" aria-labelledby="day-journal">
                <div class="sec-head">
                  <jiro-mark name="journaly" [size]="32" />
                  <h2 id="day-journal" class="sec-title">Journaly</h2>
                </div>
                @if (d.journal.entries.length) {
                  <ul class="rows">
                    @for (e of d.journal.entries; track e.id) {
                      <li>
                        <a class="row" [routerLink]="['/journal', e.id, 'edit']">
                          @if (e.title) {
                            <span class="row-main"><span class="row-title">{{ e.title }}</span></span>
                          }
                          <span class="row-meta">
                            {{ time(e.created_at) }}
                            @if (e.mood) { <span class="pill">{{ mood(e.mood) }}</span> }
                          </span>
                          @if (e.excerpt) { <span class="row-text" [class.row-text--lead]="!e.title">{{ e.excerpt }}</span> }
                        </a>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="quiet">
                    No entry
                    <a class="add" routerLink="/journal/new" [queryParams]="isToday() ? {} : { date: key() }">Write an entry</a>
                  </p>
                }
              </section>

              <!-- Ledger -->
              <section class="sec" aria-labelledby="day-ledger">
                <div class="sec-head">
                  <jiro-mark name="ledger" [size]="32" />
                  <h2 id="day-ledger" class="sec-title">Ledger</h2>
                  @if (d.ledger.transactions.length) {
                    <p class="sec-sum">
                      Spent {{ money(d.ledger.spent) }}
                      @if (d.ledger.income > 0) { <span class="sec-sum-in">, income {{ money(d.ledger.income) }}</span> }
                    </p>
                  }
                </div>
                @if (d.ledger.transactions.length) {
                  <ul class="rows">
                    @for (t of d.ledger.transactions; track t.id) {
                      <li>
                        <a class="row row--split" routerLink="/ledger/transactions" [queryParams]="{ tx: t.id }">
                          <span class="row-stack">
                            <span class="row-title">{{ t.description || 'Transaction' }}</span>
                            <span class="row-meta">
                              @if (t.category_name) {
                                <span class="cat-dot" [style.background]="t.category_color || 'var(--text-muted)'" aria-hidden="true"></span>{{ t.category_name }} ·
                              }
                              {{ t.type === 'transfer' && t.transfer_to_account_name ? t.account_name + ' to ' + t.transfer_to_account_name : t.account_name }}
                            </span>
                          </span>
                          <span class="row-amount" [style.color]="amountColor(t)">{{ amount(t) }}</span>
                        </a>
                      </li>
                    }
                  </ul>
                } @else {
                  <p class="quiet">
                    No transactions
                    <a class="add" routerLink="/ledger/transactions" [queryParams]="{ new: 1, date: key() }">Log a transaction</a>
                  </p>
                }
              </section>

            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .day { max-width: 760px; }

    .day-head {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-md);
      margin-bottom: var(--space-xl);
    }
    .day-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
      margin: 0;
      min-width: 0;
    }
    .day-title:focus { outline: none; }
    .day-rel {
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--color-primary);
    }
    .day-nav { display: flex; align-items: center; gap: var(--space-sm); }
    .day-arrow, .day-today {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      min-height: 44px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      text-decoration: none;
      font: inherit;
      cursor: pointer;
    }
    .day-today { padding: 0 var(--space-md); font-size: var(--font-size-sm); font-weight: 600; }
    .day-arrow:hover, .day-today:hover { background: var(--bg-surface-hover); text-decoration: none; }
    .day-arrow:disabled { opacity: 0.45; cursor: not-allowed; }
    .day-arrow:disabled:hover { background: var(--bg-surface); }

    .sections { display: flex; flex-direction: column; gap: var(--space-lg); }

    .sec {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg);
      box-shadow: var(--shadow-sm);
      min-width: 0;
    }
    .sec-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      min-height: 32px;
      margin-bottom: var(--space-md);
    }
    .sec-title {
      margin: 0;
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-secondary);
      line-height: var(--line-height-tight);
    }
    .sec-sum {
      margin: 0 0 0 auto;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }
    .sec-sum-in { font-weight: 500; color: var(--text-secondary); }

    .rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
    .row {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 44px;
      padding: 10px 12px;
      margin: 0 -12px;
      border-radius: var(--border-radius);
      color: var(--text-primary);
      text-decoration: none;
      min-width: 0;
    }
    .row:hover { background: var(--bg-surface-hover); text-decoration: none; }
    .row--split { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--space-md); }
    .row--inline { flex-direction: row; align-items: center; justify-content: space-between; margin-top: 4px; }
    .row-stack { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .row-main { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; min-width: 0; }
    .row-title { font-weight: 600; font-size: var(--font-size-sm); overflow-wrap: anywhere; }
    .row-meta { font-size: var(--font-size-xs); color: var(--text-secondary); display: inline-flex; align-items: center; flex-wrap: wrap; gap: 4px; }
    .row-meta--soft { color: var(--text-muted); text-transform: capitalize; }
    .row-text {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      overflow-wrap: anywhere;
    }
    .row-text--lead { color: var(--text-primary); }
    .row-value { font-weight: 600; font-size: var(--font-size-sm); }
    .row-amount { font-weight: 700; font-size: var(--font-size-sm); white-space: nowrap; font-variant-numeric: tabular-nums; }
    .cat-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }

    .pill {
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 1px 8px;
      border-radius: var(--border-radius-pill);
      background: var(--bg-surface-hover);
      color: var(--text-secondary);
    }
    .pill--pr { background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary); }

    .quiet {
      margin: 0;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--text-muted);
    }
    .add {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-weight: 600;
      color: var(--color-primary);
    }

    .sub-title {
      margin: var(--space-md) 0 var(--space-xs);
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
    }
    .plan { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
    .plan-item { display: flex; align-items: center; gap: var(--space-sm); min-height: 36px; font-size: var(--font-size-sm); color: var(--text-secondary); }
    .plan-slot { width: 76px; flex-shrink: 0; font-size: var(--font-size-xs); color: var(--text-muted); }
    .plan-link { display: inline-flex; align-items: center; min-height: 36px; color: var(--text-primary); overflow-wrap: anywhere; }

    .sec--sk .sec-head { margin-bottom: var(--space-md); }
    .sk-rows { display: flex; flex-direction: column; gap: 8px; }

    .day-error {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: var(--space-md);
      padding: var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
    }
    .day-error p { margin: 0; color: var(--text-secondary); }

    @media (max-width: 480px) {
      .sec { padding: var(--space-md); }
      .row { margin: 0 -8px; padding: 10px 8px; }
    }
  `],
})
export class DayPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly days = inject(DayService);
  private readonly settings = inject(SettingsService);
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly skeletonMarks = ['jym', 'culinara', 'journaly', 'ledger'] as const;
  private readonly retry$ = new Subject<void>();

  private readonly tz = this.settings.timezone;
  /** Recomputed with the key, so a page left open past midnight catches up on the next move. */
  readonly today = computed(() => { this.key(); return todayKey(this.tz()); });

  /** The requested date, or null when it has to be replaced with today. */
  private readonly key$ = this.route.paramMap.pipe(
    map(p => p.get('date')),
    map(date => {
      const today = todayKey(this.tz());
      if (!isDayKey(date) || date > today) {
        this.router.navigate(['/day', today], { replaceUrl: true });
        return null;
      }
      return date;
    }),
    filter((k): k is string => k !== null),
  );

  readonly state = toSignal(
    combineLatest([this.key$, this.retry$.pipe(startWith(undefined))]).pipe(
      // switchMap drops the response for a day the user has already left.
      switchMap(([key]) => {
        this.afterDayChange();
        return this.days.getDay(key, this.tz()).pipe(
          map((day): LoadState => ({ status: 'ready', key, day })),
          catchError(() => of<LoadState>({ status: 'error', key })),
          startWith<LoadState>({ status: 'loading', key }),
        );
      }),
    ),
    { initialValue: { status: 'loading', key: todayKey(this.tz()) } as LoadState },
  );

  readonly key = computed(() => this.state().key);
  readonly day = computed(() => { const s = this.state(); return s.status === 'ready' ? s.day : null; });
  readonly isToday = computed(() => this.key() >= this.today());
  readonly relative = computed(() => relativeDayName(this.key(), this.today()));
  readonly label = computed(() => longDayLabel(this.key(), this.today()));
  readonly prevKey = computed(() => addDays(this.key(), -1));
  readonly nextKey = computed(() => addDays(this.key(), 1));
  readonly prevLabel = computed(() => longDayLabel(this.prevKey(), this.today()));
  readonly nextLabel = computed(() => longDayLabel(this.nextKey(), this.today()));

  retry() { this.retry$.next(); }

  /** If the control that moved the day vanished and focus fell to body, focus the heading. */
  private afterDayChange() {
    afterNextRender(() => {
      const active = document.activeElement;
      if (!active || active === document.body) this.heading()?.nativeElement.focus();
    }, { injector: this.injector });
  }

  sessionLink(s: SessionSummary): { path: unknown[]; query: Record<string, string> | null } {
    // Completed sessions open read-only in history; the player would restart its timer.
    return s.ended_at
      ? { path: ['/jym/track'], query: { tab: 'sessions', session: s.id } }
      : { path: ['/jym/session', s.id], query: null };
  }

  sessionMeta(s: SessionSummary): string {
    const parts = [this.time(s.started_at)];
    if (s.ended_at) {
      const mins = Math.max(1, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 60000));
      parts.push(mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)} h ${mins % 60} min`);
    }
    parts.push(this.plural(s.set_count, 'set', 'sets'));
    if (s.total_volume > 0) parts.push(`${Math.round(this.settings.toDisplay(s.total_volume)).toLocaleString('en-US')} ${this.settings.unitLabel()}`);
    return parts.join(' · ');
  }

  weight(kg: number): string {
    return `${this.settings.toDisplay(kg)} ${this.settings.unitLabel()}`;
  }

  time(iso: string): string { return timeInZone(iso, this.tz()); }
  slot(s: string): string { return SLOT_LABELS[s] ?? s; }
  mood(v: string): string { return MOODS.find(m => m.value === v)?.label ?? v; }
  plural(n: number, one: string, many: string): string { return `${n} ${n === 1 ? one : many}`; }
  // One currency per user (Settings); the account's own currency column is no longer shown.
  money(v: number): string { return formatCurrency(v, this.settings.currency()); }

  amount(t: DayTransaction): string {
    if (t.type === 'transfer') return formatSignedCurrency(t.amount, this.settings.currency(), 'never');
    return formatSignedCurrency(t.type === 'expense' ? -Math.abs(t.amount) : Math.abs(t.amount), this.settings.currency());
  }

  amountColor(t: DayTransaction): string { return transactionColor(t.type); }
}
