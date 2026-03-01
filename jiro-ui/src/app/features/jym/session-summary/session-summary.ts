import { Component, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

// ─── Data types ────────────────────────────────────────────────────────────────

interface SummaryState {
  durationSeconds: number;
  sessionType: string;
  weightUnit: string;
  routineName: string | null;
  blocks: {
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
  exerciseName: string;
  muscleGroup: string | null;
  weight: number;
  reps: number;
  isPR: boolean;
}

interface MuscleGroupData {
  group: string;
  volume: number;
  percentage: number;
  color: string;
}

// Fixed accent colours for muscle groups — intentionally not theme-sensitive
// so charts are always readable regardless of the user's colour theme.
const MUSCLE_COLORS: Record<string, string> = {
  chest: '#e05a3a',
  back: '#4a90d9',
  legs: '#7b68ee',
  quadriceps: '#7b68ee',
  hamstrings: '#9b7bde',
  shoulders: '#50c878',
  arms: '#ff8c42',
  biceps: '#ff8c42',
  triceps: '#ff6b42',
  core: '#ff6b9d',
  glutes: '#9b59b6',
  calves: '#1abc9c',
  cardio: '#2ecc71',
  other: '#95a5a6',
};

function muscleColor(group: string): string {
  return MUSCLE_COLORS[group.toLowerCase()] ?? '#95a5a6';
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ─── Component ─────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-session-summary',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- ════════════════════════════════════════════════════════════════
         In-app view
         The hero gradient uses CSS theme vars so it automatically
         matches whichever colour theme the user has selected.
         ════════════════════════════════════════════════════════════════ -->
    <div class="page">

      <!-- ── Hero ──────────────────────────────────────────────────── -->
      <div class="hero">
        <!-- CSS-only diagonal texture overlay -->
        <div class="hero-texture" aria-hidden="true"></div>

        <div class="hero-content">
          <!-- Trophy in amber glow halo -->
          <div class="trophy-ring">
            <svg class="trophy" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M20 8h24v20c0 8.837-5.373 16-12 16S20 36.837 20 28V8z"
                fill="#ffd700" stroke="#e6ba00" stroke-width="1.5"/>
              <path d="M20 14H10c0 8 4 14 10 16"
                stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M44 14h10c0 8-4 14-10 16"
                stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M32 44v8" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
              <path d="M24 52h16" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="32" cy="20" r="3.5" fill="rgba(255,255,255,0.35)"/>
            </svg>
          </div>

          <h1 class="hero-title">Workout Complete!</h1>

          <!-- Only shown when PRs were hit -->
          <div class="pr-pill" *ngIf="prCount() > 0">
            <svg width="13" height="13" viewBox="0 0 100 100" aria-hidden="true">
              <path d="M30 40 v45 l20 -15 l20 15 v-45 z" fill="#5D4037"/>
              <circle cx="50" cy="35" r="26" fill="#BF360C"/>
              <circle cx="50" cy="35" r="20" fill="#E6DCC3"/>
              <text x="50" y="42" font-family="sans-serif" font-weight="bold"
                font-size="20" fill="#5D4037" text-anchor="middle">PR</text>
            </svg>
            {{ prCount() }} new PR{{ prCount() === 1 ? '' : 's' }}!
          </div>

          <span class="type-pill" *ngIf="sessionType() !== 'normal'">
            {{ sessionType() === 'deload' ? 'Deload' : 'Test' }} Session
          </span>
        </div>
      </div>

      <!-- ── Stats ──────────────────────────────────────────────────── -->
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-stripe" style="background:#4a90d9"></div>
          <div class="stat-value">{{ durationStr() }}</div>
          <div class="stat-label">Duration</div>
        </div>
        <div class="stat-card">
          <div class="stat-stripe" style="background:#f0a030"></div>
          <div class="stat-value">{{ totalVolume() }}</div>
          <div class="stat-label">Volume</div>
        </div>
        <div class="stat-card">
          <div class="stat-stripe" style="background:#2ecc71"></div>
          <div class="stat-value">{{ totalSets() }}</div>
          <div class="stat-label">Work Sets</div>
        </div>
      </div>

      <!-- ── Muscle Groups ───────────────────────────────────────────── -->
      <section class="section" *ngIf="muscleGroups().length > 0">
        <h2 class="section-label">Muscle Groups</h2>
        <div class="mg-row" *ngFor="let mg of muscleGroups()">
          <span class="mg-dot" [style.background]="mg.color"></span>
          <span class="mg-name">{{ mg.group }}</span>
          <div class="mg-track">
            <div class="mg-fill" [style.width.%]="mg.percentage" [style.background]="mg.color"></div>
          </div>
          <span class="mg-pct">{{ mg.percentage | number:'1.0-0' }}%</span>
        </div>
      </section>

      <!-- ── Session Highlights ──────────────────────────────────────── -->
      <section class="section" *ngIf="liftHighlights().length > 0">
        <h2 class="section-label">Session Highlights</h2>
        <div class="lift-card" *ngFor="let lift of liftHighlights()"
          [style.border-left-color]="liftColor(lift)">
          <div class="lift-meta">
            <span class="lift-name">{{ lift.exerciseName }}</span>
            <span class="lift-muscle" *ngIf="lift.muscleGroup">{{ lift.muscleGroup }}</span>
          </div>
          <div class="lift-aside">
            <span class="pr-icon" *ngIf="lift.isPR" aria-label="Personal Record">
              <svg width="22" height="22" viewBox="0 0 100 100" aria-hidden="true">
                <path d="M30 40 v45 l20 -15 l20 15 v-45 z" fill="#5D4037"/>
                <circle cx="50" cy="35" r="26" fill="#BF360C"/>
                <circle cx="50" cy="35" r="20" fill="#E6DCC3"/>
                <text x="50" y="42" font-family="sans-serif" font-weight="bold"
                  font-size="20" fill="#5D4037" text-anchor="middle">PR</text>
              </svg>
            </span>
            <span class="best-tag" *ngIf="!lift.isPR">Best</span>
            <span class="lift-weight">{{ lift.weight | number:'1.0-1' }} × {{ lift.reps }}</span>
          </div>
        </div>
      </section>

      <section class="section" *ngIf="liftHighlights().length === 0">
        <p class="empty-note">No sets were logged this session.</p>
      </section>

      <!-- ── Actions ────────────────────────────────────────────────── -->
      <div class="action-row">
        <button class="btn-share" (click)="shareWorkout()" [disabled]="sharing()">
          <svg *ngIf="!sharing()" width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/>
            <circle cx="6" cy="12" r="3"/>
            <circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          <span *ngIf="sharing()" class="spinner" aria-hidden="true"></span>
          {{ sharing() ? 'Sharing...' : 'Share Workout' }}
        </button>
        <button class="btn-done" (click)="done()">Done</button>
      </div>

    </div>

    <!-- ════════════════════════════════════════════════════════════════
         Share card — 375 × 667 px, off-screen capture target.
         IMPORTANT: ALL styles must use hardcoded hex/rgba values.
         CSS custom properties (var(--...)) are NOT resolved in the
         html-to-image clone context and will render as transparent/0.

         Design: the entire card shares one warm dark gradient so that
         sparse content (e.g. 1 exercise, 1 muscle group) still looks
         intentional — no dead flat-black void at the bottom.
         ════════════════════════════════════════════════════════════════ -->
    <div #shareCard class="sc">

      <!-- Header -->
      <div class="sc-hdr">
        <span class="sc-logo">JYM</span>
        <div class="sc-trophy-wrap">
          <!-- explicit top/left/right/bottom — 'inset' shorthand is not
               supported in html-to-image's rendering context -->
          <div class="sc-glow"></div>
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
            <path d="M20 8h24v20c0 8.837-5.373 16-12 16S20 36.837 20 28V8z"
              fill="#ffd700" stroke="#e6ba00" stroke-width="1.5"/>
            <path d="M20 14H10c0 8 4 14 10 16"
              stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M44 14h10c0 8-4 14-10 16"
              stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M32 44v8" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M24 52h16" stroke="#ffd700" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
        </div>
        <p class="sc-title">Workout Complete!</p>
      </div>

      <!-- Stats strip -->
      <div class="sc-stats">
        <div class="sc-stat">
          <div class="sc-sv">{{ durationStr() }}</div>
          <div class="sc-sl">DURATION</div>
        </div>
        <div class="sc-div"></div>
        <div class="sc-stat">
          <div class="sc-sv">{{ totalVolume() }}</div>
          <div class="sc-sl">VOLUME</div>
        </div>
        <div class="sc-div"></div>
        <div class="sc-stat">
          <div class="sc-sv">{{ totalSets() }}</div>
          <div class="sc-sl">WORK SETS</div>
        </div>
      </div>

      <!-- Body: vertically centred in remaining space so sparse content
           never leaves a dead void at the bottom of the card -->
      <div class="sc-body">

        <!-- Top 3 lifts -->
        <div class="sc-lifts" *ngIf="topLifts().length > 0">
          <div class="sc-slabel">TOP LIFTS</div>
          <div class="sc-lift" *ngFor="let lift of topLifts(); let i = index">
            <span class="sc-rank">{{ i + 1 }}</span>
            <span class="sc-lname">{{ lift.exerciseName }}</span>
            <span class="sc-pr" *ngIf="lift.isPR">
              <svg width="14" height="14" viewBox="0 0 100 100">
                <path d="M30 40 v45 l20 -15 l20 15 v-45 z" fill="#5D4037"/>
                <circle cx="50" cy="35" r="26" fill="#BF360C"/>
                <circle cx="50" cy="35" r="20" fill="#E6DCC3"/>
                <text x="50" y="42" font-family="sans-serif" font-weight="bold"
                  font-size="20" fill="#5D4037" text-anchor="middle">PR</text>
              </svg>
            </span>
            <span class="sc-lw">{{ lift.weight | number:'1.0-1' }} × {{ lift.reps }}</span>
          </div>
        </div>

        <!-- Muscle group bars -->
        <div class="sc-muscles" *ngIf="muscleGroups().length > 0">
          <div class="sc-slabel">MUSCLE GROUPS</div>
          <div class="sc-mg" *ngFor="let mg of muscleGroups()">
            <span class="sc-mg-dot" [style.background]="mg.color"></span>
            <span class="sc-mg-name">{{ mg.group }}</span>
            <div class="sc-mg-track">
              <div class="sc-mg-fill" [style.width.%]="mg.percentage" [style.background]="mg.color"></div>
            </div>
            <span class="sc-mg-pct">{{ mg.percentage | number:'1.0-0' }}%</span>
          </div>
        </div>

      </div>

      <div class="sc-footer">Jym &middot; Track your training</div>
    </div>
  `,

  // ─── Styles ──────────────────────────────────────────────────────────────────
  styles: [`

    /* ══ Slide-up entrance ══════════════════════════════════════════ */
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

    /* ══ Hero ═══════════════════════════════════════════════════════
       Gradient anchored to the user's theme via CSS vars:
         --bg-sidebar  → always the dark-sidebar tone for that theme
         --color-primary → the theme accent
       This means every theme (earth, clay, forest, midnight, plum…)
       gets a natural hero that feels on-brand.
       ══════════════════════════════════════════════════════════════ */
    .hero {
      position: relative;
      overflow: hidden;
      /* negative margin so it bleeds to the layout edges */
      margin: 0 calc(-1 * var(--space-md)) var(--space-xl);
      background: linear-gradient(150deg, var(--bg-sidebar) 0%, var(--color-primary) 100%);
    }

    /* diagonal stripe texture — pure CSS, no external assets */
    .hero-texture {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: repeating-linear-gradient(
        -45deg,
        rgba(255,255,255,0.04) 0px,  rgba(255,255,255,0.04) 1px,
        transparent              1px,  transparent              14px
      );
      pointer-events: none;
    }

    .hero-content {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: var(--space-2xl) var(--space-xl) var(--space-xl);
      text-align: center;
      color: var(--text-on-dark);
    }

    /* amber glow ring behind the trophy */
    .trophy-ring {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: radial-gradient(
        circle,
        rgba(255,215,0,0.18) 0%,
        rgba(255,215,0,0.05) 60%,
        transparent 100%
      );
      box-shadow:
        0 0 0 1px rgba(255,215,0,0.14),
        0 0 40px rgba(255,215,0,0.08);
      margin-bottom: var(--space-md);
    }

    .trophy {
      width: 60px;
      height: 60px;
      filter: drop-shadow(0 3px 10px rgba(0,0,0,0.45));
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

    .pr-pill {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: rgba(255,255,255,0.15);
      border: 1px solid rgba(255,255,255,0.28);
      border-radius: 20px;
      padding: 4px 14px;
      font-size: var(--font-size-sm);
      font-weight: 700;
      color: var(--text-on-dark);
      margin-bottom: var(--space-xs);
    }

    .type-pill {
      display: inline-block;
      background: rgba(255,255,255,0.12);
      border: 1px solid rgba(255,255,255,0.22);
      border-radius: 20px;
      padding: 3px 12px;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--text-on-dark);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    /* ══ Stats row ══════════════════════════════════════════════════ */
    .stats-row {
      display: flex;
      gap: var(--space-sm);
      margin-bottom: var(--space-xl);
    }

    .stat-card {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md) var(--space-xs) var(--space-sm);
      text-align: center;
      box-shadow: var(--shadow-sm);
    }

    /* coloured top accent stripe — fixed colours so charts are always
       visually distinct regardless of the user's colour theme */
    .stat-stripe {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
    }

    .stat-value {
      font-family: var(--font-family-display);
      font-size: 1.1rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1.1;
      margin-top: 4px;
    }

    .stat-label {
      font-size: 9px;
      color: var(--text-muted);
      margin-top: 3px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      font-weight: 600;
    }

    /* ══ Section ════════════════════════════════════════════════════ */
    .section { margin-bottom: var(--space-xl); }

    .section-label {
      font-family: var(--font-family);
      font-size: 10px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin: 0 0 var(--space-md);
    }

    .empty-note {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-align: center;
      padding: var(--space-lg) 0;
      margin: 0;
    }

    /* ══ Muscle group bars ══════════════════════════════════════════ */
    .mg-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 10px;
    }

    .mg-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      flex-shrink: 0;
    }

    .mg-name {
      width: 84px;
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
      background: var(--border-color);
      border-radius: 4px;
      overflow: hidden;
    }

    .mg-fill {
      height: 100%;
      border-radius: 4px;
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

    /* ══ Lift cards ═════════════════════════════════════════════════ */
    .lift-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-sm);
      padding: 12px var(--space-md);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-left-width: 4px;
      border-radius: var(--border-radius);
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
      font-size: 11px;
      color: var(--text-muted);
      text-transform: capitalize;
    }

    .lift-aside {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 0;
    }

    .pr-icon {
      display: inline-flex;
      align-items: center;
      flex-shrink: 0;
    }

    .best-tag {
      font-size: 10px;
      font-weight: 600;
      color: var(--text-muted);
      border: 1px solid var(--border-color);
      border-radius: 5px;
      padding: 2px 7px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      white-space: nowrap;
    }

    .lift-weight {
      font-size: var(--font-size-md);
      font-weight: 700;
      color: var(--text-primary);
      white-space: nowrap;
    }

    /* ══ Action buttons ═════════════════════════════════════════════ */
    .action-row {
      display: flex;
      gap: var(--space-md);
      padding-bottom: var(--space-lg);
    }

    .btn-share {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 11px 12px;
      background: var(--color-primary);
      color: var(--text-on-primary);
      border: none;
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-weight: 700;
      font-family: inherit;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: var(--shadow-md);
      transition: opacity 0.15s, transform 0.1s;
    }

    .btn-share:not(:disabled):hover  { opacity: 0.9; transform: translateY(-1px); }
    .btn-share:not(:disabled):active { opacity: 1;   transform: translateY(0); }
    .btn-share:disabled              { opacity: 0.6; cursor: not-allowed; }

    .btn-done {
      flex: 1;
      padding: 11px 12px;
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-weight: 600;
      font-family: inherit;
      white-space: nowrap;
      cursor: pointer;
      box-shadow: var(--shadow-sm);
      transition: opacity 0.15s;
    }

    .btn-done:hover { opacity: 0.8; }

    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
      flex-shrink: 0;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    /* ══════════════════════════════════════════════════════════════════
       SHARE CARD — 375 × 667 px
       ─────────────────────────────────────────────────────────────────
       Rules for this section:
         • Every colour/size value is a hardcoded literal.
         • NO var(--...) — CSS custom properties are NOT resolved in the
           html-to-image clone, they render as transparent or zero.
         • NO 'inset' shorthand — not supported in the clone renderer;
           use explicit top / right / bottom / left instead.
         • The full-card gradient prevents a dead-black void when content
           is sparse (e.g. only 1 exercise logged).
       ══════════════════════════════════════════════════════════════════ */
    .sc {
      position: fixed;
      left: -9999px;
      top: 0;
      width: 375px;
      height: 667px;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'DM Sans', 'Inter', sans-serif;
      display: flex;
      flex-direction: column;
      /* unified warm-dark gradient covers the whole card */
      background: linear-gradient(160deg, #4a1a0c 0%, #6b2416 28%, #2d1008 62%, #1a0806 100%);
      color: #f0e8e0;
    }

    /* ── Header ────────────────────────────────────────────── */
    .sc-hdr {
      position: relative;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      /* large padding so the header anchors ≈40% of the card height */
      padding: 40px 20px 30px;
      /* neutral dark overlay — works on all colour themes */
      background: rgba(0,0,0,0.18);
      border-bottom: 1px solid rgba(255,255,255,0.09);
    }

    .sc-logo {
      position: absolute;
      top: 14px;
      right: 18px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.18em;
      color: rgba(255,255,255,0.45);
    }

    .sc-trophy-wrap {
      position: relative;
      margin-bottom: 14px;
    }

    /* amber glow: explicit sides, not 'inset' shorthand */
    .sc-glow {
      position: absolute;
      top: -18px;
      left: -18px;
      right: -18px;
      bottom: -18px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(255,215,0,0.28) 0%, transparent 68%);
    }

    .sc-title {
      margin: 0;
      color: #fff;
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.01em;
      white-space: nowrap;
    }

    /* ── Stats strip ───────────────────────────────────────── */
    .sc-stats {
      display: flex;
      flex-shrink: 0;
      background: rgba(0,0,0,0.28);
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    .sc-stat  { flex: 1; padding: 13px 6px; text-align: center; }
    .sc-div   { width: 1px; background: rgba(255,255,255,0.08); flex-shrink: 0; }

    .sc-sv {
      font-size: 15px;
      font-weight: 800;
      color: #f5e8d8;
      line-height: 1.1;
    }

    .sc-sl {
      font-size: 9px;
      color: rgba(245,232,216,0.42);
      margin-top: 2px;
      letter-spacing: 0.07em;
    }

    /* ── Body wrapper: fills remaining space and centres its children
          vertically so sparse content never creates a dead void ── */
    .sc-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      padding: 0 18px;
      gap: 0;
    }

    /* ── Top lifts ─────────────────────────────────────────── */
    .sc-lifts {
      padding: 14px 0 12px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
    }

    /* ── Muscle groups ─────────────────────────────────────── */
    .sc-muscles {
      padding: 14px 0 4px;
    }

    .sc-slabel {
      font-size: 9px;
      font-weight: 800;
      color: rgba(245,232,216,0.36);
      letter-spacing: 0.12em;
      margin-bottom: 9px;
    }

    .sc-lift {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 5px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }

    .sc-lift:last-child { border-bottom: none; }

    .sc-rank {
      width: 14px;
      font-size: 10px;
      font-weight: 700;
      color: rgba(245,232,216,0.32);
      flex-shrink: 0;
      text-align: center;
    }

    .sc-lname {
      flex: 1;
      font-size: 12px;
      font-weight: 500;
      color: #f5e8d8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .sc-pr { display: inline-flex; align-items: center; flex-shrink: 0; }

    .sc-lw {
      font-size: 12px;
      font-weight: 700;
      color: #f5e8d8;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .sc-mg {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 8px;
    }

    .sc-mg-dot  { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }

    .sc-mg-name {
      width: 70px;
      font-size: 11px;
      color: rgba(245,232,216,0.78);
      text-transform: capitalize;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 0;
    }

    .sc-mg-track {
      flex: 1;
      height: 5px;
      background: rgba(255,255,255,0.12);
      border-radius: 3px;
      overflow: hidden;
    }

    .sc-mg-fill { height: 100%; border-radius: 3px; }

    .sc-mg-pct {
      width: 28px;
      font-size: 9px;
      color: rgba(245,232,216,0.38);
      text-align: right;
      flex-shrink: 0;
    }

    /* ── Footer ────────────────────────────────────────────── */
    .sc-footer {
      flex-shrink: 0;
      padding: 10px 18px;
      text-align: center;
      font-size: 10px;
      color: rgba(245,232,216,0.28);
      border-top: 1px solid rgba(255,255,255,0.07);
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

  @ViewChild('shareCard') shareCardEl!: ElementRef<HTMLDivElement>;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const state = history.state as SummaryState | undefined;
    if (!state?.blocks) {
      this.router.navigate(['/jym']);
      return;
    }
    this.computeStats(state);
  }

  liftColor(lift: LiftHighlight): string {
    return muscleColor(lift.muscleGroup ?? 'other');
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
        exerciseName: block.exerciseName,
        muscleGroup: block.muscleGroup,
        weight: best.weight,
        reps: best.reps,
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

      // Read the user's active theme colours from computed CSS vars.
      // getComputedStyle on :root returns resolved hex values, not var() refs,
      // so html-to-image (which can't resolve CSS custom properties in its
      // clone context) will see real colours.
      const root = getComputedStyle(document.documentElement);
      const sidebar = root.getPropertyValue('--bg-sidebar').trim();
      const primary = root.getPropertyValue('--color-primary').trim();

      // Apply theme-aware gradient as an inline style (overrides the class).
      // A semi-transparent dark overlay on top keeps the card moody and
      // readable regardless of which theme is selected.
      el.style.background =
        `linear-gradient(rgba(0,0,0,0.30), rgba(0,0,0,0.52)),` +
        `linear-gradient(160deg, ${sidebar} 0%, ${primary} 45%, ${sidebar} 100%)`;

      // Temporarily move the card into the visible viewport.
      // html-to-image uses getComputedStyle() which may skip painting
      // for elements at left:-9999px, producing a blank image.
      el.style.left = '0';
      await new Promise<void>(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      // skipFonts: true prevents html-to-image from trying to read
      // cross-origin Google Fonts CSS, which throws a CORS SecurityError.
      // The share card uses a system font stack so no fonts are needed.
      const dataUrl = await toPng(el, { pixelRatio: 2, width: 375, height: 667, skipFonts: true });

      // Restore element to off-screen and clear the inline style override.
      el.style.left = '-9999px';
      el.style.background = '';

      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'workout.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'My Workout — Jym' });
      } else {
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'workout.png';
        a.click();
      }
    } catch (e) {
      console.error('Share failed', e);
      el.style.left = '-9999px';
      el.style.background = '';
    } finally {
      this.sharing.set(false);
    }
  }

  done(): void {
    this.router.navigate(['/jym']);
  }
}
