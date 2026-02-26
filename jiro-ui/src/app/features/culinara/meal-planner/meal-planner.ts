import { Component, OnInit, computed, signal, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MealPlanService, MealPlan, MealPlanEntry, MealSlot } from '../../../core/services/meal-plan.service';
import { RecipeService, Recipe } from '../../../core/services/recipe.service';
import { ShoppingListComponent } from '../shopping-list/shopping-list';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch'     },
  { key: 'dinner',    label: 'Dinner'    },
  { key: 'snack',     label: 'Snack'     },
];

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n * 7);
  return r;
}

@Component({
  selector: 'app-meal-planner',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="planner-page">
      <!-- Header -->
      <div class="page-header">
        <div>
          <a routerLink="/culinara" class="back-link">← Culinara</a>
          <h1>Meal Planner</h1>
          <p class="text-secondary">{{ weekLabel() }}</p>
        </div>
        <div class="header-actions">
          <button class="nav-btn" (click)="prevWeek()">‹ Prev</button>
          <button class="nav-btn today-btn" (click)="goToday()">Today</button>
          <button class="nav-btn" (click)="nextWeek()">Next ›</button>
          <button class="grocery-btn" (click)="addAllToGrocery()" title="Add all planned recipes to grocery list">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            {{ groceryAdded() ? 'Added!' : 'Add to Grocery List' }}
          </button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="loading-state">
        <div class="spinner"></div>
      </div>

      <!-- Calendar grid -->
      <div *ngIf="!loading()" class="calendar-wrap">
        <div class="calendar-grid">
          <!-- Column headers: day names + dates -->
          <div class="slot-label-header"></div>
          <div *ngFor="let day of dayHeaders()" class="day-header" [class.today]="day.isToday">
            <span class="day-name">{{ day.name }}</span>
            <span class="day-date">{{ day.date }}</span>
          </div>

          <!-- Rows: one per meal slot -->
          <ng-container *ngFor="let slot of slots">
            <div class="slot-label">{{ slot.label }}</div>
            <div
              *ngFor="let dow of [0,1,2,3,4,5,6]"
              class="calendar-cell"
              (click)="openPicker(dow, slot.key)">

              <!-- Recipe chips -->
              <div
                *ngFor="let entry of entriesFor(dow, slot.key)"
                class="entry-chip"
                (click)="$event.stopPropagation()">
                <span class="chip-title">{{ entry.recipe_title || entry.custom_label || 'Unnamed' }}</span>
                <button class="chip-remove" (click)="removeEntry(entry)" title="Remove">×</button>
              </div>

              <!-- Add placeholder -->
              <div class="add-placeholder">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </div>
            </div>
          </ng-container>
        </div>
      </div>

      <!-- Recipe picker modal -->
      <div class="modal-backdrop" *ngIf="pickerOpen()" (click)="closePicker()">
        <div class="picker-modal" (click)="$event.stopPropagation()">
          <div class="picker-header">
            <h3>Add to {{ slotLabel(pickerSlot()!) }} — {{ dayLabel(pickerDow()!) }}</h3>
            <button class="picker-close" (click)="closePicker()">✕</button>
          </div>

          <div class="picker-search">
            <input
              class="search-input"
              type="text"
              placeholder="Search recipes…"
              [(ngModel)]="searchQuery"
              (input)="filterRecipes()" />
          </div>

          <div class="picker-results">
            <div *ngIf="filteredRecipes().length === 0" class="picker-empty">
              No recipes found
            </div>
            <button
              *ngFor="let r of filteredRecipes()"
              class="picker-recipe-btn"
              (click)="pickRecipe(r)">
              <span class="pr-title">{{ r.title }}</span>
              <span class="pr-tags" *ngIf="r.tags.length">{{ r.tags.slice(0,3).join(' · ') }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .planner-page {
      padding: var(--space-lg);
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: var(--space-md);
      margin-bottom: var(--space-lg);
      flex-wrap: wrap;
    }

    .back-link {
      font-size: var(--font-size-sm);
      color: var(--text-muted);
      text-decoration: none;
      display: block;
      margin-bottom: 4px;
    }
    .back-link:hover { color: var(--text-secondary); }

    h1 { margin: 0 0 2px; font-size: var(--font-size-xl); }
    .text-secondary { margin: 0; color: var(--text-secondary); font-size: var(--font-size-sm); }

    .header-actions {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex-wrap: wrap;
    }

    .nav-btn {
      padding: 6px 14px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-family: inherit;
      cursor: pointer;
      color: var(--text-primary);
      transition: background 0.15s;
    }
    .nav-btn:hover { background: var(--bg-surface-hover); }
    .today-btn { font-weight: 600; }

    .grocery-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      background: var(--color-primary);
      color: #fff;
      border: none;
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s;
      font-weight: 500;
    }
    .grocery-btn:hover { opacity: 0.88; }

    .loading-state {
      display: flex;
      justify-content: center;
      padding: 80px;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color);
      border-top-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }

    /* Calendar */
    .calendar-wrap {
      overflow-x: auto;
      border-radius: var(--border-radius-lg);
      border: 1px solid var(--border-color);
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: 90px repeat(7, minmax(120px, 1fr));
      min-width: 780px;
    }

    .slot-label-header {
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
    }

    .day-header {
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
      padding: 10px 8px;
      text-align: center;
    }
    .day-header:last-child { border-right: none; }
    .day-header.today { background: color-mix(in srgb, var(--color-primary) 8%, var(--bg-canvas)); }
    .day-header.today .day-name { color: var(--color-primary); font-weight: 700; }

    .day-name { display: block; font-size: var(--font-size-xs); font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-secondary); }
    .day-date { display: block; font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); margin-top: 2px; }

    .slot-label {
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
      padding: 10px 8px;
      font-size: var(--font-size-xs);
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      display: flex;
      align-items: flex-start;
      justify-content: center;
      writing-mode: horizontal-tb;
    }

    .calendar-cell {
      border-bottom: 1px solid var(--border-color);
      border-right: 1px solid var(--border-color);
      padding: 6px;
      min-height: 72px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: background 0.12s;
      position: relative;
    }
    .calendar-cell:last-child { border-right: none; }
    .calendar-cell:hover { background: var(--bg-surface-hover); }
    .calendar-cell:hover .add-placeholder { opacity: 1; }

    .entry-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--color-primary);
      color: #fff;
      border-radius: 4px;
      padding: 3px 6px 3px 8px;
      font-size: 0.72rem;
      line-height: 1.3;
    }

    .chip-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .chip-remove {
      flex-shrink: 0;
      background: none;
      border: none;
      color: rgba(255,255,255,0.7);
      cursor: pointer;
      padding: 0 2px;
      font-size: 0.9rem;
      line-height: 1;
      transition: color 0.1s;
    }
    .chip-remove:hover { color: #fff; }

    .add-placeholder {
      opacity: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--text-muted);
      transition: opacity 0.12s;
      padding: 4px;
    }

    /* Recipe picker modal */
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.4);
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-md);
    }

    .picker-modal {
      background: var(--bg-surface);
      border-radius: var(--border-radius-lg);
      width: 100%;
      max-width: 480px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
    }

    .picker-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px 12px;
      border-bottom: 1px solid var(--border-color);
    }
    .picker-header h3 { margin: 0; font-size: var(--font-size-md); }

    .picker-close {
      background: none;
      border: none;
      color: var(--text-muted);
      cursor: pointer;
      font-size: 1.1rem;
      padding: 2px 6px;
      transition: color 0.15s;
    }
    .picker-close:hover { color: var(--text-primary); }

    .picker-search { padding: 12px 20px; border-bottom: 1px solid var(--border-color); }

    .search-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-family: inherit;
      background: var(--bg-canvas);
      color: var(--text-primary);
      box-sizing: border-box;
    }
    .search-input:focus { outline: none; border-color: var(--color-primary); }

    .picker-results {
      overflow-y: auto;
      flex: 1;
      padding: 8px;
    }

    .picker-empty {
      text-align: center;
      color: var(--text-muted);
      padding: 32px;
      font-size: var(--font-size-sm);
    }

    .picker-recipe-btn {
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      border-radius: var(--border-radius);
      padding: 10px 12px;
      cursor: pointer;
      font-family: inherit;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background 0.12s;
    }
    .picker-recipe-btn:hover { background: var(--bg-surface-hover); }

    .pr-title { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-primary); }
    .pr-tags { font-size: var(--font-size-xs); color: var(--text-muted); }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 767px) {
      .planner-page { padding: var(--space-md); }
      .page-header { flex-direction: column; align-items: stretch; }
      .header-actions { justify-content: space-between; }
    }
  `],
})
export class MealPlannerComponent implements OnInit {
  readonly slots = SLOTS;
  readonly days = DAYS;

  loading = signal(true);
  plan = signal<MealPlan | null>(null);
  currentMonday = signal(mondayOf(new Date()));
  allRecipes = signal<Recipe[]>([]);
  filteredRecipes = signal<Recipe[]>([]);
  searchQuery = '';

  pickerOpen = signal(false);
  pickerDow = signal<number | null>(null);
  pickerSlot = signal<MealSlot | null>(null);

  groceryAdded = signal(false);

  weekLabel = computed(() => {
    const mon = this.currentMonday();
    const sun = addWeeks(mon, 1);
    sun.setDate(sun.getDate() - 1);
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${fmt(mon)} – ${fmt(sun)}, ${mon.getFullYear()}`;
  });

  dayHeaders = computed(() => {
    const mon = this.currentMonday();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return DAYS.map((name, i) => {
      const d = new Date(mon);
      d.setDate(d.getDate() + i);
      return {
        name,
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        isToday: d.getTime() === today.getTime(),
      };
    });
  });

  constructor(
    private mealPlanService: MealPlanService,
    private recipeService: RecipeService,
    private elRef: ElementRef,
  ) {}

  ngOnInit() {
    this.loadPlan(true);
    this.recipeService.listRecipes().subscribe({
      next: (recipes) => {
        this.allRecipes.set(recipes);
        this.filteredRecipes.set(recipes);
      },
    });
  }

  loadPlan(scrollToToday = false) {
    this.loading.set(true);
    this.mealPlanService.getMealPlan(toISODate(this.currentMonday())).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
        if (scrollToToday) setTimeout(() => this.scrollToToday(), 50);
      },
      error: () => this.loading.set(false),
    });
  }

  prevWeek() {
    this.currentMonday.set(addWeeks(this.currentMonday(), -1));
    this.loadPlan();
  }

  nextWeek() {
    this.currentMonday.set(addWeeks(this.currentMonday(), 1));
    this.loadPlan();
  }

  goToday() {
    this.currentMonday.set(mondayOf(new Date()));
    this.loadPlan(true);
  }

  private scrollToToday() {
    const wrap: HTMLElement | null = this.elRef.nativeElement.querySelector('.calendar-wrap');
    const todayCol: HTMLElement | null = this.elRef.nativeElement.querySelector('.day-header.today');
    if (wrap && todayCol) {
      // Scroll so today's column is visible just after the sticky slot label (90px)
      wrap.scrollTo({ left: todayCol.offsetLeft - 90, behavior: 'smooth' });
    }
  }

  entriesFor(dow: number, slot: MealSlot): MealPlanEntry[] {
    return (this.plan()?.entries ?? []).filter(e => e.day_of_week === dow && e.meal_slot === slot);
  }

  openPicker(dow: number, slot: MealSlot) {
    this.pickerDow.set(dow);
    this.pickerSlot.set(slot);
    this.searchQuery = '';
    this.filteredRecipes.set(this.allRecipes());
    this.pickerOpen.set(true);
  }

  closePicker() {
    this.pickerOpen.set(false);
  }

  filterRecipes() {
    const q = this.searchQuery.toLowerCase();
    this.filteredRecipes.set(
      q ? this.allRecipes().filter(r => r.title.toLowerCase().includes(q)) : this.allRecipes()
    );
  }

  pickRecipe(recipe: Recipe) {
    const plan = this.plan();
    if (!plan) return;
    this.mealPlanService.addEntry(plan.id, {
      recipe_id: recipe.id,
      day_of_week: this.pickerDow()!,
      meal_slot: this.pickerSlot()!,
    }).subscribe({
      next: (entry) => {
        this.plan.update(p => p ? { ...p, entries: [...p.entries, entry] } : p);
        this.closePicker();
      },
    });
  }

  removeEntry(entry: MealPlanEntry) {
    this.mealPlanService.removeEntry(entry.id).subscribe({
      next: () => {
        this.plan.update(p => p ? { ...p, entries: p.entries.filter(e => e.id !== entry.id) } : p);
      },
    });
  }

  addAllToGrocery() {
    const entries = this.plan()?.entries ?? [];
    const recipes = this.allRecipes();
    let count = 0;
    for (const entry of entries) {
      if (!entry.recipe_id) continue;
      const recipe = recipes.find(r => r.id === entry.recipe_id);
      if (!recipe?.base_ingredients?.length) continue;
      const ings = recipe.base_ingredients as { item: string; amount: string }[];
      ShoppingListComponent.addRecipe(recipe.title, ings);
      count++;
    }
    if (count > 0) {
      this.groceryAdded.set(true);
      setTimeout(() => this.groceryAdded.set(false), 2500);
    }
  }

  slotLabel(slot: MealSlot): string {
    return SLOTS.find(s => s.key === slot)?.label ?? slot;
  }

  dayLabel(dow: number): string {
    const headers = this.dayHeaders();
    return headers[dow] ? `${headers[dow].name} ${headers[dow].date}` : '';
  }
}
