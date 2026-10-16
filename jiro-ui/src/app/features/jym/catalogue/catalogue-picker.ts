import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CatalogueExercise, Exercise, JymService } from '../../../core/services/jym.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { kindOf, kindTag } from '../exercise-kind';
import { EQUIPMENT, groupCatalogue } from './catalogue';

/**
 * The exercise catalogue (J20): pick what you do, grouped by main muscle, and add it in one go. Nothing reaches the
 * library unless it's ticked; exercises already there show as such.
 *
 *   <jym-catalogue-picker (added)="..." />                       in a sheet
 *   <jym-catalogue-picker mode="inline" (added)="..." (skip)="..." />  an empty library
 */
@Component({
  selector: 'jym-catalogue-picker',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroSkeletonComponent],
  template: `
    <div class="cat" [class.cat--inline]="mode() === 'inline'">
      <div class="cat-top">
        <input class="cat-search" type="search" placeholder="Search exercises or muscles" aria-label="Search the catalogue"
          [ngModel]="search()" (ngModelChange)="search.set($event)" />
        <div class="cat-chips" role="group" aria-label="Equipment">
          <button type="button" class="cat-chip" [class.active]="!equipment()" [attr.aria-pressed]="!equipment()" (click)="equipment.set('')">All</button>
          @for (e of equipmentList; track e) {
            <button type="button" class="cat-chip" [class.active]="equipment() === e" [attr.aria-pressed]="equipment() === e" (click)="equipment.set(e)">{{ e }}</button>
          }
        </div>
      </div>

      @if (loading()) {
        <div aria-busy="true" aria-label="Loading the catalogue"><jiro-skeleton [lines]="6" height="48px" /></div>
      } @else if (loadError()) {
        <p class="cat-note" role="alert">Could not load the catalogue. <button type="button" class="cat-retry" (click)="load()">Try again</button></p>
      } @else {
        @for (g of groups(); track g.muscle) {
          <details class="cat-group" [open]="filtering()">
            <summary class="cat-muscle">
              <span>{{ g.muscle }}</span>
              <span class="cat-count">{{ pickedIn(g.items) ? pickedIn(g.items) + ' picked' : g.items.length }}</span>
            </summary>
            <ul class="cat-list">
              @for (e of g.items; track e.key) {
                <li>
                  <label class="cat-row" [class.cat-row--owned]="e.in_library">
                    <input type="checkbox" [checked]="e.in_library || picked().has(e.key)" [disabled]="e.in_library || adding()"
                      (change)="toggle(e.key)" />
                    <span class="cat-main">
                      <span class="cat-name">{{ e.name }}</span>
                      <span class="cat-meta">{{ meta(e) }}</span>
                    </span>
                    @if (e.in_library) { <span class="cat-owned">In your library</span> }
                    @else if (tag(e); as t) { <span class="cat-kind">{{ t }}</span> }
                  </label>
                </li>
              }
            </ul>
          </details>
        } @empty {
          <p class="cat-note">No exercises match. Try another name, or another chip.</p>
        }
      }

      <div class="cat-foot">
        @if (mode() === 'inline') {
          <button type="button" class="cat-skip" (click)="skip.emit()">Skip for now</button>
        }
        <jiro-button type="button" [disabled]="!picked().size" [loading]="adding()" (click)="add()">
          {{ picked().size ? 'Add ' + picked().size + (picked().size === 1 ? ' exercise' : ' exercises') : 'Add exercises' }}
        </jiro-button>
      </div>
    </div>
  `,
  styles: [`
    .cat { display: flex; flex-direction: column; gap: var(--space-md); }
    .cat-top { display: flex; flex-direction: column; gap: var(--space-sm); }
    .cat-search {
      width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary); font: inherit;
    }
    .cat-search:focus { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(var(--color-primary-rgb), 0.15); outline: none; }
    .cat-chips { display: flex; gap: var(--space-xs); overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
    .cat-chips::-webkit-scrollbar { display: none; }
    .cat-chip {
      flex-shrink: 0; min-height: 44px; padding: 0 14px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius-pill);
      background: transparent; color: var(--text-secondary);
      font: inherit; font-size: var(--font-size-sm); font-weight: 500; cursor: pointer;
    }
    .cat-chip:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .cat-chip.active { background: var(--color-primary); border-color: var(--color-primary); color: var(--text-on-primary); }

    .cat-group { border-bottom: 1px solid var(--border-color); }
    .cat-muscle {
      display: flex; align-items: center; justify-content: space-between; gap: var(--space-sm);
      min-height: 48px; cursor: pointer; list-style: none;
      font-family: var(--font-family-display); font-size: var(--font-size-lg); letter-spacing: -0.02em; color: var(--text-primary);
    }
    .cat-muscle::-webkit-details-marker { display: none; }
    .cat-muscle::after { content: '+'; font-family: var(--font-family); color: var(--text-secondary); font-size: var(--font-size-lg); }
    .cat-group[open] > .cat-muscle::after { content: '−'; }
    .cat-count { margin-left: auto; font-family: var(--font-family); font-size: var(--font-size-sm); letter-spacing: 0; color: var(--text-secondary); }

    .cat-list { list-style: none; margin: 0 0 var(--space-sm); padding: 0; }
    .cat-row {
      display: flex; align-items: center; gap: var(--space-md);
      min-height: 52px; padding: 6px var(--space-xs); border-radius: var(--border-radius);
      cursor: pointer;
    }
    .cat-row:hover { background: rgba(var(--color-primary-rgb), 0.05); }
    .cat-row input { width: 20px; height: 20px; flex-shrink: 0; accent-color: var(--color-primary); cursor: pointer; }
    .cat-row--owned { cursor: default; }
    .cat-row--owned:hover { background: none; }
    .cat-main { display: flex; flex-direction: column; min-width: 0; flex: 1; }
    .cat-name { color: var(--text-primary); font-weight: 500; }
    .cat-meta { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .cat-owned, .cat-kind { flex-shrink: 0; font-size: var(--font-size-xs); color: var(--text-secondary); }
    .cat-kind { padding: 2px 8px; border: 1px solid var(--border-color); border-radius: var(--border-radius-pill); }

    .cat-note { color: var(--text-secondary); font-size: var(--font-size-sm); }
    .cat-retry { background: none; border: none; color: var(--color-primary); font: inherit; font-weight: 600; cursor: pointer; min-height: 44px; }

    .cat-foot {
      position: sticky; bottom: 0; z-index: 1;
      display: flex; align-items: center; justify-content: flex-end; gap: var(--space-sm);
      padding: var(--space-md) 0; background: var(--bg-canvas); border-top: 1px solid var(--border-color);
    }
    .cat--inline .cat-foot { background: var(--bg-page); }
    .cat-skip {
      min-height: 44px; padding: 0 var(--space-sm); margin-right: auto;
      background: none; border: none; color: var(--text-secondary); font: inherit; font-weight: 600; cursor: pointer;
    }
    .cat-skip:hover { color: var(--text-primary); }
    /* On a phone the page's bottom bar is fixed over the last 60 px: the inline footer sits above it. */
    @media (max-width: 768px) {
      .cat--inline .cat-foot { bottom: calc(60px + env(safe-area-inset-bottom)); }
    }
  `],
})
export class CataloguePickerComponent implements OnInit {
  private readonly jym = inject(JymService);
  private readonly toast = inject(ToastService);

