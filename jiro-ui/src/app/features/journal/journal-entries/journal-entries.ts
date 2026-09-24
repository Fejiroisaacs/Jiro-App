import {
  Component, DestroyRef, ElementRef, computed, effect, inject, signal, untracked, viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, distinctUntilChanged, map, of, switchMap, tap } from 'rxjs';
import {
  JournalService,
  JournalEntry,
  ListEntriesParams,
  MOODS,
  moodColor as moodColorFor,
  moodLabel as moodLabelFor,
} from '../../../core/services/journal.service';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';

export const ENTRIES_PAGE_SIZE = 20;

/** Page numbers to show: always first, last, current and its neighbours; `null` is a gap. */
export function pagerItems(current: number, last: number): (number | null)[] {
  const wanted = new Set([1, last, current - 1, current, current + 1]);
  const pages = [...wanted].filter(p => p >= 1 && p <= last).sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of pages) {
    const prev = out.length ? out[out.length - 1] : null;
    if (prev !== null && p - prev === 2) out.push(p - 1);   // a one-page gap reads better as the number
    else if (prev !== null && p - prev > 2) out.push(null);
    out.push(p);
  }
  return out;
}

interface PageRequest { page: number; q: string; mood: string; tag: string; nonce: number; }

type PageState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; entries: JournalEntry[]; total: number; req: PageRequest };

interface MonthGroup { key: string; label: string; entries: JournalEntry[]; }

