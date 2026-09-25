import { Component, OnInit, OnDestroy, signal, computed, viewChild, ElementRef, HostListener, inject } from '@angular/core';
import { Location } from '@angular/common';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  JournalService,
  JournalEntry,
  JournalCollection,
  JournalImage,
  MOODS,
} from '../../../core/services/journal.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { UploadService } from '../../../core/services/upload.service';
import { promptForDay, localDateKey } from '../writing-prompts';
import { SettingsService } from '../../../core/services/settings.service';
import { dayKey, isDayKey, todayKey, zonedNoonISO } from '../../../core/utils/day';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';

/** A photo picked for an entry that does not exist yet; it uploads on publish. */
interface PendingPhoto { file: File; url: string; }

/** Dismissing the prompt lasts the calendar day; the value is that day's date. */
const PROMPT_DISMISSED_KEY = 'jiro_journal_prompt_dismissed';

@Component({
  selector: 'app-journal-editor',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroButtonComponent, JiroIconComponent],
  template: `
    <div class="editor-page" [class.immersive]="immersive()">

      <!-- Top bar -->
      <div class="editor-topbar">
        <button class="back-btn" (click)="goBack()" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          @if (!immersive()) {
<span>Back</span>
}
        </button>
        <h1 class="editor-topbar-title">
          {{ editId ? 'Edit entry' : 'New entry' }}
          @if (forDate && !editId) {
<span class="for-date-badge">for {{ formatForDate() }}</span>
}
        </h1>
        <div class="editor-topbar-actions">
          <jiro-button
            variant="primary"
            type="button"
            [disabled]="!body.trim() || saving()"
            (click)="save()">
            {{ saving() ? 'Saving...' : (editId ? 'Save' : 'Publish') }}
          </jiro-button>
        </div>
      </div>

      @if (!immersive() && entryDay(); as day) {
        <a class="day-link" [routerLink]="['/day', day]">See this day</a>
      }

      <!-- Loading skeleton -->
      @if (loading()) {
<div class="state-center">
        <span class="spinner"></span>
      </div>
}

      @if (!loading()) {
<div class="editor-body">

        <!-- Title -->
        <input
          type="text"
          class="title-input"
          placeholder="Title (optional)"
          [(ngModel)]="title"
          maxlength="255"
          (focus)="immersive.set(true)" />

        <!-- ── Writing prompt (new entries only) ─────────────────────── -->
        @if (promptVisible()) {
        <section class="prompt-strip" aria-label="Writing prompt">
          <div class="prompt-copy" aria-live="polite">
            <span class="toolbar-label">{{ backdated() ? 'Writing prompt' : "Today's prompt" }}</span>
            <button
              type="button"
              class="prompt-question"
              (click)="focusBody()">{{ prompt() }}</button>
          </div>
          <div class="prompt-actions">
            <button
              type="button"
              class="prompt-btn"
              aria-label="Show me another prompt"
              (click)="shufflePrompt()">
              <jiro-icon name="arrow-right" [size]="18" />
            </button>
            <button
              type="button"
              class="prompt-btn"
              aria-label="Hide the prompt for today"
              (click)="dismissPrompt()">
              <jiro-icon name="x" [size]="18" />
            </button>
          </div>
        </section>
        }

        <!-- Body -->
        <textarea
          #bodyTextarea
          class="body-textarea"
          [placeholder]="bodyPlaceholder()"
          [(ngModel)]="body"
          (focus)="immersive.set(true)"
          (blur)="onBodyBlur()"
          rows="8"
          aria-label="Journal entry body"></textarea>

        <!-- ── Toolbar ───────────────────────────────────────────────── -->
        <div class="editor-toolbar" [class.above-keyboard]="immersive()">

          <!-- Mood picker -->
          <div class="toolbar-section">
            <span class="toolbar-label">Mood</span>
            <div class="mood-row">
              @for (m of moods; track m) {
<button
               
                class="mood-chip"
                [class.selected]="mood === m.value"
                (click)="mood = (mood === m.value ? '' : m.value)"
                [attr.aria-label]="m.label"
                [attr.aria-pressed]="mood === m.value"
                type="button">
                {{ m.label }}
              </button>
}
            </div>
          </div>

          <!-- Tags -->
          <div class="toolbar-section">
            <span class="toolbar-label">Tags</span>
            <div class="tag-editor">
              <div class="tag-chips">
                @for (t of tags; track t) {
<span class="tag-chip">
                  {{ t }}
                  <button class="tag-remove" (click)="removeTag(t)" [attr.aria-label]="'Remove tag ' + t" type="button">×</button>
                </span>
}
              </div>
              <input
                type="text"
                class="tag-input"
                placeholder="Add tag and press Enter..."
                [(ngModel)]="tagDraft"
                (keydown.enter)="addTag($event)"
                (keydown.comma)="addTag($event)"
                maxlength="30" />
            </div>
          </div>

          <!-- Photos -->
          <div class="toolbar-section">
            <div class="img-header">
              <span class="toolbar-label" id="photos-label">Photos ({{ photoCount() }}/3)</span>
              @if (photoCount() < 3) {
<label class="img-add-btn">
                <input
                  type="file"
                  class="img-file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Add a photo"
                  (change)="onFileSelected($event)"
                  [disabled]="uploading() || saving()" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {{ uploading() ? 'Uploading...' : 'Add' }}
              </label>
}
            </div>
            @if (!editId) {
<p class="img-hint text-secondary">Photos you add here upload when you publish.</p>
}
            @if (images().length > 0 || pendingPhotos().length > 0) {
<div class="img-previews">
              @for (img of images(); track img) {
<div class="img-thumb">
                <img
                  [src]="img.file_url"
                  [alt]="imageAlt($index)"
                  width="80"
                  height="80"
                  (click)="openLightbox(img.file_url, imageAlt($index))" />
                <button class="img-remove" (click)="deleteImage(img)" [disabled]="deletingImgId() === img.id" type="button" aria-label="Remove image">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
}
              @for (p of pendingPhotos(); track p.url) {
<div class="img-thumb">
                <img [src]="p.url" [alt]="'Photo to upload: ' + p.file.name" width="80" height="80" />
                <button class="img-remove" (click)="removePending(p)" [disabled]="saving()" type="button" [attr.aria-label]="'Remove ' + p.file.name">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
}
            </div>
}
            @if (uploadError()) {
<p class="img-hint img-error" role="alert">{{ uploadError() }}</p>
}
          </div>

          <!-- Collections -->
          @if (!editId || entry()) {
<div class="toolbar-section">
            <span class="toolbar-label" id="collections-label">Collections</span>
            @if (collections().length > 0) {
<div class="coll-selector" role="group" aria-labelledby="collections-label">
              @for (c of collections(); track c.id) {
<button
                type="button"
                class="coll-option"
                [class.selected]="selectedCollections().has(c.id)"
                [attr.aria-pressed]="selectedCollections().has(c.id)"
                (click)="toggleCollection(c.id)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {{ c.name }}
              </button>
}
            </div>
}
            @if (collections().length === 0) {
<p class="text-secondary" style="font-size:var(--font-size-xs)">
              No collections yet. Make one on the <a routerLink="/journal/collections">Collections</a> page.
            </p>
}
          </div>
}

        </div>

        @if (saveError()) {
<p class="save-error">{{ saveError() }}</p>
}

        <!-- Bottom save -->
        <div class="bottom-save">
          @if (canDelete()) {
            <jiro-button variant="danger" type="button" [disabled]="saving() || deleting()" (click)="deleteEntry()">
              {{ deleting() ? 'Deleting...' : 'Delete entry' }}
            </jiro-button>
          }
          <span class="bottom-spacer"></span>
          <jiro-button
            variant="primary"
            type="button"
            [disabled]="!body.trim() || saving()"
            (click)="save()">
            {{ saving() ? 'Saving...' : (editId ? 'Save' : 'Publish') }}
          </jiro-button>
        </div>

      </div>
}

    </div>

    <!-- Lightbox -->
    @if (lightboxUrl()) {
<div class="lightbox" (click)="lightboxUrl.set(null)">
      <img [src]="lightboxUrl()!" [alt]="lightboxAlt()" />
    </div>
}
  `,
  styles: [`
    :host { display: block; }

    /* Editor page layout */
    .editor-page {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      min-height: calc(100vh - var(--topbar-height, 56px) - var(--space-xl) * 2);
    }

    /* Top bar */
    .editor-topbar {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      margin-bottom: var(--space-xl);
    }
    .back-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-secondary);
      cursor: pointer;
      font-size: var(--font-size-sm);
      padding: 6px 10px;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s;
    }
    .back-btn:hover { color: var(--text-primary); border-color: var(--text-secondary); }
    /* The page's h1, deliberately kept at toolbar scale: this is a writing
       surface, so the chrome should not compete with the entry itself. */
    .editor-topbar-title {
      flex: 1;
      font-family: var(--font-family);
      font-weight: 600;
      font-size: var(--font-size-md);
      letter-spacing: normal;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }
    .for-date-badge {
      font-size: var(--font-size-xs);
      font-weight: 500;
      color: var(--color-primary);
      background: rgba(var(--color-primary-rgb), 0.1);
      padding: 2px 8px;
      border-radius: 10px;
    }
    .editor-topbar-actions { flex-shrink: 0; }
    .day-link {
      align-self: flex-start;
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      margin: calc(var(--space-md) - var(--space-xl)) 0 var(--space-md);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
    }

    /* Editor body */
    .editor-body { display: flex; flex-direction: column; gap: var(--space-md); flex: 1; }

    /* Title */
    .title-input {
      font-family: inherit;
      font-size: 1.35rem;
      font-weight: 600;
      border: none;
      border-bottom: 1px solid var(--border-color);
      background: transparent;
      color: var(--text-primary);
      padding: var(--space-sm) 0;
      width: 100%;
    }
    .title-input:focus { border-bottom-color: var(--color-primary); }
    .title-input::placeholder { color: var(--text-secondary); font-weight: 400; }

    /* Writing prompt */
    .prompt-strip {
      display: flex;
      align-items: flex-start;
      gap: var(--space-md);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-sm) var(--space-md);
    }
    .prompt-copy {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-items: flex-start;
    }
    .prompt-question {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md);
      line-height: 1.45;
      color: var(--text-primary);
      background: none;
      border: none;
      border-radius: var(--border-radius-sm);
      text-align: left;
      padding: var(--space-xs) 0;
      min-height: 40px;
      cursor: pointer;
      transition: color 0.15s;
    }
    .prompt-question:hover { color: var(--color-primary); }
    .prompt-actions { display: flex; gap: var(--space-xs); flex-shrink: 0; }
    .prompt-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      background: none;
      border: none;
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      cursor: pointer;
      transition: color 0.15s, background 0.15s;
    }
    .prompt-btn:hover {
      color: var(--text-primary);
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    }

    /* Body textarea */
    .body-textarea {
      font-family: 'Georgia', serif;
      font-size: 1.05rem;
      line-height: 1.8;
      border: none;
      background: transparent;
      color: var(--text-primary);
      width: 100%;
      resize: vertical;
      min-height: 140px;
      padding: var(--space-sm) 0;
    }
    .body-textarea:focus { }
    .body-textarea::placeholder { color: var(--text-secondary); font-family: inherit; }

    /* Toolbar */
    .editor-toolbar {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md) var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      margin-top: 0;
    }

    .toolbar-section { display: flex; flex-direction: column; gap: var(--space-sm); }
    .toolbar-label { font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }

    /* Mood picker */
    .mood-row {
      display: flex;
      gap: var(--space-xs);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
      padding-bottom: 2px;
    }
    .mood-row::-webkit-scrollbar { display: none; }
    .mood-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 7px 12px;
      border: 1.5px solid var(--border-color);
      border-radius: 99px;
      background: var(--bg-canvas);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      cursor: pointer;
      white-space: nowrap;
      flex-shrink: 0;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      min-height: 44px;
    }
    .mood-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .mood-chip.selected {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
      font-weight: 500;
    }
    /* Tags */
    .tag-editor { display: flex; flex-direction: column; gap: var(--space-xs); }
    .tag-chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .tag-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--font-size-xs);
      padding: 4px 8px;
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
      border-radius: 99px;
    }
    .tag-remove {
      background: none;
      border: none;
      cursor: pointer;
      color: inherit;
      font-size: 0.9rem;
      padding: 0;
      line-height: 1;
      display: flex;
      align-items: center;
    }
    .tag-input {
      font-family: inherit;
      font-size: var(--font-size-sm);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      background: var(--bg-canvas);
      color: var(--text-primary);
      padding: 7px var(--space-sm);
    }
    .tag-input:focus { border-color: var(--color-primary); }

    /* Images */
    .img-header { display: flex; align-items: center; justify-content: space-between; }
    .img-add-btn {
      position: relative;
      display: flex;
      align-items: center;
      gap: 5px;
      font-size: var(--font-size-xs);
      font-family: inherit;
      color: var(--color-primary);
      cursor: pointer;
      border: 1px solid var(--color-primary);
      border-radius: var(--border-radius-sm);
      padding: 5px 10px;
      background: none;
      transition: background 0.15s;
      min-height: 30px;
    }
    .img-add-btn:hover { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
    .img-previews { display: flex; gap: var(--space-sm); flex-wrap: wrap; }
    .img-thumb {
      position: relative;
      width: 80px;
      height: 80px;
      border-radius: var(--border-radius-sm);
      overflow: hidden;
    }
    .img-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      cursor: zoom-in;
    }
    .img-remove {
      position: absolute;
      top: 3px;
      right: 3px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.6);
      color: #FFFFFF;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .img-hint { font-size: var(--font-size-xs); margin: 0; }
    .img-error { color: var(--color-danger); }
    .img-add-btn:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .img-file {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; border: 0;
      overflow: hidden; clip-path: inset(50%); white-space: nowrap;
    }

    /* Collections */
    .coll-selector { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
    .coll-option {
      font-family: inherit;
      background: none;
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1.5px solid var(--border-color);
      border-radius: 99px;
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
      min-height: 36px;
    }
    .coll-option:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .coll-option.selected {
      border-color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      color: var(--color-primary);
      font-weight: 500;
    }

    .save-error { font-size: var(--font-size-sm); color: var(--color-danger); }

    .bottom-save { display: flex; align-items: center; gap: var(--space-sm); padding-bottom: var(--space-xl); }
    .bottom-spacer { flex: 1; }

    /* State */
    .state-center { display: flex; justify-content: center; padding: var(--space-xl) 0; }

    /* Lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
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

    /* Narrow: the prompt takes its own line, the controls drop below it. */
    @media (max-width: 600px) {
      .prompt-strip {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-xs);
      }
      .prompt-actions { justify-content: flex-end; }
    }

    /* Mobile immersive */
    @media (max-width: 768px) {
      .editor-page.immersive .editor-toolbar {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        border-radius: var(--border-radius) var(--border-radius) 0 0;
        max-height: 50vh;
        overflow-y: auto;
        z-index: var(--z-sticky);
        box-shadow: 0 -4px 20px rgba(var(--shadow-rgb), 0.2);
        padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
      }

      .editor-page.immersive .editor-body {
        padding-bottom: 300px;
      }

    }
  `]
})
export class JournalEditorComponent implements OnInit, OnDestroy {
  moods = MOODS;

