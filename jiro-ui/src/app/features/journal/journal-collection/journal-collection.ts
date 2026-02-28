import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  JournalService,
  JournalCollection,
  JournalEntry,
  MOODS,
} from '../../../core/services/journal.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-journal-collection',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, JiroButtonComponent, JiroModalComponent],
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
          <div class="coll-header-info" *ngIf="collection()">
            <div class="coll-cover" [style.background-image]="collection()!.cover_image_url ? 'url(' + collection()!.cover_image_url + ')' : ''">
              <img *ngIf="!collection()!.cover_image_url" src="/icons/folder-icon.svg" width="48" height="48" alt="" class="coll-cover-icon" />
            </div>
            <div>
              <h1>{{ collection()!.name }}</h1>
              <p class="text-secondary" *ngIf="collection()!.description">{{ collection()!.description }}</p>
              <p class="text-secondary">{{ entries().length }} {{ entries().length === 1 ? 'entry' : 'entries' }}</p>
            </div>
          </div>
        </div>
        <div class="header-actions" *ngIf="collection()">
          <jiro-button variant="secondary" type="button" (click)="openEdit()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit
          </jiro-button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-center">
        <div class="spinner-lg"></div>
      </div>

      <!-- Not found -->
      <div *ngIf="!loading() && !collection()" class="state-center">
        <h3>Collection not found</h3>
        <p class="text-secondary">This collection may have been deleted.</p>
        <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal'])">Back to Journaly</jiro-button>
      </div>

      <!-- Content -->
      <div *ngIf="!loading() && collection()">

        <!-- Empty -->
        <div *ngIf="entries().length === 0" class="state-center">
          <h3>No entries yet</h3>
          <p class="text-secondary">Add entries to this collection from the editor or entry cards.</p>
          <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal/new'])">Write Entry</jiro-button>
        </div>

        <!-- Entries -->
        <div class="entries-list" *ngIf="entries().length > 0">
          <div
            *ngFor="let e of entries()"
            class="entry-card"
            (click)="router.navigate(['/journal', e.id, 'edit'])">
            <div class="entry-card-top">
              <div class="entry-meta">
                <span class="entry-date">{{ formatDate(e.created_at) }}</span>
                <span class="mood-chip" *ngIf="e.mood">{{ moodEmoji(e.mood) }} {{ moodLabel(e.mood) }}</span>
              </div>
              <div class="entry-card-actions" (click)="$event.stopPropagation()">
                <button
                  class="icon-btn danger"
                  (click)="confirmRemove(e)"
                  [disabled]="removingId() === e.id"
                  aria-label="Remove from collection">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>
            <h3 class="entry-title" *ngIf="e.title">{{ e.title }}</h3>
            <p class="entry-excerpt">{{ excerpt(e.body) }}</p>
            <div class="entry-footer">
              <div class="tag-list">
                <span class="tag-chip" *ngFor="let t of (e.tags || [])">{{ t }}</span>
              </div>
              <span class="img-badge" *ngIf="e.images?.length">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21,15 16,10 5,21"/>
                </svg>
                {{ e.images?.length }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit modal -->
    <jiro-modal *ngIf="showEdit()" title="Edit Collection" (close)="showEdit.set(false)">
      <div class="modal-form">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" [(ngModel)]="editName" maxlength="100" />
        <label class="form-label" style="margin-top:var(--space-sm)">Description (optional)</label>
        <input type="text" class="form-control" [(ngModel)]="editDesc" maxlength="255" placeholder="A brief description..." />
      </div>
      <div class="modal-actions">
        <jiro-button variant="danger" type="button" (click)="confirmDeleteColl.set(true)">Delete</jiro-button>
        <div style="flex:1"></div>
        <jiro-button variant="secondary" type="button" (click)="showEdit.set(false)">Cancel</jiro-button>
        <jiro-button variant="primary" type="button" [disabled]="!editName.trim() || saving()" (click)="saveEdit()">
          {{ saving() ? 'Saving...' : 'Save' }}
        </jiro-button>
      </div>
    </jiro-modal>

    <!-- Remove entry from collection confirm -->
    <jiro-modal *ngIf="removeTarget()" title="Remove from Collection" (close)="removeTarget.set(null)">
      <p>Remove <strong>{{ removeTarget()?.title || 'this entry' }}</strong> from the collection? The entry itself won't be deleted.</p>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="removeTarget.set(null)">Cancel</jiro-button>
        <jiro-button variant="danger" type="button" [disabled]="!!removingId()" (click)="removeEntry()">Remove</jiro-button>
      </div>
    </jiro-modal>

    <!-- Delete collection confirm -->
    <jiro-modal *ngIf="confirmDeleteColl()" title="Delete Collection" (close)="confirmDeleteColl.set(false)">
      <p>Delete <strong>{{ collection()?.name }}</strong>? The entries inside won't be deleted, just the collection.</p>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="confirmDeleteColl.set(false)">Cancel</jiro-button>
        <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="deleteCollection()">
          {{ deleting() ? 'Deleting...' : 'Delete' }}
        </jiro-button>
      </div>
    </jiro-modal>
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

    /* State */
    .state-center { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-sm); padding: var(--space-xl) 0; }

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
    .mood-chip { font-size: var(--font-size-xs); padding: 2px 8px; background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); border-radius: 99px; }
    .entry-card-actions { display: flex; gap: var(--space-xs); opacity: 0; transition: opacity 0.15s; }
    .entry-card:hover .entry-card-actions { opacity: 1; }
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
    .form-control:focus { outline: none; border-color: var(--color-primary); }
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

  removeTarget = signal<JournalEntry | null>(null);
  removingId = signal<string | null>(null);

  confirmDeleteColl = signal(false);
  deleting = signal(false);

  constructor(
    private svc: JournalService,
    private route: ActivatedRoute,
    public router: Router,
  ) {}

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

  confirmRemove(e: JournalEntry) { this.removeTarget.set(e); }

  removeEntry() {
    const e = this.removeTarget();
    if (!e) return;
    this.removingId.set(e.id);
    this.svc.removeEntryFromCollection(this.collId, e.id).subscribe({
      next: () => {
        this.entries.update(es => es.filter(x => x.id !== e.id));
        this.removeTarget.set(null);
        this.removingId.set(null);
        // Update count
        this.collection.update(c => c ? { ...c, entry_count: c.entry_count - 1 } : c);
      },
      error: () => this.removingId.set(null),
    });
  }

  deleteCollection() {
    this.deleting.set(true);
    this.svc.deleteCollection(this.collId).subscribe({
      next: () => { this.deleting.set(false); this.router.navigate(['/journal']); },
      error: () => this.deleting.set(false),
    });
  }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  excerpt(body: string): string {
    return body.length > 180 ? body.slice(0, 180) + '...' : body;
  }

  moodEmoji(value: string): string { return MOODS.find(m => m.value === value)?.emoji ?? ''; }
  moodLabel(value: string): string { return MOODS.find(m => m.value === value)?.label ?? value; }
}
