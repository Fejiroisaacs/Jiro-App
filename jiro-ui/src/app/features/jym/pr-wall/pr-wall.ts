import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';
import { JymService, ExercisePR } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';

@Component({
  selector: 'app-pr-wall',
  standalone: true,
  imports: [CommonModule, JymQuickNavComponent],
  template: `
    <div class="pr-wall">
      <div class="page-header">
        <div>
          <h1>PR Wall</h1>
          <p class="text-secondary">Your best lifts, all in one place</p>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading personal records...</p>
      </div>

      <!-- Empty state -->
      <div *ngIf="!loading() && prs().length === 0" class="state-message">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="color:var(--text-muted)">
          <circle cx="12" cy="8" r="6"/><path d="M8 14l-2 8 6-3 6 3-2-8"/>
        </svg>
        <h3>No personal records yet</h3>
        <p class="text-secondary">Log some sets and your PRs will appear here automatically.</p>
      </div>

      <!-- PR groups by muscle group -->
      <div *ngIf="!loading() && prs().length > 0">
        <!-- Summary strip -->
        <div class="summary-strip">
          <div class="summary-item">
            <span class="summary-num">{{ prs().length }}</span>
            <span class="summary-label">Exercises</span>
          </div>
          <div class="summary-item">
            <span class="summary-num">{{ muscleGroupCount() }}</span>
            <span class="summary-label">Muscle Groups</span>
          </div>
          <div class="summary-item">
            <span class="summary-num">{{ topEst1RM() | number:'1.1-1' }}</span>
            <span class="summary-label">Top Est. 1RM ({{ settingsService.unitLabel() }})</span>
          </div>
        </div>

        <!-- Groups -->
        <div *ngFor="let group of groupedPRs()" class="mg-group">
          <div class="mg-header">
            <span class="mg-label">{{ group.mg }}</span>
            <span class="mg-count">{{ group.prs.length }}</span>
          </div>

          <div class="pr-table">
            <div class="pr-header-row">
              <span class="col-exercise">Exercise</span>
              <span class="col-lift">Best Lift</span>
              <span class="col-1rm">Est. 1RM</span>
              <span class="col-date">Date</span>
            </div>

            <div *ngFor="let pr of group.prs" class="pr-row"
              (click)="router.navigate(['/jym/exercises', pr.exercise_id])">
              <span class="col-exercise ex-name">
                <span class="trophy">🏆</span>
                {{ pr.name }}
              </span>
              <span class="col-lift lift-val">
                {{ settingsService.toDisplay(pr.weight) | number:'1.1-1' }}
                <span class="unit">{{ settingsService.unitLabel() }}</span>
                × {{ pr.reps }}
              </span>
              <span class="col-1rm orm-val">
                {{ settingsService.toDisplay(pr.est_1rm) | number:'1.1-1' }}
                <span class="unit">{{ settingsService.unitLabel() }}</span>
              </span>
              <span class="col-date date-val">{{ formatDate(pr.date) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .pr-wall { max-width: 900px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }

    /* Summary strip */
    .summary-strip {
      display: flex; gap: var(--space-lg);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
      margin-bottom: var(--space-xl);
    }

    .summary-item { display: flex; flex-direction: column; gap: 2px; }

    .summary-num { font-size: var(--font-size-xl); font-weight: 700; color: var(--color-primary); }

    .summary-label { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }

    /* Muscle group sections */
    .mg-group { margin-bottom: var(--space-xl); }

    .mg-header {
      display: flex; align-items: center; gap: var(--space-sm);
      margin-bottom: var(--space-sm);
    }

    .mg-label { font-size: var(--font-size-sm); font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }

    .mg-count {
      font-size: var(--font-size-xs); padding: 1px 7px; border-radius: 10px;
      background: rgba(122,59,46,0.1); color: var(--color-primary); font-weight: 500;
    }

    /* PR table */
    .pr-table {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .pr-header-row {
      display: grid;
      grid-template-columns: 1fr 160px 140px 100px;
      padding: var(--space-xs) var(--space-md);
      background: var(--bg-canvas);
      border-bottom: 1px solid var(--border-color);
    }

    .pr-header-row span {
      font-size: var(--font-size-xs); text-transform: uppercase;
      letter-spacing: 0.5px; color: var(--text-muted); font-weight: 500;
    }

    .pr-row {
      display: grid;
      grid-template-columns: 1fr 160px 140px 100px;
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid var(--border-color);
      align-items: center; cursor: pointer;
      transition: background 0.15s;
    }

    .pr-row:last-child { border-bottom: none; }

    .pr-row:hover { background: rgba(122,59,46,0.04); }

    .ex-name {
      font-size: var(--font-size-sm); font-weight: 500;
      color: var(--color-primary); display: flex; align-items: center; gap: var(--space-xs);
    }

    .trophy { font-size: 14px; flex-shrink: 0; }

    .lift-val { font-size: var(--font-size-sm); font-weight: 600; }

    .orm-val { font-size: var(--font-size-sm); color: var(--text-secondary); }

    .date-val { font-size: var(--font-size-xs); color: var(--text-muted); }

    .unit { font-size: var(--font-size-xs); color: var(--text-muted); font-weight: 400; }

    /* States */
    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
    }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* Mobile */
    @media (max-width: 600px) {
      .pr-header-row, .pr-row {
        grid-template-columns: 1fr 120px 100px;
      }
      .col-date, .date-val { display: none; }
      .summary-strip { flex-wrap: wrap; gap: var(--space-md); }
    }
  `]
})
export class PrWallComponent implements OnInit {
  loading = signal(true);
  prs = signal<ExercisePR[]>([]);

  groupedPRs = computed(() => {
    const groups = new Map<string, ExercisePR[]>();
    for (const pr of this.prs()) {
      const mg = pr.muscle_group || 'Other';
      if (!groups.has(mg)) groups.set(mg, []);
      groups.get(mg)!.push(pr);
    }
    return Array.from(groups.entries())
      .map(([mg, prs]) => ({ mg, prs: [...prs].sort((a, b) => b.est_1rm - a.est_1rm) }))
      .sort((a, b) => a.mg.localeCompare(b.mg));
  });

  muscleGroupCount = computed(() => {
    const mgs = new Set(this.prs().map(p => p.muscle_group || 'Other'));
    return mgs.size;
  });

  topEst1RM = computed(() => {
    if (this.prs().length === 0) return 0;
    return this.settingsService.toDisplay(Math.max(...this.prs().map(p => p.est_1rm)));
  });

  constructor(
    public router: Router,
    private jymService: JymService,
    public settingsService: SettingsService,
  ) {}

  ngOnInit() {
    this.jymService.getPRs().subscribe({
      next: prs => { this.prs.set(prs); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