  editId: string | null = null;
  entry = signal<JournalEntry | null>(null);
  loading = signal(false);
  saving = signal(false);
  saveError = signal('');
  immersive = signal(false);

  title = '';
  body = '';
  mood = '';
  tags: string[] = [];
  tagDraft = '';
  forDate: string | null = null;
  groupId: string | null = null;

  images = signal<JournalImage[]>([]);
  pendingPhotos = signal<PendingPhoto[]>([]);
  readonly photoCount = computed(() => this.images().length + this.pendingPhotos().length);
  uploading = signal(false);
  uploadError = signal('');
  deletingImgId = signal<string | null>(null);
  deleting = signal(false);

  collections = signal<JournalCollection[]>([]);
  selectedCollections = signal<ReadonlySet<string>>(new Set());
  /** Until the list loads, a save must not touch membership it cannot see. */
  private collectionsLoaded = false;

  lightboxUrl = signal<string | null>(null);
  lightboxAlt = signal('');

  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly location = inject(Location);

  /** Writing for a day before today, from the calendar. */
  readonly backdated = signal(false);
  readonly bodyPlaceholder = computed(() =>
    this.backdated() ? 'What happened that day?' : "What's on your mind today?");

  /** Only the author can delete, and only an entry that exists. */
  readonly canDelete = computed(() => {
    const e = this.entry();
    return !!e && e.user_id === this.auth.user()?.id;
  });

