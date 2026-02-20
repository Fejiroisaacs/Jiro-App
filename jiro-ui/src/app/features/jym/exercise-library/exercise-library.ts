import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';
import { FormsModule } from '@angular/forms';
import { JymService, Exercise } from '../../../core/services/jym.service';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio'];

@Component({
  selector: 'app-exercise-library',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroModalComponent, JymQuickNavComponent],
  template: `
    <div class="exercise-library">
      <!-- Header -->
      <div class="page-header">
        <div>
          <h1>Exercise Library</h1>
          <p class="text-secondary">Your personal movement catalogue</p>
        </div>
        <div class="header-actions">
          <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">+ New Exercise</jiro-button>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <!-- Filters -->
      <div class="filters">
        <input
          class="search-input"
          type="text"
          placeholder="Search exercises..."
          [(ngModel)]="searchQuery"
          (input)="onSearch()" />
        <div class="muscle-chips">
          <button
            class="mg-chip"
            [class.active]="activeMG() === ''"
            (click)="setMG('')">
            All
          </button>
          <button
            *ngFor="let mg of muscleGroups"
            class="mg-chip"
            [class.active]="activeMG() === mg"
            (click)="setMG(mg)">
            {{ mg }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading exercises...</p>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading() && exercises().length === 0" class="state-message">
        <h3>No exercises yet</h3>
        <p class="text-secondary">Build your exercise library to track performance over time.</p>
        <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">Add First Exercise</jiro-button>
      </div>

      <!-- Exercise grid -->
      <div *ngIf="!loading() && exercises().length > 0" class="ex-grid">
        <jiro-card
          *ngFor="let ex of exercises()"
          [clickable]="true"
          class="ex-card"
          (click)="goToDetail(ex.id)">
          <div class="ex-card-inner">
            <div class="ex-header">
              <h3 class="ex-name">{{ ex.name }}</h3>
              <span *ngIf="ex.muscle_group" class="mg-badge">{{ ex.muscle_group }}</span>
            </div>
            <p *ngIf="ex.notes" class="ex-notes text-secondary">{{ ex.notes }}</p>
            <div class="card-actions" (click)="$event.stopPropagation()">
              <button class="icon-btn edit-btn" title="Edit exercise" (click)="openEdit(ex)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
                Edit
              </button>
              <button class="icon-btn delete-btn" title="Delete exercise" (click)="openDelete(ex)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3,6 5,6 21,6"/>
                  <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                  <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
                </svg>
                Delete
              </button>
            </div>
          </div>
        </jiro-card>
      </div>

      <!-- Create Modal -->
      <jiro-modal *ngIf="showCreate()" title="New Exercise" maxWidth="480px" (close)="showCreate.set(false)">
        <form class="create-form" (ngSubmit)="createExercise()">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input class="form-input" type="text" [(ngModel)]="newName" name="name" placeholder="e.g. Barbell Back Squat" required />
          </div>
          <div class="form-group">
            <label class="form-label">Muscle Group</label>
            <select class="form-input" [(ngModel)]="newMG" name="mg">
              <option value="">None</option>
              <option *ngFor="let mg of muscleGroups" [value]="mg">{{ mg }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-input form-textarea" [(ngModel)]="newNotes" name="notes" rows="2" placeholder="Cues, equipment notes..."></textarea>
          </div>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="showCreate.set(false)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="saving() || !newName.trim()">
              {{ saving() ? 'Creating...' : 'Create Exercise' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- Edit Modal -->
      <jiro-modal *ngIf="editingExercise()" [title]="'Edit Exercise'" maxWidth="480px" (close)="editingExercise.set(null)">
        <form class="create-form" (ngSubmit)="saveEdit()">
          <div class="form-group">
            <label class="form-label">Name *</label>
            <input class="form-input" type="text" [(ngModel)]="editName" name="ename" placeholder="Exercise name" required />
          </div>
          <div class="form-group">
            <label class="form-label">Muscle Group</label>
            <select class="form-input" [(ngModel)]="editMg" name="emg">
              <option value="">None</option>
              <option *ngFor="let mg of muscleGroups" [value]="mg">{{ mg }}</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <textarea class="form-input form-textarea" [(ngModel)]="editNotes" name="enotes" rows="2" placeholder="Cues, equipment notes..."></textarea>
          </div>
          <p class="rename-note">
            Renaming updates the exercise name everywhere — all past sessions will reflect the new name automatically.
          </p>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="editingExercise.set(null)">Cancel</jiro-button>
            <jiro-button variant="primary" type="submit" [disabled]="editSaving() || !editName.trim()">
              {{ editSaving() ? 'Saving...' : 'Save Changes' }}
            </jiro-button>
          </div>
        </form>
      </jiro-modal>

      <!-- Delete Confirm Modal -->
      <jiro-modal *ngIf="deletingExercise()" title="Delete Exercise" maxWidth="440px" (close)="deletingExercise.set(null)">
        <div class="delete-confirm">
          <div class="delete-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-danger)" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <p class="delete-msg">
            Delete <strong>{{ deletingExercise()!.name }}</strong>? This will permanently delete the exercise
            and all sets ever logged with it. This cannot be undone.
          </p>
          <div class="form-actions">
            <jiro-button variant="secondary" type="button" (click)="deletingExercise.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="deleteSaving()" (click)="confirmDelete()">
              {{ deleteSaving() ? 'Deleting...' : 'Delete Exercise' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .exercise-library { max-width: 1000px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .header-actions {
      display: flex; flex-direction: column; align-items: flex-end;
      gap: var(--space-sm); flex-shrink: 0;
    }

    .header-actions ::ng-deep .jiro-btn { width: auto; }

    .filters { display: flex; flex-direction: column; gap: var(--space-md); margin-bottom: var(--space-xl); }

    .search-input {
      width: 100%; max-width: 400px; padding: 10px 14px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-md); outline: none; transition: border-color 0.2s;
    }

    .search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.15); }

    .search-input::placeholder { color: var(--text-muted); }

    .muscle-chips { display: flex; flex-wrap: wrap; gap: var(--space-xs); }

    .mg-chip {
      padding: 4px 12px; border: 1px solid var(--border-color);
      border-radius: 12px; background: none; cursor: pointer;
      font-size: var(--font-size-xs); color: var(--text-secondary);
      transition: all 0.15s;
    }

    .mg-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .mg-chip.active {
      background: var(--color-primary); border-color: var(--color-primary);
      color: white;
    }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      justify-content: center; padding: var(--space-2xl); gap: var(--space-md); text-align: center;
    }

    .state-message ::ng-deep .jiro-btn { width: auto; }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .ex-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: var(--space-md);
    }

    .ex-card { cursor: pointer; }

    .ex-card-inner { display: flex; flex-direction: column; gap: var(--space-xs); }

    .ex-header { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .ex-name { font-size: var(--font-size-md); font-weight: 600; }

    .mg-badge {
      background: rgba(122,59,46,0.12); color: var(--color-primary);
      font-size: var(--font-size-xs); font-weight: 500;
      padding: 2px 8px; border-radius: 10px; white-space: nowrap;
    }

    .ex-notes {
      font-size: var(--font-size-sm); line-height: 1.4;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }

    .card-actions {
      display: flex; gap: var(--space-xs); margin-top: var(--space-sm);
      padding-top: var(--space-sm); border-top: 1px solid var(--border-color);
    }

    .icon-btn {
      display: inline-flex; align-items: center; gap: 5px;
      background: none; border: none; cursor: pointer; padding: 4px 8px;
      border-radius: 4px; font-size: var(--font-size-xs); font-weight: 500;
      transition: all 0.15s; color: var(--text-muted);
    }

    .edit-btn:hover { color: var(--text-primary); background: var(--bg-canvas); }

    .delete-btn:hover { color: var(--color-danger); background: rgba(196,74,74,0.08); }

    .rename-note {
      font-size: var(--font-size-xs); color: var(--text-muted);
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-sm) var(--space-md);
      line-height: 1.5;
    }

    .delete-confirm { display: flex; flex-direction: column; align-items: center; gap: var(--space-md); text-align: center; }

    .delete-icon { }

    .delete-msg { font-size: var(--font-size-md); line-height: 1.6; color: var(--text-secondary); }

    .delete-msg strong { color: var(--text-primary); }

    .create-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }

    .form-input {
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-md);
      outline: none; transition: border-color 0.2s; font-family: inherit; width: 100%; box-sizing: border-box;
    }

    .form-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.15); }

    .form-textarea { resize: vertical; min-height: 60px; }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }

    .form-actions ::ng-deep .jiro-btn { width: auto; }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ExerciseLibraryComponent implements OnInit {
  exercises = signal<Exercise[]>([]);
  loading = signal(true);
  saving = signal(false);
  showCreate = signal(false);
  activeMG = signal('');

  editingExercise = signal<Exercise | null>(null);
  editSaving = signal(false);
  editName = '';
  editMg = '';
  editNotes = '';

  deletingExercise = signal<Exercise | null>(null);
  deleteSaving = signal(false);

  muscleGroups = MUSCLE_GROUPS;
  searchQuery = '';
  newName = '';
  newMG = '';
  newNotes = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private jymService: JymService, public router: Router) {}

  ngOnInit() { this.load(); }

  load(q?: string, mg?: string) {
    this.loading.set(true);
    this.jymService.listExercises(q, mg).subscribe({
      next: exs => { this.exercises.set(exs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(this.searchQuery || undefined, this.activeMG() || undefined), 300);
  }

  setMG(mg: string) {
    this.activeMG.set(mg);
    this.load(this.searchQuery || undefined, mg || undefined);
  }

  goToDetail(id: string) { this.router.navigate(['/jym/exercises', id]); }

  createExercise() {
    if (!this.newName.trim()) return;
    this.saving.set(true);
    this.jymService.createExercise({
      name: this.newName.trim(),
      muscle_group: this.newMG || undefined,
      notes: this.newNotes.trim() || undefined,
    }).subscribe({
      next: ex => {
        this.exercises.update(list => [ex, ...list]);
        this.showCreate.set(false);
        this.newName = ''; this.newMG = ''; this.newNotes = '';
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  openEdit(ex: Exercise) {
    this.editName = ex.name;
    this.editMg = ex.muscle_group ?? '';
    this.editNotes = ex.notes ?? '';
    this.editingExercise.set(ex);
  }

  saveEdit() {
    const ex = this.editingExercise();
    if (!ex || !this.editName.trim()) return;
    this.editSaving.set(true);
    this.jymService.updateExercise(ex.id, {
      name: this.editName.trim(),
      muscle_group: this.editMg || undefined,
      notes: this.editNotes.trim() || undefined,
    }).subscribe({
      next: updated => {
        this.exercises.update(list => list.map(e => e.id === updated.id ? updated : e));
        this.editingExercise.set(null);
        this.editSaving.set(false);
      },
      error: () => this.editSaving.set(false),
    });
  }

  openDelete(ex: Exercise) {
    this.deletingExercise.set(ex);
  }

  confirmDelete() {
    const ex = this.deletingExercise();
    if (!ex) return;
    this.deleteSaving.set(true);
    this.jymService.deleteExercise(ex.id).subscribe({
      next: () => {
        this.exercises.update(list => list.filter(e => e.id !== ex.id));
        this.deletingExercise.set(null);
        this.deleteSaving.set(false);
      },
      error: () => this.deleteSaving.set(false),
    });
  }
}
