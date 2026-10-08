import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JymService } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';

export interface PickerExercise {
  id: string;
  name: string;
  muscle_group: string | null;
  kind?: ExerciseKind;
}

import { MUSCLE_GROUPS } from '../shared/muscles';
import { EXERCISE_KINDS, ExerciseKind } from '../exercise-kind';

/** Add exercise: search your library, or create one (named from the search) and add it. */
@Component({
  selector: 'jym-exercise-picker',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroModalComponent, JiroIconComponent],
  template: `
    <jiro-modal [title]="creating() ? 'New exercise' : 'Add exercise'" maxWidth="480px" (close)="close.emit()">
      @if (!creating()) {
        <input class="picker-search" type="text" [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Search exercises..." aria-label="Search exercises" autofocus />
        <div class="picker-list">
          @for (ex of filtered(); track ex.id) {
            <button type="button" class="picker-item" (click)="picked.emit(ex)">
              <span class="pi-name">{{ ex.name }}</span>
              @if (ex.muscle_group) {
                <span class="pi-mg">{{ ex.muscle_group }}</span>
              }
            </button>
          }
          @if (filtered().length === 0 && search().trim()) {
            <p class="picker-none">Nothing matches "{{ search().trim() }}".</p>
          }
          <!-- Create shortcut: always at the bottom, name pre-filled from the search -->
          <button type="button" class="picker-create-btn" (click)="startCreate()">
            <jiro-icon name="plus" [size]="14" />
            @if (search().trim()) {
              <span>Create "{{ search().trim() }}"</span>
            } @else {
              <span>New exercise</span>
            }
          </button>
        </div>
      } @else {
        <button type="button" class="back-btn" (click)="creating.set(false)">
          <jiro-icon name="caret-left" [size]="14" /> Back to search
        </button>
        <div class="create-form">
          <label class="create-label" for="new-ex-name">Name</label>
          <input
            id="new-ex-name"
            class="picker-search"
            type="text"
            [(ngModel)]="newName"
            placeholder="e.g. Romanian Deadlift"
            (keydown.enter)="!saving() && newName.trim() && create()"
          />
          <label class="create-label" for="new-ex-kind" style="margin-top:var(--space-sm)">Type</label>
          <select id="new-ex-kind" class="create-select" [(ngModel)]="newKind">
            @for (k of exerciseKinds; track k.value) { <option [value]="k.value">{{ k.label }}</option> }
          </select>
          <label class="create-label" for="new-ex-mg" style="margin-top:var(--space-sm)">Muscle group <span class="optional">(optional)</span></label>
          <select id="new-ex-mg" class="create-select" [ngModel]="newMuscleGroup" (ngModelChange)="setMuscle($event)">
            <option value="">None</option>
            @for (mg of muscleGroups; track mg) {
              <option [value]="mg">{{ mg }}</option>
            }
          </select>
          @if (error()) {
            <div class="create-error">{{ error() }}</div>
          }
          <jiro-button
            block
            type="button"
            style="margin-top:var(--space-md)"
            [disabled]="!newName.trim()"
            [loading]="saving()"
            (click)="create()">
            {{ saving() ? 'Creating...' : 'Create and add to session' }}
          </jiro-button>
        </div>
      }
    </jiro-modal>
  `,
  styles: [`
    .picker-search {
      width: 100%; box-sizing: border-box;
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-canvas);
      color: var(--text-primary); font-size: var(--font-size-md);
      font-family: inherit;
    }
    .picker-search:focus { border-color: var(--color-primary); }

    .picker-list { max-height: 50dvh; overflow-y: auto; margin-top: var(--space-sm); }

    .picker-item {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm);
      width: 100%; min-height: 44px; padding: var(--space-sm) var(--space-md);
      background: none; border: none; border-radius: var(--border-radius);
      cursor: pointer; text-align: left; font-family: inherit; transition: background 0.15s;
    }
    .picker-item:hover { background: var(--bg-surface-hover); }

    .pi-name { font-size: var(--font-size-md); color: var(--text-primary); font-weight: 500; }
    .pi-mg { font-size: var(--font-size-xs); color: var(--text-muted); white-space: nowrap; }

    .picker-none { padding: var(--space-md); font-size: var(--font-size-sm); color: var(--text-muted); text-align: center; }

    .picker-create-btn {
      display: flex; align-items: center; gap: var(--space-xs);
      width: 100%; min-height: 44px; padding: var(--space-sm) var(--space-md);
      background: none; border: none; border-top: 1px solid var(--border-color);
      color: var(--color-primary); font-size: var(--font-size-sm);
      font-weight: 500; cursor: pointer; text-align: left;
      font-family: inherit; margin-top: var(--space-xs);
      transition: background 0.15s;
    }
    .picker-create-btn:hover { background: rgba(var(--color-primary-rgb), 0.06); }

    .back-btn {
      display: inline-flex; align-items: center; gap: 4px;
      background: none; border: none; min-height: 44px; padding: 0; margin-bottom: var(--space-xs);
      color: var(--text-secondary); font-size: var(--font-size-sm); font-family: inherit; cursor: pointer;
    }
    .back-btn:hover { color: var(--text-primary); }

    .create-form { display: flex; flex-direction: column; }
    .create-label {
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--text-secondary); margin-bottom: 6px; display: block;
    }
    .create-label .optional { color: var(--text-muted); font-weight: 400; }
    .create-select {
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-canvas);
      color: var(--text-primary); font-size: var(--font-size-md);
      font-family: inherit; width: 100%;
    }
    .create-select:focus { border-color: var(--color-primary); }
    .create-error { font-size: var(--font-size-sm); color: var(--color-negative); margin-top: var(--space-xs); }
  `],
})
export class ExercisePickerComponent {
  private readonly jym = inject(JymService);

  /** The user's library. */
  readonly exercises = input.required<PickerExercise[]>();
  readonly picked = output<PickerExercise>();
  /** A new exercise, so the library shows it next time; `picked` follows. */
  readonly created = output<PickerExercise>();
  readonly close = output<void>();

  readonly search = signal('');
  readonly filtered = computed(() => {
    const q = this.search().toLowerCase();
    return this.exercises().filter(e => e.name.toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q));
  });

  readonly muscleGroups = MUSCLE_GROUPS;
  readonly creating = signal(false);
  newName = '';
  newMuscleGroup = '';
  newKind: ExerciseKind = 'weight_reps';
  readonly exerciseKinds = EXERCISE_KINDS;
  readonly saving = signal(false);
  readonly error = signal('');

  startCreate() {
    this.newName = this.search().trim();
    this.newMuscleGroup = '';
    this.newKind = 'weight_reps';
    this.error.set('');
    this.creating.set(true);
  }

  /** Cardio suggests distance + time; it can still be changed. */
  setMuscle(muscle: string) {
    this.newMuscleGroup = muscle;
    if (muscle === 'Cardio' && this.newKind === 'weight_reps') this.newKind = 'distance';
  }

  create() {
    const name = this.newName.trim();
    if (!name) return;
    this.saving.set(true);
    this.error.set('');
    this.jym.createExercise({ name, muscle_group: this.newMuscleGroup || undefined, kind: this.newKind }).subscribe({
      next: ex => {
        const entry = { id: ex.id, name: ex.name, muscle_group: ex.muscle_group, kind: ex.kind };
        this.saving.set(false);
        this.created.emit(entry);
        this.picked.emit(entry);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not create exercise. The name may already be taken.');
      },
    });
  }
}