  /** The user's day this private entry belongs to, for the day view link. */
  readonly entryDay = computed(() => {
    const e = this.entry();
    return e && !e.group_id ? dayKey(e.created_at, this.settings.timezone()) : null;
  });

  /** Read once, so the prompt and its dismissal agree on which day this is. */
  private readonly today = new Date();
  private readonly bodyTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('bodyTextarea');
  readonly promptVisible = signal(false);
  readonly promptOffset = signal(0);
  readonly prompt = computed(() => promptForDay(this.today, this.promptOffset()));

  constructor(
    private svc: JournalService,
    private route: ActivatedRoute,
    private router: Router,
    private uploadSvc: UploadService,
  ) { }

  ngOnInit() {
    this.editId = this.route.snapshot.paramMap.get('id');
    const forDate = this.route.snapshot.queryParamMap.get('date');
    this.forDate = isDayKey(forDate) ? forDate : null;
    this.backdated.set(!this.editId && !!this.forDate && this.forDate < todayKey(this.settings.timezone()));
    this.groupId = this.route.snapshot.queryParamMap.get('group');
    // "Write entry" from an empty collection starts with that collection picked.
    const collection = this.route.snapshot.queryParamMap.get('collection');
    if (!this.editId && collection) this.selectedCollections.set(new Set([collection]));
    // A prompt is only useful on a blank page, never when revising an old entry.
    this.promptVisible.set(!this.editId && !promptDismissedOn(this.today));
    this.svc.listCollections().subscribe(c => { this.collections.set(c); this.collectionsLoaded = true; });

    if (this.editId) {
      this.loading.set(true);
      this.svc.getEntry(this.editId).subscribe({
        next: e => {
          this.entry.set(e);
          this.title = e.title ?? '';
          this.body = e.body;
          this.mood = e.mood ?? '';
          this.tags = [...(e.tags ?? [])];
          this.images.set(e.images ?? []);
          this.selectedCollections.set(new Set(e.collection_ids ?? []));
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.router.navigate(['/journal']); },
      });
    }
  }