@Component({
  selector: 'app-journal-entries',
  standalone: true,
  imports: [
    FormsModule, RouterLink, JiroPageHeaderComponent, JiroEmptyStateComponent,
    JiroButtonComponent, JiroIconComponent, JiroSkeletonComponent,
  ],
  template: `
    <div class="journal-entries">

      <jiro-page-header heading="All entries" [subtitle]="countLabel()">
        <jiro-button actions variant="primary" type="button" (click)="router.navigate(['/journal/new'])">New entry</jiro-button>
      </jiro-page-header>

      <!-- Filters -->
      <div class="filters-row">
        <input
          type="search"
          class="filter-input"
          aria-label="Search entries"
          placeholder="Search entries..."
          [ngModel]="searchInput()"
          (ngModelChange)="onSearchInput($event)" />
        <select class="filter-select" aria-label="Filter by mood" [ngModel]="mood()" (ngModelChange)="onMoodChange($event)">
          <option value="">All moods</option>
          @for (m of moods; track m.value) {
            <option [value]="m.value">{{ m.label }}</option>
          }
        </select>
        <input
          type="text"
          class="filter-input filter-tag"
          aria-label="Filter by tag"
          placeholder="Filter by tag..."
          [ngModel]="tagInput()"
          (ngModelChange)="onTagInput($event)" />
        @if (filtering()) {
          <button class="list-clear" type="button" (click)="clearFilters()">Clear filters</button>
        }
      </div>

      <div #listTop class="list-top">
        @switch (state().status) {
          @case ('loading') {
            <ul class="entries-list" aria-hidden="true">
              @for (i of skeletonRows; track i) {
                <li class="entry-row entry-row--skeleton">
                  <jiro-skeleton height="12px" width="96px" />
                  <jiro-skeleton height="18px" width="45%" />
                  <jiro-skeleton [lines]="2" height="13px" />
                </li>
              }
            </ul>
            <span class="sr-only" role="status">Loading entries</span>
          }

          @case ('error') {
            <div class="error-box" role="alert">
              <jiro-icon name="warning-circle" [size]="20" />
              <p>Could not load your entries.</p>
              <jiro-button variant="secondary" size="sm" type="button" (click)="retry()">Retry</jiro-button>
            </div>
          }

          @case ('ready') {
            @if (total() === 0) {
              @if (filtering()) {
                <jiro-empty-state
                  icon="magnifying-glass"
                  heading="Nothing matches"
                  message="No entry matches this search, mood or tag.">
                  <jiro-button variant="secondary" type="button" (click)="clearFilters()">Clear filters</jiro-button>
                </jiro-empty-state>
              } @else {
                <jiro-empty-state
                  icon="notebook"
                  heading="No entries yet"
                  message="A sentence is enough. Just begin.">
                  <jiro-button type="button" (click)="router.navigate(['/journal/new'])">New entry</jiro-button>
                </jiro-empty-state>
              }
            } @else {
              @for (g of groups(); track g.key) {
                <section class="month" [attr.aria-labelledby]="'month-' + g.key">
                  <h2 class="month-title" [id]="'month-' + g.key">{{ g.label }}</h2>
                  <ul class="entries-list">
                    @for (e of g.entries; track e.id) {
                      <li>
                        <a class="entry-row" [routerLink]="['/journal', e.id, 'edit']">
                          <div class="entry-meta">
                            <span class="entry-date">{{ formatDate(e.created_at) }}</span>
                            @if (e.mood) {
                              <span class="mood-chip" [style.border-left-color]="moodColor(e.mood)">{{ moodLabel(e.mood) }}</span>
                            }
                          </div>
                          <h3 class="entry-title" [class.entry-title--untitled]="!e.title">{{ e.title || 'Untitled' }}</h3>
                          @if (excerpt(e.body)) {
                            <p class="entry-excerpt">{{ excerpt(e.body) }}</p>
                          }
                          @if (e.tags?.length) {
                            <div class="tag-list">
                              @for (t of e.tags; track t) {
                                <span class="tag-chip">{{ t }}</span>
                              }
                            </div>
                          }
                        </a>
                      </li>
                    }
                  </ul>
                </section>
              }

              <p class="showing" role="status">{{ showingLabel() }}</p>

              @if (lastPage() > 1) {
                <nav class="pager" aria-label="Pagination">
                  @if (page() > 1) {
                    <a class="pg-btn pg-step" [routerLink]="[]" [queryParams]="pageParams(page() - 1)" queryParamsHandling="merge">
                      <jiro-icon name="caret-left" [size]="14" /> <span aria-hidden="true">Prev</span><span class="sr-only">Previous page</span>
                    </a>
                  } @else {
                    <span class="pg-btn pg-step is-disabled" aria-disabled="true">
                      <jiro-icon name="caret-left" [size]="14" /> <span aria-hidden="true">Prev</span><span class="sr-only">Previous page</span>
                    </span>
                  }

                  <ol class="pg-numbers">
                    @for (p of pages(); track $index) {
                      <li>
                        @if (p === null) {
                          <span class="pg-gap" aria-hidden="true">...</span>
                        } @else if (p === page()) {
                          <a class="pg-btn pg-num is-current" [routerLink]="[]" [queryParams]="pageParams(p)" queryParamsHandling="merge"
                             aria-current="page" [attr.aria-label]="'Page ' + p">{{ p }}</a>
                        } @else {
                          <a class="pg-btn pg-num" [routerLink]="[]" [queryParams]="pageParams(p)" queryParamsHandling="merge"
                             [attr.aria-label]="'Page ' + p">{{ p }}</a>
                        }
                      </li>
                    }
                  </ol>
                  <span class="pg-compact">Page {{ page() }} of {{ lastPage() }}</span>

                  @if (page() < lastPage()) {
                    <a class="pg-btn pg-step" [routerLink]="[]" [queryParams]="pageParams(page() + 1)" queryParamsHandling="merge">
                      <span aria-hidden="true">Next</span><span class="sr-only">Next page</span> <jiro-icon name="caret-right" [size]="14" />
                    </a>
                  } @else {
                    <span class="pg-btn pg-step is-disabled" aria-disabled="true">
                      <span aria-hidden="true">Next</span><span class="sr-only">Next page</span> <jiro-icon name="caret-right" [size]="14" />
                    </span>
                  }
                </nav>
              }
            }
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .journal-entries { max-width: 860px; }

    /* Filters (as on journal-home) */
    .filters-row { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-lg); flex-wrap: wrap; }
    .filter-input, .filter-select {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-surface); color: var(--text-primary); padding: 7px var(--space-sm); flex: 1; min-width: 140px;
    }
    .filter-input:focus, .filter-select:focus { border-color: var(--color-primary); }
    .filter-tag { min-width: 120px; }
    .list-clear {
      background: none; border: none; padding: 0;
      color: var(--color-primary); font: inherit; font-size: var(--font-size-sm);
      cursor: pointer; text-decoration: underline; white-space: nowrap;
    }

    /* Clears the sticky mobile top bar (0px on desktop) when scrolled to. */
    .list-top { scroll-margin-top: calc(var(--topbar-height, 0px) + var(--space-lg)); }

    /* Month groups */
    .month + .month { margin-top: var(--space-xl); }
    .month-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md); font-weight: 600; color: var(--text-primary);
      margin: 0 0 var(--space-sm);
    }

    /* Entry rows (as journal-home's entry cards) */
    .entries-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-md); }
    .entry-row {
      display: block; min-width: 0;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
      color: inherit; text-decoration: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    a.entry-row:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); text-decoration: none; }
    a.entry-row:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .entry-row--skeleton { display: flex; flex-direction: column; gap: var(--space-sm); }

    .entry-meta { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-xs); }
    .entry-date { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .mood-chip {
      font-size: var(--font-size-xs); padding: 2px 8px 2px 7px;
      background: var(--bg-canvas); color: var(--text-secondary);
      border: 1px solid var(--border-color);
      border-left: 3px solid var(--border-color);
      border-radius: var(--border-radius-sm);
    }
    .entry-title {
      font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-xs);
      color: var(--text-primary); overflow-wrap: anywhere;
    }
    .entry-title--untitled { color: var(--text-secondary); font-style: italic; }
    .entry-excerpt {
      font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0 0 var(--space-sm);
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical;
      overflow-wrap: anywhere;
    }
    .entry-excerpt:last-child { margin-bottom: 0; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag-chip { font-size: 0.7rem; padding: 2px 8px; background: var(--bg-canvas); border-radius: 99px; color: var(--text-secondary); border: 1px solid var(--border-color); }

    /* Error */
    .error-box {
      display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap;
      padding: var(--space-md) var(--space-lg);
      border: 1px solid color-mix(in srgb, var(--color-danger) 35%, var(--border-color));
      background: color-mix(in srgb, var(--color-danger) 6%, var(--bg-surface));
      border-radius: var(--border-radius); color: var(--text-primary);
    }
    .error-box jiro-icon { color: var(--color-danger); }
    .error-box p { margin: 0; flex: 1; min-width: 12ch; font-size: var(--font-size-sm); }

    /* Pager */
    .showing { margin: var(--space-lg) 0 var(--space-sm); font-size: var(--font-size-sm); color: var(--text-secondary); text-align: center; }
    .pager { display: flex; align-items: center; justify-content: center; gap: var(--space-xs); flex-wrap: nowrap; margin-bottom: var(--space-xl); }
    .pg-numbers { display: flex; align-items: center; gap: var(--space-xs); list-style: none; margin: 0; padding: 0; }
    .pg-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 4px;
      min-width: 40px; min-height: 40px; padding: 0 var(--space-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-sm); font-weight: 500; text-decoration: none; white-space: nowrap;
      transition: border-color 0.15s, background 0.15s;
    }
    a.pg-btn:hover { border-color: var(--color-primary); text-decoration: none; }
    a.pg-btn:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .pg-btn.is-current {
      background: var(--color-primary); border-color: var(--color-primary);
      color: var(--text-on-primary); font-weight: 600;
    }
    .pg-btn.is-disabled { color: var(--text-muted); background: transparent; cursor: default; }
    .pg-gap { display: inline-block; min-width: 24px; text-align: center; color: var(--text-secondary); }
    .pg-compact { display: none; font-size: var(--font-size-sm); color: var(--text-secondary); white-space: nowrap; }

    @media (max-width: 600px) {
      .filters-row { flex-direction: column; align-items: stretch; }
      .filter-input, .filter-select { min-width: 0; }
      .list-clear { align-self: flex-start; }
      .entry-row { padding: var(--space-md); }
    }

    @media (max-width: 480px) {
      .pg-numbers { display: none; }
      .pg-compact { display: inline; flex: 1; text-align: center; }
      .pager { justify-content: space-between; }
    }
  `],
})
export class JournalEntriesComponent {
  readonly moods = MOODS;
  readonly skeletonRows = [0, 1, 2, 3, 4];

