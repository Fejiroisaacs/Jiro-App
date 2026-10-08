import { Component, OnInit, inject, input, signal } from '@angular/core';

import { Router, RouterLink } from '@angular/router';
import { JymService, Routine } from '../../../core/services/jym.service';
import { planText } from '../plan-text';
import { distanceUnit, kindOf } from '../exercise-kind';
import { WorkoutLauncher } from '../shared/workout-launcher';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';

@Component({
  selector: 'app-jym-templates',
  standalone: true,
  imports: [RouterLink, JiroSkeletonComponent, JiroButtonComponent, JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent],
  template: `
    <div class="templates-page">
      @if (!embedded()) {
        <jiro-page-header heading="Templates" subtitle="Workouts to start any time, saved from a workout or a split's day" />
      }

      @if (loading()) {
        <div class="template-list" role="status" aria-label="Loading templates">@for (i of [1, 2, 3]; track i) { <jiro-skeleton height="72px" /> }</div>
      }

      @if (!loading() && templates().length === 0) {
        <jiro-empty-state
          icon="floppy-disk"
          heading="No templates yet"
          message="In a workout, open Workout options and choose Save as template. On a split, a day's menu has Save as template too." />
      }

      @if (!loading() && templates().length > 0) {
<div class="template-list">
        @for (t of templates(); track t) {
<div class="template-card">
          <div class="template-info">
            <a class="template-name" [routerLink]="['/jym/templates', t.id]">{{ t.name }}</a>
            <div class="template-exercises">
              @for (item of t.items; track item; let last = $last) {
<span class="ex-chip">
                {{ item.exercise_name }}
                <span class="ex-sets">{{ planChip(item) }}</span>
                @if (!last) {
<span class="ex-sep"> · </span>
}
              </span>
}
              @if (t.items.length === 0) {
<span class="text-secondary">No exercises</span>
}
            </div>
          </div>
          <div class="template-actions">
            <a class="edit-link" [routerLink]="['/jym/templates', t.id]" [attr.aria-label]="'Edit template ' + t.name">
              <jiro-icon name="pencil-simple" [size]="14" /> Edit
            </a>
            <jiro-button variant="primary" type="button" (click)="startFromTemplate(t)">
              <jiro-icon name="play:fill" [size]="11" />
              Start
            </jiro-button>
            <button class="delete-btn" type="button" title="Delete template" [attr.aria-label]="'Delete template ' + t.name" (click)="deleteTemplate(t)">
              <jiro-icon name="trash" [size]="16" />
            </button>
          </div>
        </div>
}
      </div>
}

    </div>
  `,
  styles: [`
    :host { display: block; }
    .templates-page { max-width: 700px; width: 100%; }



    .template-list { display: flex; flex-direction: column; gap: var(--space-sm); }

    .template-card {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-md); padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
    }

    .template-info { flex: 1; min-width: 0; }
    .template-name {
      display: inline-block; font-weight: 600; font-size: var(--font-size-base); margin-bottom: 4px;
      color: var(--text-primary); text-decoration: none;
    }
    .template-name:hover { text-decoration: underline; }
    .edit-link {
      display: inline-flex; align-items: center; gap: 6px; min-height: 44px; padding: 0 var(--space-md);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      color: var(--text-primary); font-size: var(--font-size-sm); font-weight: 600; text-decoration: none;
    }
    .edit-link:hover { background: var(--bg-surface-hover); }
    .template-exercises {
      font-size: var(--font-size-sm); color: var(--text-secondary);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .ex-chip { display: inline; }
    .ex-sets { font-size: 11px; color: var(--color-primary); margin-left: 3px; }
    .ex-sep { color: var(--border-color); }

    .template-actions { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

    .delete-btn {
      display: flex; align-items: center; justify-content: center;
      width: 44px; height: 44px; border-radius: var(--border-radius-sm);
      border: 1px solid var(--border-color); background: none;
      color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
    }
    .delete-btn:hover { border-color: var(--color-negative); color: var(--color-negative); background: rgba(var(--color-danger-rgb), 0.06); }

    @media (max-width: 600px) {
      .template-card { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
      .template-actions { width: 100%; justify-content: flex-end; }
    }
  `]
})
export class JymTemplatesComponent implements OnInit {
  readonly planText = planText;
  private readonly settings = inject(SettingsService);
  /** The plan chip in the exercise's own terms: reps, a hold or a distance. */
  planChip(x: Parameters<typeof planText>[0] & { exercise_kind?: string | null }): string {
    return planText(x, 'short', { kind: kindOf(x.exercise_kind), distanceUnit: distanceUnit(this.settings.weightUnit()) });
  }
  embedded = input(false);
  templates = signal<Routine[]>([]);
  loading = signal(true);

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  private readonly launcher = inject(WorkoutLauncher);

  constructor(private jymService: JymService, private router: Router) {}

  ngOnInit() {
    this.jymService.listTemplates().subscribe({
      next: t => { this.templates.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  startFromTemplate(t: Routine) {
    this.launcher.start({ routine_id: t.id });
  }

  async deleteTemplate(t: Routine) {
    const ok = await this.confirmService.confirm({
      title: `Delete ${t.name}?`,
      message: 'This removes the template only. Workouts you started from it are not affected.',
      confirmLabel: 'Delete template',
      danger: true,
    });
    if (!ok) return;
    this.jymService.deleteTemplate(t.id).subscribe({
      next: () => {
        this.templates.update(ts => ts.filter(x => x.id !== t.id));
        this.toast.success(`${t.name} deleted`);
      },
      error: () => this.toast.error('Could not delete the template.'),
    });
  }
}
