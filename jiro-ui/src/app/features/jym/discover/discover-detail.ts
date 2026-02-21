import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { JymService, PublicSplitDetail } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-discover-detail',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent],
  template: `
    <div class="discover-detail">
      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading split...</p>
      </div>

      <!-- Error -->
      <div *ngIf="!loading() && error()" class="state-message">
        <h3>Split not found</h3>
        <p class="text-secondary">This split may be private or no longer exists.</p>
        <jiro-button variant="secondary" type="button" (click)="router.navigate(['/jym/discover'])">
          Back to Discover
        </jiro-button>
      </div>

      <!-- Content -->
      <div *ngIf="!loading() && split()">
        <!-- Header -->
        <div class="page-header">
          <div class="header-left">
            <button class="back-btn" (click)="router.navigate(['/jym/discover'])">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15,18 9,12 15,6"/>
              </svg>
              Discover
            </button>
            <h1>{{ split()!.split_name }}</h1>
            <div *ngIf="split()!.tags.length" class="tag-row">
              <span *ngFor="let tag of split()!.tags" class="tag-chip">{{ tag }}</span>
            </div>
          </div>
          <div class="header-actions">
            <jiro-button variant="primary" type="button" [disabled]="importing()" (click)="importSplit()">
              <svg *ngIf="!importing() && !imported()" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7,10 12,15 17,10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              <svg *ngIf="imported()" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20,6 9,17 4,12"/>
              </svg>
              {{ importing() ? 'Importing...' : imported() ? 'Added!' : 'Add to My Splits' }}
            </jiro-button>
          </div>
        </div>

        <!-- Success banner -->
        <div *ngIf="imported()" class="import-banner">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20,6 9,17 4,12"/>
          </svg>
          Split added to your account.
          <button class="goto-btn" (click)="router.navigate(['/jym'])">Go to My Splits</button>
        </div>

        <!-- Routines -->
        <div class="routines-grid">
          <div *ngFor="let routine of split()!.routines" class="routine-card">
            <div class="routine-header">
              <span class="day-chip">Day {{ routine.day_order }}</span>
              <span class="routine-name">{{ routine.name }}</span>
            </div>
            <div class="exercise-list">
              <div *ngFor="let ex of routine.exercises" class="exercise-row">
                <div class="ex-info">
                  <span class="ex-name">{{ ex.name }}</span>
                  <span class="ex-muscle text-secondary" *ngIf="ex.muscle_group">{{ ex.muscle_group }}</span>
                </div>
                <span class="ex-sets">{{ ex.target_sets }}×{{ ex.target_reps }}</span>
              </div>
              <div *ngIf="routine.exercises.length === 0" class="no-exercises text-secondary">
                No exercises listed
              </div>
            </div>
          </div>
        </div>

        <!-- Empty routines -->
        <div *ngIf="split()!.routines.length === 0" class="state-message">
          <p class="text-secondary">This split has no routines yet.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .discover-detail { max-width: 900px; width: 100%; }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }

    .state-message ::ng-deep .jiro-btn { width: auto; }

    .spinner-lg {
      width: 36px; height: 36px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-lg); gap: var(--space-md);
    }

    .header-left { display: flex; flex-direction: column; gap: var(--space-xs); }

    .header-actions ::ng-deep .jiro-btn { width: auto; flex-shrink: 0; }

    .back-btn {
      display: flex; align-items: center; gap: 6px;
      background: none; border: none; color: var(--text-muted);
      font-size: var(--font-size-sm); cursor: pointer; padding: 0;
    }

    .back-btn:hover { color: var(--text-primary); }

    h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .tag-row { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }

    .tag-chip {
      font-size: 11px; font-weight: 500;
      padding: 2px 8px; border-radius: 10px;
      background: rgba(122,59,46,0.08); color: var(--color-primary);
      border: 1px solid rgba(122,59,46,0.18);
    }

    .import-banner {
      display: flex; align-items: center; gap: var(--space-sm);
      background: rgba(76,175,80,0.08); border: 1px solid rgba(76,175,80,0.3);
      border-radius: var(--border-radius); padding: var(--space-sm) var(--space-md);
      margin-bottom: var(--space-lg); color: #2e7d32; font-size: var(--font-size-sm);
    }

    .goto-btn {
      background: none; border: none; color: #2e7d32; font-weight: 600;
      text-decoration: underline; cursor: pointer; font-size: var(--font-size-sm);
    }

    .routines-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: var(--space-lg);
    }

    .routine-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .routine-header {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-md); border-bottom: 1px solid var(--border-color);
      background: var(--bg-canvas);
    }

    .day-chip {
      background: rgba(122,59,46,0.12); color: var(--color-primary);
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 2px 8px; border-radius: 10px; white-space: nowrap;
    }

    .routine-name { font-weight: 600; font-size: var(--font-size-sm); }

    .exercise-list { padding: var(--space-sm); display: flex; flex-direction: column; gap: 2px; }

    .exercise-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-xs) var(--space-sm);
      border-radius: 4px; transition: background 0.1s;
    }

    .exercise-row:hover { background: var(--bg-canvas); }

    .ex-info { display: flex; flex-direction: column; gap: 1px; }

    .ex-name { font-size: var(--font-size-sm); font-weight: 500; }

    .ex-muscle { font-size: var(--font-size-xs); }

    .ex-sets {
      font-size: var(--font-size-xs); font-weight: 600;
      color: var(--color-primary); background: rgba(122,59,46,0.1);
      padding: 2px 8px; border-radius: 8px; white-space: nowrap;
    }

    .no-exercises {
      font-size: var(--font-size-sm); padding: var(--space-sm) var(--space-md);
      text-align: center;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class DiscoverDetailComponent implements OnInit {
  split = signal<PublicSplitDetail | null>(null);
  loading = signal(true);
  error = signal(false);
  importing = signal(false);
  imported = signal(false);

  private splitId = '';

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    public router: Router,
  ) {}

  ngOnInit() {
    this.splitId = this.route.snapshot.paramMap.get('id') || '';
    this.jymService.getPublicSplit(this.splitId).subscribe({
      next: s => { this.split.set(s); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  importSplit() {
    if (this.imported()) return;
    this.importing.set(true);
    this.jymService.importPublicSplit(this.splitId).subscribe({
      next: () => { this.importing.set(false); this.imported.set(true); },
      error: () => this.importing.set(false),
    });
  }
}