  /** Next prompt in the list. The aria-live copy announces the change. */
  shufflePrompt() { this.promptOffset.update(o => o + 1); }

  dismissPrompt() {
    try { localStorage.setItem(PROMPT_DISMISSED_KEY, localDateKey(this.today)); } catch { /* storage unavailable */ }
    this.promptVisible.set(false);
  }

  /** Tapping the question drops the caret straight into the entry. */
  focusBody() { this.bodyTextarea()?.nativeElement.focus(); }

  addTag(e: Event) {
    e.preventDefault();
    const t = this.tagDraft.replace(/,$/, '').trim();
    if (t && !this.tags.includes(t) && this.tags.length < 10) {
      this.tags = [...this.tags, t];
    }
    this.tagDraft = '';
  }

  removeTag(t: string) { this.tags = this.tags.filter(x => x !== t); }

  toggleCollection(id: string) {
    const next = new Set(this.selectedCollections());
    if (next.has(id)) next.delete(id); else next.add(id);
    this.selectedCollections.set(next);
  }

  onBodyBlur() {
    // Small delay so toolbar tap doesn't immediately close immersive
    setTimeout(() => {
      if (!document.activeElement || (document.activeElement as HTMLElement).tagName === 'BODY') {
        this.immersive.set(false);
      }
    }, 150);
  }

