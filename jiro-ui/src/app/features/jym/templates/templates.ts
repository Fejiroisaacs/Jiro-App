import { Component, OnInit, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JymService, Routine } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
@Component({
  selector: 'app-jym-templates',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent, JiroModalComponent],
  template: `
    <div class="templates-page">
      @if (!embedded()) {
      <div class="page-header">
        <div>
          <h1>Templates</h1>
          <p class="text-secondary">Reusable workout layouts saved from your sessions</p>
        </div>
      </div>
      }

      <div *ngIf="loading()" class="state-msg">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading() && templates().length === 0" class="empty-state">
        <div class="empty-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
          </svg>
        </div>
        <p class="empty-title">No templates yet</p>
        <p class="text-secondary empty-hint">
          During a session, tap <strong>Save Icon</strong> to save its exercise layout for future workouts.
        </p>
      </div>

      <div *ngIf="!loading() && templates().length > 0" class="template-list">
        <div *ngFor="let t of templates()" class="template-card">
          <div class="template-info">
            <div class="template-name">{{ t.name }}</div>
            <div class="template-exercises">
              <span *ngFor="let item of t.items; let last = last" class="ex-chip">
                {{ item.exercise_name }}
                <span class="ex-sets">{{ item.target_sets }}×{{ item.target_reps }}</span>
                <span *ngIf="!last" class="ex-sep"> · </span>
              </span>
              <span *ngIf="t.items.length === 0" class="text-secondary">No exercises</span>
            </div>
          </div>
          <div class="template-actions">
            <jiro-button variant="primary" type="button" (click)="startFromTemplate(t)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                <polygon points="5,3 19,12 5,21"/>
              </svg>
              Start
            </jiro-button>
            <button class="delete-btn" title="Delete template" (click)="confirmDelete(t)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Delete confirmation modal -->
      <jiro-modal *ngIf="deleting()" title="Delete Template?" maxWidth="400px" (close)="deleting.set(null)">
        <div class="delete-confirm">
          <p>Delete <strong>{{ deleting()!.name }}</strong>?</p>
          <p class="text-secondary" style="font-size: var(--font-size-sm); margin-top: var(--space-xs);">
            This only removes the template — sessions you started from it are not affected.
          </p>
          <div class="form-actions" style="margin-top: var(--space-lg);">
            <jiro-button variant="secondary" type="button" (click)="deleting.set(null)">Cancel</jiro-button>
            <jiro-button variant="danger" type="button" [disabled]="deleteInProgress()" (click)="doDelete()">
              {{ deleteInProgress() ? 'Deleting...' : 'Delete' }}
            </jiro-button>
          </div>
        </div>
      </jiro-modal>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .templates-page { max-width: 700px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-lg); gap: var(--space-md);
    }
    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    .state-msg { color: var(--text-secondary); padding: var(--space-xl) 0; }

    .empty-state {
      text-align: center; padding: var(--space-3xl) var(--space-xl);
      color: var(--text-secondary);
    }
    .empty-icon {
      display: inline-flex; align-items: center; justify-content: center;
      width: 72px; height: 72px; border-radius: 50%;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      margin-bottom: var(--space-lg); color: var(--text-secondary);
    }
    .empty-title { font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary); margin-bottom: var(--space-sm); }
    .empty-hint { font-size: var(--font-size-sm); max-width: 340px; margin: 0 auto; line-height: 1.6; }

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
      width: 32px; height: 32px; border-radius: var(--border-radius-sm);
      border: 1px solid var(--border-color); background: none;
      color: var(--text-secondary); cursor: pointer; transition: all 0.15s;
    }
    .delete-btn:hover { border-color: #e05c5c; color: #e05c5c; background: rgba(224,92,92,0.06); }

    .delete-confirm p { margin: 0; }

    @media (max-width: 600px) {
      .page-header h1 { font-size: var(--font-size-xl); }
      .template-card { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
      .template-actions { width: 100%; justify-content: flex-end; }
    }
  `]
})
export class JymTemplatesComponent implements OnInit {
  embedded = input(false);
  templates = signal<Routine[]>([]);
  loading = signal(true);
  deleting = signal<Routine | null>(null);
  deleteInProgress = signal(false);

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

  confirmDelete(t: Routine) {
    this.deleting.set(t);
  }

  doDelete() {
    const t = this.deleting();
    if (!t) return;
    this.deleteInProgress.set(true);
    this.jymService.deleteTemplate(t.id).subscribe({
      next: () => {
        this.templates.update(ts => ts.filter(x => x.id !== t.id));
        this.deleting.set(null);
        this.deleteInProgress.set(false);
      },
      error: () => this.deleteInProgress.set(false),
    });
  }
}
