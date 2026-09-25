import {
  Component, Input, Output, EventEmitter,
  signal, OnChanges, SimpleChanges, HostListener,
  ElementRef, Injector, afterNextRender, inject,
} from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { RouterLink } from '@angular/router';

import { JournalEntry, JournalService, MOODS } from '../../../core/services/journal.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { isJiroModalOpen } from '../../../shared/components/jiro-modal/jiro-modal';
import { SettingsService } from '../../../core/services/settings.service';
import { todayKey } from '../../../core/utils/day';

@Component({
  selector: 'journal-day-modal',
  standalone: true,
  imports: [A11yModule, RouterLink, JiroButtonComponent],
  template: `
    <!-- Backdrop -->
    <div class="backdrop" (click)="close.emit()" aria-hidden="true"></div>

    <!-- Sheet / Dialog -->
    <div
      class="modal"
      role="dialog"
      aria-labelledby="dm-date"
      aria-modal="true"
      cdkTrapFocus
      [cdkTrapFocusAutoCapture]="true"
      (touchstart)="touchStartY = $event.touches[0].clientY"
      (touchend)="onSwipeEnd($event)">

      <!-- Drag handle (mobile) -->
      <div class="handle" aria-hidden="true"></div>

      <!-- Header -->
      <div class="modal-header">
        @if (expanded() || expandLoading()) {
<button class="hdr-btn" (click)="backToList()" aria-label="Back to list">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          Back
        </button>
}
        <h2 id="dm-date" class="modal-date">{{ formattedDate }}</h2>
        <button class="hdr-btn hdr-close" (click)="close.emit()" aria-label="Close">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">

        @if (showDayLink()) {
          <a class="day-link" [routerLink]="['/day', date]">See the whole day</a>
        }

        <!-- Empty state -->
        @if (!entries.length) {
<div class="empty-state">
          <p class="text-secondary">No entries for this day.</p>
          <jiro-button variant="primary" type="button" (click)="newEntry.emit()">Write now</jiro-button>
        </div>
}

        <!-- Entry list -->
        @if (!expanded() && !expandLoading() && entries.length) {
<div class="entry-list">
          @for (e of entries; track e) {
<div
            class="entry-card"
            (click)="expandEntry(e)">
            @if (showAuthor) {
<div class="card-author">{{ authorName(e) }}</div>
}
            <div class="card-meta">
              @if (e.mood) {
<span class="mood-chip">{{ moodLabel(e.mood) }}</span>
}
              <!-- The card is clickable anywhere; this button is its keyboard and
                   screen-reader handle, kept outside the Delete button's subtree. -->
              <button type="button" class="entry-time card-open" [attr.aria-label]="openLabel(e)">{{ formatTime(e.created_at) }}</button>
            </div>
            @if (e.title) {
<h3 class="card-title">{{ e.title }}</h3>
}
            <p class="card-excerpt">{{ excerpt(e.body) }}</p>
            @if (e.images?.length) {
<div class="card-images">
              @for (img of (e.images || []); track img) {
<img
                [src]="img.file_url"
                class="thumb"
                [alt]="imageAlt(e, $index, (e.images || []).length)"
                width="68"
                height="68" />
}
            </div>
}
            @if (e.tags?.length) {
<div class="tag-list">
              @for (t of (e.tags || []); track t) {
<span class="tag-chip">{{ t }}</span>
}
            </div>
}
            @if (canEdit(e)) {
<div class="card-delete-row" (click)="$event.stopPropagation()">
              <button class="card-delete-btn" (click)="deleteEntry.emit(e.id)" aria-label="Delete entry">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </button>
            </div>
}
          </div>
}

          <div class="list-footer">
            <jiro-button variant="secondary" type="button" (click)="newEntry.emit()">New Entry</jiro-button>
          </div>
        </div>
}

        <!-- Expand loading -->
        @if (expandLoading()) {
<div class="expand-loading">
          <div class="spinner"></div>
        </div>
}

        <!-- Expanded entry -->
        @if (expanded() && !expandLoading()) {
<div class="expanded-view">
          <div class="exp-top">
            @if (showAuthor) {
<span class="exp-author">{{ authorName(expanded()!) }}</span>
}
            @if (expanded()!.mood) {
<span class="mood-chip">{{ moodLabel(expanded()!.mood!) }}</span>
}
          </div>
          @if (expanded()!.title) {
<h3 class="exp-title">{{ expanded()!.title }}</h3>
}
          <p class="exp-body">{{ expanded()!.body }}</p>
          @if (expanded()!.images?.length) {
<div class="exp-images">
            @for (img of (expanded()!.images || []); track img) {
<img

              [src]="img.file_url"
              class="exp-img"
              [alt]="expandedImageAlt($index)"
              width="260"
              height="160"
              (click)="openLightbox(img.file_url, $index)" />
}
          </div>
}
          @if (expanded()!.tags?.length) {
<div class="tag-list">
            @for (t of (expanded()!.tags || []); track t) {
<span class="tag-chip">{{ t }}</span>
}
          </div>
}
          @if (canEdit(expanded()!)) {
<div class="exp-actions">
            <jiro-button variant="danger" type="button" (click)="deleteEntry.emit(expanded()!.id)">
              Delete
            </jiro-button>
            <jiro-button variant="primary" type="button" (click)="editEntry.emit(expanded()!.id)">
              Edit Entry
            </jiro-button>
          </div>
}
        </div>
}

      </div>
    </div>

    <!-- Lightbox -->
    @if (lightboxUrl()) {
<div class="lightbox" (click)="lightboxUrl.set(null)">
      <img [src]="lightboxUrl()!" [alt]="expandedImageAlt(lightboxIndex())" />
    </div>
}
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: var(--z-modal);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Backdrop ───────────────────────────────────────── */
    .backdrop {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.45);
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
      animation: fade-in 200ms ease-out forwards;
    }

    /* ── Modal ──────────────────────────────────────────── */
    .modal {
      position: relative;
      z-index: 1;
      background: var(--bg-surface);
      border-radius: var(--border-radius-lg);
      width: min(600px, calc(100vw - 32px));
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 10px 40px rgba(var(--shadow-rgb), 0.22);
      animation: modal-in 200ms ease-out forwards;
      overflow: hidden;
    }

    .handle { display: none; }

    /* ── Header ─────────────────────────────────────────── */
    .modal-header {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-md) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
      flex-shrink: 0;
    }
    .modal-date {
      flex: 1;
      font-size: var(--font-size-md);
      font-weight: 600;
      margin: 0;
    }
    .hdr-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      padding: 6px 10px;
      font-size: var(--font-size-sm);
      font-family: inherit;
      min-height: 36px;
      flex-shrink: 0;
      transition: background 0.15s, color 0.15s;
    }
    .hdr-btn:hover { background: var(--bg-surface-hover); color: var(--text-primary); }
    .hdr-close { padding: 6px 8px; min-width: 36px; justify-content: center; }

    /* ── Body ───────────────────────────────────────────── */
    .modal-body {
      overflow-y: auto;
      flex: 1;
      padding: var(--space-lg);
      overscroll-behavior: contain;
    }

    .day-link {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      margin-bottom: var(--space-sm);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
    }

    /* ── Empty state ────────────────────────────────────── */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-md);
      padding: var(--space-xl) 0;
      text-align: center;
    }

    /* ── Entry list ─────────────────────────────────────── */
    .entry-list { display: flex; flex-direction: column; gap: var(--space-md); }

    .entry-card {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      cursor: pointer;
      transition: transform 0.15s ease-out, border-color 0.15s, box-shadow 0.15s;
    }
    .entry-card:hover, .entry-card:has(.card-open:focus-visible) {
      transform: translateY(-2px);
      border-color: var(--color-primary);
      box-shadow: 0 4px 14px rgba(var(--shadow-rgb), 0.12);
    }

    .card-author {
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-primary);
      margin-bottom: 3px;
    }
    .card-meta {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-bottom: var(--space-xs);
    }
    .entry-time { font-size: var(--font-size-xs); color: var(--text-secondary); margin-left: auto; }
    .card-open {
      padding: 0; border: 0; background: none;
      font-family: inherit; cursor: pointer;
    }
    .card-open:focus-visible { outline: none; } /* drawn on the whole card above */
    .entry-card:has(.card-open:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: 2px; }

    .card-title { font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-xs); }
    .card-excerpt {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.55;
      margin: 0;
      overflow: hidden;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
    }

    .card-images {
      display: flex;
      gap: 6px;
      overflow-x: auto;
      margin-top: var(--space-sm);
      scrollbar-width: none;
    }
    .card-images::-webkit-scrollbar { display: none; }
    .thumb {
      width: 68px;
      height: 68px;
      object-fit: cover;
      border-radius: var(--border-radius-sm);
      flex-shrink: 0;
    }

    .card-delete-row {
      display: flex;
      justify-content: flex-end;
      margin-top: var(--space-xs);
      padding-top: var(--space-xs);
      border-top: 1px solid var(--border-color);
    }
    .card-delete-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 0.7rem;
      font-family: inherit;
      color: var(--text-secondary);
      padding: 2px 4px;
      border-radius: var(--border-radius-sm);
      opacity: 0.6;
      transition: color 0.12s, opacity 0.12s, background 0.12s;
    }
    .card-delete-btn:hover {
      color: var(--color-danger);
      opacity: 1;
      background: color-mix(in srgb, var(--color-danger) 8%, transparent);
    }

    .list-footer { display: flex; justify-content: center; padding-top: var(--space-sm); }

    /* ── Expand loading ─────────────────────────────────── */
    .expand-loading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: var(--space-xl) 0;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Expanded view ──────────────────────────────────── */
    .expanded-view { animation: expand-in 180ms ease-out forwards; }
    .exp-top { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); min-height: 22px; flex-wrap: wrap; }
    .exp-author { font-size: var(--font-size-xs); font-weight: 600; color: var(--color-primary); }
    .exp-title { font-size: var(--font-size-lg); font-weight: 600; margin: 0 0 var(--space-md); }
    .exp-body {
      font-family: 'Georgia', serif;
      font-size: 1rem;
      line-height: 1.85;
      color: var(--text-primary);
      white-space: pre-wrap;
      margin: 0 0 var(--space-lg);
    }
    .exp-images {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }
    .exp-img {
      width: 100%;
      max-width: 260px;
      height: 160px;
      object-fit: cover;
      border-radius: var(--border-radius);
      cursor: zoom-in;
      transition: opacity 0.15s;
    }
    .exp-img:hover { opacity: 0.88; }
    .exp-actions {
      display: flex;
      justify-content: space-between;
      margin-top: var(--space-lg);
      padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
    }

    /* ── Shared chips ───────────────────────────────────── */
    .mood-chip {
      font-size: var(--font-size-xs);
      padding: 2px 10px;
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
      border-radius: 99px;
      flex-shrink: 0;
    }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; margin-top: var(--space-sm); }
    .tag-chip {
      font-size: 0.7rem;
      padding: 2px 8px;
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: 99px;
      color: var(--text-secondary);
    }

    /* ── Lightbox ───────────────────────────────────────── */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.9);
      z-index: var(--z-overlay);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: zoom-out;
    }
    .lightbox img {
      max-width: 90vw;
      max-height: 90vh;
      object-fit: contain;
      border-radius: var(--border-radius);
    }

    /* ── Animations ─────────────────────────────────────── */
    @keyframes fade-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes modal-in {
      from { opacity: 0; transform: scale(0.95); }
      to   { opacity: 1; transform: scale(1);    }
    }
    @keyframes expand-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0);   }
    }

    /* ── Mobile bottom sheet ────────────────────────────── */
    @media (max-width: 600px) {
      :host { align-items: flex-end; }
      .modal {
        width: 100%;
        border-radius: var(--border-radius-lg) var(--border-radius-lg) 0 0;
        max-height: 88vh;
        animation: sheet-in 280ms cubic-bezier(0.32, 0.72, 0, 1) forwards;
      }
      .handle {
        display: block;
        width: 36px;
        height: 4px;
        background: var(--border-color);
        border-radius: 2px;
        margin: var(--space-sm) auto 0;
        flex-shrink: 0;
      }
      @keyframes sheet-in {
        from { transform: translateY(100%); }
        to   { transform: translateY(0);    }
      }
    }
  `],
})
export class JournalDayModalComponent implements OnChanges {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly settings = inject(SettingsService);

