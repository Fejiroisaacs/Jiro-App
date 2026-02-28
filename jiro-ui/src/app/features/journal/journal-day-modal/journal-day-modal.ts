import {
  Component, Input, Output, EventEmitter,
  signal, OnChanges, SimpleChanges, HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { JournalEntry, JournalService, MOODS } from '../../../core/services/journal.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'journal-day-modal',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent],
  template: `
    <!-- Backdrop -->
    <div class="backdrop" (click)="close.emit()" aria-hidden="true"></div>

    <!-- Sheet / Dialog -->
    <div
      class="modal"
      role="dialog"
      aria-labelledby="dm-date"
      aria-modal="true"
      (touchstart)="touchStartY = $event.touches[0].clientY"
      (touchend)="onSwipeEnd($event)">

      <!-- Drag handle (mobile) -->
      <div class="handle" aria-hidden="true"></div>

      <!-- Header -->
      <div class="modal-header">
        <button *ngIf="expanded() || expandLoading()" class="hdr-btn" (click)="expanded.set(null); expandLoading.set(false)" aria-label="Back to list">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          Back
        </button>
        <h2 id="dm-date" class="modal-date">{{ formattedDate }}</h2>
        <button class="hdr-btn hdr-close" (click)="close.emit()" aria-label="Close">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Body -->
      <div class="modal-body">

        <!-- Empty state -->
        <div *ngIf="!entries.length" class="empty-state">
          <p class="text-secondary">No entries for this day.</p>
          <jiro-button variant="primary" type="button" (click)="newEntry.emit()">Write now</jiro-button>
        </div>

        <!-- Entry list -->
        <div *ngIf="!expanded() && !expandLoading() && entries.length" class="entry-list">
          <div
            *ngFor="let e of entries"
            class="entry-card"
            (click)="expandEntry(e)"
            tabindex="0"
            role="button"
            (keydown.enter)="expandEntry(e)">
            <div class="card-author" *ngIf="showAuthor">{{ authorName(e) }}</div>
            <div class="card-meta">
              <span class="mood-chip" *ngIf="e.mood">{{ moodLabel(e.mood) }}</span>
              <span class="entry-time">{{ formatTime(e.created_at) }}</span>
            </div>
            <h3 class="card-title" *ngIf="e.title">{{ e.title }}</h3>
            <p class="card-excerpt">{{ excerpt(e.body) }}</p>
            <div class="card-images" *ngIf="e.images?.length">
              <img *ngFor="let img of (e.images || [])" [src]="img.file_url" class="thumb" alt="" />
            </div>
            <div class="tag-list" *ngIf="e.tags?.length">
              <span class="tag-chip" *ngFor="let t of (e.tags || [])">{{ t }}</span>
            </div>
            <div class="card-delete-row" *ngIf="canEdit(e)" (click)="$event.stopPropagation()">
              <button class="card-delete-btn" (click)="deleteEntry.emit(e.id)" aria-label="Delete entry">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
                Delete
              </button>
            </div>
          </div>

          <div class="list-footer">
            <jiro-button variant="secondary" type="button" (click)="newEntry.emit()">New Entry</jiro-button>
          </div>
        </div>

        <!-- Expand loading -->
        <div *ngIf="expandLoading()" class="expand-loading">
          <div class="spinner"></div>
        </div>

        <!-- Expanded entry -->
        <div *ngIf="expanded() && !expandLoading()" class="expanded-view">
          <div class="exp-top">
            <span class="exp-author" *ngIf="showAuthor">{{ authorName(expanded()!) }}</span>
            <span class="mood-chip" *ngIf="expanded()!.mood">{{ moodLabel(expanded()!.mood!) }}</span>
          </div>
          <h3 class="exp-title" *ngIf="expanded()!.title">{{ expanded()!.title }}</h3>
          <p class="exp-body">{{ expanded()!.body }}</p>
          <div class="exp-images" *ngIf="expanded()!.images?.length">
            <img
              *ngFor="let img of (expanded()!.images || [])"
              [src]="img.file_url"
              class="exp-img"
              alt=""
              (click)="lightboxUrl.set(img.file_url)" />
          </div>
          <div class="tag-list" *ngIf="expanded()!.tags?.length">
            <span class="tag-chip" *ngFor="let t of (expanded()!.tags || [])">{{ t }}</span>
          </div>
          <div class="exp-actions" *ngIf="canEdit(expanded()!)">
            <jiro-button variant="danger" type="button" (click)="deleteEntry.emit(expanded()!.id)">
              Delete
            </jiro-button>
            <jiro-button variant="primary" type="button" (click)="editEntry.emit(expanded()!.id)">
              Edit Entry
            </jiro-button>
          </div>
        </div>

      </div>
    </div>

    <!-- Lightbox -->
    <div class="lightbox" *ngIf="lightboxUrl()" (click)="lightboxUrl.set(null)">
      <img [src]="lightboxUrl()!" alt="Full size image" />
    </div>
  `,
  styles: [`
    :host {
      position: fixed;
      inset: 0;
      z-index: 400;
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
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.18);
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
      outline: none;
      transition: transform 0.15s ease-out, border-color 0.15s, box-shadow 0.15s;
    }
    .entry-card:hover, .entry-card:focus-visible {
      transform: translateY(-2px);
      border-color: var(--color-primary);
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
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
      z-index: 9999;
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
  constructor(private svc: JournalService) {}

  @Input() date: string | null = null;
  @Input() entries: JournalEntry[] = [];
  @Input() initialEntry: JournalEntry | null = null;
  @Input() showAuthor = false;
  @Input() memberMap: Record<string, string> = {};
  /** When set, only entries with this user_id show the Edit button. Null = always show. */
  @Input() ownUserId: string | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() editEntry = new EventEmitter<string>();
  @Output() deleteEntry = new EventEmitter<string>();
  @Output() newEntry = new EventEmitter<void>();

  expanded = signal<JournalEntry | null>(null);
  expandLoading = signal(false);
  lightboxUrl = signal<string | null>(null);
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

  expandEntry(e: JournalEntry) {
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
    if (this.lightboxUrl())   { this.lightboxUrl.set(null);   return; }
    if (this.expandLoading()) { this.expandLoading.set(false); return; }
    if (this.expanded())      { this.expanded.set(null);       return; }
    this.close.emit();
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
