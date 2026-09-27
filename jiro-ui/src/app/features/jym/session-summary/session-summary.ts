import { Component, OnInit, ViewChild, ElementRef, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { JymService } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { dayKey } from '../../../core/utils/day';
import { muscleColor } from '../shared/muscle-colors';

interface SummaryState {
  sessionId: string;
  durationSeconds: number;
  sessionType: string;
  weightUnit: string;
  routineName: string | null;
  blocks: {
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string | null;
    sets: {
      weight: number;
      reps: number;
      saved: boolean;
      isPR: boolean;
      isWarmup: boolean;
    }[];
  }[];
}

interface LiftHighlight {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  weight: number;
  reps: number;
  est1RM: number;
  isPR: boolean;
  previousBest?: { weight: number; reps: number; est1RM: number };
}

/** Mirrors the backend's epley1RM exactly (services/jym.go) — this side only
 *  ever has to rate the just-finished session's own sets locally; the
 *  previous session's number always comes pre-computed from the API. */
function epley1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

interface MuscleGroupData {
  group: string;
  volume: number;
  percentage: number;
  color: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';

@Component({
  selector: 'app-session-summary',
  standalone: true,
  imports: [JiroIconComponent, CommonModule, RouterLink, JymPrBadgeComponent],
  template: `
    <div class="page">

      <div class="hero">
        <div class="hero-content">
          <span class="trophy-ring"><jiro-icon name="trophy" [size]="48" /></span>
          <h1 class="hero-title">Workout complete</h1>
          @if (sessionType() !== 'normal') {
            <span class="type-pill">{{ sessionType() === 'deload' ? 'Deload' : 'Test' }} session</span>
          }
        </div>
      </div>

      @if (prCount() > 0) {
        <p class="pr-line">
          <jym-pr-badge size="md" />
          {{ prCount() }} new personal record{{ prCount() === 1 ? '' : 's' }}
        </p>
      }

      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-value">{{ durationStr() }}</div>
          <div class="stat-label">Duration</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalVolume() }}</div>
          <div class="stat-label">Volume</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ totalSets() }}</div>
          <div class="stat-label">Work sets</div>
        </div>
      </div>

      @if (muscleGroups().length > 0) {
        <section class="section">
          <h2 class="section-label">Muscle groups</h2>
          @for (mg of muscleGroups(); track mg.group) {
            <div class="mg-row">
              <span class="mg-name">{{ mg.group }}</span>
              <div class="mg-track">
                <div class="mg-fill" [style.width.%]="mg.percentage" [style.background]="mg.color"></div>
              </div>
              <span class="mg-pct">{{ mg.percentage | number:'1.0-0' }}%</span>
            </div>
          }
        </section>
      }

      @if (liftHighlights().length > 0) {
        <section class="section">
          <h2 class="section-label">Session highlights</h2>
          @for (lift of liftHighlights(); track lift.exerciseId) {
            <div class="lift-card">
              <div class="lift-meta">
                <span class="lift-name">{{ lift.exerciseName }}</span>
                @if (lift.muscleGroup) {
                  <span class="lift-muscle">{{ lift.muscleGroup }}</span>
                }
              </div>
              <div class="lift-aside">
                <div class="lift-current">
                  @if (lift.isPR) {
                    <jym-pr-badge />
                  } @else {
                    <span class="best-tag">Best</span>
                  }
                  <span class="lift-weight">{{ lift.weight | number:'1.0-1' }} × {{ lift.reps }}</span>
                </div>
                @if (lift.previousBest; as prev) {
                  <div class="lift-previous">
                    Last time {{ prev.weight | number:'1.0-1' }} × {{ prev.reps }}
                    @if (est1RMDelta(lift); as d) {
                      <span class="delta" [class.delta-up]="d.direction === 'up'" [class.delta-down]="d.direction === 'down'">
                        {{ d.direction === 'up' ? '↑' : d.direction === 'down' ? '↓' : '' }}{{ d.pct > 0 ? d.pct + '%' : '' }}
                      </span>
                    }
                  </div>
                }
              </div>
            </div>
          }
        </section>
      }

      @if (liftHighlights().length === 0) {
        <section class="section">
          <p class="empty-note">No sets were logged this session.</p>
        </section>
      }

      <div class="action-row">
        <button class="btn-share" (click)="shareWorkout()" [disabled]="sharing()">
          @if (sharing()) {
            <span class="spinner" aria-hidden="true"></span>
          } @else {
            <jiro-icon name="share-network" [size]="16" />
          }
          {{ sharing() ? 'Sharing...' : 'Share workout' }}
        </button>
        <button class="btn-done" (click)="done()">Done</button>
      </div>
      @if (sessionDay()) {
        <p class="day-link-row"><a class="day-link" [routerLink]="['/day', sessionDay()]">See this day</a></p>
      }

    </div>

    <!-- Share card, 375 x 667, exported with html-to-image; styles use tokens, resolved via computed style at capture. -->
    <div #shareCard class="sc" aria-hidden="true">
      <div class="sc-hdr">
        <span class="sc-logo">Jym</span>
        <jiro-icon class="sc-trophy" name="trophy" [size]="48" />
        <p class="sc-title">Workout complete</p>
      </div>

      <div class="sc-stats">
        <div class="sc-stat">
          <div class="sc-sv">{{ durationStr() }}</div>
          <div class="sc-sl">Duration</div>
        </div>
        <div class="sc-div"></div>
        <div class="sc-stat">
          <div class="sc-sv">{{ totalVolume() }}</div>
          <div class="sc-sl">Volume</div>
        </div>
        <div class="sc-div"></div>
        <div class="sc-stat">
          <div class="sc-sv">{{ totalSets() }}</div>
          <div class="sc-sl">Work sets</div>
        </div>
      </div>

      <div class="sc-body">
        @if (topLifts().length > 0) {
          <div class="sc-lifts">
            <div class="sc-slabel">Top lifts</div>
            @for (lift of topLifts(); track lift.exerciseId; let i = $index) {
              <div class="sc-lift">
                <span class="sc-rank">{{ i + 1 }}</span>
                <span class="sc-lname">{{ lift.exerciseName }}</span>
                @if (lift.isPR) {
                  <span class="sc-pr">PR</span>
                }
                <span class="sc-lw">{{ lift.weight | number:'1.0-1' }} × {{ lift.reps }}</span>
              </div>
            }
          </div>
        }

        @if (muscleGroups().length > 0) {
          <div class="sc-muscles">
            <div class="sc-slabel">Muscle groups</div>
            @for (mg of muscleGroups(); track mg.group) {
              <div class="sc-mg">
                <span class="sc-mg-name">{{ mg.group }}</span>
                <div class="sc-mg-track">
                  <div class="sc-mg-fill" [style.width.%]="mg.percentage" [style.background]="mg.color"></div>
                </div>
                <span class="sc-mg-pct">{{ mg.percentage | number:'1.0-0' }}%</span>
              </div>
            }
          </div>
        }
      </div>

      <div class="sc-footer">Jym &middot; Track your training</div>
    </div>
  `,

  styles: [`
    @keyframes slideUp {
      from { transform: translateY(56px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }

    .page {
      max-width: 600px;
      margin: 0 auto;
      padding: 0 var(--space-md) var(--space-2xl);
      animation: slideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    /* Hero: the theme's sidebar tone into its primary, so every theme gets its own banner. */
    .hero {
      margin: 0 calc(-1 * var(--space-md)) var(--space-lg);
      background: linear-gradient(150deg, var(--bg-sidebar) 0%, var(--color-primary) 100%);
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-2xl) var(--space-xl) var(--space-xl);
      text-align: center;
      color: var(--text-on-dark);
    }

    .trophy-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: color-mix(in srgb, var(--text-on-dark) 12%, transparent);
      margin-bottom: var(--space-md);
    }

    .hero-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-on-dark);
      margin: 0 0 var(--space-sm);
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .type-pill {
      display: inline-block;
      background: color-mix(in srgb, var(--text-on-dark) 12%, transparent);
      border: 1px solid color-mix(in srgb, var(--text-on-dark) 24%, transparent);
      border-radius: var(--border-radius-pill);
      padding: 3px 12px;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-on-dark);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .pr-line {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-sm);
      margin: 0 0 var(--space-lg);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }

    .stats-row {
      display: flex;
      gap: var(--space-sm);
      margin-bottom: var(--space-xl);
    }

    .stat-card {
      flex: 1;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-md) var(--space-xs) var(--space-sm);
      text-align: center;
      box-shadow: var(--shadow-sm);
    }

    .stat-value {
      font-family: var(--font-family-display);
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
    }

    .stat-label,
    .section-label {
      font-family: var(--font-family);
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .stat-label { margin-top: 4px; }

    .section { margin-bottom: var(--space-xl); }
    .section-label { margin: 0 0 var(--space-md); }

    .empty-note {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-align: center;
      padding: var(--space-lg) 0;
      margin: 0;
    }

    .mg-row {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      margin-bottom: 10px;
    }

    .mg-name {
      width: 92px;
      font-size: var(--font-size-sm);
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .mg-track {
      flex: 1;
      height: 8px;
      background: var(--bg-canvas);
      border-radius: var(--border-radius-sm);
      overflow: hidden;
    }

    .mg-fill {
      height: 100%;
      border-radius: var(--border-radius-sm);
      transition: width 0.8s cubic-bezier(0.16, 1, 0.3, 1);
    }

    .mg-pct {
      width: 36px;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-align: right;
      flex-shrink: 0;
      font-weight: 500;
    }

    .lift-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: 12px var(--space-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      margin-bottom: var(--space-sm);
      box-shadow: var(--shadow-sm);
    }

    .lift-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }

    .lift-name {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .lift-muscle {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      text-transform: capitalize;
    }

    .lift-aside {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      flex-shrink: 0;
    }

    .lift-current {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    .lift-previous {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      white-space: nowrap;
    }

    .delta-up { color: var(--color-success); font-weight: 600; }
    .delta-down { color: var(--color-danger); font-weight: 600; }

    .best-tag {
      display: inline-flex;
      align-items: center;
      height: 20px;
      padding: 0 8px;
      font-size: 0.65rem;
      font-weight: 700;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-pill);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      white-space: nowrap;
    }

    .lift-weight {
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }

    .action-row {
      display: flex;
      gap: var(--space-md);
      padding-bottom: var(--space-lg);
    }

    .btn-share,
    .btn-done {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      min-height: 44px;
      padding: 11px 12px;
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-family: inherit;
      white-space: nowrap;
      cursor: pointer;
    }

    .btn-share {
      background: var(--color-primary);
      color: var(--text-on-primary);
      border: none;
      font-weight: 700;
      box-shadow: var(--shadow-md);
      transition: opacity 0.15s, transform 0.1s;
    }

    .btn-share:not(:disabled):hover  { opacity: 0.9; transform: translateY(-1px); }
    .btn-share:not(:disabled):active { opacity: 1;   transform: translateY(0); }
    .btn-share:disabled              { opacity: 0.6; cursor: not-allowed; }

    .btn-done {
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      font-weight: 600;
      box-shadow: var(--shadow-sm);
      transition: opacity 0.15s;
    }

    .btn-done:hover { opacity: 0.8; }

    .day-link-row { margin: calc(-1 * var(--space-sm)) 0 var(--space-lg); text-align: center; }
    .day-link {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
    }

    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid color-mix(in srgb, currentColor 30%, transparent);
      border-top-color: currentColor;
      border-radius: 50%;
      animation: jiro-spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    /* Share card: off-screen capture target. No 'inset' shorthand; the clone renderer ignores it. */
    .sc {
      position: fixed;
      left: -9999px;
      top: 0;
      width: 375px;
      height: 667px;
      overflow: hidden;
      font-family: var(--font-family);
      display: flex;
      flex-direction: column;
      background:
        linear-gradient(var(--scrim), var(--scrim)),
        linear-gradient(160deg, var(--bg-sidebar) 0%, var(--color-primary) 45%, var(--bg-sidebar) 100%);
      color: var(--text-on-dark);
    }

    .sc-hdr {
      position: relative;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      padding: 40px 20px 30px;
      border-bottom: 1px solid color-mix(in srgb, var(--text-on-dark) 12%, transparent);
    }

    .sc-logo {
      position: absolute;
      top: 14px;
      right: 18px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--text-on-dark) 60%, transparent);
    }

    .sc-trophy { color: var(--text-on-dark); }

    .sc-title {
      margin: 0;
      color: var(--text-on-dark);
      font-size: 17px;
      font-weight: 800;
      white-space: nowrap;
    }

    .sc-stats {
      display: flex;
      flex-shrink: 0;
      background: var(--scrim);
      border-bottom: 1px solid color-mix(in srgb, var(--text-on-dark) 10%, transparent);
    }

    .sc-stat { flex: 1; padding: 13px 6px; text-align: center; }
    .sc-div  { width: 1px; background: color-mix(in srgb, var(--text-on-dark) 12%, transparent); flex-shrink: 0; }

    .sc-sv {
      font-size: 15px;
      font-weight: 800;
      color: var(--text-on-dark);
      line-height: 1.1;
    }

    .sc-sl,
    .sc-slabel {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: color-mix(in srgb, var(--text-on-dark) 70%, transparent);
    }

    .sc-sl { margin-top: 2px; }
    .sc-slabel { margin-bottom: 9px; }

    .sc-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 0 18px;
    }

    .sc-lifts {
      padding: 14px 0 12px;
      border-bottom: 1px solid color-mix(in srgb, var(--text-on-dark) 10%, transparent);
    }

    .sc-muscles { padding: 14px 0 4px; }

    .sc-lift {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 0;
    }

    .sc-rank {
      width: 14px;
      font-size: 10px;
      font-weight: 700;
      color: color-mix(in srgb, var(--text-on-dark) 60%, transparent);
      flex-shrink: 0;
      text-align: center;
    }

    .sc-lname {
      flex: 1;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-on-dark);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* The PR badge's shape and type, on the dark card. */
    .sc-pr {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 30px;
      height: 20px;
      padding: 0 6px;
      border: 1px solid color-mix(in srgb, var(--color-warning) 60%, var(--text-on-dark));
      border-radius: var(--border-radius-pill);
      background: color-mix(in srgb, var(--color-warning) 45%, transparent);
      color: var(--text-on-dark);
      font-size: 0.65rem;
      font-weight: 700;
      letter-spacing: 0.6px;
      flex-shrink: 0;
    }

    .sc-lw {
      font-size: 12px;
      font-weight: 700;
      color: var(--text-on-dark);
      white-space: nowrap;
      flex-shrink: 0;
    }

    .sc-mg {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    .sc-mg-name {
      width: 76px;
      font-size: 11px;
      color: var(--text-on-dark);
      text-transform: capitalize;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .sc-mg-track {
      flex: 1;
      height: 6px;
      background: color-mix(in srgb, var(--text-on-dark) 14%, transparent);
      border-radius: var(--border-radius-sm);
      overflow: hidden;
    }

    /* Data colours lifted toward the card text so they read on the dark card. */
    .sc-mg-fill {
      height: 100%;
      border-radius: var(--border-radius-sm);
      filter: brightness(1.35);
    }

    .sc-mg-pct {
      width: 28px;
      font-size: 9px;
      color: color-mix(in srgb, var(--text-on-dark) 70%, transparent);
      text-align: right;
      flex-shrink: 0;
    }

    .sc-footer {
      flex-shrink: 0;
      padding: 10px 18px;
      text-align: center;
      font-size: 10px;
      color: color-mix(in srgb, var(--text-on-dark) 60%, transparent);
      border-top: 1px solid color-mix(in srgb, var(--text-on-dark) 10%, transparent);
      letter-spacing: 0.04em;
    }
  `],
})
export class SessionSummaryComponent implements OnInit {
  durationStr    = signal('');
  totalVolume    = signal('0');
  totalSets      = signal(0);
  prCount        = signal(0);
  sessionType    = signal('normal');
  muscleGroups   = signal<MuscleGroupData[]>([]);
  liftHighlights = signal<LiftHighlight[]>([]);
  topLifts       = signal<LiftHighlight[]>([]);
  sharing        = signal(false);
  /** The user's day the workout started on (now minus its duration). */
  sessionDay     = signal('');

  @ViewChild('shareCard') shareCardEl!: ElementRef<HTMLDivElement>;

  private readonly jymService = inject(JymService);
  private readonly settings = inject(SettingsService);

  constructor(private router: Router) {}

  ngOnInit(): void {
    const state = history.state as SummaryState | undefined;
    if (!state?.blocks) {
      this.router.navigate(['/jym']);
      return;
    }
    this.computeStats(state);
    this.loadPreviousBests(state);
    const started = Date.now() - (state.durationSeconds ?? 0) * 1000;
    this.sessionDay.set(dayKey(started, this.settings.timezone()));
  }

  /** Fills in each highlight's previousBest once the API responds; the page
   *  renders immediately without it and updates in place, rather than
   *  blocking "Workout complete" on a network round trip. */
  private loadPreviousBests(state: SummaryState): void {
    if (!state.sessionId) return;
    const exerciseIds = state.blocks.map(b => b.exerciseId).filter(Boolean);
    this.jymService.getPreviousBests(state.sessionId, exerciseIds).subscribe({
      next: bests => {
        const byExercise = new Map(bests.map(b => [b.exercise_id, b]));
        this.liftHighlights.update(highlights => highlights.map(h => {
          const prev = byExercise.get(h.exerciseId);
          if (!prev) return h;
          // The API returns kg; lift.weight is already in the user's display
          // unit (session-player converts before it ever reaches this page),
          // so both sides must be compared in the same unit or the delta
          // below is meaningless — recomputed from the converted weight
          // rather than trusting the API's kg-based est_1rm.
          const weight = this.settings.toDisplay(prev.weight);
          return { ...h, previousBest: { weight, reps: prev.reps_performed, est1RM: epley1RM(weight, prev.reps_performed) } };
        }));
      },
      // No previous-workout comparison is a normal outcome (first time doing
      // an exercise, or the lookup failing) — the rest of the summary already
      // rendered, so this fails silently rather than showing an error toast.
      error: () => {},
    });
  }

  /** Under half a kilo of estimated 1RM is noise, not progress either way. */
  est1RMDelta(lift: LiftHighlight): { pct: number; direction: 'up' | 'down' | 'same' } | null {
    const prev = lift.previousBest;
    if (!prev || prev.est1RM <= 0) return null;
    const diff = lift.est1RM - prev.est1RM;
    if (Math.abs(diff) < 0.5) return { pct: 0, direction: 'same' };
    return { pct: Math.abs(Math.round((diff / prev.est1RM) * 100)), direction: diff > 0 ? 'up' : 'down' };
  }

  private computeStats(state: SummaryState): void {
    this.sessionType.set(state.sessionType ?? 'normal');

    // Duration string
    const secs = state.durationSeconds ?? 0;
    if (secs >= 3600) {
      this.durationStr.set(`${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`);
    } else if (secs >= 60) {
      this.durationStr.set(`${Math.floor(secs / 60)}m ${secs % 60}s`);
    } else {
      this.durationStr.set(`${secs}s`);
    }

    // Collect work sets (saved & not warmup)
    const work: { weight: number; reps: number; isPR: boolean; mg: string | null }[] = [];
    for (const block of state.blocks) {
      for (const s of block.sets) {
        if (s.saved && !s.isWarmup) {
          work.push({ weight: s.weight, reps: s.reps, isPR: s.isPR, mg: block.muscleGroup });
        }
      }
    }

    this.totalSets.set(work.length);

    const vol = work.reduce((acc, s) => acc + s.weight * s.reps, 0);
    this.totalVolume.set(`${Math.round(vol).toLocaleString()} ${state.weightUnit || 'lbs'}`);

    // Muscle group breakdown
    const groupMap = new Map<string, number>();
    for (const s of work) {
      const key = s.mg?.toLowerCase() ?? 'other';
      groupMap.set(key, (groupMap.get(key) ?? 0) + s.weight * s.reps);
    }
    const totalVol = vol || 1;
    this.muscleGroups.set(
      Array.from(groupMap.entries())
        .map(([key, volume]) => ({
          group: capitalize(key),
          volume,
          percentage: Math.round((volume / totalVol) * 100),
          color: muscleColor(key),
        }))
        .sort((a, b) => b.volume - a.volume),
    );

    // Lift highlights — one entry per exercise block
    const highlights: LiftHighlight[] = [];
    for (const block of state.blocks) {
      const ws = block.sets.filter(s => s.saved && !s.isWarmup);
      if (!ws.length) continue;
      const prSets = ws.filter(s => s.isPR);
      const pool   = prSets.length ? prSets : ws;
      const best   = pool.reduce((top, s) => (s.weight > top.weight ? s : top), pool[0]);
      highlights.push({
        exerciseId: block.exerciseId,
        exerciseName: block.exerciseName,
        muscleGroup: block.muscleGroup,
        weight: best.weight,
        reps: best.reps,
        est1RM: epley1RM(best.weight, best.reps),
        isPR: prSets.length > 0,
      });
    }

    this.liftHighlights.set(highlights);
    this.prCount.set(highlights.filter(h => h.isPR).length);
    this.topLifts.set([...highlights].sort((a, b) => b.weight - a.weight).slice(0, 3));
  }

  async shareWorkout(): Promise<void> {
    this.sharing.set(true);
    const el = this.shareCardEl.nativeElement;
    try {
      const { toPng } = await import('html-to-image');

      // Temporarily move the card into the visible viewport.
      // html-to-image uses getComputedStyle() which may skip painting
      // for elements at left:-9999px, producing a blank image.
      el.style.left = '0';
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      // skipFonts: true prevents html-to-image from trying to read
      // cross-origin Google Fonts CSS, which throws a CORS SecurityError.
      // The image falls back to the system sans, which is fine for the card.
      const dataUrl = await toPng(el, { pixelRatio: 2, width: 375, height: 667, skipFonts: true });

      // Restore the card to off-screen.
      el.style.left = '-9999px';

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'workout.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Jym workout' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'workout.png';
        a.click();
      }
    } catch (e) {
      console.error('Share failed', e);
      el.style.left = '-9999px';
    } finally {
      this.sharing.set(false);
    }
  }

  done(): void {
    this.router.navigate(['/jym']);
  }
}
