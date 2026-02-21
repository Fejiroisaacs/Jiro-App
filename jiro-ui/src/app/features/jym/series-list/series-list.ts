import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { JymQuickNavComponent } from '../jym-quick-nav/jym-quick-nav';
import { JymService, SplitSeriesSummary } from '../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-series-list',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent, JymQuickNavComponent],
  template: `
    <div class="series-list">
      <div class="page-header">
        <div>
          <h1>My Series</h1>
          <p class="text-secondary">Structured program runs and progression tracking</p>
        </div>
      </div>

      <!-- Quick nav -->
      <jym-quick-nav></jym-quick-nav>

      <div *ngIf="loading()" class="state-message">
        <div class="spinner-lg"></div>
        <p>Loading series...</p>
      </div>

      <div *ngIf="!loading() && series().length === 0" class="state-message">
        <h3>No series yet</h3>
        <p class="text-secondary">Start a series from a split card on the Jym home page.</p>
        <jiro-button variant="primary" type="button" (click)="goBack()">Go to Jym</jiro-button>
      </div>

      <div *ngIf="!loading() && series().length > 0" class="series-grid">
        <div *ngFor="let sr of series()" class="series-card" (click)="view(sr.id)">
          <div class="card-top">
            <div>
              <div class="split-name">{{ sr.split_name }}</div>
              <h3 class="series-name">{{ sr.name }}</h3>
            </div>
            <span class="status-badge" [class.active]="!sr.ended_at" [class.ended]="!!sr.ended_at">
              {{ sr.ended_at ? 'Ended' : 'Active' }}
            </span>
          </div>

          <div class="card-meta">
            <span class="meta-item">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              Started {{ formatDate(sr.started_at) }}
            </span>
            <span *ngIf="sr.ended_at" class="meta-item">
              Ended {{ formatDate(sr.ended_at) }}
            </span>
          </div>

          <div class="card-footer">
            <span class="sessions-pill" *ngIf="!(sr.duration_type === 'sessions' && sr.target_sessions)">{{ sr.session_count }} sessions</span>
            <span class="duration-pill" *ngIf="sr.duration_type === 'weeks' && sr.target_weeks">
              {{ progressWeeks(sr) }} / {{ sr.target_weeks }} wks
            </span>
            <span class="duration-pill" *ngIf="sr.duration_type === 'sessions' && sr.target_sessions">
              {{ sr.session_count }} / {{ sr.target_sessions }} sessions
            </span>
            <span class="duration-pill open" *ngIf="sr.duration_type === 'open'">Open-ended</span>

            <button class="del-btn" (click)="deleteSeries($event, sr)" title="Delete series">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3,6 5,6 21,6"/>
                <path d="M19,6l-1,14a2,2,0,0,1-2,2H8a2,2,0,0,1-2-2L5,6"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .series-list { max-width: 900px; width: 100%; }

    .page-header {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: var(--space-xl); gap: var(--space-md);
    }

    .page-header h1 { font-size: var(--font-size-2xl); font-weight: 700; }
    .page-header ::ng-deep .jiro-btn { width: auto; flex-shrink: 0; }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
    }
    .state-message ::ng-deep .jiro-btn { width: auto; }
    .empty-icon { font-size: 48px; }

    .spinner-lg {
      width: 40px; height: 40px; border: 3px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .series-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-lg);
    }

    .series-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-lg);
      cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
      display: flex; flex-direction: column; gap: var(--space-md);
      position: relative;
    }

    .series-card:hover { border-color: var(--color-primary); box-shadow: 0 0 0 3px rgba(122,59,46,0.08); }

    .card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-sm); }

    .split-name { font-size: var(--font-size-xs); color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }

    .series-name { font-size: var(--font-size-lg); font-weight: 600; }

    .status-badge {
      font-size: var(--font-size-xs); font-weight: 600; padding: 3px 10px;
      border-radius: 10px; white-space: nowrap; flex-shrink: 0;
    }
    .status-badge.active { background: rgba(76,175,80,0.12); color: #4caf50; }
    .status-badge.ended { background: var(--bg-canvas); color: var(--text-muted); border: 1px solid var(--border-color); }

    .card-meta { display: flex; flex-direction: column; gap: 2px; }

    .meta-item {
      display: flex; align-items: center; gap: var(--space-xs);
      font-size: var(--font-size-xs); color: var(--text-muted);
    }

    .card-footer { display: flex; align-items: center; gap: var(--space-sm); flex-wrap: wrap; }

    .sessions-pill, .duration-pill {
      font-size: var(--font-size-xs); padding: 3px 10px; border-radius: 10px;
      background: rgba(122,59,46,0.1); color: var(--color-primary); font-weight: 500;
    }

    .duration-pill.open { background: var(--bg-canvas); color: var(--text-muted); }

    .del-btn {
      margin-left: auto; background: none; border: none; cursor: pointer;
      color: var(--text-muted); padding: 4px; border-radius: 4px;
      display: inline-flex; align-items: center; transition: all 0.15s;
    }
    .del-btn:hover { color: var(--color-danger); background: rgba(196,74,74,0.1); }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 768px) {
      .del-btn {
        position: absolute;
        top: var(--space-md);
        right: var(--space-md);
        margin-left: 0;
      }

      .card-top { padding-right: 32px; }

      .sessions-pill, .duration-pill {
        font-size: 10px;
        padding: 2px 8px;
      }
    }
  `]
})
export class SeriesListComponent implements OnInit {
  series = signal<SplitSeriesSummary[]>([]);
  loading = signal(true);

  constructor(private jymService: JymService, public router: Router) {}

  ngOnInit() {
    this.jymService.listSeries().subscribe({
      next: s => { this.series.set(s); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  view(id: string) { this.router.navigate(['/jym/series', id]); }

  goBack() { this.router.navigate(['/jym']); }

  deleteSeries(event: Event, sr: SplitSeriesSummary) {
    event.stopPropagation();
    this.jymService.deleteSeries(sr.id).subscribe({
      next: () => this.series.update(list => list.filter(s => s.id !== sr.id)),
    });
  }

  progressWeeks(sr: SplitSeriesSummary): number {
    const days = Math.floor((Date.now() - new Date(sr.started_at).getTime()) / 86400000);
    return Math.floor(days / 7);
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
