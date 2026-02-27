import { Component, OnInit, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  JournalService,
  JournalEntry,
  JournalCollection,
  JournalImage,
  MOODS,
} from '../../../core/services/journal.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-journal-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroButtonComponent],
  template: `
    <div class="editor-page" [class.immersive]="immersive()">

      <!-- Top bar -->
      <div class="editor-topbar">
        <button class="back-btn" (click)="goBack()" aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15,18 9,12 15,6"/>
          </svg>
          <span *ngIf="!immersive()">Back</span>
        </button>
        <div class="editor-topbar-title">
          <span *ngIf="!editId">New Entry</span>
          <span *ngIf="editId">Edit Entry</span>
        </div>
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

      <!-- Loading skeleton -->
      <div *ngIf="loading()" class="state-center">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading()" class="editor-body">

        <!-- Title -->
        <input
          type="text"
          class="title-input"
          placeholder="Title (optional)"
          [(ngModel)]="title"
          maxlength="255"
          (focus)="immersive.set(true)" />

        <!-- Body -->
        <textarea
          class="body-textarea"
          placeholder="What's on your mind today?"
          [(ngModel)]="body"
          (focus)="immersive.set(true)"
          (blur)="onBodyBlur()"
          rows="14"
          aria-label="Journal entry body"></textarea>

        <!-- ── Toolbar ───────────────────────────────────────────────── -->
        <div class="editor-toolbar" [class.above-keyboard]="immersive()">

          <!-- Mood picker -->
          <div class="toolbar-section">
            <span class="toolbar-label">Mood</span>
            <div class="mood-row">
              <button
                *ngFor="let m of moods"
                class="mood-chip"
                [class.selected]="mood === m.value"
                (click)="mood = (mood === m.value ? '' : m.value)"
                [attr.aria-label]="m.label"
                [attr.aria-pressed]="mood === m.value"
                type="button">
                {{ m.label }}
              </button>
            </div>
          </div>

          <!-- Tags -->
          <div class="toolbar-section">
            <span class="toolbar-label">Tags</span>
            <div class="tag-editor">
              <div class="tag-chips">
                <span class="tag-chip" *ngFor="let t of tags">
                  {{ t }}
                  <button class="tag-remove" (click)="removeTag(t)" [attr.aria-label]="'Remove tag ' + t" type="button">×</button>
                </span>
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

          <!-- Images -->
          <div class="toolbar-section">
            <div class="img-header">
              <span class="toolbar-label">Images ({{ images().length }}/3)</span>
              <label class="img-add-btn" *ngIf="images().length < 3">
                <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onFileSelected($event)" hidden [disabled]="uploading()" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                {{ uploading() ? 'Uploading...' : 'Add' }}
              </label>
            </div>
            <div class="img-previews" *ngIf="images().length > 0">
              <div *ngFor="let img of images()" class="img-thumb">
                <img [src]="img.file_url" [alt]="'Attached image'" (click)="lightboxUrl.set(img.file_url)" />
                <button class="img-remove" (click)="deleteImage(img)" [disabled]="deletingImgId() === img.id" type="button" aria-label="Remove image">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <p class="img-hint text-secondary" *ngIf="uploadError()">{{ uploadError() }}</p>
          </div>

          <!-- Collections -->
          <div class="toolbar-section" *ngIf="!editId || entry()">
            <span class="toolbar-label">Collections</span>
            <div class="coll-selector" *ngIf="collections().length > 0">
              <label
                *ngFor="let c of collections()"
                class="coll-option"
                [class.selected]="selectedCollections.has(c.id)">
                <input
                  type="checkbox"
                  [checked]="selectedCollections.has(c.id)"
                  (change)="toggleCollection(c.id)"
                  hidden />
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                {{ c.name }}
              </label>
            </div>
            <p class="text-secondary" style="font-size:var(--font-size-xs)" *ngIf="collections().length === 0">
              No collections yet.
            </p>
          </div>

        </div>

        <p class="save-error" *ngIf="saveError()">{{ saveError() }}</p>
      </div>

    </div>

    <!-- Lightbox -->
    <div class="lightbox" *ngIf="lightboxUrl()" (click)="lightboxUrl.set(null)">
      <img [src]="lightboxUrl()!" alt="Full size image" />
    </div>
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
    .editor-topbar-title {
      flex: 1;
      font-weight: 600;
      font-size: var(--font-size-md);
    }
    .editor-topbar-actions { flex-shrink: 0; }

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
    .title-input:focus { outline: none; border-bottom-color: var(--color-primary); }
    .title-input::placeholder { color: var(--text-secondary); font-weight: 400; }

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
      min-height: 260px;
      padding: var(--space-sm) 0;
    }
    .body-textarea:focus { outline: none; }
    .body-textarea::placeholder { color: var(--text-secondary); font-family: inherit; }

    /* Toolbar */
    .editor-toolbar {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
      margin-top: var(--space-md);
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
    .tag-input:focus { outline: none; border-color: var(--color-primary); }

    /* Images */
    .img-header { display: flex; align-items: center; justify-content: space-between; }
    .img-add-btn {
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
      background: rgba(0,0,0,0.6);
      color: #fff;
      border: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    .img-hint { font-size: var(--font-size-xs); margin-top: var(--space-xs); }

    /* Collections */
    .coll-selector { display: flex; flex-wrap: wrap; gap: var(--space-xs); }
    .coll-option {
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

    /* State */
    .state-center { display: flex; justify-content: center; padding: var(--space-xl) 0; }

    /* Lightbox */
    .lightbox {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
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
        z-index: 100;
        box-shadow: 0 -4px 20px rgba(0,0,0,0.15);
        padding-bottom: calc(var(--space-lg) + env(safe-area-inset-bottom));
      }

      .editor-page.immersive .editor-body {
        padding-bottom: 300px;
      }

    }
  `]
})
export class JournalEditorComponent implements OnInit {
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