  protected readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly svc = inject(JournalService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly listTop = viewChild<ElementRef<HTMLElement>>('listTop');

  // ── URL state ────────────────────────────────────────────────────────────
  private readonly qp = toSignal(this.route.queryParamMap, { requireSync: true });

  readonly page = computed(() => parsePage(this.qp().get('page')) ?? 1);
  readonly q = computed(() => (this.qp().get('q') ?? '').trim());
  readonly mood = computed(() => this.qp().get('mood') ?? '');
  readonly tag = computed(() => (this.qp().get('tag') ?? '').trim());
  readonly filtering = computed(() => !!(this.q() || this.mood() || this.tag()));

  /** What the two text boxes show; they lead the URL by the debounce. */
  readonly searchInput = signal('');
  readonly tagInput = signal('');
  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private tagTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly nonce = signal(0);

  // ── Data ─────────────────────────────────────────────────────────────────
  readonly state = signal<PageState>({ status: 'loading' });
  /** The last known total, kept through reloads so the header does not flicker. */
  readonly total = signal<number | null>(null);

  readonly lastPage = computed(() => Math.max(1, Math.ceil((this.total() ?? 0) / ENTRIES_PAGE_SIZE)));
  readonly pages = computed(() => pagerItems(this.page(), this.lastPage()));

  readonly groups = computed<MonthGroup[]>(() => {
    const s = this.state();
    if (s.status !== 'ready') return [];
    const out: MonthGroup[] = [];
    for (const e of s.entries) {
      const d = new Date(e.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      let g = out[out.length - 1];
      if (!g || g.key !== key) {
        g = { key, label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), entries: [] };
        out.push(g);
      }
      g.entries.push(e);
    }
    return out;
  });

  readonly countLabel = computed(() => {
    const t = this.total();
    if (t === null) return '';
    const noun = t === 1 ? 'entry' : 'entries';
    return this.filtering() ? `${t} matching ${noun}` : `${t} ${noun}`;
  });

  readonly showingLabel = computed(() => {
    const s = this.state();
    if (s.status !== 'ready' || s.total === 0) return '';
    const from = (s.req.page - 1) * ENTRIES_PAGE_SIZE + 1;
    const to = from + s.entries.length - 1;
    return `Showing ${from}-${to} of ${s.total} ${s.total === 1 ? 'entry' : 'entries'}`;
  });

  constructor() {
    // Keep the text boxes in step with the URL (Back/Forward, shared links,
    // Clear filters) without trampling what is being typed.
    effect(() => {
      const q = this.q();
      untracked(() => { if (this.searchInput().trim() !== q) this.searchInput.set(q); });
    });
    effect(() => {
      const tag = this.tag();
      untracked(() => { if (this.tagInput().trim() !== tag) this.tagInput.set(tag); });
    });

    // An invalid or explicit page=1 in the URL is normalised away.
    effect(() => {
      const raw = this.qp().get('page');
      if (raw !== null && (parsePage(raw) ?? 1) === 1) {
        untracked(() => this.setParams({ page: null }, true));
      }
    });

    const request = computed<PageRequest>(() => ({
      page: this.page(), q: this.q(), mood: this.mood(), tag: this.tag(), nonce: this.nonce(),
    }));

    let lastLoadedPage: number | null = null;

    toObservable(request).pipe(
      distinctUntilChanged((a, b) =>
        a.page === b.page && a.q === b.q && a.mood === b.mood && a.tag === b.tag && a.nonce === b.nonce),
      tap(() => this.state.set({ status: 'loading' })),
      // switchMap drops the in-flight request when the page or a filter
      // changes, so a slow earlier response can never overwrite a later one.
      switchMap(req => {
        const params: ListEntriesParams = {
          limit: ENTRIES_PAGE_SIZE,
          offset: (req.page - 1) * ENTRIES_PAGE_SIZE,
        };
        if (req.q) params.q = req.q;
        if (req.mood) params.mood = req.mood;
        if (req.tag) params.tag = req.tag;
        return this.svc.listEntriesPage(params).pipe(
          map(res => ({ req, res })),
          catchError(() => of({ req, res: null })),
        );
      }),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ req, res }) => {
      if (!res) {
        this.state.set({ status: 'error' });
        return;
      }
      this.total.set(res.total);

      // Past the end (entries deleted since, or a hand-edited URL): go to
      // the real last page instead of showing an empty one.
      const last = Math.max(1, Math.ceil(res.total / ENTRIES_PAGE_SIZE));
      if (req.page > last) {
        this.setParams({ page: last > 1 ? last : null }, true);
        return;
      }

      this.state.set({ status: 'ready', entries: res.entries, total: res.total, req });

      if (lastLoadedPage !== null && lastLoadedPage !== req.page) {
        // The app scrolls inside <body>, not the window, so scroll the
        // element itself. Wait a frame for the new rows to render.
        requestAnimationFrame(() => {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          this.listTop()?.nativeElement.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        });
      }
      lastLoadedPage = req.page;
    });

