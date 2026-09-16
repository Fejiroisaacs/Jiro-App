import { Component, OnInit, inject, input, signal } from '@angular/core';

import { Router } from '@angular/router';
import { JymService, Routine } from '../../../core/services/jym.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroPageHeaderComponent } from '../../../shared/components/jiro-page-header/jiro-page-header';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

@Component({
  selector: 'app-jym-templates',
  standalone: true,
  imports: [JiroButtonComponent, JiroIconComponent, JiroPageHeaderComponent, JiroEmptyStateComponent],
  template: `
    <div class="templates-page">
      @if (!embedded()) {
        <jiro-page-header heading="Templates" subtitle="Reusable workout layouts saved from your sessions" />
      }

      @if (loading()) {
        <div class="state-loading" aria-busy="true"><span class="spinner"></span></div>
      }

      @if (!loading() && templates().length === 0) {
        <jiro-empty-state
          icon="floppy-disk"
          heading="No templates yet"
          message="During a session, use Save as template to keep its exercise layout for next time." />
      }

      @if (!loading() && templates().length > 0) {
<div class="template-list">
        @for (t of templates(); track t) {
<div class="template-card">
          <div class="template-info">
            <div class="template-name">{{ t.name }}</div>
            <div class="template-exercises">
              @for (item of t.items; track item; let last = $last) {
<span class="ex-chip">
                {{ item.exercise_name }}
                <span class="ex-sets">{{ item.target_sets }}×{{ item.target_reps }}</span>
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
            <jiro-button variant="primary" type="button" (click)="startFromTemplate(t)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
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

    .state-loading { display: flex; justify-content: center; padding: var(--space-2xl); }

    .template-list { display: flex; flex-direction: column; gap: var(--space-sm); }

    .template-card {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-md); padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius-md);
    }

    .template-info { flex: 1; min-width: 0; }
    .template-name { font-weight: 600; font-size: var(--font-size-base); margin-bottom: 4px; }
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
      width: 40px; height: 40px; border-radius: var(--border-radius-sm);
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
  embedded = input(false);
  templates = signal<Routine[]>([]);
  loading = signal(true);

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  constructor(private jymService: JymService, private router: Router) {}

  ngOnInit() {
    this.jymService.listTemplates().subscribe({
      next: t => { this.templates.set(t); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  startFromTemplate(t: Routine) {
    this.jymService.startSession({ routine_id: t.id }).subscribe({
      next: s => this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } }),
    });
  }

  async deleteTemplate(t: Routine) {
    const ok = await this.confirmService.confirm({
      title: `Delete ${t.name}?`,
      message: 'This removes the template only. Sessions you started from it are not affected.',
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
