import { Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { JymService, Exercise, ExercisePR } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { JiroMenuComponent, JiroMenuItem } from '../../../shared/components/jiro-menu/jiro-menu';

const MUSCLE_GROUPS = ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Legs', 'Glutes', 'Core', 'Cardio'];

const ROW_ACTIONS: JiroMenuItem[] = [
  { id: 'edit', label: 'Edit', icon: 'pencil-simple' },
  { id: 'delete', label: 'Delete', icon: 'trash', danger: true },
];

/**
 * The exercise library as a list: one row per exercise with its best set
 * (from the PR wall data, one request) and when that PR was set. Edit and
 * delete live in a per-row menu; the row itself opens the exercise.
 */
@Component({
  selector: 'app-exercise-library',
  standalone: true,
  imports: [
    FormsModule, RouterLink,
    JiroButtonComponent, JiroModalComponent, JiroPageHeaderComponent,
    JiroEmptyStateComponent, JiroSkeletonComponent, JiroMenuComponent,
  ],
  template: `
    <div class="exercise-library">
      @if (!embedded()) {
        <jiro-page-header heading="Exercises" subtitle="Your exercise library">
          <jiro-button actions type="button" (click)="showCreate.set(true)">New exercise</jiro-button>
        </jiro-page-header>
      }

      <div class="toolbar">
        <input
          class="search-input"
          type="search"
          placeholder="Search exercises..."
          aria-label="Search exercises"
          [(ngModel)]="searchQuery"
          (input)="onSearch()" />
        @if (embedded()) {
          <jiro-button type="button" (click)="showCreate.set(true)">New exercise</jiro-button>
        }
      </div>
      <div class="muscle-chips" role="group" aria-label="Filter by muscle group">
        <button type="button" class="mg-chip" [class.active]="activeMG() === ''" [attr.aria-pressed]="activeMG() === ''" (click)="setMG('')">All</button>
        @for (mg of muscleGroups; track mg) {
          <button type="button" class="mg-chip" [class.active]="activeMG() === mg" [attr.aria-pressed]="activeMG() === mg" (click)="setMG(mg)">{{ mg }}</button>
        }
      </div>

      @if (loading()) {
        <div class="ex-loading" aria-busy="true" aria-label="Loading exercises">
          <jiro-skeleton [lines]="5" height="56px" />
        </div>
      } @else if (exercises().length === 0) {
        @if (hasFilters()) {
          <jiro-empty-state icon="magnifying-glass" heading="No exercises match" message="Try another name, or clear the filters.">
            <jiro-button variant="secondary" size="sm" type="button" (click)="clearFilters()">Clear filters</jiro-button>
          </jiro-empty-state>
        } @else {
          <jiro-empty-state icon="barbell" heading="No exercises yet" message="Build your library to track performance over time.">
            <jiro-button type="button" (click)="showCreate.set(true)">Add your first exercise</jiro-button>
          </jiro-empty-state>
        }
      } @else {
        <ul class="ex-list">
          @for (ex of exercises(); track ex.id) {
            <li class="ex-row">
              <a class="ex-link" [routerLink]="['/jym/exercises', ex.id]">
                <span class="ex-main">
                  <span class="ex-name">{{ ex.name }}</span>
                  @if (ex.muscle_group) {
                    <span class="mg-badge">{{ ex.muscle_group }}</span>
                  }
                </span>
                @if (prFor(ex.id); as pr) {
                  <span class="ex-best">
                    <span class="best-set">{{ weight(pr.weight) }} {{ unit() }} &times; {{ pr.reps }}</span>
                    <span class="best-meta">est. 1RM {{ weight(pr.est_1rm) }} {{ unit() }} &middot; last trained {{ ago(ex.last_performed_at ?? pr.date) }}</span>
                  </span>
                } @else {
                  <span class="ex-best ex-best--none">No sets logged yet</span>
                }
              </a>
              <jiro-menu [items]="rowActions" [label]="'More actions for ' + ex.name" (select)="onRowAction(ex, $event)" />
            </li>
          }
        </ul>
      }

      <!-- Create -->
      @if (showCreate()) {
        <jiro-modal title="New exercise" maxWidth="480px" (close)="showCreate.set(false)">
          <form class="ex-form" (ngSubmit)="createExercise()">
            <div class="form-group">
              <label class="form-label" for="ex-new-name">Name</label>
              <input id="ex-new-name" class="form-input" type="text" [(ngModel)]="newName" name="name" placeholder="e.g. Barbell Back Squat" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-new-mg">Muscle group</label>
              <select id="ex-new-mg" class="form-input" [(ngModel)]="newMG" name="mg">
                <option value="">None</option>
                @for (mg of muscleGroups; track mg) {
                  <option [value]="mg">{{ mg }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-new-notes">Notes</label>
              <textarea id="ex-new-notes" class="form-input form-textarea" [(ngModel)]="newNotes" name="notes" rows="2" placeholder="Cues, equipment notes..."></textarea>
            </div>
            <div class="form-actions">
              <jiro-button variant="secondary" type="button" (click)="showCreate.set(false)">Cancel</jiro-button>
              <jiro-button type="submit" [disabled]="!newName.trim()" [loading]="saving()">Create exercise</jiro-button>
            </div>
          </form>
        </jiro-modal>
      }

      <!-- Edit -->
      @if (editingExercise()) {
        <jiro-modal title="Edit exercise" maxWidth="480px" (close)="editingExercise.set(null)">
          <form class="ex-form" (ngSubmit)="saveEdit()">
            <div class="form-group">
              <label class="form-label" for="ex-edit-name">Name</label>
              <input id="ex-edit-name" class="form-input" type="text" [(ngModel)]="editName" name="ename" placeholder="Exercise name" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-edit-mg">Muscle group</label>
              <select id="ex-edit-mg" class="form-input" [(ngModel)]="editMg" name="emg">
                <option value="">None</option>
                @for (mg of muscleGroups; track mg) {
                  <option [value]="mg">{{ mg }}</option>
                }
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="ex-edit-notes">Notes</label>
              <textarea id="ex-edit-notes" class="form-input form-textarea" [(ngModel)]="editNotes" name="enotes" rows="2" placeholder="Cues, equipment notes..."></textarea>
            </div>
            <p class="rename-note">
              Renaming updates the exercise everywhere; past sessions show the new name.
            </p>
            <div class="form-actions">
              <jiro-button variant="secondary" type="button" (click)="editingExercise.set(null)">Cancel</jiro-button>
              <jiro-button type="submit" [disabled]="!editName.trim()" [loading]="editSaving()">Save changes</jiro-button>
            </div>
          </form>
        </jiro-modal>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }

    .exercise-library { max-width: 1000px; width: 100%; }

    .toolbar {
      display: flex; align-items: center; gap: var(--space-sm);
      margin-bottom: var(--space-sm);
    }

    .search-input {
      flex: 1; max-width: 400px; min-height: 40px; padding: 8px 14px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-md); font-family: inherit; transition: border-color 0.2s;
    }
    .search-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15); }
    .search-input::placeholder { color: var(--text-muted); }

    .muscle-chips { display: flex; flex-wrap: wrap; gap: var(--space-xs); margin-bottom: var(--space-lg); }

    .mg-chip {
      min-height: 32px; padding: 4px 14px;
      border: 1px dashed var(--border-color);
      border-radius: 2px;
      background: var(--bg-surface);
      cursor: pointer;
      font-size: var(--font-size-sm); font-family: inherit;
      color: var(--text-secondary);
      font-weight: 500;
      box-shadow: 2px 2px 0 var(--border-color);
      transition: all 0.2s cubic-bezier(0.2, 0, 0, 1);
      position: relative; top: 0; left: 0;
    }
    .mg-chip:hover {
      top: -1px; left: -1px;
      box-shadow: 3px 3px 0 var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .mg-chip.active {
      background: var(--color-primary);
      border: 1px solid var(--color-primary);
      color: var(--text-on-primary);
      box-shadow: 2px 2px 0 rgba(var(--color-primary-rgb), 0.4);
    }

    .ex-loading { display: block; }

    /* List */
    .ex-list {
      list-style: none; margin: 0; padding: 0;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
    }

    .ex-row {
      display: flex; align-items: center; gap: var(--space-xs);
      padding-right: var(--space-xs);
      border-bottom: 1px solid var(--border-color);
      transition: background 0.15s;
    }
    .ex-row:last-child { border-bottom: none; }
    .ex-row:hover { background: var(--bg-surface-hover); }

    .ex-link {
      flex: 1; min-width: 0;
      display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
      align-items: center; gap: var(--space-md);
      min-height: 56px; padding: var(--space-sm) var(--space-md);
      color: inherit; text-decoration: none;
    }
    .ex-link:hover { text-decoration: none; }
    .ex-link:focus-visible { outline-offset: -3px; }

    .ex-main { display: flex; align-items: center; flex-wrap: wrap; gap: var(--space-sm); min-width: 0; }

    .ex-name {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md); font-weight: 600;
      color: var(--text-primary);
    }

    .mg-badge {
      background: var(--bg-canvas);
      color: var(--text-primary);
      font-size: var(--font-size-xs);
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 2px;
      border: 1px solid var(--border-color);
      box-shadow: 1px 1px 0 var(--border-color);
      white-space: nowrap;
    }

    .ex-best { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .best-set {
      font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary);
      font-variant-numeric: tabular-nums; white-space: nowrap;
    }
    .best-meta {
      font-size: var(--font-size-xs); color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ex-best--none { font-size: var(--font-size-sm); color: var(--text-muted); }

    @media (max-width: 600px) {
      .toolbar { flex-wrap: wrap; }
      .search-input { max-width: none; }
      .ex-link { grid-template-columns: 1fr; gap: 4px; }
    }

    /* Forms */
    .ex-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label {
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      font-family: var(--font-family-display);
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
    .form-input:focus { border-bottom-color: var(--color-primary); }

    .form-textarea { resize: vertical; min-height: 60px; }

    .rename-note {
      font-size: var(--font-size-xs); color: var(--text-muted);
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-sm) var(--space-md);
      line-height: 1.5;
    }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }
  `]
})
export class ExerciseLibraryComponent implements OnInit {
  embedded = input(false);

