import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JournalService, JournalCollection } from '../../../core/services/journal.service';
import { JournalQuickNavComponent } from '../journal-quick-nav/journal-quick-nav';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-journal-collections-list',
  standalone: true,
  imports: [CommonModule, FormsModule, JournalQuickNavComponent, JiroButtonComponent, JiroModalComponent],
  template: `
    <div class="collections-page">

      <div class="page-header">
        <div>
          <h1>Journaly</h1>
          <p class="text-secondary">Your reflection space</p>
        </div>
      </div>

      <journal-quick-nav></journal-quick-nav>

      <div class="section-row">
        <h2 class="section-title">Collections</h2>
        <jiro-button variant="secondary" type="button" (click)="showCreate.set(true)">+ New</jiro-button>
      </div>

      <div *ngIf="loading()" class="state-box">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading() && collections().length === 0" class="state-box">
        <h3>No collections yet</h3>
        <p class="text-secondary">Group related entries into collections — travel, family moments, and more.</p>
        <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">Create Collection</jiro-button>
      </div>

      <div class="collections-grid" *ngIf="!loading() && collections().length > 0">
        <div
          *ngFor="let c of collections()"
          class="collection-card"
          (click)="router.navigate(['/journal/collections', c.id])">
          <div class="collection-cover" [style.background-image]="c.cover_image_url ? 'url(' + c.cover_image_url + ')' : ''">
            <img *ngIf="!c.cover_image_url" src="/icons/folder-icon.svg" width="48" height="48" alt="" />
          </div>
          <div class="collection-body">
            <span class="collection-name">{{ c.name }}</span>
            <span class="collection-count text-secondary">{{ c.entry_count }} {{ c.entry_count === 1 ? 'entry' : 'entries' }}</span>
            <p class="collection-desc text-secondary" *ngIf="c.description">{{ c.description }}</p>
          </div>
        </div>
      </div>
    </div>

    <jiro-modal *ngIf="showCreate()" title="New Collection" (close)="showCreate.set(false)">
      <div class="modal-form">
        <label class="form-label">Name</label>
        <input type="text" class="form-control" [(ngModel)]="newName" placeholder="e.g. Europe Trip 2024" maxlength="100" />
        <label class="form-label" style="margin-top: var(--space-sm)">Description (optional)</label>
        <input type="text" class="form-control" [(ngModel)]="newDesc" placeholder="A brief description..." maxlength="255" />
      </div>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="showCreate.set(false)">Cancel</jiro-button>
        <jiro-button variant="primary" type="button" [disabled]="!newName.trim() || creating()" (click)="createCollection()">
          {{ creating() ? 'Creating...' : 'Create' }}
        </jiro-button>
      </div>
    </jiro-modal>
  `,
  styles: [`
    .collections-page { max-width: 860px; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-xl); }
    .page-header h1 { margin: 0 0 var(--space-xs); }

    .section-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-lg); }
    .section-title { font-size: var(--font-size-lg); font-weight: 600; margin: 0; }

    .state-box { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-sm); padding: var(--space-xl) 0; }

    .collections-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-md);
    }
    .collection-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
      cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .collection-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .collection-cover {
      height: 100px;
      background: color-mix(in srgb, var(--color-primary) 12%, transparent);
      background-size: cover; background-position: center;
      display: flex; align-items: center; justify-content: center;
    }
    .collection-body { padding: var(--space-sm) var(--space-md); }
    .collection-name { font-weight: 600; font-size: var(--font-size-sm); display: block; margin-bottom: 2px; }
    .collection-count { font-size: var(--font-size-xs); display: block; }
    .collection-desc {
      font-size: var(--font-size-xs); margin-top: 4px;
      overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    }

    .modal-form { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-lg); }
    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }
    .form-control {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-canvas); color: var(--text-primary); padding: 8px var(--space-sm);
    }
    .form-control:focus { outline: none; border-color: var(--color-primary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }

    @media (max-width: 600px) {
      .collections-grid { grid-template-columns: repeat(2, 1fr); }
    }
  `]
})
export class JournalCollectionsListComponent implements OnInit {
  collections = signal<JournalCollection[]>([]);
  loading = signal(true);
  showCreate = signal(false);
  newName = '';
  newDesc = '';
  creating = signal(false);

  constructor(private svc: JournalService, public router: Router) {}

  ngOnInit() {
    this.svc.listCollections().subscribe({
      next: c => { this.collections.set(c); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  createCollection() {
    if (!this.newName.trim()) return;
    this.creating.set(true);
    this.svc.createCollection(this.newName.trim(), this.newDesc.trim() || undefined).subscribe({
      next: c => {
        this.collections.update(cs => [c, ...cs]);
        this.newName = '';
        this.newDesc = '';
        this.showCreate.set(false);
        this.creating.set(false);
      },
      error: () => this.creating.set(false),
    });
  }
}