  save() {
    if (!this.body.trim()) return;
    // Flush any tag the user typed but didn't confirm with Enter
    const draft = this.tagDraft.replace(/,$/, '').trim();
    if (draft && !this.tags.includes(draft) && this.tags.length < 10) {
      this.tags = [...this.tags, draft];
    }
    this.tagDraft = '';
    this.saving.set(true);
    this.saveError.set('');
    // Only collections that still exist, so a stale ?collection= is dropped.
    const known = new Set(this.collections().map(c => c.id));
    const req: any = {
      title: this.title.trim() || undefined,
      body: this.body.trim(),
      mood: this.mood || undefined,
      tags: this.tags,
    };
    if (this.collectionsLoaded) {
      req.collection_ids = [...this.selectedCollections()].filter(id => known.has(id));
    }
    if (this.forDate && !this.editId) {
      // Noon on the chosen day in the user's zone, so the entry lands on that day everywhere.
      req.created_at = zonedNoonISO(this.forDate, this.settings.timezone());
    }

    if (this.editId) {
      this.svc.updateEntry(this.editId, req).subscribe({
        next: () => { this.saving.set(false); this.router.navigate([this.backRoute()]); },
        error: (err: any) => { this.saving.set(false); this.saveError.set(errorMessage(err, 'Failed to save.')); },
      });
    } else {
      const create = this.groupId ? this.svc.createGroupEntry(this.groupId, req) : this.svc.createEntry(req);
      create.subscribe({
        next: e => this.afterCreate(e),
        error: (err: any) => { this.saving.set(false); this.saveError.set(errorMessage(err, 'Failed to save.')); },
      });
    }
  }