  private readonly jym = inject(JymService);
  private readonly settings = inject(SettingsService);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  readonly muscleGroups = MUSCLE_GROUPS;
  readonly rowActions = ROW_ACTIONS;

  exercises = signal<Exercise[]>([]);
  prs = signal<ExercisePR[]>([]);
  loading = signal(true);
  activeMG = signal('');
  searchQuery = '';

  showCreate = signal(false);
  saving = signal(false);
  newName = '';
  newMG = '';
  newNotes = '';

  editingExercise = signal<Exercise | null>(null);
  editSaving = signal(false);
  editName = '';
  editMg = '';
  editNotes = '';

  private readonly prByExercise = computed(() => new Map(this.prs().map(p => [p.exercise_id, p])));
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit() {
    // One request for the list, one for every exercise's best set; a PR
    // failure still lists the exercises.
    forkJoin({
      exercises: this.jym.listExercises(),
      prs: this.jym.getPRs().pipe(catchError(() => of([] as ExercisePR[]))),
    }).subscribe({
      next: ({ exercises, prs }) => {
        this.exercises.set(exercises);
        this.prs.set(prs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not load your exercises.');
      },
    });
  }

  prFor(id: string): ExercisePR | null {
    return this.prByExercise().get(id) ?? null;
  }

  unit(): string {
    return this.settings.unitLabel();
  }

  weight(kg: number): string {
    const v = this.settings.toDisplay(kg);
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  /** Relative day for a PR date, counted in UTC days like the rest of Jym. */
  ago(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const days = Math.round((today - day) / 86400000);
    if (days <= 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 14) return `${days} days ago`;
    if (days < 56) return `${Math.round(days / 7)} weeks ago`;
    return d.toLocaleDateString(undefined, {
      month: 'short', day: 'numeric',
      year: d.getUTCFullYear() === now.getUTCFullYear() ? undefined : 'numeric',
      timeZone: 'UTC',
    });
  }

  hasFilters(): boolean {
    return !!this.searchQuery.trim() || !!this.activeMG();
  }

  load(q?: string, mg?: string) {
    this.loading.set(true);
    this.jym.listExercises(q, mg).subscribe({
      next: exs => { this.exercises.set(exs); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toast.error('Could not load your exercises.'); },
    });
  }

  onSearch() {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(this.searchQuery.trim() || undefined, this.activeMG() || undefined), 300);
  }

  setMG(mg: string) {
    this.activeMG.set(mg);
    this.load(this.searchQuery.trim() || undefined, mg || undefined);
  }

  clearFilters() {
    this.searchQuery = '';
    this.activeMG.set('');
    this.load();
  }

  onRowAction(ex: Exercise, action: string) {
    if (action === 'edit') this.openEdit(ex);
    else if (action === 'delete') this.deleteExercise(ex);
  }

  createExercise() {
    if (!this.newName.trim()) return;
    this.saving.set(true);
    this.jym.createExercise({
      name: this.newName.trim(),
      muscle_group: this.newMG || undefined,
      notes: this.newNotes.trim() || undefined,
    }).subscribe({
      next: ex => {
        this.exercises.update(list => [ex, ...list]);
        this.showCreate.set(false);
        this.newName = ''; this.newMG = ''; this.newNotes = '';
        this.saving.set(false);
        this.toast.success(`${ex.name} added`);
      },
      error: () => { this.saving.set(false); this.toast.error('Could not create the exercise.'); },
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
    this.jym.updateExercise(ex.id, {
      name: this.editName.trim(),
      muscle_group: this.editMg || undefined,
      notes: this.editNotes.trim() || undefined,
    }).subscribe({
      next: updated => {
        this.exercises.update(list => list.map(e => e.id === updated.id ? updated : e));
        this.editingExercise.set(null);
        this.editSaving.set(false);
        this.toast.success('Exercise saved');
      },
      error: () => { this.editSaving.set(false); this.toast.error('Could not save the exercise.'); },
    });
  }

  async deleteExercise(ex: Exercise) {
    const ok = await this.confirm.confirm({
      title: `Delete ${ex.name}?`,
      message: 'This removes the exercise and every set ever logged with it. It cannot be undone.',
      confirmLabel: 'Delete exercise',
      danger: true,
    });
    if (!ok) return;
    this.jym.deleteExercise(ex.id).subscribe({
      next: () => {
        this.exercises.update(list => list.filter(e => e.id !== ex.id));
        this.prs.update(list => list.filter(p => p.exercise_id !== ex.id));
        this.toast.success(`${ex.name} deleted`);
      },
      error: () => this.toast.error('Could not delete the exercise.'),
    });
  }
}