  /** Only for a day that has happened; the day view has no future. */
  showDayLink(): boolean {
    return this.dayLink && !!this.date && this.date <= todayKey(this.settings.timezone());
  }

  constructor(private svc: JournalService) {}

  /**
   * The list and the open entry replace each other, so the focused control
   * can vanish and drop focus to <body>. After the swap, focus the nth match
   * of `selector` unless focus is still inside the dialog.
   */
  private keepFocus(selector: string, nth = 0) {
    afterNextRender(() => {
      const root = this.host.nativeElement;
      if (root.contains(document.activeElement)) return;
      root.querySelectorAll<HTMLElement>(selector)[Math.max(nth, 0)]?.focus();
    }, { injector: this.injector });
  }

  @Input() date: string | null = null;
  @Input() entries: JournalEntry[] = [];
  @Input() initialEntry: JournalEntry | null = null;
  @Input() showAuthor = false;
  @Input() memberMap: Record<string, string> = {};
  /** When set, only entries with this user_id show the Edit button. Null = always show. */
  @Input() ownUserId: string | null = null;
  /** Offer a link to the cross-module day view (the user's own journal only). */
  @Input() dayLink = false;
  @Output() close = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<string>();
  @Output() deleteEntry = new EventEmitter<string>();
  @Output() newEntry = new EventEmitter<void>();

