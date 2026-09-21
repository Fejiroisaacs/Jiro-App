import { Component, HostListener, OnDestroy, OnInit, ElementRef, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { RecipeService, RecipeWithTrials } from '../../../core/services/recipe.service';
import { ToastService } from '../../../core/services/toast.service';
import { readLocal, writeLocal, removeLocal } from '../../../core/storage';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

interface CookStep {
  text: string;
  done: boolean;
}

interface CookIngredient {
  item: string;
  amount: string;
  checked: boolean;
}

/** The subset of the Screen Wake Lock API we use; it is not in every lib.dom. */
interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

/**
 * Cooking from a recipe, hands busy, phone propped against a bowl.
 *
 * A route rather than an overlay, so the phone's back gesture and a refresh
 * both behave, and a focus screen: the route data hides the module row and the
 * bottom bar so this page's footer owns the bottom of the viewport. Exiting is
 * always the visible button; Escape is a desktop convenience on top of it.
 */
@Component({
  selector: 'app-cook-mode',
  standalone: true,
  imports: [JiroIconComponent, JiroEmptyStateComponent],
  template: `
    <div class="cook">
      <header class="cook-header">
        <h1 class="cook-title" #heading tabindex="-1">{{ recipe()?.title ?? 'Cook mode' }}</h1>
        <button class="cook-exit" type="button" (click)="exit()">
          <jiro-icon name="x" [size]="16" />
          Exit
        </button>
      </header>

      @if (loading()) {
        <div class="cook-loading" aria-busy="true"><span class="spinner"></span></div>
      } @else if (!recipe()) {
        <div class="cook-body">
          <jiro-empty-state
            icon="warning-circle"
            heading="Recipe not found"
            message="It may have been deleted." />
        </div>
      } @else {
        <div class="cook-body">
          @if (ingredients().length) {
            <section class="cook-section">
              <h2 class="cook-section-title">Ingredients</h2>
              <ul class="cook-list">
                @for (ing of ingredients(); track $index) {
                  <li>
                    <button
                      class="cook-row"
                      type="button"
                      role="checkbox"
                      [attr.aria-checked]="ing.checked"
                      [class.cook-row--done]="ing.checked"
                      (click)="toggleIngredient($index)">
                      <span class="cook-box" aria-hidden="true">
                        @if (ing.checked) { <jiro-icon name="check" [size]="14" /> }
                      </span>
                      <span class="cook-item">{{ ing.item }}</span>
                      <span class="cook-amount">{{ ing.amount }}</span>
                    </button>
                  </li>
                }
              </ul>
            </section>
          }

          @if (steps().length) {
            <section class="cook-section">
              <h2 class="cook-section-title">Steps</h2>
              <ol class="cook-list">
                @for (step of steps(); track $index) {
                  <li>
                    <button
                      class="cook-row cook-row--step"
                      type="button"
                      role="checkbox"
                      [attr.aria-checked]="step.done"
                      [class.cook-row--done]="step.done"
                      (click)="toggleStep($index)">
                      <span class="cook-num" aria-hidden="true">{{ $index + 1 }}</span>
                      <span class="cook-text">{{ step.text }}</span>
                      <span class="cook-box" aria-hidden="true">
                        @if (step.done) { <jiro-icon name="check" [size]="14" /> }
                      </span>
                    </button>
                  </li>
                }
              </ol>
            </section>
          }

          @if (!ingredients().length && !steps().length) {
            <jiro-empty-state
              icon="fork-knife"
              heading="Nothing to follow yet"
              message="This recipe has no ingredients or instructions on it. You can still log that you cooked it." />
          }
        </div>

        <footer class="cook-footer">
          <div class="cook-footer-inner">
            <div class="cook-rate">
              <span class="cook-rate-label" id="cook-rate-label">Rate this cook</span>
              <div class="cook-stars" role="group" aria-labelledby="cook-rate-label">
                @for (s of stars; track s) {
                  <button
                    type="button"
                    class="cook-star"
                    [class.cook-star--filled]="s <= rating()"
                    [attr.aria-pressed]="s <= rating()"
                    [attr.aria-label]="s + (s === 1 ? ' star' : ' stars')"
                    (click)="setRating(s)">
                    <jiro-icon [name]="s <= rating() ? 'star:fill' : 'star'" [size]="22" />
                  </button>
                }
              </div>
            </div>
            <textarea
              class="cook-notes"
              rows="1"
              aria-label="Notes about this cook"
              placeholder="Notes (optional)..."
              [value]="notes()"
              (input)="notes.set($any($event.target).value)"></textarea>
            <button class="cook-log" type="button" [disabled]="saving()" (click)="logCook()">
              {{ saving() ? 'Saving...' : 'Log this cook' }}
            </button>
          </div>
        </footer>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }

    .cook {
      display: flex;
      flex-direction: column;
      /* Fills what the shell leaves: no module row and no bottom bar here. */
      min-height: calc(100dvh - var(--topbar-height, 0px));
      margin: calc(-1 * var(--space-xl));
    }

    .cook-header {
      position: sticky;
      top: var(--topbar-height, 0px);
      z-index: var(--z-sticky);
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      padding: var(--space-md) var(--space-xl);
      background: var(--bg-surface);
      border-bottom: 1px solid var(--border-color);
    }

    .cook-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-lg);
      font-weight: 600;
      color: var(--text-primary);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cook-title:focus-visible { outline-offset: 4px; }

    .cook-exit {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
      min-height: 44px;
      padding: 0 var(--space-md);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font: inherit;
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
    }
    .cook-exit:hover { border-color: var(--color-primary); color: var(--color-primary); }

    .cook-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

    .cook-body {
      flex: 1;
      padding: var(--space-lg) var(--space-xl);
      max-width: 720px;
      width: 100%;
      margin: 0 auto;
    }

    .cook-section + .cook-section { margin-top: var(--space-xl); }

    .cook-section-title {
      font-size: var(--font-size-xs);
      text-transform: uppercase;
      letter-spacing: 1px;
      color: var(--text-muted);
      margin-bottom: var(--space-sm);
    }

    .cook-list { list-style: none; margin: 0; padding: 0; }

    .cook-row {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      width: 100%;
      min-height: 52px;
      padding: 12px var(--space-md);
      border: none;
      border-bottom: 1px solid var(--border-color);
      background: none;
      color: var(--text-primary);
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .cook-row:hover { background: var(--bg-surface-hover); }
    .cook-row--done { color: var(--text-muted); }
    .cook-row--done .cook-item,
    .cook-row--done .cook-text { text-decoration: line-through; }

    .cook-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      color: var(--text-on-primary);
    }
    .cook-row--done .cook-box { background: var(--color-accent); border-color: var(--color-accent); }

    .cook-item { flex: 1; min-width: 0; }
    .cook-amount { color: var(--text-secondary); font-size: var(--font-size-sm); white-space: nowrap; }

    .cook-row--step { align-items: flex-start; }

    .cook-num {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--bg-canvas);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 600;
    }
    .cook-text { flex: 1; min-width: 0; line-height: 1.5; }

    /* ── Footer, pinned above the home indicator ── */
    .cook-footer {
      position: sticky;
      bottom: 0;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-color);
      padding: var(--space-md) var(--space-xl);
      padding-bottom: calc(var(--space-md) + env(safe-area-inset-bottom));
    }

    .cook-footer-inner {
      max-width: 720px;
      margin: 0 auto;
      display: flex;
      align-items: flex-end;
      gap: var(--space-md);
      flex-wrap: wrap;
    }

    .cook-rate { display: flex; flex-direction: column; gap: 2px; }
    .cook-rate-label { font-size: var(--font-size-xs); color: var(--text-muted); }
    .cook-stars { display: flex; }

    .cook-star {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border: none;
      background: none;
      color: var(--border-color);
      cursor: pointer;
    }
    .cook-star--filled { color: var(--color-warning); }

    .cook-notes {
      flex: 1;
      min-width: 160px;
      padding: 8px 10px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-canvas);
      color: var(--text-primary);
      font: inherit;
      font-size: var(--font-size-sm);
      resize: none;
    }
    .cook-notes:focus { border-color: var(--color-primary); }

    .cook-log {
      min-height: 44px;
      padding: 0 var(--space-lg);
      border: none;
      border-radius: var(--border-radius);
      background: var(--color-primary);
      color: var(--text-on-primary);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
    }
    .cook-log:disabled { opacity: 0.6; cursor: not-allowed; }

    @media (max-width: 768px) {
      .cook { margin: calc(-1 * var(--space-md)); }
      .cook-header, .cook-body, .cook-footer { padding-left: var(--space-md); padding-right: var(--space-md); }

      /* One column, in reading order: rate, note, then the action. The footer
         is already eating a third of a short screen, so the notes field starts
         collapsed and grows when focused rather than always taking two rows. */
      .cook-footer-inner {
        flex-direction: column;
        align-items: stretch;
        gap: var(--space-sm);
      }
      .cook-rate { flex-direction: row; align-items: center; gap: var(--space-sm); }
      .cook-notes { width: 100%; }
      .cook-log { width: 100%; }
    }
  `]
})
export class CookModeComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly recipeService = inject(RecipeService);
  private readonly toast = inject(ToastService);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly stars = [1, 2, 3, 4, 5];

  recipe = signal<RecipeWithTrials | null>(null);
  loading = signal(true);
  saving = signal(false);
  ingredients = signal<CookIngredient[]>([]);
  steps = signal<CookStep[]>([]);
  rating = signal(0);
  notes = signal('');

  private recipeId = '';
  private wakeLock: WakeLockSentinelLike | null = null;

  ngOnInit() {
    this.recipeId = this.route.snapshot.paramMap.get('id') ?? '';
    this.recipeService.getRecipe(this.recipeId).subscribe({
      next: r => {
        this.recipe.set(r);
        const saved = this.loadChecklistState();
        this.ingredients.set((r.base_ingredients ?? []).map((i, idx) => ({
          item: i.item,
          amount: i.amount,
          checked: saved?.ingredients[idx] ?? false,
        })));
        this.steps.set((r.instructions ?? '')
          .split('\n')
          .map(s => s.trim())
          .filter(s => s.length > 0)
          .map((text, idx) => ({ text, done: saved?.steps[idx] ?? false })));
        this.loading.set(false);
        setTimeout(() => this.heading()?.nativeElement.focus(), 0);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Could not open that recipe.');
      },
    });

    void this.requestWakeLock();
    document.addEventListener('visibilitychange', this.onVisibilityChange);
  }

  ngOnDestroy() {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    void this.releaseWakeLock();
  }

  /**
   * Keep the screen on while cooking. Absent in Firefox, rejected outright on
   * low battery, and iOS only has it from Safari 16.4, so every path is
   * swallowed: no wake lock is a worse cook, not a broken page.
   */
  private async requestWakeLock() {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    try {
      this.wakeLock = await nav.wakeLock.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }

  private async releaseWakeLock() {
    try {
      await this.wakeLock?.release();
    } catch {
      /* already gone */
    }
    this.wakeLock = null;
  }

  /** Browsers drop the sentinel whenever the tab hides, so ask again on return. */
  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && !this.wakeLock) {
      void this.requestWakeLock();
    }
  };

  /** Desktop convenience. On a phone, the Exit button is the way out. */
  @HostListener('document:keydown.escape')
  onEscape() {
    this.exit();
  }

  toggleIngredient(index: number) {
    this.ingredients.update(list =>
      list.map((ing, i) => i === index ? { ...ing, checked: !ing.checked } : ing)
    );
    this.saveChecklistState();
  }

  toggleStep(index: number) {
    this.steps.update(list =>
      list.map((s, i) => i === index ? { ...s, done: !s.done } : s)
    );
    this.saveChecklistState();
  }

  private checklistKey(): string {
    return `jiro_cook_checklist_${this.recipeId}`;
  }

  /** Indexed against the current recipe, not stored ingredient/step text: an
   *  edited recipe simply gets a length mismatch below and starts unchecked. */
  private loadChecklistState(): { ingredients: boolean[]; steps: boolean[] } | null {
    const raw = readLocal(this.checklistKey());
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed?.ingredients) && Array.isArray(parsed?.steps)) return parsed;
    } catch {
      /* corrupt or stale — ignore */
    }
    return null;
  }

  private saveChecklistState() {
    writeLocal(this.checklistKey(), JSON.stringify({
      ingredients: this.ingredients().map(i => i.checked),
      steps: this.steps().map(s => s.done),
    }));
  }

  private clearChecklistState() {
    removeLocal(this.checklistKey());
  }

  setRating(value: number) {
    this.rating.set(value === this.rating() ? 0 : value);
  }

  exit() {
    this.router.navigate(['/culinara', this.recipeId]);
  }

  logCook() {
    this.saving.set(true);
    this.recipeService.createTrial(this.recipeId, {
      date_cooked: new Date().toISOString(),
      notes: this.notes().trim() || undefined,
      rating: this.rating() > 0 ? this.rating() : undefined,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.clearChecklistState();
        this.toast.success('Cook logged');
        this.router.navigate(['/culinara', this.recipeId]);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Could not log this cook.');
      },
    });
  }
}
