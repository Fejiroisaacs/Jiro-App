import { Injectable, inject } from '@angular/core';
import { Observable, merge, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { JymService, SessionSummary, BodyWeight } from './jym.service';
import { JournalService, JournalStreak } from './journal.service';
import { RecipeService, CookStreak, Recipe } from './recipe.service';
import { LedgerService, LedgerAccount, LedgerSummary, BudgetWithSpend } from './ledger.service';
import { SettingsService } from './settings.service';
import { dayKey, todayKey } from '../utils/day';

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
  /** Sessions started per day (YYYY-MM-DD in the user's timezone, the day view's unit), from the latest 50. */
  workoutCounts: Map<string, number>;
  hasAny: boolean;
}

export interface JournalDays {
  /** Private entries per day (YYYY-MM-DD in the user's timezone) over the strip's 14 days. */
  counts: Map<string, number>;
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

/** Days the activity strip shows, today included. */
export const STRIP_DAYS = 14;

/**
 * Entries fetched for the strip. The API caps a page at 50; someone writing
 * more than 50 entries in 14 days sees the oldest days of the strip undercounted.
 */
const STRIP_ENTRY_LIMIT = 50;

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly jym = inject(JymService);
  private readonly journal = inject(JournalService);
  private readonly recipes = inject(RecipeService);
  private readonly ledger = inject(LedgerService);
  private readonly settings = inject(SettingsService);

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
        return this.jym.listSessions().pipe(map(s => toDashboardJym(s, this.settings.timezone())));
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
   * Entries per day for the activity strip and "Written today", cut in the
   * user's timezone like the day view. The calendar endpoint counts UTC days,
   * so this reads the entries themselves: everything since a day before the
   * strip starts (days are at most 26 hours, so one spare day covers any zone).
   */
  private journalDays(): Observable<JournalDays> {
    const tz = this.settings.timezone();
    const from = new Date(Date.now() - (STRIP_DAYS + 1) * 86_400_000).toISOString();
    return this.journal.listEntries({ from, limit: STRIP_ENTRY_LIMIT }).pipe(
      map(entries => {
        const counts = countByDay(entries.map(e => e.created_at), tz);
        return { counts, wroteToday: counts.has(todayKey(tz)) };
      }),
    );
  }
}

function countByDay(instants: string[], tz: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const iso of instants) {
    const key = dayKey(iso, tz);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function toDashboardJym(sessions: SessionSummary[], tz: string): DashboardJym {
  return {
    inProgress: sessions.find(s => !s.ended_at) ?? null,
    lastCompleted: sessions.find(s => !!s.ended_at) ?? null,
    // Every session counts, in progress too, as it does on the day page.
    workoutCounts: countByDay(sessions.map(s => s.started_at), tz),
    hasAny: sessions.length > 0,
  };
}
