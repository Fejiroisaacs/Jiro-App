import { Component, OnInit, inject, signal } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  JournalService,
  JournalCollection,
  JournalEntry,
  MOODS,
  moodMeta,
} from '../../../core/services/journal.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { IconName } from '../../../shared/icons/icons.generated';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { UploadService } from '../../../core/services/upload.service';

@Component({
  selector: 'app-journal-collection',
  standalone: true,
  imports: [FormsModule, RouterLink, JiroButtonComponent, JiroModalComponent, JiroIconComponent],
  template: `
    <div class="collection-page">

      <!-- Top bar -->
      <div class="page-header">
        <div class="header-left">
          <a routerLink="/journal" class="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            Journaly
          </a>
          @if (collection()) {
<div class="coll-header-info">
            <div class="coll-cover-wrap">
              <div class="coll-cover" [style.background-image]="collection()!.cover_image_url ? 'url(' + collection()!.cover_image_url + ')' : ''">
                @if (!collection()!.cover_image_url) {
<img src="/icons/folder-icon.svg" width="48" height="48" alt="" class="coll-cover-icon" />
}
              </div>
              <label class="cover-change">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>
                </svg>
                <input
                  type="file"
                  class="cover-file"
                  accept="image/jpeg,image/png,image/webp"
                  [disabled]="coverBusy()"
                  [attr.aria-label]="collection()!.cover_image_url ? 'Change cover image' : 'Add cover image'"
                  (change)="onCoverFileChange($event)" />
              </label>
              @if (coverBusy()) {
<div class="cover-pending" role="status">
                <span class="spinner spinner--sm"></span>
                <span class="cover-sr">Uploading cover image, {{ coverProgress() }} percent</span>
              </div>
}
            </div>
            @if (collection()!.cover_image_url) {
<div class="cover-actions">
              <button
                type="button"
                class="cover-remove"
                [disabled]="coverBusy()"
                aria-label="Remove cover image"
                (click)="removeCover()">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
}
            <div>
              <h1>{{ collection()!.name }}</h1>
              @if (collection()!.description) {
<p class="text-secondary">{{ collection()!.description }}</p>
}
              <p class="text-secondary">{{ entries().length }} {{ entries().length === 1 ? 'entry' : 'entries' }}</p>
            </div>
          </div>
}
        </div>
        @if (collection()) {
<div class="header-actions">
          <jiro-button variant="secondary" type="button" (click)="openEdit()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </jiro-button>
        </div>
}
      </div>

      <!-- Loading -->
      @if (loading()) {
<div class="state-center">
        <span class="spinner"></span>
      </div>
}

      <!-- Not found -->
      @if (!loading() && !collection()) {
<div class="state-center">
        <h2>Collection not found</h2>
        <p class="text-secondary">This collection may have been deleted.</p>
        <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal'])">Back to Journaly</jiro-button>
      </div>
}

      <!-- Content -->
      @if (!loading() && collection()) {
<div>

        <!-- Empty -->
        @if (entries().length === 0) {
<div class="state-center">
          <h2>No entries yet</h2>
          <p class="text-secondary">Write a new entry for it, or open an existing entry and pick this collection under Collections.</p>
          <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal/new'], { queryParams: { collection: collId } })">Write entry</jiro-button>
        </div>
}

        <!-- Entries -->
        @if (entries().length > 0) {
<div class="entries-list">
          @for (e of entries(); track e) {
<div
           
            class="entry-card"
            (click)="router.navigate(['/journal', e.id, 'edit'])">
            <div class="entry-card-top">
              <div class="entry-meta">
                <span class="entry-date">{{ formatDate(e.created_at) }}</span>
                @if (e.mood) {
<span class="mood-chip"><jiro-icon [name]="moodIcon(e.mood)" /> {{ moodLabel(e.mood) }}</span>
}
              </div>
              <div class="entry-card-actions" (click)="$event.stopPropagation()">
                <button
                  class="icon-btn danger"
                  (click)="confirmRemove(e)"
                  [disabled]="removingId() === e.id"
                  [attr.aria-label]="'Remove ' + (e.title || 'this entry') + ' from the collection'">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            @if (e.title) {
<h2 class="entry-title">{{ e.title }}</h2>
}
            <p class="entry-excerpt">{{ excerpt(e.body) }}</p>
            <div class="entry-footer">
              <div class="tag-list">
                @for (t of (e.tags || []); track t) {
<span class="tag-chip">{{ t }}</span>
}
              </div>
              @if (e.images?.length) {
<span class="img-badge">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
                {{ e.images?.length }}
              </span>
}
            </div>
          </div>
}
        </div>
}
      </div>
}
    </div>

    <!-- Edit modal -->
    @if (showEdit()) {
<jiro-modal title="Edit Collection" (close)="showEdit.set(false)">
      <div class="modal-form">
        <label class="form-label" for="edit-coll-name">Name</label>
        <input id="edit-coll-name" type="text" class="form-control" [(ngModel)]="editName" maxlength="100" />
        <label class="form-label" for="edit-coll-desc" style="margin-top:var(--space-sm)">Description (optional)</label>
        <input id="edit-coll-desc" type="text" class="form-control" [(ngModel)]="editDesc" maxlength="255" placeholder="A brief description..." />
      </div>
      <div class="modal-actions">
        <jiro-button variant="danger" type="button" (click)="deleteCollection()">Delete</jiro-button>
        <div style="flex:1"></div>
        <jiro-button variant="secondary" type="button" (click)="showEdit.set(false)">Cancel</jiro-button>
        <jiro-button variant="primary" type="button" [disabled]="!editName.trim() || saving()" (click)="saveEdit()">
          {{ saving() ? 'Saving...' : 'Save' }}
        </jiro-button>
      </div>
    </jiro-modal>
}

  `,
  styles: [`
    .collection-page { max-width: 860px; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-xl); gap: var(--space-md); }
    .header-left { display: flex; flex-direction: column; gap: var(--space-sm); }
    .back-link {
      display: flex; align-items: center; gap: 4px;
      font-size: var(--font-size-sm); color: var(--text-secondary); text-decoration: none; transition: color 0.15s;
    }
    .back-link:hover { color: var(--color-primary); text-decoration: none; }
    .coll-header-info { display: flex; align-items: center; gap: var(--space-md); }
    .coll-cover {
      width: 60px;
      height: 60px;
      border-radius: var(--border-radius);
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      background-size: cover;
      background-position: center;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .coll-cover-icon { display: block; }
    .coll-header-info h1 { margin: 0 0 2px; }
    .header-actions { flex-shrink: 0; }

    /* Cover image controls */
    .coll-cover-wrap { position: relative; width: 60px; height: 60px; flex-shrink: 0; }
    .cover-change {
      position: absolute; inset: 0;
      min-width: 40px; min-height: 40px;
      display: flex; align-items: flex-end; justify-content: flex-end;
      padding: var(--space-xs);
      border-radius: var(--border-radius);
      cursor: pointer;
    }
    .cover-change svg {
      display: block; padding: 3px; box-sizing: content-box;
      color: var(--text-secondary);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      transition: color 0.15s, border-color 0.15s;
    }
    .coll-cover-wrap:hover .cover-change svg,
    .cover-change:focus-within svg { color: var(--text-primary); border-color: var(--text-secondary); }
    .cover-change:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .cover-file {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; border: 0;
      overflow: hidden; clip-path: inset(50%); white-space: nowrap;
    }
    .cover-pending {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      border-radius: var(--border-radius);
      background: color-mix(in srgb, var(--bg-canvas) 78%, transparent);
    }
    .cover-sr {
      position: absolute; width: 1px; height: 1px;
      padding: 0; margin: -1px; border: 0;
      overflow: hidden; clip-path: inset(50%); white-space: nowrap;
    }
    .cover-actions { display: flex; align-items: center; flex-shrink: 0; }
    .cover-remove {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      cursor: pointer;
      transition: color 0.12s, border-color 0.12s, background 0.12s;
    }
    .cover-remove:hover:not(:disabled) {
      color: var(--color-danger);
      border-color: var(--color-danger);
      background: color-mix(in srgb, var(--color-danger) 10%, transparent);
    }
    .cover-remove:disabled { opacity: 0.5; cursor: not-allowed; }

    /* State */
    .state-center { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-sm); padding: var(--space-xl) 0; }
    .state-center h2 { font-size: 1.17em; } /* the size these had as h3 */

    /* Entry cards */
    .entries-list { display: flex; flex-direction: column; gap: var(--space-md); }
    .entry-card {
      background: var(--bg-surface); border: 1px solid var(--border-color); border-radius: var(--border-radius);
      padding: var(--space-md) var(--space-lg); cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .entry-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .entry-card-top { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-xs); }
    .entry-meta { display: flex; align-items: center; gap: var(--space-sm); }
    .entry-date { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .mood-chip { display: inline-flex; align-items: center; gap: 4px; font-size: var(--font-size-xs); padding: 2px 8px; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); border-radius: 99px; }
    .entry-card-actions { display: flex; gap: var(--space-xs); opacity: 0; transition: opacity 0.15s; }
    .entry-card:hover .entry-card-actions,
    .entry-card:focus-within .entry-card-actions { opacity: 1; }
    /* No hover on touch screens: keep the remove control visible. */
    @media (hover: none) { .entry-card-actions { opacity: 1; } }
    .icon-btn { min-width: 32px; min-height: 32px; justify-content: center; }
    .icon-btn { background: none; border: none; cursor: pointer; padding: 4px; border-radius: var(--border-radius-sm); color: var(--text-secondary); display: flex; align-items: center; transition: color 0.12s, background 0.12s; }
    .icon-btn.danger:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .entry-title { font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-xs); }
    .entry-excerpt { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0 0 var(--space-sm); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .entry-footer { display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm); }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag-chip { font-size: 0.65rem; padding: 2px 6px; background: var(--bg-surface-hover); border-radius: 99px; color: var(--text-secondary); }
    .img-badge { display: flex; align-items: center; gap: 3px; font-size: var(--font-size-xs); color: var(--text-secondary); flex-shrink: 0; }

    /* Modal */
    .modal-form { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-lg); }
    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }
    .form-control { font-family: inherit; font-size: var(--font-size-sm); border: 1px solid var(--border-color); border-radius: var(--border-radius-sm); background: var(--bg-canvas); color: var(--text-primary); padding: 8px var(--space-sm); }
    .form-control:focus { border-color: var(--color-primary); }
    .modal-actions { display: flex; gap: var(--space-sm); align-items: center; }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
      .header-actions { width: 100%; justify-content: flex-end; }
    }
  `]
})
export class JournalCollectionComponent implements OnInit {
  collId = '';
  collection = signal<JournalCollection | null>(null);
  entries = signal<JournalEntry[]>([]);
  loading = signal(true);

