import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, merge, of } from 'rxjs';
import { catchError, expand, map, reduce } from 'rxjs/operators';
import { JymService, SessionSummary, BodyWeight } from './jym.service';
import { JournalEntry, JournalService, JournalStreak } from './journal.service';
import { RecipeService, CookStreak, Recipe } from './recipe.service';
import { LedgerService, LedgerAccount, LedgerSummary, BudgetWithSpend } from './ledger.service';
import { SettingsService } from './settings.service';
import { addDays, dayKey, dayStartISO, todayKey } from '../utils/day';

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

/** Entries per request for the strip: the API's page cap. */
const STRIP_PAGE_SIZE = 50;

/**
 * The strip reads every entry in its window, a page at a time, up to this
 * many pages (500 entries in 14 days). Past that the oldest days undercount
 * rather than the dashboard firing an unbounded run of requests.
 */
const STRIP_MAX_PAGES = 10;

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
      case 'ledgerSummary':
        // This month in the user's zone (YYYY-MM of today's key).
        return this.ledger.getSummary(todayKey(this.settings.timezone()).slice(0, 7));
      case 'ledgerBudgets':
        return this.ledger.listBudgets().pipe(map(b => [...b].sort((x, y) => y.pct_used - x.pct_used).slice(0, 3)));
    }
  }

  /**
   * Entries per day for the activity strip and "Written today", cut in the
   * user's timezone like the day view: every entry since the strip's first
   * day began in that zone.
   */
  private journalDays(): Observable<JournalDays> {
    const tz = this.settings.timezone();
    const today = todayKey(tz);
    const from = dayStartISO(addDays(today, -(STRIP_DAYS - 1)), tz);
    return this.entriesSince(from).pipe(
      map(entries => {
        const counts = countByDay(entries.map(e => e.created_at), tz);
        return { counts, wroteToday: counts.has(today) };
      }),
    );
  }

  /**
   * Every private entry created at or after `from`, paging by offset until
   * X-Total-Count is reached (or STRIP_MAX_PAGES pages have been read).
   */
  private entriesSince(from: string): Observable<JournalEntry[]> {
    const page = (offset: number) => this.journal.listEntriesPage({ from, limit: STRIP_PAGE_SIZE, offset });
    return page(0).pipe(
      expand((res, i) => {
        const read = (i + 1) * STRIP_PAGE_SIZE;
        return read < res.total && i + 1 < STRIP_MAX_PAGES ? page(read) : EMPTY;
      }),
      reduce((all, res) => all.concat(res.entries), [] as JournalEntry[]),
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
