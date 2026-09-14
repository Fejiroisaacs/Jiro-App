import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { JymService, SessionSummary } from './jym.service';
import { JournalService, JournalStreak } from './journal.service';
import { RecipeService, CookStreak } from './recipe.service';
import { LedgerService, LedgerSummary, BudgetWithSpend } from './ledger.service';

export interface DashboardJym {
  inProgress: SessionSummary | null;
  lastCompleted: SessionSummary | null;
  /** UTC calendar dates (YYYY-MM-DD) with a completed session; the API's streaks and calendars are UTC-day based too. */
  workoutDays: Set<string>;
  hasAny: boolean;
}

export interface DashboardJournal {
  streak: JournalStreak;
  /** Calendar dates (YYYY-MM-DD, UTC-day based like the API) with an entry. */
  days: Set<string>;
  wroteToday: boolean;
}

export interface DashboardLedger {
  hasAccounts: boolean;
  summary: LedgerSummary | null;
  /** Top three budgets by percentage used. */
  budgets: BudgetWithSpend[];
}

/** Each module is null when its requests failed, so the page can degrade per card. */
export interface DashboardData {
  jym: DashboardJym | null;
  journal: DashboardJournal | null;
  kitchen: CookStreak | null;
  ledger: DashboardLedger | null;
}

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

  load(): Observable<DashboardData> {
    const now = new Date();
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    // The journal calendar is keyed on UTC days; ask for the current UTC month
    // and, early in the month, the previous one so the 14-day strip is complete.
    const utcYear = now.getUTCFullYear();
    const utcMonth = now.getUTCMonth() + 1;
    const prev = new Date(Date.UTC(utcYear, utcMonth - 2, 1));
    const needPrev = now.getUTCDate() < 14;

    const safe = <T>(source: Observable<T>): Observable<T | null> => source.pipe(catchError(() => of(null)));

    return forkJoin({
      sessions: safe(this.jym.listSessions()),
      streak: safe(this.journal.getStreak()),
      calThis: safe(this.journal.getCalendar(utcYear, utcMonth)),
      calPrev: needPrev ? safe(this.journal.getCalendar(prev.getUTCFullYear(), prev.getUTCMonth() + 1)) : of(null),
      cook: safe(this.recipes.getCookStreak()),
      accounts: safe(this.ledger.listAccounts()),
      summary: safe(this.ledger.getSummary(month)),
      budgets: safe(this.ledger.listBudgets()),
    }).pipe(
      map(r => {
        const jym: DashboardJym | null = r.sessions
          ? {
              inProgress: r.sessions.find(s => !s.ended_at) ?? null,
              lastCompleted: r.sessions.find(s => !!s.ended_at) ?? null,
              workoutDays: new Set(r.sessions.filter(s => !!s.ended_at).map(s => utcDateKey(new Date(s.started_at)))),
              hasAny: r.sessions.length > 0,
            }
          : null;

        let journal: DashboardJournal | null = null;
        if (r.streak && r.calThis) {
          const days = new Set<string>();
          const add = (year: number, month1: number, list: number[]) => {
            for (const d of list) days.add(`${year}-${String(month1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
          };
          add(r.calThis.year, r.calThis.month, r.calThis.days);
          if (r.calPrev) add(r.calPrev.year, r.calPrev.month, r.calPrev.days);
          journal = { streak: r.streak, days, wroteToday: r.calThis.days.includes(now.getUTCDate()) };
        }

        const ledger: DashboardLedger | null = r.accounts
          ? {
              hasAccounts: r.accounts.length > 0,
              summary: r.summary,
              budgets: [...(r.budgets ?? [])].sort((a, b) => b.pct_used - a.pct_used).slice(0, 3),
            }
          : null;

        return { jym, journal, kitchen: r.cook, ledger };
      }),
    );
  }
}