  /** Uploads photos picked before publishing; on failure the editor stays on the saved entry so nothing is lost. */
  private async afterCreate(e: JournalEntry) {
    const pending = this.pendingPhotos();
    let failed = 0;
    if (pending.length) this.uploading.set(true);
    for (const p of pending) {
      try {
        const img = await this.uploadFile(e.id, p.file);
        this.images.update(imgs => [...imgs, img]);
      } catch {
        failed++;
      }
      URL.revokeObjectURL(p.url);
    }
    this.pendingPhotos.set([]);
    this.uploading.set(false);
    this.saving.set(false);

    if (failed === 0) {
      this.router.navigate([this.groupId ? `/journal/groups/${this.groupId}` : '/journal']);
      return;
    }
    this.editId = e.id;
    this.entry.set({ ...e, images: this.images() });
    this.location.replaceState(`/journal/${e.id}/edit`);
    this.uploadError.set(failed === 1
      ? 'Your entry is saved, but one photo did not upload. Try adding it again.'
      : `Your entry is saved, but ${failed} photos did not upload. Try adding them again.`);
  }

  private uploadFile(entryId: string, file: File): Promise<JournalImage> {
    return new Promise((resolve, reject) => {
      this.svc.presignImage(entryId, file.type, file.size).subscribe({
        next: ({ upload_url, object_key }) => {
          this.uploadSvc.putToStorage(upload_url, file).then(() => {
            this.svc.confirmImage(entryId, object_key).subscribe({ next: resolve, error: reject });
          }).catch(reject);
        },
        error: reject,
      });
    });
  }