  images = signal<JournalImage[]>([]);
  uploading = signal(false);
  uploadError = signal('');
  deletingImgId = signal<string | null>(null);

  collections = signal<JournalCollection[]>([]);
  selectedCollections = new Set<string>();

  lightboxUrl = signal<string | null>(null);

  constructor(
    private svc: JournalService,
    private route: ActivatedRoute,
    private router: Router,
    private uploadSvc: UploadService,
  ) {}

  ngOnInit() {
    this.editId = this.route.snapshot.paramMap.get('id');
    this.svc.listCollections().subscribe(c => this.collections.set(c));

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
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); this.router.navigate(['/journal']); },
      });
    }
  }

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
    if (this.selectedCollections.has(id)) {
      this.selectedCollections.delete(id);
    } else {
      this.selectedCollections.add(id);
    }
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
    const req = {
      title: this.title.trim() || undefined,
      body: this.body.trim(),
      mood: this.mood || undefined,
      tags: this.tags,
    };

    if (this.editId) {
      this.svc.updateEntry(this.editId, req).subscribe({
        next: () => { this.saving.set(false); this.router.navigate(['/journal']); },
        error: (err: any) => { this.saving.set(false); this.saveError.set(err?.error?.message ?? 'Failed to save.'); },
      });
    } else {
      this.svc.createEntry(req).subscribe({
        next: e => {
          // Add to selected collections
          Array.from(this.selectedCollections).forEach(cid =>
            this.svc.addEntryToCollection(cid, e.id).subscribe()
          );
          this.saving.set(false);
          this.router.navigate(['/journal']);
        },
        error: (err: any) => { this.saving.set(false); this.saveError.set(err?.error?.message ?? 'Failed to save.'); },
      });
    }
  }

  onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.uploadError.set('Only JPEG, PNG, and WebP images are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.uploadError.set('Image must be 10 MB or smaller.');
      return;
    }
    if (this.images().length >= 3) {
      this.uploadError.set('Maximum 3 images per entry.');
      return;
    }
    if (!this.editId) {
      // Must save first to get an entry ID
      this.uploadError.set('Please save the entry first before adding images.');
      return;
    }
    this.uploadError.set('');
    this.uploading.set(true);

    this.svc.presignImage(this.editId, file.type, file.size).subscribe({
      next: ({ upload_url, object_key }) => {
        this.uploadSvc.putToStorage(upload_url, file).then(() => {
          this.svc.confirmImage(this.editId!, object_key).subscribe({
            next: img => { this.images.update(imgs => [...imgs, img]); this.uploading.set(false); },
            error: () => { this.uploadError.set('Upload succeeded but confirmation failed.'); this.uploading.set(false); },
          });
        }).catch(() => { this.uploadError.set('Failed to upload image.'); this.uploading.set(false); });
      },
      error: () => { this.uploadError.set('Failed to start upload.'); this.uploading.set(false); },
    });

    // Reset input
    (event.target as HTMLInputElement).value = '';
  }

  deleteImage(img: JournalImage) {
    this.deletingImgId.set(img.id);
    this.svc.deleteImage(img.id).subscribe({
      next: () => { this.images.update(imgs => imgs.filter(i => i.id !== img.id)); this.deletingImgId.set(null); },
      error: () => this.deletingImgId.set(null),
    });
  }

  goBack() { this.router.navigate(['/journal']); }

  @HostListener('document:keydown.escape')
  onEscape() { this.lightboxUrl.set(null); this.immersive.set(false); }
}
