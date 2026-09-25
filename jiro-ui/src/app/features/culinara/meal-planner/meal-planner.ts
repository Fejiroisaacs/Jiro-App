import { Component, OnInit, computed, inject, signal, ElementRef } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { MealPlanService, MealPlan, MealPlanEntry, MealSlot } from '../../../core/services/meal-plan.service';
import { RecipeService, Recipe } from '../../../core/services/recipe.service';
import { GroceryService, groceryAddedMessage } from '../../../core/services/grocery.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { SettingsService } from '../../../core/services/settings.service';
import { addDays, mondayOfKey, shortDayLabel, todayKey } from '../../../core/utils/day';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SLOTS: { key: MealSlot; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch',     label: 'Lunch'     },
  { key: 'dinner',    label: 'Dinner'    },
  { key: 'snack',     label: 'Snack'     },
];

@Component({
  selector: 'app-meal-planner',
  standalone: true,
  imports: [FormsModule, JiroPageHeaderComponent, JiroModalComponent, JiroButtonComponent],
  template: `
    <div class="planner-page">
      <!-- Header -->
      <jiro-page-header heading="Meal planner" [subtitle]="weekLabel()">
        <div actions class="header-actions">
          <button class="nav-btn" type="button" (click)="prevWeek()" aria-label="Previous week">‹ Prev</button>
          <button class="nav-btn today-btn" type="button" (click)="goToday()">Today</button>
          <button class="nav-btn" type="button" (click)="nextWeek()" aria-label="Next week">Next ›</button>
          <button class="grocery-btn" type="button" (click)="addAllToGrocery()" title="Add all planned recipes to grocery list"
            aria-label="Add every planned recipe to the grocery list" [disabled]="groceryBusy()" [attr.aria-busy]="groceryBusy() ? 'true' : null">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/>
              <path d="M16 10a4 4 0 0 1-8 0"/>
            </svg>
            Add to grocery list
          </button>
        </div>
      </jiro-page-header>

      <!-- Loading -->
      @if (loading()) {
<div class="state-loading" aria-busy="true">
        <div class="spinner"></div>
      </div>
}

      <!-- Calendar grid -->
      @if (!loading()) {
<div class="calendar-wrap">
        <div class="calendar-grid">
          <!-- Column headers: day names + dates -->
          <div class="slot-label-header"></div>
          @for (day of dayHeaders(); track day) {
<div class="day-header" [class.today]="day.isToday">
            <span class="day-name">{{ day.name }}</span>
            <span class="day-date">{{ day.date }}</span>
          </div>
}

          <!-- Rows: one per meal slot -->
          @for (slot of slots; track slot) {

            <div class="slot-label">{{ slot.label }}</div>
            @for (dow of [0,1,2,3,4,5,6]; track dow) {
              <div class="calendar-cell">
                @for (entry of entriesFor(dow, slot.key); track entry.id) {
                  <div class="entry-chip" [class.entry-chip--note]="!entry.recipe_id">
                    <span class="chip-title">{{ entryName(entry) }}</span>
                    <button class="chip-remove" type="button" (click)="removeEntry(entry)" title="Remove from this day"
                      [attr.aria-label]="'Remove ' + entryName(entry) + ' from ' + slot.label + ', ' + dayLabel(dow)">×</button>
                  </div>
                }
                <!-- The rest of the box is one button, so a slot is reachable by keyboard. -->
                <button class="cell-add" type="button" (click)="openPicker(dow, slot.key)"
                  [attr.aria-label]="'Add to ' + slot.label + ', ' + dayLabel(dow)">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                </button>
              </div>
            }
          
}
        </div>
      </div>
}

      <!-- Recipe picker -->
      @if (pickerOpen()) {
        <jiro-modal [title]="'Add to ' + slotLabel(pickerSlot()!) + ', ' + dayLabel(pickerDow()!)" maxWidth="480px" (close)="closePicker()">
          <div class="picker">
            <label class="sr-only" for="planner-recipe-search">Search recipes</label>
            <input
              id="planner-recipe-search"
              class="search-input"
              type="search"
              placeholder="Search recipes"
              autocomplete="off"
              autofocus
              [(ngModel)]="searchQuery"
              (input)="filterRecipes()" />

            <div class="picker-results" role="list" aria-label="Recipes">
              @if (filteredRecipes().length === 0) {
                <div class="picker-empty" role="listitem">No recipes found</div>
              }
              @for (r of filteredRecipes(); track r.id) {
                <div role="listitem">
                  <button type="button" class="picker-recipe-btn" (click)="pickRecipe(r)">
                    <span class="pr-title">{{ r.title }}</span>
                    @if (r.tags.length) {
                      <span class="pr-tags">{{ r.tags.slice(0,3).join(' · ') }}</span>
                    }
                  </button>
                </div>
              }
            </div>

            <form class="note-form" (ngSubmit)="addNote()">
              <label class="note-label" for="planner-note">Or add a note instead</label>
              <div class="note-row">
                <input id="planner-note" class="search-input" name="note" type="text" maxlength="80"
                  placeholder="Such as Dinner out" autocomplete="off"
                  [(ngModel)]="noteText" />
                <jiro-button type="submit" variant="secondary" [disabled]="!noteText.trim()">Add note</jiro-button>
              </div>
            </form>
          </div>
        </jiro-modal>
      }
    </div>
  `,
  styles: [`
    .planner-page {
      padding: var(--space-lg);
      max-width: 1200px;
      margin: 0 auto;
    }



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
      color: var(--text-on-primary);
      border: none;
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.15s;
      font-weight: 500;
    }
    .grocery-btn:hover { opacity: 0.88; }
    .grocery-btn:disabled { opacity: 0.6; cursor: progress; }

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }
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
      display: flex;
      flex-direction: column;
      gap: 4px;
      transition: background 0.12s;
      position: relative;
    }
    .calendar-cell:last-child { border-right: none; }
    .calendar-cell:hover { background: var(--bg-surface-hover); }

    /* Fills the rest of the box: the whole empty area opens the picker. */
    .cell-add {
      flex: 1;
      min-height: 28px;
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px;
      background: none;
      border: 1px dashed transparent;
      border-radius: 4px;
      color: var(--text-muted);
      cursor: pointer;
      font: inherit;
    }
    .cell-add svg { opacity: 0; transition: opacity 0.12s; }
    .calendar-cell:hover .cell-add svg,
    .cell-add:focus-visible svg { opacity: 1; }
    .cell-add:hover { border-color: var(--border-color); }
    .cell-add:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 1px;
      border-color: var(--color-primary);
    }

    .entry-chip {
      display: flex;
      align-items: center;
      gap: 4px;
      background: var(--color-primary);
      color: var(--text-on-primary);
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

    /* A note ("Dinner out") in place of a recipe: quieter than a recipe chip. */
    .entry-chip--note {
      background: color-mix(in srgb, var(--color-primary) 12%, var(--bg-surface));
      color: var(--text-primary);
      border: 1px dashed color-mix(in srgb, var(--color-primary) 45%, transparent);
    }

    .chip-remove {
      flex-shrink: 0;
      min-width: 20px;
      min-height: 20px;
      background: none;
      border: none;
      color: inherit;
      opacity: 0.8;
      cursor: pointer;
      padding: 0 2px;
      font-size: 0.9rem;
      line-height: 1;
      transition: opacity 0.1s;
    }
    .chip-remove:hover, .chip-remove:focus-visible { opacity: 1; }

    /* Recipe picker (inside jiro-modal) */
    .picker {
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
    }

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
    .search-input:focus { border-color: var(--color-primary); }

    .picker-results {
      overflow-y: auto;
      max-height: min(40vh, 320px);
      margin: 0 calc(var(--space-sm) * -1);
    }

    .note-form {
      border-top: 1px solid var(--border-color);
      padding-top: var(--space-md);
    }
    .note-label {
      display: block;
      font-size: var(--font-size-sm);
      font-weight: 600;
      margin-bottom: var(--space-xs);
    }
    .note-row {
      display: flex;
      gap: var(--space-sm);
      align-items: center;
    }
    .note-row .search-input { flex: 1; min-width: 0; min-height: 40px; }

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
  private readonly settings = inject(SettingsService);

  /**
   * The Monday of the shown week, as a day key. Weeks are calendar weeks in
   * the user's zone, and the key is sent to the API as is, so no instant (and
   * no browser-to-UTC shift) is involved: a Date at local midnight turned
   * into an ISO string gave the Sunday before for anyone east of UTC.
   */
  currentMonday = signal(this.thisMonday());
  allRecipes = signal<Recipe[]>([]);
  filteredRecipes = signal<Recipe[]>([]);
  searchQuery = '';

  pickerOpen = signal(false);
  pickerDow = signal<number | null>(null);
  pickerSlot = signal<MealSlot | null>(null);

  groceryBusy = signal(false);
  noteText = '';
  private readonly grocery = inject(GroceryService);
  private readonly toast = inject(ToastService);

  weekLabel = computed(() => {
    const mon = this.currentMonday();
    return `${shortDayLabel(mon)} – ${shortDayLabel(addDays(mon, 6))}, ${mon.slice(0, 4)}`;
  });

  dayHeaders = computed(() => {
    const mon = this.currentMonday();
    const today = todayKey(this.settings.timezone());
    return DAYS.map((name, i) => {
      const key = addDays(mon, i);
      return { name, date: shortDayLabel(key), isToday: key === today };
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
    this.mealPlanService.getMealPlan(this.currentMonday()).subscribe({
      next: (plan) => {
        this.plan.set(plan);
        this.loading.set(false);
        if (scrollToToday) setTimeout(() => this.scrollToToday(), 50);
      },
      error: () => this.loading.set(false),
    });
  }

  prevWeek() {
    this.currentMonday.set(addDays(this.currentMonday(), -7));
    this.loadPlan();
  }

  nextWeek() {
    this.currentMonday.set(addDays(this.currentMonday(), 7));
    this.loadPlan();
  }

  goToday() {
    this.currentMonday.set(this.thisMonday());
    this.loadPlan(true);
  }

  private thisMonday(): string {
    return mondayOfKey(todayKey(this.settings.timezone()));
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

  /** What a slot's chip says: the recipe's title or the note. */
  entryName(entry: MealPlanEntry): string {
    return entry.recipe_title || entry.custom_label || 'Unnamed';
  }

  openPicker(dow: number, slot: MealSlot) {
    this.pickerDow.set(dow);
    this.pickerSlot.set(slot);
    this.searchQuery = '';
    this.noteText = '';
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
    this.addToSlot({ recipe_id: recipe.id });
  }

  /** A free-text entry, such as "Dinner out", in place of a recipe. */
  addNote() {
    const label = this.noteText.trim();
    if (!label) return;
    this.addToSlot({ custom_label: label });
  }

  private addToSlot(what: { recipe_id?: string; custom_label?: string }) {
    const plan = this.plan();
    if (!plan) return;
    this.mealPlanService.addEntry(plan.id, {
      ...what,
      day_of_week: this.pickerDow()!,
      meal_slot: this.pickerSlot()!,
    }).subscribe({
      next: (entry) => {
        this.plan.update(p => p ? { ...p, entries: [...p.entries, entry] } : p);
        this.closePicker();
      },
      error: () => this.toast.error('Could not add to the plan'),
    });
  }

  removeEntry(entry: MealPlanEntry) {
    this.mealPlanService.removeEntry(entry.id).subscribe({
      next: () => {
        this.plan.update(p => p ? { ...p, entries: p.entries.filter(e => e.id !== entry.id) } : p);
      },
      error: () => this.toast.error('Could not remove it from the plan'),
    });
  }

  /** Adds every recipe planned this week; the server skips what is already on the list. */
  addAllToGrocery() {
    const plan = this.plan();
    if (!plan || this.groceryBusy()) return;
    if (!plan.entries.some(e => e.recipe_id)) {
      this.toast.show('No recipes are planned for this week yet', { kind: 'info' });
      return;
    }
    this.groceryBusy.set(true);
    this.grocery.addMealPlan(plan.id).subscribe({
      next: (res) => {
        this.groceryBusy.set(false);
        this.toast.success(groceryAddedMessage(res.added, res.skipped));
      },
      error: () => {
        this.groceryBusy.set(false);
        this.toast.error('Could not add to your grocery list');
      },
    });
  }

  slotLabel(slot: MealSlot): string {
    return SLOTS.find(s => s.key === slot)?.label ?? slot;
  }

  dayLabel(dow: number): string {
    const headers = this.dayHeaders();
    return headers[dow] ? `${headers[dow].name} ${headers[dow].date}` : '';
  }
}
