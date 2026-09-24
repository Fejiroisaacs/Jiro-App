import { Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DashboardJournal, DashboardLedger, DashboardService, SourceResults, WidgetSource } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { MODULES } from '../../core/navigation';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroEmptyStateComponent } from '../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { DashboardLayoutService } from './dashboard-layout.service';
import { DashboardLayout, WIDGET_BY_ID, sameLayout, sourcesFor } from './widget-catalog';
import { CustomiseDashboardComponent } from './customise-dashboard';
import { WidgetData } from './widgets/widget-shell';
import { WorkoutWidgetComponent } from './widgets/workout-widget';
import { JournalWidgetComponent } from './widgets/journal-widget';
import { KitchenWidgetComponent } from './widgets/kitchen-widget';
import { BodyWeightWidgetComponent } from './widgets/body-weight-widget';
import { RecentRecipesWidgetComponent } from './widgets/recent-recipes-widget';
import { LedgerWidgetComponent } from './widgets/ledger-widget';
import { ActivityData, ActivityWidgetComponent } from './widgets/activity-widget';

/** Both parts loaded gives the combined value; either failed gives null; otherwise still loading. */
function combine<A, B, R>(a: WidgetData<A>, b: WidgetData<B>, join: (a: A, b: B) => R): WidgetData<R> {
  if (a === null || b === null) return null;
  if (a === undefined || b === undefined) return undefined;
  return join(a, b);
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink, JiroPageHeaderComponent, JiroButtonComponent, JiroEmptyStateComponent, JiroMarkComponent, JiroIconComponent,
    CustomiseDashboardComponent,
    WorkoutWidgetComponent, JournalWidgetComponent, KitchenWidgetComponent, BodyWeightWidgetComponent,
    RecentRecipesWidgetComponent, LedgerWidgetComponent, ActivityWidgetComponent,
  ],
  template: `
    <div class="dash">
      <jiro-page-header [heading]="greeting()" [subtitle]="dateLabel">
        <jiro-button actions #customiseBtn variant="secondary" (click)="openCustomise()">
          <jiro-icon name="squares-four" [size]="18" /> Customise
        </jiro-button>
      </jiro-page-header>

      @if (widgets().length === 0) {
        <div class="dash-empty">
          <jiro-empty-state icon="squares-four" heading="Your dashboard is empty" message="Choose the cards you want to see here.">
            <jiro-button (click)="openCustomise()">Customise</jiro-button>
          </jiro-empty-state>
        </div>
      } @else {
        <div class="grid">
          @for (w of widgets(); track w.id) {
            <div class="cell" [class.cell--wide]="w.wide">
              @switch (w.id) {
                @case ('workout') { <dash-workout-widget [data]="results().sessions" /> }
                @case ('journal') { <dash-journal-widget [data]="journal()" /> }
                @case ('kitchen') { <dash-kitchen-widget [data]="results().cookStreak" /> }
                @case ('body_weight') { <dash-body-weight-widget [data]="results().bodyWeights" /> }
                @case ('recent_recipes') { <dash-recent-recipes-widget [data]="results().recentRecipes" /> }
                @case ('ledger_month') { <dash-ledger-widget [data]="ledger()" /> }
                @case ('activity') { <dash-activity-widget [data]="activity()" /> }
              }
            </div>
          }
        </div>
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

    @if (customising()) {
      <dash-customise-dashboard [layout]="layout()" (save)="saveLayout($event)" (cancel)="closeCustomise()" />
    }
  `,
  styles: [`
    .dash { max-width: 1100px; }

    /* Visual order is DOM order (no dense packing), so keyboard order matches. */
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-lg);
      margin-bottom: var(--space-lg);
    }
    .cell { min-width: 0; }
    .cell--wide { grid-column: 1 / -1; }

    .dash-empty {
      margin-bottom: var(--space-lg);
      background: var(--bg-surface);
      border: 1px dashed var(--border-color);
      border-radius: var(--border-radius-lg);
    }

    /* Shortcuts */
    .shortcuts { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
    .sc {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      min-height: 44px;
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
    .sc--disabled:hover { transform: none; box-shadow: none; }
    .sc-soon { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }

    @media (max-width: 900px) {
      .grid { grid-template-columns: minmax(0, 1fr); }
    }
  `]
})
export class DashboardComponent {
  private readonly dashboard = inject(DashboardService);
  private readonly layouts = inject(DashboardLayoutService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly doc = inject(DOCUMENT);

  private readonly customiseBtn = viewChild('customiseBtn', { read: ElementRef });

  readonly modules = MODULES;
  readonly layout = this.layouts.layout;
  readonly customising = signal(false);
  private returnFocus: HTMLElement | null = null;

  readonly dateLabel = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  readonly greeting = computed(() => {
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const user = this.auth.user();
    const name = (user?.display_name || user?.email.split('@')[0] || '').split(' ')[0];
    return name ? `${part}, ${name}` : part;
  });

  /** Visible widgets in layout order. */
  readonly widgets = computed(() =>
    this.layout().widgets
      .filter(w => w.visible)
      .map(w => ({ id: w.id, wide: WIDGET_BY_ID.get(w.id)!.span === 'wide' })),
  );

  /** Per-source results: absent while loading, null when that request failed. */
  readonly results = signal<SourceResults>({});
  private readonly requested = new Set<WidgetSource>();

  readonly journal = computed<WidgetData<DashboardJournal>>(() => {
    const r = this.results();
    return combine(r.journalStreak, r.journalCalendar, (streak, cal) => ({ streak, ...cal }));
  });

  readonly activity = computed<WidgetData<ActivityData>>(() => {
    const r = this.results();
    return combine(r.sessions, r.journalCalendar, (s, c) => ({ workoutDays: s.workoutDays, journalDays: c.days }));
  });

  /** Accounts decide whether the card works; a failed summary or budget list degrades inside it. */
  readonly ledger = computed<WidgetData<DashboardLedger>>(() => {
    const { ledgerAccounts: accounts, ledgerSummary: summary, ledgerBudgets: budgets } = this.results();
    if (accounts === null) return null;
    if (accounts === undefined || summary === undefined || budgets === undefined) return undefined;
    return { hasAccounts: accounts.length > 0, summary, budgets: budgets ?? [] };
  });

  constructor() {
    // Fetch what the visible widgets need. When a save reveals a widget, only
    // the sources not already requested are fetched.
    effect(() => {
      const missing = [...sourcesFor(this.layout())].filter(s => !this.requested.has(s));
      if (missing.length === 0) return;
      missing.forEach(s => this.requested.add(s));
      untracked(() =>
        this.dashboard.load(missing)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(part => this.results.update(r => ({ ...r, ...part }))),
      );
    });
  }

  openCustomise() {
    this.returnFocus = this.doc.activeElement instanceof HTMLElement ? this.doc.activeElement : null;
    this.customising.set(true);
  }

  closeCustomise() {
    this.customising.set(false);
    afterNextRender(() => {
      // The empty state's button is gone once a widget is shown again; fall back to the header button.
      const target = this.returnFocus?.isConnected
        ? this.returnFocus
        : (this.customiseBtn()?.nativeElement as HTMLElement | undefined)?.querySelector('button');
      target?.focus();
      this.returnFocus = null;
    }, { injector: this.injector });
  }

  saveLayout(draft: DashboardLayout) {
    if (!sameLayout(draft, this.layout())) this.layouts.save(draft);
    this.closeCustomise();
  }
}