  removePending(p: PendingPhoto) {
    URL.revokeObjectURL(p.url);
    this.pendingPhotos.update(ps => ps.filter(x => x !== p));
  }

  async deleteEntry() {
    const e = this.entry();
    if (!e) return;
    const ok = await this.confirmService.confirm({
      title: 'Delete this entry?',
      message: e.group_id
        ? 'It is removed from the group for everyone, permanently.'
        : 'It is removed from your journal and its collections, with its photos. This cannot be undone.',
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    this.deleting.set(true);
    this.svc.deleteEntry(e.id).subscribe({
      next: () => {
        this.toast.success('Entry deleted');
        this.router.navigate([this.backRoute()]);
      },
      error: () => {
        this.deleting.set(false);
        this.toast.error('Could not delete the entry.');
      },
    });
  }

  ngOnDestroy() {
    for (const p of this.pendingPhotos()) URL.revokeObjectURL(p.url);
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.uploadError.set('Only JPEG, PNG, and WebP images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Image must be 10 MB or smaller.');
      return;
    }
    if (this.photoCount() >= 3) {
      this.uploadError.set('An entry can have up to 3 photos.');
      return;
    }
    this.uploadError.set('');
    if (!this.editId) {
      // No entry to attach to yet: hold it and upload on publish.
      this.pendingPhotos.update(ps => [...ps, { file, url: URL.createObjectURL(file) }]);
      return;
    }
    this.uploading.set(true);
    this.uploadFile(this.editId, file).then(
      img => { this.images.update(imgs => [...imgs, img]); this.uploading.set(false); },
      () => { this.uploadError.set('That photo did not upload. Try again.'); this.uploading.set(false); },
    );
  }

  /**
   * Uploads carry no caption, so name each one by its position and the entry it
   * belongs to — otherwise a screen reader announces three identical images.
   */
  imageAlt(index: number): string {
    const subject = this.title.trim() || 'this entry';
    const total = this.images().length;
    return total > 1
      ? `Attachment ${index + 1} of ${total} on ${subject}`
      : `Attachment on ${subject}`;
  }

  openLightbox(url: string, alt: string) {
    this.lightboxUrl.set(url);
    this.lightboxAlt.set(alt);
  }

  deleteImage(img: JournalImage) {
    this.deletingImgId.set(img.id);
    this.svc.deleteImage(img.id).subscribe({
      next: () => { this.images.update(imgs => imgs.filter(i => i.id !== img.id)); this.deletingImgId.set(null); },
      error: () => this.deletingImgId.set(null),
    });
  }

  goBack() { this.router.navigate([this.backRoute()]); }

  private backRoute(): string {
    const groupId = this.entry()?.group_id || this.groupId;
    return groupId ? `/journal/groups/${groupId}` : '/journal';
  }

  @HostListener('document:keydown.escape')
  onEscape() { this.lightboxUrl.set(null); this.immersive.set(false); }

  formatForDate(): string {
    if (!this.forDate) return '';
    const d = new Date(this.forDate + 'T12:00:00');
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
}

/** The API's error message ({ error: { message } }), or the fallback. */
function errorMessage(err: any, fallback: string): string {
  return err?.error?.error?.message ?? fallback;
}

/**
 * True only when the prompt was dismissed on this same local day, so yesterday's
 * dismissal does not silence today's prompt. Storage throws in private windows,
 * where the prompt simply shows again.
 */
function promptDismissedOn(today: Date): boolean {
  try { return localStorage.getItem(PROMPT_DISMISSED_KEY) === localDateKey(today); } catch { return false; }
}
