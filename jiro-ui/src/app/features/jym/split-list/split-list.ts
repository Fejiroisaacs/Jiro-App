import { Component, OnInit, inject, signal, input } from '@angular/core';

import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { JymService, Split, CreateSeriesRequest } from '../../../core/services/jym.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

@Component({
  selector: 'app-split-list',
  standalone: true,
  imports: [
    FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent,
    JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent,
  ],
  template: `
    <div class="split-list">
      <!-- Header -->
      @if (!embedded()) {
        <jiro-page-header heading="Splits" subtitle="Manage your training splits">
          <button actions class="discover-btn" type="button" (click)="router.navigate(['/jym/discover'])">
            <jiro-icon name="magnifying-glass" [size]="14" />
            Discover
          </button>
          <jiro-button actions type="button" (click)="showCreate.set(true)">New split</jiro-button>
        </jiro-page-header>
      } @else {
        <div class="header-actions">
          <button class="discover-btn" type="button" (click)="router.navigate(['/jym/discover'])">
            <jiro-icon name="magnifying-glass" [size]="14" />
            Discover
          </button>
          <jiro-button type="button" (click)="showCreate.set(true)">New split</jiro-button>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      <!-- Empty state -->
      @if (!loading() && splits().length === 0) {
        <jiro-empty-state
          icon="squares-four"
          heading="No training splits yet"
          message="Create your first split to organise your training week.">
          <jiro-button type="button" (click)="showCreate.set(true)">Create your first split</jiro-button>
        </jiro-empty-state>
      }

      <!-- Splits grid -->
      @if (!loading() && splits().length > 0) {
<div class="splits-grid">
        @for (split of splits(); track split) {
<jiro-card class="split-card">
          <div class="split-header">
            <div class="split-info">
              <h2 class="split-name">{{ split.name }}</h2>
              @if (split.description) {
<p class="split-desc text-secondary">{{ split.description }}</p>
}
              @if (split.tags.length) {
<div class="split-tags">
                @for (tag of split.tags; track tag) {
<span class="tag-chip">{{ tag }}</span>
}
              </div>
}
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
            <button class="delete-split-btn" type="button" (click)="deleteSplit(split)" title="Delete split"
              [attr.aria-label]="'Delete split ' + split.name">
              <jiro-icon name="trash" [size]="16" />
            </button>
          </div>
        </jiro-card>
}
      </div>
}

      <!-- Create Split Modal -->
      @if (showCreate()) {
<jiro-modal title="New Training Split" maxWidth="480px" (close)="showCreate.set(false)">
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
}

      <!-- New Series Modal -->
      @if (showNewSeries()) {
<jiro-modal title="Start New Series" maxWidth="480px" (close)="showNewSeries.set(false)">
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
          @if (seriesDurationType === 'weeks') {
<div class="form-group">
            <label class="form-label">Target Weeks</label>
            <input class="form-input" type="number" min="1" [(ngModel)]="seriesTargetWeeks" name="tweeks" placeholder="e.g. 8" />
          </div>
}
          @if (seriesDurationType === 'sessions') {
<div class="form-group">
            <label class="form-label">Target Sessions</label>
            <input class="form-input" type="number" min="1" [(ngModel)]="seriesTargetSessions" name="tsessions" placeholder="e.g. 24" />
          </div>
}
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="showNewSeries.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="savingSeries() || !seriesName.trim()">
              {{ savingSeries() ? 'Starting...' : 'Start Series' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>
}

      <!-- Start Session: choose routine modal -->
      @if (showRoutinePicker()) {
<jiro-modal title="Choose Routine" maxWidth="420px" (close)="showRoutinePicker.set(false)">
        @if (loadingRoutines()) {
          <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
        }
        @if (!loadingRoutines()) {
<div class="routine-list">
          @for (r of pickerRoutines(); track r) {
<button
           
            class="routine-pick-btn"
            (click)="startWithRoutine(r.id)">
            <span class="routine-pick-name">{{ r.name }}</span>
            <span class="routine-pick-day">Day {{ r.day_order }}</span>
          </button>
}
          <button class="routine-pick-btn freestyle" (click)="startFreeWithSplit()">
            Freestyle (no routine)
          </button>
        </div>
}
      </jiro-modal>
}
    </div>
  `,
  styles: [`
    :host { display: block; }

    .split-list { max-width: 1000px; width: 100%; }

    .header-actions { display: flex; gap: var(--space-sm); align-items: center; margin-bottom: var(--space-lg); }


    .discover-btn {
      display: flex; align-items: center; gap: 6px;
      min-height: 40px; padding: 8px 14px; font-family: inherit;
      background: none; border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary); font-size: var(--font-size-sm);
      cursor: pointer; transition: all 0.15s; white-space: nowrap;
    }

    .discover-btn:hover { border-color: var(--color-primary); color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

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

    /* ── State messages ── */
    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

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
      box-shadow: 1px 1px 0 rgba(var(--shadow-rgb), 0.1);
      white-space: nowrap;
    }

    .split-actions { display: flex; gap: var(--space-sm); margin-top: var(--space-lg); align-items: center; }

    .btn-slot { flex: 1; display: flex; flex-direction: column; }
    .btn-slot { --jiro-btn-width: 100%; }
    .btn-slot jiro-button { display: flex; flex: 1; }

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
      border-color: rgba(var(--color-danger-rgb), 0.3);
      background: rgba(var(--color-danger-rgb), 0.04);
      box-shadow: 1px 1px 0 rgba(var(--color-danger-rgb), 0.3);
      top: -1px; 
      left: -1px;
    }


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



    .routine-list { display: flex; flex-direction: column; gap: var(--space-xs); }

    .routine-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      cursor: pointer; font-size: var(--font-size-md); color: var(--text-primary);
      transition: all 0.15s; text-align: left; width: 100%;
    }

    .routine-pick-btn:hover { border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.05); }

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
      border-color: var(--color-primary); background: rgba(var(--color-primary-rgb), 0.08);
      color: var(--color-primary); font-weight: 600;
    }


    @media (max-width: 600px) {
      .split-actions { gap: 0.3rem; }


      .split-actions svg { width: 10px; height: 10px; }

      .delete-split-btn { width: 2rem; height: 2rem; }
    }
  `]
})
export class SplitListComponent implements OnInit {
  embedded = input(false);
  splits = signal<Split[]>([]);
  loading = signal(true);
  saving = signal(false);
  showCreate = signal(false);
  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);
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

  async deleteSplit(split: Split) {
    const ok = await this.confirmService.confirm({
      title: `Delete ${split.name}?`,
      message: 'This deletes the split and all its routines. Sessions you already logged from them are not affected.',
      confirmLabel: 'Delete split',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteSplit(split.id).subscribe({
      next: () => {
        this.splits.update(list => list.filter(s => s.id !== split.id));
        this.toast.success(`${split.name} deleted`);
      },
      error: () => this.toast.error('Could not delete the split.'),
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
