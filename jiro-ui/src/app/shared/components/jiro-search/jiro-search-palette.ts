import {
  AfterViewInit, Component, ElementRef, OnDestroy, PLATFORM_ID,
  computed, inject, linkedSignal, signal, viewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  Observable, catchError, debounce, distinctUntilChanged, filter, map, merge, of, share,
  switchMap, takeUntil, timer,
} from 'rxjs';
import { SearchItem, SearchResponse, SearchService } from '../../../core/services/search.service';
import { SearchPaletteService } from '../../../core/search-palette.service';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../jiro-skeleton/jiro-skeleton';
import { IconName } from '../../icons/icons.generated';

const MIN_CHARS = 2;
const DEBOUNCE_MS = 250;
/** Skeleton rows only appear if a request takes longer than this. */
const SKELETON_DELAY_MS = 150;

type GroupKey = 'recipes' | 'exercises' | 'sessions' | 'journal';

const GROUPS: { key: GroupKey; label: string; icon: IconName }[] = [
  { key: 'recipes', label: 'Recipes', icon: 'fork-knife' },
  { key: 'exercises', label: 'Exercises', icon: 'barbell' },
  { key: 'sessions', label: 'Sessions', icon: 'calendar-blank' },
  { key: 'journal', label: 'Journal', icon: 'notebook' },
];

type SearchState =
  | { kind: 'hint' }
  | { kind: 'loading' }
  | { kind: 'results'; data: SearchResponse }
  | { kind: 'rate-limited' }
  | { kind: 'error' };

interface Option {
  /** Unique DOM id, referenced by aria-activedescendant. */
  domId: string;
  index: number;
  group: GroupKey;
  item: SearchItem;
}

interface RenderedGroup {
  key: GroupKey;
  label: string;
  icon: IconName;
  hasMore: boolean;
  options: Option[];
}

interface TextPart { text: string; match: boolean; }

/**
 * Global search command palette (Ctrl/Cmd+K). Rendered by the main layout
 * while SearchPaletteService.open() is true; closing destroys it, which
 * returns focus to whatever was focused before it opened.
 *
 * Follows the ARIA combobox pattern: focus stays in the input, the active
 * option is exposed through aria-activedescendant, and options are never
 * tabbable. Matched text is split in TypeScript and rendered with <mark>
 * through interpolation — never innerHTML, since titles are user content.
 */
