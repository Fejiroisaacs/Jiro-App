import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { JymService, Split, CreateSeriesRequest } from '../../../core/services/jym.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';

@Component({
  selector: 'app-split-list',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent, JymQuickNavComponent],
  template: `
    <div class="split-list">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Splits</h1>
          <p class="text-secondary">Manage your training splits</p>
        </div>
        <div class="header-actions">
          <button class="discover-btn" (click)="router.navigate(['/jym/discover'])">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            Discover
          </button>
          <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">
            + New Routine Split
          </jiro-button>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading splits...</p>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading() && splits().length === 0" class="state-message">
        <h3>No training splits yet</h3>
        <p class="text-secondary">Create your first split to organise your training week.</p>
        <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">
          Create First Split
        </jiro-button>
      </div>

      <!-- Splits grid -->
      <div *ngIf="!loading() && splits().length > 0" class="splits-grid">
        <jiro-card *ngFor="let split of splits()" class="split-card">
          <div class="split-header">
            <div class="split-info">
              <h3 class="split-name">{{ split.name }}</h3>
              <p class="split-desc text-secondary" *ngIf="split.description">{{ split.description }}</p>
              <div *ngIf="split.tags.length" class="split-tags">
                <span *ngFor="let tag of split.tags" class="tag-chip">{{ tag }}</span>
              </div>
            </div>
            <span class="routine-badge">{{ split.routine_count || 0 }} {{ (split.routine_count || 0) === 1 ? 'day' : 'days' }}</span>
          </div>

          <div class="split-actions">
            <div class="btn-slot">
              <jiro-button variant="secondary" type="button" (click)="viewSplit(split.id)">
                Build
              </jiro-button>
            </div>
            <div class="btn-slot">
              <jiro-button variant="secondary" type="button" (click)="openNewSeries(split.id)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                </svg>
                Series
              </jiro-button>
            </div>
            <div class="btn-slot">
              <jiro-button variant="primary" type="button" (click)="startFromSplitCard(split)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <polygon points="5,3 19,12 5,21"/>
                </svg>
                Start
              </jiro-button>
            </div>
            <button class="delete-split-btn" (click)="confirmDelete(split)" title="Delete split">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
              </svg>
            </button>
          </div>
        </jiro-card>
      </div>

      <!-- Create Split Modal -->
      <jiro-modal *ngIf="showCreate()" title="New Training Split" maxWidth="480px" (close)="showCreate.set(false)">
        <form class="create-form" (ngSubmit)="createSplit()">
          <div class="form-group">
            <label class="form-label">Split Name</label>
            <input
              class="form-input"
              type="text"
              [(ngModel)]="newName"
              name="name"
              placeholder="e.g. Push Pull Legs"
              required />
          </div>
          <div class="form-group">
            <label class="form-label">Description (optional)</label>
            <textarea
              class="form-input form-textarea"
              [(ngModel)]="newDesc"
              name="desc"
              rows="2"
              placeholder="Brief description of this split..."></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Tags (optional, comma-separated)</label>
            <input
              class="form-input"
              type="text"
              [(ngModel)]="newTagsRaw"
              name="tags"
              placeholder="e.g. PPL, Hypertrophy, Beginner" />
          </div>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="showCreate.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !newName.trim()">
              {{ saving() ? 'Creating...' : 'Create Split' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- New Series Modal -->
      <jiro-modal *ngIf="showNewSeries()" title="Start New Series" maxWidth="480px" (close)="showNewSeries.set(false)">
        <form class="create-form" (ngSubmit)="createSeries()">
          <div class="form-group">
            <label class="form-label">Series Name</label>
            <input class="form-input" type="text" [(ngModel)]="seriesName" name="sname" placeholder="e.g. PPL Run #1" required />
          </div>
          <div class="form-group">
            <label class="form-label">Duration Type</label>
            <div class="duration-type-group">
              <button type="button" class="dtype-btn" [class.active]="seriesDurationType === 'weeks'" (click)="seriesDurationType = 'weeks'">Fixed Weeks</button>
              <button type="button" class="dtype-btn" [class.active]="seriesDurationType === 'sessions'" (click)="seriesDurationType = 'sessions'">Session Count</button>
              <button type="button" class="dtype-btn" [class.active]="seriesDurationType === 'open'" (click)="seriesDurationType = 'open'">Open-ended</button>
            </div>
          </div>
          <div class="form-group" *ngIf="seriesDurationType === 'weeks'">
            <label class="form-label">Target Weeks</label>
            <input class="form-input" type="number" min="1" [(ngModel)]="seriesTargetWeeks" name="tweeks" placeholder="e.g. 8" />
          </div>
          <div class="form-group" *ngIf="seriesDurationType === 'sessions'">
            <label class="form-label">Target Sessions</label>
            <input class="form-input" type="number" min="1" [(ngModel)]="seriesTargetSessions" name="tsessions" placeholder="e.g. 24" />
          </div>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="showNewSeries.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="savingSeries() || !seriesName.trim()">
              {{ savingSeries() ? 'Starting...' : 'Start Series' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- Delete Split Confirmation Modal -->
      <jiro-modal *ngIf="deletingSplit()" title="Delete Split?" maxWidth="420px" (close)="deletingSplit.set(null)">
        <div class="delete-confirm">
          <p>Delete <strong>{{ deletingSplit()!.name }}</strong>?</p>
          <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
            This will permanently delete the split and all its routines. Sessions that used these routines are not affected.
          </p>
          <div class="form-actions" style="margin-top: var(--space-lg);">
            <jiro-button variant="secondary" type="button" (click)="deletingSplit.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="deleteSplit()">
              {{ deleting() ? 'Deleting...' : 'Delete' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>

      <!-- Start Session: choose routine modal -->
      <jiro-modal *ngIf="showRoutinePicker()" title="Choose Routine" maxWidth="420px" (close)="showRoutinePicker.set(false)">
        <div *ngIf="loadingRoutines()" class="picker-loading">
          <div class="spinner-lg"></div>
        </div>
        <div *ngIf="!loadingRoutines()" class="routine-list">
          <button
            *ngFor="let r of pickerRoutines()"
            class="routine-pick-btn"
            (click)="startWithRoutine(r.id)">
            <span class="routine-pick-name">{{ r.name }}</span>
            <span class="routine-pick-day">Day {{ r.day_order }}</span>
          </button>
          <button class="routine-pick-btn freestyle" (click)="startFreeWithSplit()">
            Freestyle (no routine)
          </button>
        </div>
      </jiro-modal>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .split-list { max-width: 1000px; width: 100%; }

    .page-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      margin-bottom: var(--space-lg);
      gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions { display: flex; gap: var(--space-sm); flex-shrink: 0; align-items: center; }

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    .discover-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 8px 14px;
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .discover-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(122,59,46,0.05); }

    .split-tags { display: flex; flex-wrap: wrap; gap: 4px; margin-top: var(--space-xs); }

    .tag-chip {
      background: var(--bg-canvas); 
      color: var(--text-primary);
      font-size: var(--font-size-xs); 
      font-weight: 600;
      padding: 4px 8px; 
      border-radius: 2px;
      border: 1px dashed var(--border-color);
      box-shadow: 1px 1px 0 var(--border-color);
      white-space: nowrap;
    }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
      .header-actions { flex-shrink: 1; }
      .header-actions ::ng-deep .jiro-btn { width: auto; }
    }

    /* ── State messages ── */
    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }

    .state-message ::ng-deep .jiro-btn { width: auto; }

    .spinner-lg {
      width: 40px; height: 40px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .splits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
      gap: var(--space-lg);
    }

    .split-card { display: flex; flex-direction: column; gap: var(--space-md); }

    .split-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-info { flex: 1; min-width: 0; }

    .split-name { font-size: var(--font-size-lg); font-weight: 600; }

    .split-desc { font-size: var(--font-size-sm); margin-top: var(--space-xs); line-height: 1.4; }

    .routine-badge {
      background: var(--bg-canvas);
      color: var(--color-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 2px;
      border: 1px solid var(--border-color);
      box-shadow: 1px 1px 0 rgba(0,0,0,0.1);
      white-space: nowrap;
    }

    .split-actions { display: flex; gap: var(--space-sm); margin-top: var(--space-lg); align-items: center; }

    .btn-slot { flex: 1; display: flex; flex-direction: column; }
    .btn-slot ::ng-deep .jiro-btn { flex: 1; width: 100%; }

    .delete-split-btn {
      flex-shrink: 0;
      background: none; border: 1px solid var(--border-color);
      color: var(--text-muted); cursor: pointer;
      width: 36px; height: 36px; border-radius: var(--border-radius);
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s;
      position: relative;
      top: 0;
      left: 0;
    }

    .delete-split-btn:hover {
      color: var(--color-danger);
      border-color: rgba(196,74,74,0.3);
      background: rgba(196,74,74,0.04);
      box-shadow: 1px 1px 0 rgba(196,74,74,0.3);
      top: -1px; 
      left: -1px;
    }

    .delete-confirm { display: flex; flex-direction: column; gap: var(--space-xs); }

    .create-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-md); }

    .form-label { 
      font-size: var(--font-size-lg); 
      font-weight: 600; 
      color: var(--text-primary); 
      font-family: 'Newsreader', serif;
    }

    .form-input {
      padding: 10px 0; 
      border: none;
      border-bottom: 2px dashed var(--border-color);
      border-radius: 0; 
      background: transparent;
      color: var(--text-primary); 
      font-size: var(--font-size-md);
      outline: none; 
      transition: border-color 0.2s; 
      font-family: inherit; 
      width: 100%; 
      box-sizing: border-box;
    }

    .form-input:focus { 
      border-bottom-color: var(--color-primary); 
    }

    .form-textarea { resize: vertical; min-height: 60px; }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }

    .form-actions ::ng-deep .jiro-btn { width: auto; }

    .picker-loading { display: flex; justify-content: center; padding: var(--space-xl); }

    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; font-size: var(--font-size-md); color: var(--text-primary);
      transition: all 0.15s; text-align: left; width: 100%;
    }

    .routine-pick-btn:hover { border-color: var(--color-primary); background: rgba(122,59,46,0.05); }

    .routine-pick-btn.freestyle { color: var(--text-secondary); font-size: var(--font-size-sm); }

    .routine-pick-name { font-weight: 500; }

    .routine-pick-day { font-size: var(--font-size-xs); color: var(--text-muted); }

    .duration-type-group { display: flex; gap: var(--space-xs); }

    .dtype-btn {
      flex: 1; padding: var(--space-xs) var(--space-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); cursor: pointer; transition: all 0.15s;
    }

    .dtype-btn.active {
      border-color: var(--color-primary); background: rgba(122,59,46,0.08);
      color: var(--color-primary); font-weight: 600;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 600px) {
      .split-actions { gap: 0.3rem; }

      .split-actions ::ng-deep .jiro-btn {
        padding: 0.4rem 0.55rem;
        font-size: 0.7rem;
        gap: 0.2rem;
      }

      .split-actions svg { width: 10px; height: 10px; }

      .delete-split-btn { width: 2rem; height: 2rem; }
    }
  `]
})
export class SplitListComponent implements OnInit {
  splits = signal<Split[]>([]);
  loading = signal(true);
  saving = signal(false);
  showCreate = signal(false);
  deletingSplit = signal<Split | null>(null);
  deleting = signal(false);
  showRoutinePicker = signal(false);
  loadingRoutines = signal(false);
  pickerRoutines = signal<{ id: string; name: string; day_order: number }[]>([]);

