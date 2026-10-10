import { Component, DestroyRef, OnInit, ViewChild, ElementRef, computed, signal, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JymPrBadgeComponent } from '../shared/pr-badge/pr-badge';
import { JymService, SessionReport, SetRef, UpdateSessionTimesRequest } from '../../../core/services/jym.service';
import { ExerciseKind, distanceText, distanceUnit, durationText, kindOf, setText } from '../exercise-kind';
import { SettingsService } from '../../../core/services/settings.service';
import { ToastService } from '../../../core/services/toast.service';
import { dayKey, fromZonedInput, timeInZone, toZonedInput } from '../../../core/utils/day';
import { formatInstant } from '../../../core/utils/format-date';
import { WorkoutLauncher } from '../shared/workout-launcher';
import { SaveTemplateDialogComponent } from '../shared/save-template-dialog';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { muscleColor } from '../shared/muscle-colors';

interface LiftHighlight {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string | null;
  /** In the display unit. */
  weight: number;
  reps: number;
  /** In kg, from the API. */
  est1RM: number;
  isPR: boolean;
  isFirst: boolean;
  previous?: { weight: number; reps: number; est1RM: number };
  /** The best set and last time's in the lift's own words ("100 × 5", "0:45", "5 km in 26:00"). */
  text: string;
  previousText?: string;
}