@Component({
  selector: 'jiro-search-palette',
  standalone: true,
  imports: [JiroIconComponent, JiroSkeletonComponent],
  template: `
    <div class="sp-backdrop" (click)="onBackdropClick($event)">
      <div
        #dialog
        class="sp-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        (keydown)="onKeydown($event)">
        <div class="sp-input-row">
          <jiro-icon name="magnifying-glass" [size]="20" class="sp-input-icon" />
          <input
            #input
            type="text"
            class="sp-input"
            role="combobox"
            aria-label="Search recipes, exercises, sessions and journal"
            aria-autocomplete="list"
            aria-controls="search-listbox"
            [attr.aria-expanded]="options().length > 0"
            [attr.aria-activedescendant]="activeOption()?.domId ?? null"
            placeholder="Search recipes, exercises, sessions, journal…"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="go"
            [value]="query()"
            (input)="onInput($event)" />
          <button type="button" class="sp-close" aria-label="Close search" (click)="palette.close()">
            <span class="sp-close-desktop" aria-hidden="true">Esc</span>
            <span class="sp-close-mobile">Cancel</span>
          </button>
        </div>

        <div class="sp-body">
          <div
            id="search-listbox"
            role="listbox"
            aria-label="Search results"
            class="sp-listbox"
            [class.sp-listbox--empty]="options().length === 0"
            [class.stale]="stale()"
            [attr.aria-busy]="stale() || null">
            @for (g of groups(); track g.key) {
              <div role="group" class="sp-group" [attr.aria-labelledby]="'search-group-' + g.key">
                <div class="sp-group-label" role="presentation" [id]="'search-group-' + g.key">
                  <span>{{ g.label }}</span>
                  @if (g.hasMore) { <span class="sp-group-more">Top {{ g.options.length }} shown</span> }
                </div>
                @for (o of g.options; track o.domId) {
                  <div
                    role="option"
                    class="sp-option"
                    [id]="o.domId"
                    [class.active]="o.index === activeIndex()"
                    [attr.aria-selected]="o.index === activeIndex()"
                    (mousemove)="activeIndex.set(o.index)"
                    (mousedown)="$event.preventDefault()"
                    (click)="choose(o)">
                    <jiro-icon [name]="g.icon" [size]="18" class="sp-option-icon" />
                    <div class="sp-option-text">
                      <span class="sp-option-title">@for (p of highlight(titleOf(o)); track $index) {@if (p.match) {<mark>{{ p.text }}</mark>} @else {<span>{{ p.text }}</span>}}</span>
                      @if (o.item.title && o.item.snippet) {
                        <span class="sp-option-snippet">@for (p of highlight(o.item.snippet); track $index) {@if (p.match) {<mark>{{ p.text }}</mark>} @else {<span>{{ p.text }}</span>}}</span>
                      }
                      @if (metaOf(o); as meta) {
                        <span class="sp-option-meta">{{ meta }}</span>
                      }
                    </div>
                    @if (o.item.in_progress) {
                      <span class="sp-badge">In progress</span>
                    }
                  </div>
                }
              </div>
            }
          </div>

          @switch (state().kind) {
            @case ('hint') {
              <p class="sp-message">Type at least 2 characters</p>
            }
            @case ('loading') {
              @if (showSkeleton()) {
                <div class="sp-skeleton">
                  @for (i of skeletonRows; track i) {
                    <div class="sp-skeleton-row">
                      <jiro-skeleton height="18px" width="18px" />
                      <jiro-skeleton class="sp-skeleton-text" [lines]="2" height="12px" />
                    </div>
                  }
                </div>
              }
            }
            @case ('results') {
              @if (options().length === 0) {
                <p class="sp-message">No matches for "{{ resultQuery() }}"</p>
              }
            }
            @case ('rate-limited') {
              <p class="sp-message sp-message--warn">Searching too fast. Try again in a moment.</p>
            }
            @case ('error') {
              <p class="sp-message sp-message--warn">Search is unavailable right now</p>
            }
          }
        </div>

        <div class="sr-only" aria-live="polite" aria-atomic="true">{{ announcement() }}</div>
      </div>
    </div>
  `,
  styles: [`
    .sp-backdrop {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 12vh var(--space-lg) var(--space-lg);
      animation: sp-fade 0.12s ease;
    }

    .sp-panel {
      width: 100%;
      max-width: 640px;
      max-height: min(560px, 76vh);
      display: flex;
      flex-direction: column;
      background: var(--bg-surface);
      color: var(--text-primary); /* own the text colour: opened from the dark sidebar */
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
      overflow: hidden;
    }

    .sp-input-row {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: 0 var(--space-sm) 0 var(--space-md);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }

    .sp-input-icon { color: var(--text-muted); flex-shrink: 0; }

    .sp-input {
      flex: 1;
      min-width: 0;
      height: 56px;
      border: none;
      background: transparent;
      color: var(--text-primary);
      font-family: inherit;
      font-size: var(--font-size-lg);
    }
    .sp-input::placeholder { color: var(--text-muted); }
    /* The whole row is the field; the global input ring would sit inside it. */
    .sp-input:focus-visible { outline: none; }
    .sp-input-row:focus-within { box-shadow: inset 0 -2px 0 var(--color-primary); }

    .sp-close {
      flex-shrink: 0;
      min-width: 44px;
      min-height: 44px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      font-family: inherit;
      font-size: var(--font-size-sm);
      cursor: pointer;
    }
    .sp-close:hover { color: var(--text-primary); background: var(--bg-surface-hover); }
    .sp-close-desktop {
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 2px 6px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
    }
    .sp-close-mobile { display: none; }

    .sp-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overscroll-behavior: contain;
    }

    .sp-listbox { padding: var(--space-xs) var(--space-sm) var(--space-sm); }
    .sp-listbox--empty { padding: 0; }

    .sp-group + .sp-group { margin-top: var(--space-xs); }

    .sp-group-label {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: var(--space-sm) var(--space-sm) var(--space-xs);
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-muted);
    }
    .sp-group-more { text-transform: none; letter-spacing: 0; font-weight: 500; }

    .sp-option {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      min-height: 44px;
      padding: var(--space-sm);
      border-radius: var(--border-radius);
      cursor: pointer;
      box-sizing: border-box;
    }
    .sp-option.active {
      background: var(--bg-surface-hover);
      box-shadow: inset 3px 0 0 var(--color-primary);
    }

    .sp-option-icon { color: var(--text-muted); flex-shrink: 0; }
    .sp-option.active .sp-option-icon { color: var(--color-primary); }

    .sp-option-text {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .sp-option-title,
    .sp-option-snippet,
    .sp-option-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .sp-option-title { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); }
    .sp-option-snippet { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .sp-option-meta { font-size: var(--font-size-xs); color: var(--text-muted); }

    mark {
      background: rgba(var(--color-primary-rgb), 0.18);
      color: inherit;
      font-weight: 700;
      border-radius: var(--border-radius-sm);
      padding: 0 1px;
    }

    .sp-listbox.stale { opacity: 0.55; transition: opacity 0.12s ease; }

    .sp-badge {
      flex-shrink: 0;
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--border-radius-pill);
      background: rgba(var(--color-accent-rgb), 0.15);
      color: var(--text-primary);
      border: 1px solid rgba(var(--color-accent-rgb), 0.5);
      white-space: nowrap;
    }

    .sp-message {
      margin: 0;
      padding: var(--space-xl) var(--space-lg);
      text-align: center;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      overflow-wrap: anywhere;
    }
    .sp-message--warn { color: var(--text-primary); }

    .sp-skeleton {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      padding: var(--space-md);
    }
    .sp-skeleton-row { display: flex; align-items: flex-start; gap: var(--space-sm); }
    .sp-skeleton-text { flex: 1; }

    @keyframes sp-fade { from { opacity: 0; } to { opacity: 1; } }

    /* Same breakpoint as the main layout's phone shell: a full-screen sheet. */
    @media (max-width: 768px) {
      .sp-backdrop { padding: 0; align-items: stretch; }
      .sp-panel {
        max-width: none;
        max-height: none;
        height: 100dvh;
        border: none;
        border-radius: 0;
        box-shadow: none;
        padding-top: env(safe-area-inset-top);
        padding-bottom: env(safe-area-inset-bottom);
      }
      /* 16px stops iOS Safari zooming into the field on focus. */
      .sp-input { font-size: 16px; height: 52px; }
      .sp-close-desktop { display: none; }
      .sp-close-mobile { display: inline; color: var(--color-primary); font-weight: 600; padding: 0 var(--space-xs); }
    }
  `],
})
export class JiroSearchPaletteComponent implements AfterViewInit, OnDestroy {
  readonly palette = inject(SearchPaletteService);
  private readonly api = inject(SearchService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly dialogRef = viewChild.required<ElementRef<HTMLElement>>('dialog');

  /** Element focused before the palette opened; focus goes back there on close. */
  private readonly previousFocus: HTMLElement | null =
    this.isBrowser && document.activeElement instanceof HTMLElement ? document.activeElement : null;

  readonly skeletonRows = [0, 1, 2];
  readonly query = signal('');

  readonly state = toSignal(
    toObservable(this.query).pipe(
      map(q => q.trim()),
      // Under the minimum there is nothing to wait for: clear at once.
      map(q => (q.length < MIN_CHARS ? '' : q)),
      debounce(q => timer(q ? DEBOUNCE_MS : 0)),
      distinctUntilChanged(),
      // switchMap cancels the in-flight request when the query moves on, so a
      // slow stale response can never replace newer results.
      switchMap(q => (q ? this.run(q) : of<SearchState>({ kind: 'hint' }))),
    ),
    { initialValue: { kind: 'hint' } as SearchState },
  );

  /** 'loading' is only emitted once a request is slower than SKELETON_DELAY_MS. */
  readonly showSkeleton = computed(() => this.state().kind === 'loading');

  private readonly results = computed(() => {
    const s = this.state();
    return s.kind === 'results' ? s.data : null;
  });

  readonly resultQuery = computed(() => this.results()?.query ?? '');

  /** True while the results shown are for an earlier query than the one typed. */
  readonly stale = computed(() => !!this.results() && this.resultQuery() !== this.query().trim());

  readonly groups = computed<RenderedGroup[]>(() => {
    const data = this.results();
    if (!data) return [];
    let index = 0;
    const out: RenderedGroup[] = [];
    for (const g of GROUPS) {
      const group = data[g.key];
      if (!group || group.items.length === 0) continue;
      out.push({
        key: g.key,
        label: g.label,
        icon: g.icon,
        hasMore: group.has_more,
        options: group.items.map(item => {
          const i = index++;
          return { domId: `search-opt-${i}`, index: i, group: g.key, item };
        }),
      });
    }
    return out;
  });

  readonly options = computed<Option[]>(() => this.groups().flatMap(g => g.options));

  /** Resets to the first option whenever a new result set arrives. */
  readonly activeIndex = linkedSignal<Option[], number>({
    source: this.options,
    computation: opts => (opts.length ? 0 : -1),
  });

  readonly activeOption = computed<Option | null>(() => this.options()[this.activeIndex()] ?? null);

  readonly announcement = computed(() => {
    const s = this.state();
    switch (s.kind) {
      case 'hint': return this.query().trim().length > 0 ? 'Type at least 2 characters' : '';
      case 'loading': return this.showSkeleton() ? 'Searching…' : '';
      case 'rate-limited': return 'Searching too fast. Try again in a moment.';
      case 'error': return 'Search is unavailable right now';
      case 'results': {
        const n = this.options().length;
        if (n === 0) return `No matches for "${s.data.query}"`;
        return n === 1 ? '1 result' : `${n} results`;
      }
    }
  });

  constructor() {
    // Leaving the page by any route (back button, a link behind the panel)
    // closes the palette too.
    this.router.events
      .pipe(filter(e => e instanceof NavigationStart), takeUntilDestroyed())
      .subscribe(() => this.palette.close());
  }

  // Synchronous, unlike afterNextRender: when the shortcut opens the palette
  // (see main-layout), this runs inside that same keydown.
  ngAfterViewInit() {
    if (this.isBrowser) this.inputRef().nativeElement.focus();
  }

  ngOnDestroy() {
    if (this.previousFocus?.isConnected) this.previousFocus.focus();
  }

  /**
   * One request. Emits { kind: 'loading' } only if the response has not come
   * back within SKELETON_DELAY_MS, so fast answers never flash a skeleton; the
   * previous results stay on screen until then.
   */
  private run(q: string): Observable<SearchState> {
    const request$ = this.api.search(q).pipe(
      map((data): SearchState => ({ kind: 'results', data })),
      catchError((err: unknown) =>
        of<SearchState>(err instanceof HttpErrorResponse && err.status === 429 ? { kind: 'rate-limited' } : { kind: 'error' })),
      share(),
    );
    const slow$ = timer(SKELETON_DELAY_MS).pipe(
      takeUntil(request$),
      map((): SearchState => ({ kind: 'loading' })),
    );
    return merge(slow$, request$);
  }

  onInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
  }

  onBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) this.palette.close();
  }

  onKeydown(event: KeyboardEvent) {
    const count = this.options().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (!count) return;
        const step = event.key === 'ArrowDown' ? 1 : -1;
        const current = this.activeIndex();
        const next = current < 0 ? (step > 0 ? 0 : count - 1) : (current + step + count) % count;
        this.activeIndex.set(next);
        this.scrollActiveIntoView();
        return;
      }
      case 'Enter': {
        event.preventDefault();
        // The list on screen can belong to the previous query for the length
        // of the debounce plus the request; don't open a result the user has
        // already typed past.
        const o = this.activeOption();
        if (o && !this.stale()) this.choose(o);
        return;
      }
      case 'Escape':
        event.preventDefault();
        event.stopPropagation();
        this.palette.close();
        return;
      case 'Tab':
        this.trapTab(event);
        return;
    }
  }

  choose(o: Option) {
    const { item } = o;
    this.palette.close();
    switch (o.group) {
      case 'recipes':
        this.router.navigate(['/culinara', item.id]);
        break;
      case 'exercises':
        this.router.navigate(['/jym/exercises', item.id]);
        break;
      case 'sessions':
        if (item.in_progress) {
          this.router.navigate(['/jym/session', item.id]);
        } else {
          // Completed sessions open read-only in history. The player would
          // restart its timer, and Finish would overwrite ended_at.
          // 'reload' so picking the same session twice still re-focuses it.
          this.router.navigate(['/jym/track'], {
            queryParams: { tab: 'sessions', session: item.id },
            onSameUrlNavigation: 'reload',
          });
        }
        break;
      case 'journal':
        this.router.navigate(['/journal', item.id, 'edit']);
        break;
    }
  }

  titleOf(o: Option): string {
    if (o.item.title) return o.item.title;
    // Most entries are untitled; their own words tell them apart, a repeated
    // "Untitled entry" label doesn't.
    return o.item.snippet?.trim() || (o.group === 'journal' ? 'Untitled entry' : '');
  }

  metaOf(o: Option): string {
    const { item } = o;
    const parts: string[] = [];
    if (o.group === 'exercises' && item.subtitle) parts.push(capitalise(item.subtitle));
    if (o.group === 'sessions' && item.subtitle && item.subtitle !== 'normal') parts.push(capitalise(item.subtitle));
    if (o.group === 'journal' && item.group_id) parts.push('Group post');
    if (item.date) parts.push(formatDate(item.date));
    return parts.join(' · ');
  }

  /** Splits text around case-insensitive matches of the query that produced the results. */
  highlight(text: string): TextPart[] {
    const q = this.resultQuery();
    if (!text) return [];
    if (!q) return [{ text, match: false }];
    const lowerText = text.toLowerCase();
    const lowerQ = q.toLowerCase();
    // Some characters change length when lower-cased (e.g. 'İ'); offsets
    // would drift, so skip highlighting rather than cut in the wrong place.
    if (lowerText.length !== text.length || lowerQ.length !== q.length) return [{ text, match: false }];
    const parts: TextPart[] = [];
    let from = 0;
    while (from < text.length) {
      const at = lowerText.indexOf(lowerQ, from);
      if (at < 0) break;
      if (at > from) parts.push({ text: text.slice(from, at), match: false });
      parts.push({ text: text.slice(at, at + q.length), match: true });
      from = at + q.length;
    }
    if (from < text.length) parts.push({ text: text.slice(from), match: false });
    return parts;
  }

  private scrollActiveIntoView() {
    const o = this.activeOption();
    if (!o || !this.isBrowser) return;
    this.host.nativeElement.querySelector(`#${o.domId}`)?.scrollIntoView({ block: 'nearest' });
  }

  /** Keeps Tab and Shift+Tab cycling inside the dialog. */
  private trapTab(event: KeyboardEvent) {
    const focusables = Array.from(
      this.dialogRef().nativeElement.querySelectorAll<HTMLElement>(
        'input, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ),
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !focusables.includes(active as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !focusables.includes(active as HTMLElement))) {
      event.preventDefault();
      first.focus();
    }
  }
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