  showEdit = signal(false);
  editName = '';
  editDesc = '';
  saving = signal(false);

  removingId = signal<string | null>(null);

  deleting = signal(false);

  coverBusy = signal(false);
  coverProgress = signal(0);

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly uploadService = inject(UploadService);

  constructor(
    private svc: JournalService,
    private route: ActivatedRoute,
    public router: Router,
  ) { }

  ngOnInit() {
    this.collId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getCollection(this.collId).subscribe({
      next: ({ collection, entries }) => {
        this.collection.set(collection);
        this.entries.set(entries);
        this.editName = collection.name;
        this.editDesc = collection.description ?? '';
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openEdit() {
    const c = this.collection();
    if (c) { this.editName = c.name; this.editDesc = c.description ?? ''; }
    this.showEdit.set(true);
  }

  saveEdit() {
    if (!this.editName.trim()) return;
    this.saving.set(true);
    this.svc.updateCollection(this.collId, { name: this.editName.trim(), description: this.editDesc.trim() || undefined }).subscribe({
      next: c => {
        this.collection.set(c);
        this.showEdit.set(false);
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  onCoverFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!input) return;
    input.value = '';
    if (!file || !this.collId) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.toast.error('Please choose a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast.error('Image must be under 5 MB.');
      return;
    }

    this.coverBusy.set(true);
    this.coverProgress.set(0);
    this.uploadService.uploadCollectionCover(this.collId, file, pct => this.coverProgress.set(pct)).subscribe({
      next: url => {
        this.collection.update(c => c ? { ...c, cover_image_url: url } : c);
        this.coverBusy.set(false);
        this.toast.success('Cover image updated');
      },
      error: () => {
        this.coverBusy.set(false);
        this.toast.error('Could not upload the cover image.');
      },
    });
  }

  async removeCover() {
    if (!this.collection()?.cover_image_url) return;
    const ok = await this.confirmService.confirm({
      title: 'Remove cover image?',
      message: 'The collection keeps its name and entries; only the cover image goes.',
      confirmLabel: 'Remove image',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (!ok) return;

    this.coverBusy.set(true);
    this.uploadService.deleteCollectionCover(this.collId).subscribe({
      next: () => {
        this.collection.update(c => c ? { ...c, cover_image_url: null } : c);
        this.coverBusy.set(false);
        this.toast.success('Cover image removed');
      },
      error: () => {
        this.coverBusy.set(false);
        this.toast.error('Could not remove the cover image.');
      },
    });
  }

  async confirmRemove(e: JournalEntry) {
    const ok = await this.confirmService.confirm({
      title: 'Remove from this collection?',
      message: 'The entry stays in your journal; only this collection lets it go.',
      confirmLabel: 'Remove',
      cancelLabel: 'Keep it',
      danger: true,
    });
    if (ok) this.removeEntry(e);
  }

  removeEntry(e: JournalEntry) {
    this.removingId.set(e.id);
    this.svc.removeEntryFromCollection(this.collId, e.id).subscribe({
      next: () => {
        this.entries.update(es => es.filter(x => x.id !== e.id));
        this.removingId.set(null);
        this.collection.update(c => c ? { ...c, entry_count: c.entry_count - 1 } : c);
        this.toast.success('Removed from the collection');
      },
      error: () => {
        this.removingId.set(null);
        this.toast.error('Could not remove the entry from the collection.');
      },
    });
  }

  async deleteCollection() {
    const name = this.collection()?.name ?? 'this collection';
    const ok = await this.confirmService.confirm({
      title: `Delete ${name}?`,
      message: 'The collection goes; the entries inside it stay in your journal.',
      confirmLabel: 'Delete collection',
      danger: true,
    });
    if (!ok) return;
    this.svc.deleteCollection(this.collId).subscribe({
      next: () => {
        this.toast.success(`${name} deleted`);
        this.router.navigate(['/journal']);
      },
      error: () => this.toast.error('Could not delete the collection.'),
    });
  }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  excerpt(body: string): string {
    return body.length > 180 ? body.slice(0, 180) + '...' : body;
  }

  moodIcon(value: string): IconName { return moodMeta(value)?.icon ?? 'smiley'; }
  moodLabel(value: string): string { return MOODS.find(m => m.value === value)?.label ?? value; }
}
