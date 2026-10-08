import { Component, OnInit, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

import { ActivatedRoute, Router } from '@angular/router';
import { JymService, PublicSplitDetail } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { planText } from '../plan-text';
import { distanceUnit, kindOf } from '../exercise-kind';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';

@Component({
  selector: 'app-discover-detail',
  standalone: true,
  imports: [JiroSkeletonComponent, JiroButtonComponent, JiroIconComponent, JiroEmptyStateComponent, JiroPageHeaderComponent],
  template: `
    <div class="discover-detail">
      <!-- Loading -->
      @if (loading()) {
        <div class="state-loading" role="status" aria-label="Loading split"><jiro-skeleton width="40%" height="32px" /><jiro-skeleton width="25%" height="14px" /><div class="routines-grid">@for (i of [1, 2, 3]; track i) { <jiro-skeleton height="200px" /> }</div></div>
      }

      <!-- Error -->
      @if (!loading() && error()) {
        <jiro-empty-state
          icon="warning-circle"
          heading="Split not found"
          message="This split may be private, or it no longer exists.">
          <jiro-button variant="secondary" type="button" (click)="router.navigate(['/jym/discover'])">
            Back to Discover
          </jiro-button>
        </jiro-empty-state>
      }

      <!-- Content -->
      @if (!loading() && split()) {
<div>
        <!-- Header -->
        <jiro-page-header [heading]="split()!.split_name" backLink="/jym/discover" backLabel="Discover">
          <jiro-button actions type="button" [disabled]="imported()" [loading]="importing()" (click)="importSplit()">
            @if (imported()) {
              <jiro-icon name="check" [size]="14" />
            } @else {
              <jiro-icon name="plus" [size]="14" />
            }
            {{ imported() ? 'Added' : 'Add to my splits' }}
          </jiro-button>
        </jiro-page-header>
        @if (split()!.tags.length) {
          <div class="tag-row">
            @for (tag of split()!.tags; track tag) {
              <span class="tag-chip">{{ tag }}</span>
            }
          </div>
        }

        <!-- Success banner -->
        @if (imported()) {
<div class="import-banner">
          <jiro-icon name="check-circle" [size]="15" />
          It's in your splits.
          <button class="goto-btn" type="button" (click)="router.navigate(['/jym/splits', newSplitId])">Open it</button>
        </div>
}

        <!-- Routines -->
        <div class="routines-grid">
          @for (routine of split()!.routines; track routine) {
<div class="routine-card">
            <div class="routine-header">
              <span class="day-chip">Day {{ routine.day_order }}</span>
              <span class="routine-name">{{ routine.name }}</span>
            </div>
            <div class="exercise-list">
              @for (ex of routine.exercises; track ex) {
<div class="exercise-row">
                <div class="ex-info">
                  <span class="ex-name">{{ ex.name }}</span>
                  @if (ex.muscle_group) {
<span class="ex-muscle text-secondary">{{ ex.muscle_group }}</span>
}
                </div>
                <span class="ex-sets">{{ planChip(ex) }}</span>
              </div>
}
              @if (routine.exercises.length === 0) {
<div class="no-exercises text-secondary">
                No exercises listed
              </div>
}
            </div>
          </div>
}
        </div>

        <!-- Empty routines -->
        @if (split()!.routines.length === 0) {
          <jiro-empty-state compact heading="No days yet" message="Whoever shared this split has not added days to it." />
        }
      </div>
}
    </div>
  `,
  styles: [`
    :host { display: block; }

    .discover-detail { max-width: 900px; width: 100%; }

    .state-loading { display: flex; flex-direction: column; gap: var(--space-md); }

    .tag-row { display: flex; flex-wrap: wrap; gap: 4px; margin: calc(-1 * var(--space-md)) 0 var(--space-lg); }

    .tag-chip {
      font-size: 11px; font-weight: 500;
      padding: 2px 8px; border-radius: var(--border-radius-pill);
      background: rgba(var(--color-primary-rgb), 0.08); color: var(--color-primary);
      border: 1px solid rgba(var(--color-primary-rgb), 0.18);
    }

    .import-banner {
      display: flex; align-items: center; gap: var(--space-sm);
      background: rgba(var(--color-accent-rgb), 0.08); border: 1px solid rgba(var(--color-accent-rgb), 0.3);
      border-radius: var(--border-radius); padding: var(--space-sm) var(--space-md);
      margin-bottom: var(--space-lg); color: var(--color-positive); font-size: var(--font-size-sm);
    }

    .goto-btn {
      background: none; border: none; color: var(--color-positive); font-weight: 600;
      text-decoration: underline; cursor: pointer; font-size: var(--font-size-sm);
      min-height: 44px; padding: 0 var(--space-xs); margin-left: auto;
    }

    .routines-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
      gap: var(--space-lg);
    }

    .routine-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .routine-header {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-md); border-bottom: 1px solid var(--border-color);
      background: var(--bg-canvas);
    }

    .day-chip {
      background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary-text);
      font-size: var(--font-size-xs); font-weight: 600;
      padding: 2px 8px; border-radius: var(--border-radius-pill); white-space: nowrap;
    }

    .routine-name { font-weight: 600; font-size: var(--font-size-sm); }

    .exercise-list { padding: var(--space-sm); display: flex; flex-direction: column; gap: 2px; }

    .exercise-row {
      display: flex; align-items: center; justify-content: space-between;
      padding: var(--space-xs) var(--space-sm);
      border-radius: var(--border-radius-sm); transition: background 0.1s;
    }

    .exercise-row:hover { background: var(--bg-canvas); }

    .ex-info { display: flex; flex-direction: column; gap: 1px; }

    .ex-name { font-size: var(--font-size-sm); font-weight: 500; }

    .ex-muscle { font-size: var(--font-size-xs); }

    .ex-sets {
      font-size: var(--font-size-xs); font-weight: 600;
      color: var(--color-primary-text); background: rgba(var(--color-primary-rgb), 0.1);
      padding: 2px 8px; border-radius: var(--border-radius-pill); white-space: nowrap;
    }

    .no-exercises {
      font-size: var(--font-size-sm); padding: var(--space-sm) var(--space-md);
      text-align: center;
    }

  `]
})
export class DiscoverDetailComponent implements OnInit {
  readonly planText = planText;
  private readonly settings = inject(SettingsService);
  /** The plan chip in the exercise's own terms: reps, a hold or a distance. */
  planChip(x: Parameters<typeof planText>[0] & { kind?: string | null }): string {
    return planText(x, 'short', { kind: kindOf(x.kind), distanceUnit: distanceUnit(this.settings.weightUnit()) });
  }
  split = signal<PublicSplitDetail | null>(null);
  loading = signal(true);
  error = signal(false);
  importing = signal(false);
  imported = signal(false);

  private splitId = '';
  /** Your copy; importing again returns the same one. */
  newSplitId = '';

  private readonly toast = inject(ToastService);

  constructor(
    private jymService: JymService,
    private route: ActivatedRoute,
    public router: Router,
  ) { }

  ngOnInit() {
    this.splitId = this.route.snapshot.paramMap.get('id') || '';
    this.jymService.getPublicSplit(this.splitId).subscribe({
      next: s => { this.split.set(s); this.loading.set(false); },
      error: () => { this.error.set(true); this.loading.set(false); },
    });
  }

  importSplit() {
    if (this.imported()) return;
    this.importing.set(true);
    this.jymService.importPublicSplit(this.splitId).subscribe({
      next: res => { this.newSplitId = res.split_id; this.importing.set(false); this.imported.set(true); },
      error: () => {
        this.importing.set(false);
        this.toast.error('Could not add this split. Try again.');
      },
    });
  }
}
