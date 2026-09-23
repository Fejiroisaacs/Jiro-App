import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, merge, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { JymService, SessionSummary, BodyWeight } from './jym.service';
import { JournalService, JournalStreak } from './journal.service';
import { RecipeService, CookStreak, Recipe } from './recipe.service';
import { LedgerService, LedgerAccount, LedgerSummary, BudgetWithSpend } from './ledger.service';

/** A single request (or small request group) the dashboard can make. Widgets that share a source share the request. */
export type WidgetSource =
  | 'sessions'
  | 'journalStreak'
  | 'journalCalendar'
  | 'cookStreak'
  | 'bodyWeights'
  | 'recentRecipes'
  | 'ledgerAccounts'
  | 'ledgerSummary'
  | 'ledgerBudgets';

export interface DashboardJym {
  inProgress: SessionSummary | null;
  lastCompleted: SessionSummary | null;
  /** UTC calendar dates (YYYY-MM-DD) with a completed session; the API's streaks and calendars are UTC-day based too. */
  workoutDays: Set<string>;
  hasAny: boolean;
}

export interface JournalDays {
  /** Calendar dates (YYYY-MM-DD, UTC-day based like the API) with an entry. */
  days: Set<string>;
  wroteToday: boolean;
}

export interface DashboardJournal extends JournalDays {
  streak: JournalStreak;
}

export interface DashboardLedger {
  hasAccounts: boolean;
  summary: LedgerSummary | null;
  /** Top three budgets by percentage used. */
  budgets: BudgetWithSpend[];
}

/** What each source resolves to once loaded. */
export interface SourceValues {
  sessions: DashboardJym;
  journalStreak: JournalStreak;
  journalCalendar: JournalDays;
  cookStreak: CookStreak;
  bodyWeights: BodyWeight[];
  recentRecipes: Recipe[];
  ledgerAccounts: LedgerAccount[];
  ledgerSummary: LedgerSummary;
  ledgerBudgets: BudgetWithSpend[];
}

/**
 * Loaded sources so far. A key that is absent has not arrived yet (loading);
 * null means that request failed, so the page can degrade per card.
 */
export type SourceResults = { [K in WidgetSource]?: SourceValues[K] | null };

/** How many recipes the Recent recipes widget shows. */
export const RECENT_RECIPE_COUNT = 3;

/** UTC calendar date as YYYY-MM-DD, matching how the API counts days. */
export function utcDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly jym = inject(JymService);
  private readonly journal = inject(JournalService);
  private readonly recipes = inject(RecipeService);
  private readonly ledger = inject(LedgerService);

  /**
   * Fetches only the given sources. Emits one partial result per source as it
   * lands, so fast cards do not wait on slow ones; a failed source emits null
   * for itself and never errors the stream.
   */
  load(sources: Iterable<WidgetSource>): Observable<SourceResults> {
    const wanted = [...new Set(sources)];
    if (wanted.length === 0) return of({});
    return merge(
      ...wanted.map(key =>
        (this.request(key) as Observable<unknown>).pipe(
          catchError(() => of(null)),
          map(value => ({ [key]: value }) as SourceResults),
        ),
      ),
    );
  }

  private request<K extends WidgetSource>(key: K): Observable<SourceValues[K]>;
  private request(key: WidgetSource): Observable<SourceValues[WidgetSource]> {
    switch (key) {
      case 'sessions':
        return this.jym.listSessions().pipe(map(toDashboardJym));
      case 'journalStreak':
        return this.journal.getStreak();
      case 'journalCalendar':
        return this.journalDays();
      case 'cookStreak':
        return this.recipes.getCookStreak();
      case 'bodyWeights':
        return this.jym.listBodyWeights();
      case 'recentRecipes':
        return this.recipes.listRecipes(undefined, RECENT_RECIPE_COUNT);
      case 'ledgerAccounts':
        return this.ledger.listAccounts();
      case 'ledgerSummary': {
        const now = new Date();
        return this.ledger.getSummary(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
      }
      case 'ledgerBudgets':
        return this.ledger.listBudgets().pipe(map(b => [...b].sort((x, y) => y.pct_used - x.pct_used).slice(0, 3)));
    }
  }

  /**
   * The journal calendar is keyed on UTC days; ask for the current UTC month
   * and, early in the month, the previous one so the 14-day strip is complete.
   * Only the current month is required; a failed previous month just leaves
   * those days blank.
   */
  private journalDays(): Observable<JournalDays> {
    const now = new Date();
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth() + 1;
    const prev = new Date(Date.UTC(utcYear, utcMonth - 2, 1));
    const needPrev = now.getUTCDate() < 14;

    return forkJoin({
      calThis: this.journal.getCalendar(utcYear, utcMonth),
      calPrev: needPrev
        ? this.journal.getCalendar(prev.getUTCFullYear(), prev.getUTCMonth() + 1).pipe(catchError(() => of(null)))
        : of(null),
    }).pipe(
      map(({ calThis, calPrev }) => {
        const days = new Set<string>();
        const add = (year: number, month1: number, list: number[]) => {
          for (const d of list) days.add(`${year}-${String(month1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
        };
        add(calThis.year, calThis.month, calThis.days);
        if (calPrev) add(calPrev.year, calPrev.month, calPrev.days);
        return { days, wroteToday: calThis.days.includes(now.getUTCDate()) };
      }),
    );
  }
}

function toDashboardJym(sessions: SessionSummary[]): DashboardJym {
  return {
    inProgress: sessions.find(s => !s.ended_at) ?? null,
    lastCompleted: sessions.find(s => !!s.ended_at) ?? null,
    workoutDays: new Set(sessions.filter(s => !!s.ended_at).map(s => utcDateKey(new Date(s.started_at)))),
    hasAny: sessions.length > 0,
  };
}