    this.destroyRef.onDestroy(() => this.clearTimers());
  }

  // ── Filters ──────────────────────────────────────────────────────────────
  onSearchInput(value: string) {
    this.searchInput.set(value);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => {
      this.searchTimer = null;
      this.setParams({ q: value.trim() || null, page: null }, true);
    }, 300);
  }

  onTagInput(value: string) {
    this.tagInput.set(value);
    if (this.tagTimer) clearTimeout(this.tagTimer);
    this.tagTimer = setTimeout(() => {
      this.tagTimer = null;
      this.setParams({ tag: value.trim() || null, page: null }, true);
    }, 300);
  }

  onMoodChange(value: string) {
    this.setParams({ mood: value || null, page: null }, false);
  }

  clearFilters() {
    this.clearTimers();
    this.searchInput.set('');
    this.tagInput.set('');
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  retry() { this.nonce.update(n => n + 1); }

  /** Query params for a pager link; page 1 is left out of the URL. */
  pageParams(p: number): Record<string, number | null> {
    return { page: p > 1 ? p : null };
  }

  private setParams(params: Record<string, string | number | null>, replaceUrl: boolean) {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      queryParamsHandling: 'merge',
      replaceUrl,
    });
  }

  private clearTimers() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.tagTimer) clearTimeout(this.tagTimer);
    this.searchTimer = this.tagTimer = null;
  }

  // ── Display helpers ──────────────────────────────────────────────────────
  formatDate(s: string): string {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** Body as one line of plain text; CSS clamps it to two lines. */
  excerpt(body: string): string {
    const flat = (body ?? '').replace(/\s+/g, ' ').trim();
    return flat.length > 240 ? flat.slice(0, 240) + '...' : flat;
  }

  moodLabel(value: string): string { return moodLabelFor(value); }
  moodColor(value: string): string { return moodColorFor(value); }
}

/** A positive whole page number, or null for anything else. */
function parsePage(raw: string | null): number | null {
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && Number.isSafeInteger(n) ? n : null;
}