  expanded = signal<JournalEntry | null>(null);
  expandLoading = signal(false);
  lightboxUrl = signal<string | null>(null);
  /** Which image in the expanded entry the lightbox is showing, for its alt. */
  lightboxIndex = signal(0);
  touchStartY = 0;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['date']) this.expanded.set(null);
    if (changes['initialEntry'] && this.initialEntry) {
      this.expandEntry(this.initialEntry);
    }
    if (changes['entries'] && this.expanded()) {
      const stillExists = this.entries.some(e => e.id === this.expanded()!.id);
      if (!stillExists) this.expanded.set(null);
    }
  }

  openLabel(e: JournalEntry): string {
    const what = e.title || this.excerpt(e.body).slice(0, 60) || 'entry';
    return `Open ${what}, ${this.formatTime(e.created_at)}`;
  }

  backToList() {
    const shown = this.expanded();
    this.expanded.set(null);
    this.expandLoading.set(false);
    const i = shown ? this.entries.findIndex(x => x.id === shown.id) : -1;
    this.keepFocus('.card-open', i);
  }

  expandEntry(e: JournalEntry) {
    this.keepFocus('[aria-label="Back to list"]');
    // Use cached version if images are already loaded
    if (e.images && e.images.length > 0) {
      this.expanded.set(e);
      return;
    }
    this.expandLoading.set(true);
    this.svc.getEntry(e.id).subscribe({
      next: full => { this.expanded.set(full); this.expandLoading.set(false); },
      error: () => { this.expanded.set(e); this.expandLoading.set(false); },
    });
  }

  get formattedDate(): string {
    if (!this.date) return '';
    const [y, m, d] = this.date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-US', {
      weekday: 'long', month: 'short', day: 'numeric',
    });
  }

  onSwipeEnd(e: TouchEvent) {
    if (e.changedTouches[0].clientY - this.touchStartY > 80) this.close.emit();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    if (isJiroModalOpen()) return; // a confirm opened from here closes first
    if (this.lightboxUrl())   { this.lightboxUrl.set(null);   return; }
    if (this.expandLoading() || this.expanded()) { this.backToList(); return; }
    this.close.emit();
  }

  /**
   * A name for a journal photo. There is no caption to draw on, so the entry
   * itself is the only thing that distinguishes one photo from another: its
   * title where there is one, otherwise the day. The position is included only
   * when there is more than one, because "Photo 1 of 1" is noise.
   */
  imageAlt(e: JournalEntry, index: number, total: number): string {
    const subject = e.title?.trim() || this.formattedDate;
    return total > 1
      ? `Photo ${index + 1} of ${total} from ${subject}`
      : `Photo from ${subject}`;
  }

  /** The same, for the entry currently expanded. */
  expandedImageAlt(index: number): string {
    const e = this.expanded();
    if (!e) return '';
    return this.imageAlt(e, index, (e.images || []).length);
  }

  openLightbox(url: string, index: number) {
    this.lightboxIndex.set(index);
    this.lightboxUrl.set(url);
  }

  moodLabel(value: string): string {
    return MOODS.find(m => m.value === value)?.label ?? value;
  }

  canEdit(e: JournalEntry): boolean {
    return this.ownUserId === null || e.user_id === this.ownUserId;
  }

  authorName(e: JournalEntry): string {
    return this.memberMap[e.user_id] ?? 'Unknown';
  }

  excerpt(body: string): string {
    return body.length > 200 ? body.slice(0, 200) + '…' : body;
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
}