interface MuscleGroupData {
  group: string;
  sets: number;
  percentage: number;
  color: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatDuration(secs: number): string {
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  if (secs >= 60) return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  return `${secs}s`;
}

import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';

@Component({
  selector: 'app-session-summary',
  standalone: true,
  imports: [JiroIconComponent, CommonModule, FormsModule, RouterLink, JymPrBadgeComponent, JiroModalComponent, JiroButtonComponent, SaveTemplateDialogComponent],
  template: `
    <div class="page">

      <div class="hero">
        <div class="hero-content">
          <span class="trophy-ring"><jiro-icon [name]="inProgress() ? 'barbell' : 'trophy'" [size]="48" /></span>
          <h1 class="hero-title">{{ inProgress() ? 'Workout in progress' : 'Workout complete' }}</h1>
          @if (routineName(); as name) {
            <p class="hero-sub">{{ name }}</p>
          }
          @if (whenLabel(); as when) {
            <p class="hero-when">{{ when }}</p>
          }
          @if (report() && !inProgress()) {
            <div class="hero-edits">
              <button type="button" class="hero-edit" (click)="editWorkout()">
                <jiro-icon name="barbell" [size]="14" /> Edit workout
              </button>
              <button type="button" class="hero-edit" aria-haspopup="dialog" (click)="openTimes()">
                <jiro-icon name="pencil-simple" [size]="14" /> Edit times
              </button>
            </div>
          }
          @if (sessionType() !== 'normal') {
            <span class="type-pill">{{ sessionType() === 'deload' ? 'Deload' : 'Test' }} session</span>
          }
        </div>
      </div>

      @if (loading()) {
        <p class="state-note" role="status">Loading your summary…</p>
      } @else if (loadError()) {
        <div class="state-note" role="alert">
          <p>Could not load this summary.</p>
          <div class="action-row">
            <button class="btn-share" (click)="load()">Try again</button>
            <button class="btn-done" (click)="done()">Back to Jym</button>
          </div>
        </div>
      } @else if (inProgress()) {
        <div class="state-note">
          <p>This workout isn't finished yet, so it has no summary.</p>
          <div class="action-row">
            <button class="btn-share" type="button" (click)="resume()">Resume workout</button>
          </div>
        </div>
      } @else {
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
          @if (totalDistance(); as d) {
            <div class="stat-card">
              <div class="stat-value">{{ d }}</div>
              <div class="stat-label">Distance</div>
            </div>
          }
          @if (totalHeld(); as t) {
            <div class="stat-card">
              <div class="stat-value">{{ t }}</div>
              <div class="stat-label">Time held</div>
            </div>
          }
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
                    } @else if (lift.isFirst) {
                      <span class="best-tag">First time</span>
                    } @else {
                      <span class="best-tag">Best</span>
                    }
                    <span class="lift-weight">{{ lift.text }}</span>
                  </div>
                  @if (lift.previous; as prev) {
                    <div class="lift-previous">
                      Last time {{ lift.previousText }}
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
            <p class="empty-note">No work sets were logged this session.</p>
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
        <div class="action-row action-row--quiet">
          <button class="btn-quiet" type="button" [disabled]="launcher.starting()" (click)="repeat()">
            <jiro-icon name="repeat" [size]="16" /> Repeat workout
          </button>
          <button class="btn-quiet" type="button" aria-haspopup="dialog" (click)="showTemplateSave.set(true)">
            <jiro-icon name="floppy-disk" [size]="16" /> Save as template
          </button>
        </div>
        @if (sessionDay()) {
          <p class="day-link-row"><a class="day-link" [routerLink]="['/day', sessionDay()]">See this day</a></p>
        }
      }

    </div>

    @if (showTemplateSave() && report(); as r) {
      <jym-save-template-dialog [sessionId]="r.id" [initialName]="r.routine_name ?? ''" (close)="showTemplateSave.set(false)" />
    }

    <!-- A finished workout's start and end; the times must still hold every logged set. -->
    @if (timesOpen()) {
      <jiro-modal sheet title="Workout times" maxWidth="420px" (close)="timesOpen.set(false)">
        <div class="times-field">
          <label class="field-label" for="times-start">Started</label>
          <input id="times-start" class="times-input" type="datetime-local" [(ngModel)]="startText" />
        </div>
        <div class="times-field">
          <label class="field-label" for="times-end">Finished</label>
          <input id="times-end" class="times-input" type="datetime-local" [(ngModel)]="endText" />
        </div>
        @if (setSpan(); as span) {
          <p class="times-help">{{ span }}</p>
        }
        @if (timesError()) {
          <p class="times-error" role="alert">{{ timesError() }}</p>
        }
        <div class="times-actions">
          <jiro-button variant="secondary" size="lg" type="button" (click)="timesOpen.set(false)">Cancel</jiro-button>
          <jiro-button size="lg" type="button" [loading]="timesSaving()" (click)="saveTimes()">Save times</jiro-button>
        </div>
      </jiro-modal>
    }

    <!-- Share card, 375 x 667, exported with html-to-image; styles use tokens, resolved via computed style at capture. -->
    <div #shareCard class="sc" aria-hidden="true">
      <div class="sc-hdr">
        <span class="sc-logo">Jym</span>
        <jiro-icon class="sc-trophy" name="trophy" [size]="48" />
        <p class="sc-title">Workout complete</p>
        @if (routineName(); as name) {
          <p class="sc-sub">{{ name }}</p>
        }
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
                <span class="sc-lw">{{ lift.text }}</span>
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

    /* Hero: a quiet card; the theme's primary is its one accent, on the trophy. */
    .hero {
      margin: var(--space-md) 0 var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-sm);
    }

    .hero-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-xl) var(--space-md) var(--space-lg);
      text-align: center;
      color: var(--text-primary);
    }

    .trophy-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 88px;
      height: 88px;
      border-radius: 50%;
      background: rgba(var(--color-primary-rgb), 0.08);
      color: var(--color-primary-text);
      margin-bottom: var(--space-md);
    }

    .hero-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 var(--space-sm);
      letter-spacing: -0.02em;
      line-height: 1.15;
    }

    .hero-sub {
      margin: 0 0 var(--space-sm);
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
    }

    .hero-when { margin: 0 0 var(--space-sm); font-size: var(--font-size-sm); color: var(--text-secondary); }

    /* Outlined like the secondary button. */
    .hero-edit {
      display: inline-flex; align-items: center; gap: 6px;
      min-height: 44px; padding: 0 var(--space-md); margin-bottom: var(--space-sm);
      border: 1px solid color-mix(in srgb, var(--text-primary) 40%, transparent); border-radius: var(--border-radius-pill);
      background: none; color: var(--text-primary);
      font-family: inherit; font-size: var(--font-size-sm); font-weight: 600; cursor: pointer;
    }
    .hero-edit:hover { background: rgba(var(--color-primary-rgb), 0.06); border-color: var(--text-primary); }
    .hero-edits { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--space-sm); }

    .type-pill {
      display: inline-block;
      background: rgba(var(--color-primary-rgb), 0.08);
      border: 1px solid rgba(var(--color-primary-rgb), 0.2);
      border-radius: var(--border-radius-pill);
      padding: 3px 12px;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-primary-text);
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
      flex-wrap: wrap;
      gap: var(--space-sm);
      margin-bottom: var(--space-xl);
    }

    /* As many as fit at 96 px or more: a phone shows three, then the distance and time held below. */
    .stat-card {
      flex: 1 1 96px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-md) var(--space-xs) var(--space-sm);
      text-align: center;
      box-shadow: var(--shadow-sm);
    }

    .stat-value {
      font-family: var(--font-family-display);
      letter-spacing: -0.02em;
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
    }

    .stat-label,
    .section-label {
      font-family: var(--font-family);
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-secondary);
    }

    .stat-label { margin-top: 4px; }

    .section { margin-bottom: var(--space-xl); }
    .section-label { margin: 0 0 var(--space-md); }

    .state-note {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-align: center;
      padding: var(--space-lg) 0;
      margin: 0;
    }
    .state-note p { margin: 0 0 var(--space-md); }

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

    .action-row--quiet { margin-top: calc(-1 * var(--space-sm)); }
    .btn-quiet {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      min-height: 44px; padding: 0 12px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: none; color: var(--text-primary);
      font-size: var(--font-size-sm); font-weight: 600; font-family: inherit; white-space: nowrap; cursor: pointer;
    }
    .btn-quiet:hover:not(:disabled) { background: var(--bg-surface-hover); }
    .btn-quiet:disabled { opacity: 0.6; cursor: not-allowed; }

    .times-field { margin-bottom: var(--space-md); }
    .field-label { display: block; font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); margin-bottom: var(--space-xs); }
    .times-input {
      width: 100%; box-sizing: border-box; min-height: 48px; padding: 10px 12px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-md); font-family: inherit;
    }
    .times-input:focus { border-color: var(--color-primary); }
    .times-help { font-size: var(--font-size-sm); color: var(--text-secondary); margin-bottom: var(--space-sm); }
    .times-error { font-size: var(--font-size-sm); color: var(--color-negative); margin-bottom: var(--space-sm); }
    .times-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-md); }
    @media (max-width: 600px) { .times-actions > * { flex: 1; --jiro-btn-width: 100%; } }

    .day-link-row { margin: calc(-1 * var(--space-sm)) 0 var(--space-lg); text-align: center; }
    .day-link {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
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

    .sc-sub {
      margin: -8px 0 0;
      color: color-mix(in srgb, var(--text-on-dark) 80%, transparent);
      font-size: 13px;
      font-weight: 600;
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

    .sc-mg-fill {
      height: 100%;
      border-radius: var(--border-radius-sm);
    }

    /* Light-theme data colours are lifted to read on the dark card; dark-theme ones already are. */
    :host-context(html:not(.dark)) .sc-mg-fill { filter: brightness(1.35); }

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
  /** Distance run, rowed or ridden, and time held, when the workout had any. */
  totalDistance  = signal('');
  totalHeld      = signal('');
  totalSets      = signal(0);
  prCount        = signal(0);
  sessionType    = signal('normal');
  routineName    = signal<string | null>(null);
  muscleGroups   = signal<MuscleGroupData[]>([]);
  liftHighlights = signal<LiftHighlight[]>([]);
  topLifts       = signal<LiftHighlight[]>([]);
  sharing        = signal(false);
  loading        = signal(true);
  loadError      = signal(false);
  /** The user's day the workout started on. */
  sessionDay     = signal('');
  report         = signal<SessionReport | null>(null);
  inProgress     = computed(() => !!this.report() && !this.report()!.ended_at);
  /** "Mon 28 Sep, 7:30 PM to 8:42 PM". */
  whenLabel      = signal('');
  /** When the sets were logged, as the rule for editing times. */
  setSpan        = signal('');
  showTemplateSave = signal(false);

  // Edit times
  timesOpen   = signal(false);
  timesSaving = signal(false);
  timesError  = signal<string | null>(null);
  startText = '';
  endText = '';
  private startShown = '';
  private endShown = '';

  readonly launcher = inject(WorkoutLauncher);

  @ViewChild('shareCard') shareCardEl!: ElementRef<HTMLDivElement>;

  private readonly jymService = inject(JymService);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Search can open another workout's summary while this one is showing: follow the id.
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
  }

  /** The server builds the summary, so it survives a reload and matches history. */
  load(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.router.navigate(['/jym']);
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);
    this.jymService.getSessionReport(id).subscribe({
      next: report => {
        this.show(report);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });
  }

  private show(r: SessionReport): void {
    this.report.set(r);
    const tz = this.settings.timezone();
    const at = (iso: string) => `${formatInstant(iso, tz, { weekday: true })}, ${timeInZone(iso, tz)}`;
    const later = (from: string, to: string) => dayKey(from, tz) === dayKey(to, tz) ? timeInZone(to, tz) : at(to);
    this.whenLabel.set(r.ended_at ? `${at(r.started_at)} to ${later(r.started_at, r.ended_at)}` : `Started ${at(r.started_at)}`);
    this.setSpan.set(r.first_set_at && r.last_set_at
      ? `Your sets were logged from ${timeInZone(r.first_set_at, tz)} to ${later(r.first_set_at, r.last_set_at)}. The times need to include them.`
      : '');
    this.sessionType.set(r.session_type || 'normal');
    this.routineName.set(r.routine_name);
    const started = new Date(r.started_at).getTime();
    const ended = r.ended_at ? new Date(r.ended_at).getTime() : Date.now();
    this.durationStr.set(formatDuration(Math.max(0, Math.floor((ended - started) / 1000))));
    this.sessionDay.set(dayKey(started, this.settings.timezone()));

    this.totalSets.set(r.set_count);
    const volume = Math.round(this.settings.toDisplay(r.total_volume));
    this.totalVolume.set(`${volume.toLocaleString('en-US')} ${this.settings.unitLabel()}`);
    const dUnit = distanceUnit(this.settings.weightUnit());
    this.totalDistance.set(r.total_distance_m > 0 ? distanceText(r.total_distance_m, dUnit) : '');
    this.totalHeld.set(r.total_duration_s > 0 ? durationText(r.total_duration_s) : '');
    this.prCount.set(r.pr_count);

    const allSets = r.muscles.reduce((sum, m) => sum + m.sets, 0) || 1;
    this.muscleGroups.set(r.muscles.map(m => ({
      group: capitalize(m.muscle_group),
      sets: m.sets,
      percentage: Math.round((m.sets / allSets) * 100),
      color: muscleColor(m.muscle_group),
    })));

    const words = (kind: ExerciseKind, s: SetRef) => {
      const weight = this.settings.toDisplay(s.weight);
      return kind === 'weight_reps' ? `${+weight.toFixed(1)} × ${s.reps}`
        : setText(kind, { weight: +weight.toFixed(1), reps: s.reps, duration_s: s.duration_s, distance_m: s.distance_m }, this.settings.unitLabel());
    };
    const highlights: LiftHighlight[] = r.exercises.flatMap(e => e.best ? [{
      exerciseId: e.exercise_id,
      exerciseName: e.name,
      muscleGroup: e.muscle_group,
      weight: this.settings.toDisplay(e.best.weight),
      reps: e.best.reps,
      est1RM: e.best.est_1rm,
      isPR: e.is_pr,
      isFirst: e.is_first,
      previous: e.previous
        ? { weight: this.settings.toDisplay(e.previous.weight), reps: e.previous.reps, est1RM: e.previous.est_1rm }
        : undefined,
      text: words(kindOf(e.kind), e.best),
      previousText: e.previous ? words(kindOf(e.kind), e.previous) : undefined,
    }] : []);
    this.liftHighlights.set(highlights);
    // Weighted lifts by estimated 1RM, then bodyweight lifts by reps.
    this.topLifts.set([...highlights].sort((a, b) => b.est1RM - a.est1RM || b.reps - a.reps).slice(0, 3));
  }

  /** Change in estimated 1RM on last time; none for a record or a deload, and under 0.25 kg is noise. */
  est1RMDelta(lift: LiftHighlight): { pct: number; direction: 'up' | 'down' | 'same' } | null {
    const prev = lift.previous;
    if (!prev || prev.est1RM <= 0 || lift.isPR || this.sessionType() === 'deload') return null;
    const diff = lift.est1RM - prev.est1RM;
    const pct = Math.round(Math.abs(diff / prev.est1RM) * 100);
    if (Math.abs(diff) < 0.25 || pct === 0) return { pct: 0, direction: 'same' };
    return { pct, direction: diff > 0 ? 'up' : 'down' };
  }

  async shareWorkout(): Promise<void> {
    this.sharing.set(true);
    const el = this.shareCardEl.nativeElement;
    try {
      const { toBlob } = await import('html-to-image');

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
      // A Blob directly: the production CSP refuses fetch() on data: URLs.
      const blob = await toBlob(el, { pixelRatio: 2, width: 375, height: 667, skipFonts: true });
      el.style.left = '-9999px';
      if (!blob) throw new Error('empty image');

      const file = new File([blob], 'workout.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'My Jym workout' });
          return;
        } catch (e) {
          // Closing the share sheet is not a failure; anything else falls back to a download.
          if ((e as DOMException)?.name === 'AbortError') return;
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'workout.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Share failed', e);
      el.style.left = '-9999px';
      this.toast.error('Could not create the workout image.');
    } finally {
      this.sharing.set(false);
    }
  }

  /** Back where the summary was opened from (history, the day view), else Jym; never out of the app. */
  done(): void {
    const back = (history.state as { back?: unknown } | null)?.back;
    if (typeof back === 'string' && back.startsWith('/')) this.router.navigateByUrl(back);
    else this.router.navigate(['/jym']);
  }

  /** Opens the workout for fixing in place of this page; Done there comes back here, keeping this page's way back. */
  editWorkout(): void {
    const r = this.report();
    if (!r) return;
    const back = (history.state as { back?: unknown } | null)?.back;
    this.router.navigate(['/jym/sessions', r.id, 'edit'], { replaceUrl: true, state: typeof back === 'string' ? { back } : {} });
  }

  resume(): void {
    const r = this.report();
    if (r) this.router.navigate(['/jym/session', r.id]);
  }

  /** A normal workout of the same routine and exercises, done in the same order, with the same supersets. */
  repeat(): void {
    const r = this.report();
    if (!r) return;
    const ids = r.exercises.map(e => e.exercise_id);
    const start = (groups?: (number | null)[]) => this.launcher.start({
      ...(r.routine_id ? { routine_id: r.routine_id } : {}),
      exercise_ids: ids,
      ...(groups && groups.some(g => g !== null) ? { superset_groups: groups } : {}),
    });
    // The workout's own list says which exercises were supersets; without it, repeat without them.
    this.jymService.getSession(r.id).subscribe({
      next: s => {
        const byId = new Map((s.exercises ?? []).map(x => [x.exercise_id, x.superset_group ?? null]));
        start(ids.map(id => byId.get(id) ?? null));
      },
      error: () => start(),
    });
  }

  openTimes(): void {
    const r = this.report();
    if (!r?.ended_at) return;
    const tz = this.settings.timezone();
    this.startText = this.startShown = toZonedInput(r.started_at, tz);
    this.endText = this.endShown = toZonedInput(r.ended_at, tz);
    this.timesError.set(null);
    this.timesOpen.set(true);
  }

  /** Sends only what changed (the fields have no seconds); the server holds the rules and explains a refusal. */
  saveTimes(): void {
    const r = this.report();
    if (!r || this.timesSaving()) return;
    const tz = this.settings.timezone();
    const start = fromZonedInput(this.startText, tz);
    const end = fromZonedInput(this.endText, tz);
    if (!start || !end) {
      this.timesError.set('Enter both a start and a finish time.');
      return;
    }
    if (Date.parse(end) <= Date.parse(start)) {
      this.timesError.set('The end must be after the start.');
      return;
    }
    const req: UpdateSessionTimesRequest = {};
    if (this.startText !== this.startShown) req.started_at = start;
    if (this.endText !== this.endShown) req.ended_at = end;
    if (!req.started_at && !req.ended_at) {
      this.timesOpen.set(false);
      return;
    }
    this.timesSaving.set(true);
    this.jymService.updateSessionTimes(r.id, req).subscribe({
      next: () => {
        this.timesSaving.set(false);
        this.timesOpen.set(false);
        this.toast.success('Times saved');
        this.load();
      },
      error: err => {
        this.timesSaving.set(false);
        this.timesError.set(err?.status === 400 && err?.error?.error?.message
          ? err.error.error.message
          : 'Could not save the times. Try again.');
      },
    });
  }
}