  newName = '';
  newDesc = '';
  newTagsRaw = '';
  private selectedSplitId = '';

  // Series
  showNewSeries = signal(false);
  savingSeries = signal(false);
  seriesName = '';
  seriesDurationType: 'weeks' | 'sessions' | 'open' = 'open';
  seriesTargetWeeks: number | null = null;
  seriesTargetSessions: number | null = null;
  private seriesSplitId = '';

  constructor(private jymService: JymService, public router: Router) { }

  ngOnInit() {
    this.jymService.listSplits().subscribe({
      next: s => { this.splits.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  viewSplit(id: string) {
    this.router.navigate(['/jym/splits', id]);
  }

  createSplit() {
    if (!this.newName.trim()) return;
    this.saving.set(true);
    const tags = this.newTagsRaw.split(',').map(t => t.trim()).filter(t => t.length > 0);
    this.jymService.createSplit({
      name: this.newName.trim(),
      description: this.newDesc.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined,
    }).subscribe({
      next: s => {
        this.splits.update(list => [s, ...list]);
        this.showCreate.set(false);
        this.newName = '';
        this.newDesc = '';
        this.newTagsRaw = '';
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  startFromSplitCard(split: Split) {
    this.selectedSplitId = split.id;
    this.loadingRoutines.set(true);
    this.showRoutinePicker.set(true);
    this.jymService.getSplit(split.id).subscribe({
      next: s => {
        this.pickerRoutines.set(s.routines.map(r => ({ id: r.id, name: r.name, day_order: r.day_order })));
        this.loadingRoutines.set(false);
      },
      error: () => { this.loadingRoutines.set(false); this.showRoutinePicker.set(false); },
    });
  }

  startWithRoutine(routineId: string) {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({ routine_id: routineId }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } }),
    });
  }

  startFreeWithSplit() {
    this.showRoutinePicker.set(false);
    this.jymService.startSession({}).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id]),
    });
  }

