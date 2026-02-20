import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { JymService, SplitWithRoutines, Routine, RoutineItem, Exercise } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-split-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, JiroButtonComponent, JiroModalComponent],
  template: `
    <div class="split-detail" *ngIf="split()">
      <!-- Header -->
      <div class="page-header">
        <div class="header-left">
          <button class="back-btn" (click)="goBack()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            All Splits
          </button>
          <div class="split-title-row">
            <h1 *ngIf="!editingName()">{{ split()!.name }}</h1>
            <input *ngIf="editingName()" class="title-input" [(ngModel)]="editName" (blur)="saveName()" (keydown.enter)="saveName()" autofocus />
            <button class="edit-btn" (click)="startEditName()">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </div>
        </div>
        <jiro-button variant="primary" type="button" (click)="showAddRoutine.set(true)">
          + Add Day
        </jiro-button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
      </div>

      <!-- Routines (drag-drop columns) -->
      <div *ngIf="!loading()" class="routines-board">
        <div
          *ngFor="let routine of routines(); let ri = index"
          class="routine-column">
          <div class="routine-header">
            <div class="routine-title">
              <span class="day-chip">Day {{ routine.day_order }}</span>
              <span class="routine-name">{{ routine.name }}</span>
            </div>
            <button class="icon-btn danger" (click)="deleteRoutine(routine, ri)" title="Delete day">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
                <path d="M10,11v6M14,11v6M9,6V4a1,1,0,0,1,1-1h4a1,1,0,0,1,1,1V6"/>
              </svg>
            </button>
          </div>

          <!-- Exercise items (drag-drop list) -->
          <div
            cdkDropList
            [cdkDropListData]="routine.items"
            [id]="'routine-' + routine.id"
            [cdkDropListConnectedTo]="getConnectedLists()"
            class="exercise-list"
            (cdkDropListDropped)="onDrop($event, ri)">
            <div
              *ngFor="let item of routine.items; let ii = index"
              cdkDrag
              class="exercise-item">
              <div class="drag-handle" cdkDragHandle>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                  <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                </svg>
              </div>
              <div class="item-info">
                <span class="item-name">{{ item.exercise_name }}</span>
                <span class="item-muscle" *ngIf="item.muscle_group">{{ item.muscle_group }}</span>
              </div>
              <div class="item-targets">
                <span class="target-text">{{ item.target_sets }}×{{ item.target_reps }}</span>
              </div>
              <button class="icon-btn" (click)="removeItem(ri, ii)" title="Remove exercise">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div *ngIf="routine.items.length === 0" class="empty-list">
              Drag exercises here or click + Add
            </div>
          </div>

          <button class="add-ex-btn" (click)="openExercisePicker(ri)">
            + Add Exercise
          </button>
        </div>

        <div *ngIf="routines().length === 0" class="board-empty">
          <p class="text-secondary">No training days yet. Add your first day to start building.</p>
          <jiro-button variant="primary" type="button" (click)="showAddRoutine.set(true)">+ Add Day</jiro-button>
        </div>
      </div>
    </div>

    <!-- Add Routine Modal -->
    <jiro-modal *ngIf="showAddRoutine()" title="Add Training Day" maxWidth="400px" (close)="showAddRoutine.set(false)">
      <form class="simple-form" (ngSubmit)="addRoutine()">
        <div class="form-group">
          <label class="form-label">Day Name</label>
          <input class="form-input" type="text" [(ngModel)]="newRoutineName" name="name" placeholder="e.g. Push Day" required />
        </div>
        <div class="form-group">
          <label class="form-label">Day Order</label>
          <input class="form-input" type="number" [(ngModel)]="newRoutineDay" name="day" min="1" />
        </div>
        <div class="form-actions">
          <jiro-button variant="secondary" type="button" (click)="showAddRoutine.set(false)">Cancel</jiro-button>
          <jiro-button variant="primary" type="submit" [disabled]="saving() || !newRoutineName.trim()">
            {{ saving() ? 'Adding...' : 'Add Day' }}
          </jiro-button>
        </div>
      </form>
    </jiro-modal>

    <!-- Exercise Picker Modal -->
    <jiro-modal *ngIf="showExPicker()" title="Add Exercise" maxWidth="480px" (close)="showExPicker.set(false)">
      <div class="ex-picker">
        <input class="form-input" type="text" [(ngModel)]="exSearch" (input)="filterExercises()" placeholder="Search exercises..." />
        <div class="ex-picker-list">
          <button
            *ngFor="let ex of filteredExercises()"
            class="ex-pick-btn"
            (click)="addExerciseToRoutine(ex)">
            <span class="ex-pick-name">{{ ex.name }}</span>
            <span class="ex-pick-muscle" *ngIf="ex.muscle_group">{{ ex.muscle_group }}</span>
          </button>
          <div *ngIf="filteredExercises().length === 0" class="no-results">
            <p class="text-secondary">No exercises found.</p>
            <p class="text-secondary" style="font-size:var(--font-size-sm)">Add exercises in the Exercise Library first.</p>
          </div>
        </div>

        <!-- Target sets/reps -->
        <div *ngIf="pickerSelectedEx()" class="target-inputs">
          <div class="target-row">
            <div class="form-group">
              <label class="form-label">Sets</label>
              <input class="form-input" type="number" [(ngModel)]="pickerSets" min="1" max="10" />
            </div>
            <div class="form-group">
              <label class="form-label">Reps</label>
              <input class="form-input" type="number" [(ngModel)]="pickerReps" min="1" max="100" />
            </div>
          </div>
          <jiro-button variant="primary" type="button" (click)="confirmAddExercise()">
            Add {{ pickerSelectedEx()!.name }}
          </jiro-button>
        </div>
      </div>
    </jiro-modal>
  `,
  styles: [`
    :host { display: block; }

    .split-detail { max-width: 1200px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header ::ng-deep .jiro-btn { width: auto; flex-shrink: 0; }

    .header-left { display: flex; flex-direction: column; gap: var(--space-sm); }

    .back-btn {
      display: flex; align-items: center; gap: var(--space-xs);
      background: none; border: none; color: var(--text-muted);
      font-size: var(--font-size-sm); cursor: pointer; padding: 0;
    }

    .back-btn:hover { color: var(--text-primary); }

    .split-title-row {
      display: flex; align-items: center; gap: var(--space-sm);
    }

    .split-title-row h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .title-input {
      font-size: var(--font-size-2xl); font-weight: 700;
      border: none; border-bottom: 2px solid var(--color-primary);
      background: transparent; color: var(--text-primary);
      outline: none; padding: 0 var(--space-xs);
    }

    .edit-btn {
      background: none; border: none; color: var(--text-muted);
      cursor: pointer; padding: var(--space-xs); border-radius: 4px;
    }

    .edit-btn:hover { color: var(--color-primary); background: rgba(122,59,46,0.1); }

    .state-message {
      display: flex; align-items: center; justify-content: center; padding: var(--space-2xl);
    }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .routines-board {
      display: flex; gap: var(--space-lg); overflow-x: auto;
      padding-bottom: var(--space-md); align-items: flex-start;
    }

    .board-empty {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center; width: 100%;
    }

    .board-empty ::ng-deep .jiro-btn { width: auto; }

    .routine-column {
      min-width: 260px; max-width: 280px; flex-shrink: 0;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); display: flex; flex-direction: column;
    }

    .routine-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-md); border-bottom: 1px solid var(--border-color);
    }

    .routine-title { display: flex; align-items: center; gap: var(--space-xs); flex: 1; min-width: 0; }

    .day-chip {
      background: rgba(122,59,46,0.12); color: var(--color-primary);
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 2px 8px; border-radius: 10px; white-space: nowrap;
    }

    .routine-name {
      font-weight: 600; font-size: var(--font-size-sm);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    .icon-btn {
      background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 4px; border-radius: 4px;
      display: flex; align-items: center; flex-shrink: 0;
    }

    .icon-btn:hover { color: var(--text-primary); background: var(--bg-surface-hover); }
    .icon-btn.danger:hover { color: var(--color-danger); background: rgba(196, 74, 74, 0.1); }

    .exercise-list {
      padding: var(--space-sm); display: flex; flex-direction: column;
      gap: var(--space-xs); min-height: 60px; flex: 1;
    }

    .exercise-item {
      display: flex; align-items: center; gap: var(--space-xs);
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-xs) var(--space-sm);
      cursor: grab; transition: box-shadow 0.15s;
    }

    .exercise-item:hover { box-shadow: var(--shadow-sm); }

    .exercise-item.cdk-drag-preview {
      box-shadow: var(--shadow-md); opacity: 0.95;
    }

    .exercise-item.cdk-drag-placeholder { opacity: 0.3; }

    .drag-handle { cursor: grab; color: var(--text-muted); flex-shrink: 0; }

    .item-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }

    .item-name { font-size: var(--font-size-sm); font-weight: 500; }

    .item-muscle { font-size: var(--font-size-xs); color: var(--text-muted); }

    .item-targets { flex-shrink: 0; }

    .target-text {
      font-size: var(--font-size-xs); font-weight: 600;
      color: var(--color-primary); background: rgba(122,59,46,0.1);
      padding: 2px 6px; border-radius: 8px;
    }

    .empty-list {
      font-size: var(--font-size-xs); color: var(--text-muted);
      text-align: center; padding: var(--space-md);
      border: 1px dashed var(--border-color); border-radius: var(--border-radius);
    }

    .add-ex-btn {
      width: 100%; padding: var(--space-sm); background: none;
      border: none; border-top: 1px solid var(--border-color);
      color: var(--text-muted); font-size: var(--font-size-sm);
      cursor: pointer; text-align: center; transition: all 0.15s;
      border-radius: 0 0 var(--border-radius) var(--border-radius);
    }

    .add-ex-btn:hover { color: var(--color-primary); background: rgba(122,59,46,0.05); }

    /* Modal forms */
    .simple-form { display: flex; flex-direction: column; gap: var(--space-md); }

    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); }

    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }

    .form-input {
      padding: 10px 14px; border: 1px solid var(--border-color);
      border-radius: var(--border-radius); background: var(--bg-surface);
      color: var(--text-primary); font-size: var(--font-size-md);
      outline: none; transition: border-color 0.2s; font-family: inherit; width: 100%; box-sizing: border-box;
    }

    .form-input:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.15); }

    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }

    .form-actions ::ng-deep .jiro-btn { width: auto; }

    /* Exercise picker */
    .ex-picker { display: flex; flex-direction: column; gap: var(--space-md); }

    .ex-picker-list {
      max-height: 240px; overflow-y: auto;
      display: flex; flex-direction: column; gap: 2px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius); padding: var(--space-xs);
    }

    .ex-pick-btn {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-sm) var(--space-md); background: none;
      border: none; border-radius: 4px; cursor: pointer;
      text-align: left; width: 100%; transition: background 0.15s;
    }

    .ex-pick-btn:hover { background: rgba(122,59,46,0.08); }

    .ex-pick-name { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); }

    .ex-pick-muscle { font-size: var(--font-size-xs); color: var(--text-muted); }

    .no-results { padding: var(--space-md); text-align: center; }

    .target-inputs {
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md);
      display: flex; flex-direction: column; gap: var(--space-md);
    }

    .target-inputs ::ng-deep .jiro-btn { width: auto; }

    .target-row { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-md); }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class SplitDetailComponent implements OnInit {
  split = signal<SplitWithRoutines | null>(null);
  routines = signal<(Routine & { items: RoutineItem[] })[]>([]);
  loading = signal(true);
  saving = signal(false);
  editingName = signal(false);
  showAddRoutine = signal(false);
  showExPicker = signal(false);

  editName = '';
  newRoutineName = '';
  newRoutineDay = 1;

  allExercises = signal<Exercise[]>([]);
  filteredExercises = signal<Exercise[]>([]);
  exSearch = '';
  pickerSelectedEx = signal<Exercise | null>(null);
  pickerSets = 3;
  pickerReps = 8;
  private pickerRoutineIndex = 0;

  private splitId = '';

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.splitId = this.route.snapshot.paramMap.get('id') || '';
    this.loadSplit();
    this.jymService.listExercises().subscribe(exs => {
      this.allExercises.set(exs);
      this.filteredExercises.set(exs);
    });
  }

  loadSplit() {
    this.loading.set(true);
    this.jymService.getSplit(this.splitId).subscribe({
      next: s => {
        this.split.set(s);
        this.routines.set(s.routines.map(r => ({ ...r, items: r.items || [] })));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goBack() { this.router.navigate(['/jym']); }

  startEditName() {
    this.editName = this.split()?.name || '';
    this.editingName.set(true);
  }

  saveName() {
    if (!this.editName.trim() || this.editName.trim() === this.split()?.name) {
      this.editingName.set(false);
      return;
    }
    this.jymService.updateSplit(this.splitId, { name: this.editName.trim() }).subscribe({
      next: s => {
        this.split.update(cur => cur ? { ...cur, name: s.name } : cur);
        this.editingName.set(false);
      },
      error: () => this.editingName.set(false),
    });
  }

  addRoutine() {
    if (!this.newRoutineName.trim()) return;
    this.saving.set(true);
    this.jymService.createRoutine(this.splitId, { name: this.newRoutineName.trim(), day_order: this.newRoutineDay }).subscribe({
      next: r => {
        this.routines.update(list => [...list, { ...r, items: [] }]);
        this.showAddRoutine.set(false);
        this.newRoutineName = '';
        this.newRoutineDay = this.routines().length + 1;
        this.saving.set(false);
      },
      error: () => this.saving.set(false),
    });
  }

  deleteRoutine(routine: Routine, ri: number) {
    this.jymService.deleteRoutine(routine.id).subscribe({
      next: () => {
        this.routines.update(list => list.filter((_, i) => i !== ri));
      },
    });
  }

  getConnectedLists(): string[] {
    return this.routines().map(r => 'routine-' + r.id);
  }

  onDrop(event: CdkDragDrop<RoutineItem[]>, routineIndex: number) {
    const lists = this.routines();
    const prevIdx = lists.findIndex(r => 'routine-' + r.id === event.previousContainer.id);
    const currIdx = routineIndex;

    if (event.previousContainer === event.container) {
      const items = [...lists[currIdx].items];
      moveItemInArray(items, event.previousIndex, event.currentIndex);
      this.routines.update(rs => rs.map((r, i) => i === currIdx ? { ...r, items } : r));
    } else {
      const prevItems = [...lists[prevIdx].items];
      const currItems = [...lists[currIdx].items];
      const [moved] = prevItems.splice(event.previousIndex, 1);
      currItems.splice(event.currentIndex, 0, moved);
      this.routines.update(rs => rs.map((r, i) => {
        if (i === prevIdx) return { ...r, items: prevItems };
        if (i === currIdx) return { ...r, items: currItems };
        return r;
      }));
    }

    // Persist to backend
    const routine = this.routines()[currIdx];
    const entries = routine.items.map((item, idx) => ({
      exercise_id: item.exercise_id,
      target_sets: item.target_sets,
      target_reps: item.target_reps,
    }));
    this.jymService.replaceRoutineItems(routine.id, entries).subscribe();
  }

  openExercisePicker(routineIndex: number) {
    this.pickerRoutineIndex = routineIndex;
    this.pickerSelectedEx.set(null);
    this.exSearch = '';
    this.filteredExercises.set(this.allExercises());
    this.showExPicker.set(true);
  }

  filterExercises() {
    const q = this.exSearch.toLowerCase();
    this.filteredExercises.set(this.allExercises().filter(e =>
      e.name.toLowerCase().includes(q) || (e.muscle_group || '').toLowerCase().includes(q)
    ));
  }

  addExerciseToRoutine(ex: Exercise) {
    this.pickerSelectedEx.set(ex);
    this.pickerSets = 3;
    this.pickerReps = 8;
  }

  confirmAddExercise() {
    const ex = this.pickerSelectedEx();
    if (!ex) return;
    const ri = this.pickerRoutineIndex;
    const routine = this.routines()[ri];

    const newItem: RoutineItem = {
      id: '',
      routine_id: routine.id,
      exercise_id: ex.id,
      target_sets: this.pickerSets,
      target_reps: this.pickerReps,
      order_index: routine.items.length,
      exercise_name: ex.name,
      muscle_group: ex.muscle_group,
    };

    const updatedItems = [...routine.items, newItem];
    this.routines.update(rs => rs.map((r, i) => i === ri ? { ...r, items: updatedItems } : r));

    const entries = updatedItems.map(item => ({
      exercise_id: item.exercise_id,
      target_sets: item.target_sets,
      target_reps: item.target_reps,
    }));
    this.jymService.replaceRoutineItems(routine.id, entries).subscribe({
      next: saved => {
        this.routines.update(rs => rs.map((r, i) => i === ri ? { ...r, items: saved } : r));
      },
    });

    this.showExPicker.set(false);
    this.pickerSelectedEx.set(null);
  }

  removeItem(routineIndex: number, itemIndex: number) {
    const routine = this.routines()[routineIndex];
    const updatedItems = routine.items.filter((_, i) => i !== itemIndex);
    this.routines.update(rs => rs.map((r, i) => i === routineIndex ? { ...r, items: updatedItems } : r));

    const entries = updatedItems.map(item => ({
      exercise_id: item.exercise_id,
      target_sets: item.target_sets,
      target_reps: item.target_reps,
    }));
    this.jymService.replaceRoutineItems(routine.id, entries).subscribe();
  }
}