  readonly mode = input<'sheet' | 'inline'>('sheet');
  /** The exercises just copied into the library. */
  readonly added = output<Exercise[]>();
  readonly skip = output<void>();

  readonly equipmentList = EQUIPMENT;
  readonly catalogue = signal<CatalogueExercise[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal(false);
  readonly adding = signal(false);
  readonly search = signal('');
  readonly equipment = signal('');
  readonly picked = signal(new Set<string>());

  readonly groups = computed(() => groupCatalogue(this.catalogue(), { search: this.search(), equipment: this.equipment() }));
  /** A search or a chip opens every section; otherwise they start closed. */
  readonly filtering = computed(() => !!this.search().trim() || !!this.equipment());

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.loadError.set(false);
    this.jym.getCatalogue().subscribe({
      next: list => { this.catalogue.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.loadError.set(true); },
    });
  }

  toggle(key: string) {
    this.picked.update(s => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  pickedIn(items: CatalogueExercise[]): number {
    const p = this.picked();
    return items.filter(e => p.has(e.key)).length;
  }

  meta(e: CatalogueExercise): string {
    return [e.equipment, ...(e.secondary_muscles.length ? [e.secondary_muscles.join(', ')] : [])].join(' · ');
  }

  tag(e: CatalogueExercise): string | null {
    return kindTag(kindOf(e.kind));
  }

  add() {
    const keys = [...this.picked()];
    if (!keys.length) return;
    this.adding.set(true);
    this.jym.addFromCatalogue(keys).subscribe({
      next: res => {
        this.adding.set(false);
        this.picked.set(new Set());
        const n = res.added.length;
        this.toast.success(n ? `Added ${n} exercise${n === 1 ? '' : 's'}` : 'Those are already in your library');
        this.added.emit(res.added);
      },
      error: () => { this.adding.set(false); this.toast.error('Could not add those exercises.'); },
    });
  }
}