  confirmDelete(split: Split) {
    this.deletingSplit.set(split);
  }

  deleteSplit() {
    const split = this.deletingSplit();
    if (!split) return;
    this.deleting.set(true);
    this.jymService.deleteSplit(split.id).subscribe({
      next: () => {
        this.splits.update(list => list.filter(s => s.id !== split.id));
        this.deletingSplit.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }

  openNewSeries(splitId: string) {
    this.seriesSplitId = splitId;
    this.seriesName = '';
    this.seriesDurationType = 'open';
    this.seriesTargetWeeks = null;
    this.seriesTargetSessions = null;
    this.showNewSeries.set(true);
  }

  createSeries() {
    if (!this.seriesName.trim()) return;
    this.savingSeries.set(true);
    const req: CreateSeriesRequest = {
      split_id: this.seriesSplitId,
      name: this.seriesName.trim(),
      duration_type: this.seriesDurationType,
      target_weeks: this.seriesDurationType === 'weeks' ? (this.seriesTargetWeeks ?? undefined) : undefined,
      target_sessions: this.seriesDurationType === 'sessions' ? (this.seriesTargetSessions ?? undefined) : undefined,
    };
    this.jymService.createSeries(req).subscribe({
      next: sr => {
        this.savingSeries.set(false);
        this.showNewSeries.set(false);
        this.router.navigate(['/jym/series', sr.id]);
      },
      error: () => this.savingSeries.set(false),
    });
  }
}
