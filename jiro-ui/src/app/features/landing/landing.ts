import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { trigger, transition, style, animate, query, stagger } from '@angular/animations';
import { AuthService } from '../../core/services/auth.service';

const bentoAnimation = trigger('bentoEntrance', [
  transition(':enter', [
    query('.l-card', [
      style({ opacity: 0, transform: 'translateY(40px) scale(0.98)' })
    ], { optional: true }),
    query('.l-card', [
      stagger('120ms', [
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)',
          style({ opacity: 1, transform: 'translateY(0) scale(1)' })
        )
      ])
    ], { optional: true })
  ])
]);

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  animations: [bentoAnimation],
  template: `
    <div class="landing">

      <!-- ── Nav ───────────────────────────────────────────────────────────── -->
      <nav class="l-nav">
        <div class="l-nav-inner">
          <div class="l-logo">
            <span class="l-logo-mark">J</span>
            <span class="l-logo-text">iro</span>
          </div>
          <div class="l-nav-links">
            <a routerLink="/login" class="l-nav-login">Log in</a>
            <a routerLink="/register" class="l-nav-cta">Get started</a>
          </div>
        </div>
      </nav>

      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <section class="l-hero">
        <div class="l-hero-inner">
          <h1 class="l-hero-title">Your Life,<br><em>Unified.</em></h1>
          <p class="l-hero-sub">
            One modular platform for your recipes, workouts, journal, and more.
            No ads. No clutter. Just your life, beautifully organised.
          </p>
          <div class="l-hero-actions">
            <a routerLink="/register" class="l-btn l-btn--primary">Get started</a>
            <a class="l-btn l-btn--ghost" (click)="scrollToModules()">Explore modules</a>
          </div>
        </div>

        <!-- The real dashboard, shot in dark mode. Re-shoot after UI changes. -->
        <div class="l-hero-shot-wrap">
          <img
            class="l-hero-shot"
            src="/images/landing/dashboard.webp"
            width="1440"
            height="900"
            fetchpriority="high"
            decoding="async"
            alt="The Jiro dashboard in dark mode: a workout in progress, a journal streak, a cook streak, the month's income and spending, budget bars and a two-week activity strip." />
        </div>

        <!-- Decorative orbs -->
        <div class="l-orb l-orb--1" aria-hidden="true"></div>
        <div class="l-orb l-orb--2" aria-hidden="true"></div>
      </section>

      <!-- ── Module Bento ───────────────────────────────────────────────────── -->
      <section class="l-modules" id="modules">
        <div class="l-section-inner">
          <h2 class="l-section-title">Every corner of your life, covered.</h2>

          <div class="l-bento" [@.disabled]="reducedMotion" [@bentoEntrance]>

            <!-- Culinara — large -->
            <div class="l-card l-card--culinara" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <img src="/icons/culinara-icon.svg" width="24" height="24" alt="Culinara" />
                </div>
                <h3 class="l-card-name">Culinara</h3>
                <p class="l-card-desc">Perfect your recipes. Log every trial, promote the winner to your permanent cookbook.</p>
              </div>
              <div class="l-card-shot">
                <img
                  src="/images/landing/culinara.webp"
                  width="728"
                  height="232"
                  loading="lazy"
                  decoding="async"
                  alt="The Culinara recipe list: six recipes with tags, ingredient chips, trial counts and star ratings." />
              </div>
            </div>

            <!-- Journaly — tall -->
            <div class="l-card l-card--journaly" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <img src="/icons/journaly-icon.svg" width="24" height="24" alt="Journaly" />
                </div>
                <h3 class="l-card-name">Journaly</h3>
                <p class="l-card-desc">Private reflections or shared journals. Track your mood, write daily, watch your streak grow.</p>
              </div>
              <div class="l-card-shot">
                <img
                  src="/images/landing/journaly.webp"
                  width="720"
                  height="1240"
                  loading="lazy"
                  decoding="async"
                  alt="Journaly on a phone: a writing streak, and a chart of how the last thirty days felt broken down by mood." />
              </div>
            </div>

            <!-- Jym — medium -->
            <div class="l-card l-card--jym" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <img src="/icons/jym-icon.svg" width="24" height="24" alt="Jym" />
                </div>
                <h3 class="l-card-name">Jym</h3>
                <p class="l-card-desc">Log sets, track volume, and visualise your strength journey with PR detection and progress charts.</p>
              </div>
              <div class="l-card-shot">
                <img
                  src="/images/landing/jym.webp"
                  width="400"
                  height="300"
                  loading="lazy"
                  decoding="async"
                  alt="A Jym session in progress: two exercises with logged sets, weights in pounds, and personal-record badges." />
              </div>
            </div>

            <!-- Ledger — medium -->
            <div class="l-card l-card--ledger" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <img src="/icons/ledger-icon.svg" width="24" height="24" alt="Ledger" />
                </div>
                <h3 class="l-card-name">Ledger</h3>
                <p class="l-card-desc">Track spending, set budgets, and watch your net worth grow over time.</p>
              </div>
              <div class="l-card-shot">
                <img
                  src="/images/landing/ledger.webp"
                  width="498"
                  height="375"
                  loading="lazy"
                  decoding="async"
                  alt="The Ledger overview: the month's income, spending and savings rate, three budget bars and recent transactions." />
              </div>
            </div>

            <!-- Echo — small -->
            <div class="l-card l-card--echo" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <img src="/icons/echo-icon.svg" width="24" height="24" alt="Echo" />
                </div>
                <h3 class="l-card-name">Echo</h3>
                <p class="l-card-desc">Smart reminders that fit your rhythm. Recurring schedules, multi-channel delivery. Coming soon.</p>
              </div>
              <div class="l-card-badge">Coming soon</div>
            </div>

          </div>
        </div>
      </section>

      <!-- ── Why Jiro ───────────────────────────────────────────────────────── -->
      <section class="l-why">
        <div class="l-section-inner">
          <h2 class="l-section-title">Built different, on purpose.</h2>
          <div class="l-pillars">
            <div class="l-pillar">
              <div class="l-pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h4>Private by default</h4>
              <p>Your data is yours. No tracking, no third-party analytics, nothing sold on, no ads. Self-host it if you would rather not take our word for it.</p>
            </div>
            <div class="l-pillar">
              <div class="l-pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 21 12"/><path d="M21 12V2h-10"/>
                </svg>
              </div>
              <h4>One coherent system</h4>
              <p>All modules share the same design language, data layer, and account — no juggling five separate apps.</p>
            </div>
            <div class="l-pillar">
              <div class="l-pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <h4>Modular by design</h4>
              <p>Use only what you need. Each module is independent but lives in the same elegant workspace.</p>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Final CTA ──────────────────────────────────────────────────────── -->
      <section class="l-final">
        <div class="l-final-inner">
          <h2>Ready to organise your chaos?</h2>
          <a routerLink="/register" class="l-btn l-btn--primary l-btn--lg">Get started</a>
        </div>
        <div class="l-orb l-orb--3" aria-hidden="true"></div>
      </section>

      <!-- ── Footer ─────────────────────────────────────────────────────────── -->
      <footer class="l-footer">
        <div class="l-footer-inner">
          <span class="l-footer-logo">Jiro</span>
          <span class="l-footer-copy">© 2026 Jiro. All rights reserved.</span>
          <div class="l-footer-links">
            <a routerLink="/login">Log in</a>
            <a routerLink="/register">Get started</a>
          </div>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Reset / Base ──────────────────────────────────────────────────────── */
    .landing {
      min-height: 100vh;
      background: var(--bg-canvas);
      color: var(--text-primary);
      overflow-x: hidden;
    }

    a { text-decoration: none; cursor: pointer; }

    /* ── Layout helpers ────────────────────────────────────────────────────── */
    .l-nav-inner,
    .l-section-inner,
    .l-hero-inner,
    .l-final-inner,
    .l-footer-inner {
      max-width: 1080px;
      margin: 0 auto;
      padding: 0 var(--space-xl);
    }

    /* ── Nav ───────────────────────────────────────────────────────────────── */
    .l-nav {
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      background: color-mix(in srgb, var(--bg-canvas) 80%, transparent);
      border-bottom: 1px solid var(--border-color);
    }
    .l-nav-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 60px;
    }
    .l-logo { display: flex; align-items: baseline; gap: 0; }
    .l-logo-mark {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--color-primary);
      line-height: 1;
    }
    .l-logo-text {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      line-height: 1;
    }
    .l-nav-links { display: flex; align-items: center; gap: var(--space-sm); }
    .l-nav-login {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      padding: 7px 14px;
      border-radius: var(--border-radius-sm);
      transition: color 0.15s;
    }
    .l-nav-login:hover { color: var(--text-primary); }
    .l-nav-cta {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--color-primary);
      padding: 7px 14px;
      border: 1.5px solid var(--color-primary);
      border-radius: var(--border-radius-sm);
      transition: background 0.15s, color 0.15s;
    }
    .l-nav-cta:hover {
      background: var(--color-primary);
      color: var(--text-on-primary);
    }

    /* ── Buttons ───────────────────────────────────────────────────────────── */
    .l-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
      font-weight: 600;
      border-radius: var(--border-radius-sm);
      transition: transform 0.12s, box-shadow 0.12s, opacity 0.12s;
      cursor: pointer;
      border: none;
      padding: 11px 24px;
      font-size: var(--font-size-sm);
    }
    .l-btn:hover { transform: translateY(-1px); }
    .l-btn--primary {
      background: var(--color-primary);
      color: var(--text-on-primary);
      box-shadow: 0 2px 12px color-mix(in srgb, var(--color-primary) 35%, transparent);
    }
    .l-btn--primary:hover {
      box-shadow: 0 4px 20px color-mix(in srgb, var(--color-primary) 45%, transparent);
    }
    .l-btn--ghost {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }
    .l-btn--ghost:hover { color: var(--text-primary); border-color: var(--text-secondary); }
    .l-btn--lg { padding: 14px 32px; font-size: var(--font-size-md); }

    /* ── Orbs ──────────────────────────────────────────────────────────────── */
    .l-orb {
      position: absolute;
      border-radius: 50%;
      filter: blur(80px);
      pointer-events: none;
      z-index: 0;
    }
    .l-orb--1 {
      width: 500px; height: 500px;
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      top: -120px; right: -100px;
    }
    .l-orb--2 {
      width: 300px; height: 300px;
      background: color-mix(in srgb, var(--color-primary) 6%, transparent);
      bottom: 0; left: -60px;
    }
    .l-orb--3 {
      width: 600px; height: 400px;
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
    }

    /* ── Hero ──────────────────────────────────────────────────────────────── */
    .l-hero {
      position: relative;
      padding: 100px 0 80px;
      text-align: center;
      overflow: hidden;
    }
    .l-hero-inner { position: relative; z-index: 1; }
    .l-hero-title {
      font-size: clamp(2.8rem, 7vw, 5.5rem);
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.03em;
      margin: 0 0 var(--space-lg);
      color: var(--text-primary);
      animation: fadeUp 0.55s 0.05s ease both;
    }
    .l-hero-title em {
      font-style: normal;
      color: var(--color-primary);
    }
    .l-hero-sub {
      font-size: var(--font-size-lg);
      color: var(--text-secondary);
      max-width: 520px;
      margin: 0 auto var(--space-xl);
      line-height: 1.65;
      animation: fadeUp 0.6s 0.1s ease both;
    }
    .l-hero-actions {
      display: flex;
      gap: var(--space-sm);
      justify-content: center;
      flex-wrap: wrap;
      animation: fadeUp 0.65s 0.15s ease both;
    }

    /* ── Hero Mockup ───────────────────────────────────────────────────────── */
    /* Abstract Sidebar */
    .w-12 { width: 48px; } .w-16 { width: 64px; } .w-10 { width: 40px; } .w-20 { width: 80px; } .w-18 { width: 72px; } .w-24 { width: 96px; }
    .w-full { width: 100%; } .w-3-4 { width: 75%; } .w-2-3 { width: 66%; } .w-5-6 { width: 83%; } .w-1-2 { width: 50%; }
    /* Abstract Main Content */

    /* ── Hero screenshot ───────────────────────────────────────────────────── */
    .l-hero-shot-wrap {
      position: relative;
      z-index: 2;
      max-width: 900px;
      margin: 60px auto 0;
      /* A fixed angle reads as a composition; a photo of a UI that swings with
         the cursor fights its own perspective. */
      transform: rotate(-0.6deg);
    }

    .l-hero-shot {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
      background: var(--bg-surface);
    }

    @media (max-width: 600px) {
      .l-hero-shot-wrap { margin-top: var(--space-xl); transform: none; }
    }

    /* ── Module card screenshots ───────────────────────────────────────────── */
    .l-card-shot {
      margin-top: auto;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      overflow: hidden;
      background: var(--bg-surface);
      line-height: 0;
    }

    .l-card-shot img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top left;
    }

    /* Each card is a different shape, so the frame is set per card and the
       image crops into it rather than the image dictating the layout. */
    .l-card--culinara .l-card-shot { aspect-ratio: 728 / 232; }
    /* This card is double height. The phone sits as a device on the card,
       whole and uncropped, filling the space that is left. A cover crop here
       cut the app's own header off the sides. */
    .l-card--journaly .l-card-shot {
      flex: 1;
      min-height: 260px;
      border: none;
      background: none;
      overflow: visible;
    }
    .l-card--journaly .l-card-shot img {
      object-fit: contain;
      object-position: top center;
      border-radius: var(--border-radius);
      border: 1px solid var(--border-color);
      box-shadow: var(--shadow-md);
    }
    .l-card--jym .l-card-shot { aspect-ratio: 4 / 3; }
    .l-card--ledger .l-card-shot { aspect-ratio: 4 / 3; }

    @media (max-width: 700px) {
      /* Stacked, the portrait shot would run away with the page. */
      .l-card--journaly .l-card-shot { flex: none; min-height: 0; }
      .l-card--journaly .l-card-shot img { max-height: 420px; }

      /* One column, the wide recipe crop becomes an unreadable sliver, so it
         crops to the first card instead of shrinking to fit two. */
      .l-card--culinara .l-card-shot { aspect-ratio: 16 / 10; }
    }

    /* ── Section shared ────────────────────────────────────────────────────── */
    .l-section-title {
      font-size: clamp(1.6rem, 4vw, 2.4rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 var(--space-xl);
      color: var(--text-primary);
    }

    /* ── Modules ───────────────────────────────────────────────────────────── */
    .l-modules {
      padding: 80px 0;
      background: var(--bg-surface);
      border-top: 1px solid var(--border-color);
      border-bottom: 1px solid var(--border-color);
    }

    .l-bento {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      grid-template-rows: auto auto;
      gap: 16px;
    }

    /* Card base */
    .l-card {
      --mouse-x: 50%;
      --mouse-y: 50%;
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: calc(var(--border-radius) * 1.5);
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
      overflow: hidden;
      position: relative;
    }
    .l-card::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: radial-gradient(
        circle at var(--mouse-x) var(--mouse-y),
        rgba(255,255,255,0.07) 0%,
        transparent 60%
      );
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s;
      z-index: 1;
    }
    .l-card:hover::after { opacity: 1; }
    .l-card:hover {
      border-color: var(--color-primary);
      box-shadow: 0 8px 32px rgba(0,0,0,0.08);
      transform: translateY(-2px);
    }

    /* Culinara: span 2 cols, row 1 */
    .l-card--culinara {
      grid-column: 1 / 3;
      grid-row: 1;
    }
    .l-card--culinara .l-card-content { flex: 1; }

    /* Journaly: col 3, rows 1–2 */
    .l-card--journaly {
      grid-column: 3;
      grid-row: 1 / 3;
    }

    /* Jym: col 1, row 2 */
    .l-card--jym {
      grid-column: 1;
      grid-row: 2;
    }

    /* Ledger: col 2, row 2 */
    .l-card--ledger {
      grid-column: 2;
      grid-row: 2;
    }

    /* Echo: removed from bento, shown inline */
    .l-card--echo {
      grid-column: 1 / 4;
      flex-direction: row;
      align-items: center;
      gap: var(--space-xl);
      opacity: 0.75;
    }
    .l-card--echo .l-card-content { flex: 1; }
    .l-card-badge {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 5px 12px;
      border: 1.5px dashed var(--border-color);
      border-radius: 99px;
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .l-card-content { display: flex; flex-direction: column; gap: var(--space-xs); }
    .l-card-icon {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: var(--space-xs);
    }
    .l-card-icon img { display: block; }
    .l-card-name {
      font-size: var(--font-size-lg);
      font-weight: 700;
      margin: 0;
      color: var(--text-primary);
    }
    .l-card-desc {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      line-height: 1.6;
      margin: 0;
    }

    /* ── Culinara mockup ───────────────────────────────────────────────────── */
    .l-card--culinara:hover .mc-recipe-card {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 16px 40px rgba(0,0,0,0.1);
    }

    /* ── Journaly mockup ───────────────────────────────────────────────────── */
    .l-card--journaly:hover .mj-streak {
      transform: scale(1.05) rotate(2deg);
    }

    /* ── Jym mockup ────────────────────────────────────────────────────────── */
    .l-card--jym:hover .mjym-bar {
      opacity: 0.8;
    }
    .l-card--jym:hover .mjym-bar--pr {
      opacity: 1;
      transform: scaleY(1.1);
      transform-origin: bottom;
    }
    @keyframes prPulse {
      0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--color-primary) 60%, transparent); }
      70%  { box-shadow: 0 0 0 10px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    .l-card--jym:hover .mjym-pr-badge {
      transform: translateY(-4px) scale(1.05);
    }

    /* ── Ledger mockup ─────────────────────────────────────────────────────── */
    .l-card--ledger:hover .ml-networth { transform: translateY(-3px); }

    /* ── Why Jiro ──────────────────────────────────────────────────────────── */
    .l-why { padding: 80px 0; }
    /* Not three equal columns: privacy is the actual differentiator, so it
       leads at a wider measure and the other two sit beside it. */
    .l-pillars {
      display: grid;
      grid-template-columns: 1.4fr 1fr 1fr;
      gap: var(--space-xl);
      align-items: start;
    }
    .l-pillar { display: flex; flex-direction: column; gap: var(--space-sm); }
    .l-pillar:first-child h4 { font-size: var(--font-size-xl); }
    .l-pillar:first-child p { font-size: var(--font-size-md); }
    .l-pillar-icon {
      width: 44px; height: 44px;
      display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      border-radius: var(--border-radius-sm);
      color: var(--color-primary);
      margin-bottom: var(--space-xs);
    }
    .l-pillar h4 { font-size: var(--font-size-md); font-weight: 700; margin: 0; }
    .l-pillar p { font-size: var(--font-size-sm); color: var(--text-secondary); margin: 0; line-height: 1.6; }

    /* ── Final CTA ─────────────────────────────────────────────────────────── */
    .l-final {
      position: relative;
      overflow: hidden;
      border-top: 1px solid var(--border-color);
      padding: 100px 0;
      text-align: center;
      background: var(--bg-surface);
    }
    .l-final-inner { position: relative; z-index: 1; }
    .l-final h2 {
      font-size: clamp(1.8rem, 4vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 var(--space-sm);
    }
    .l-final p {
      color: var(--text-secondary);
      margin: 0 0 var(--space-xl);
      font-size: var(--font-size-md);
    }

    /* ── Footer ────────────────────────────────────────────────────────────── */
    .l-footer {
      border-top: 1px solid var(--border-color);
      padding: var(--space-lg) 0;
    }
    .l-footer-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-md);
      flex-wrap: wrap;
    }
    .l-footer-logo { font-weight: 800; font-size: var(--font-size-md); color: var(--text-primary); }
    .l-footer-copy { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .l-footer-links { display: flex; gap: var(--space-md); }
    .l-footer-links a { font-size: var(--font-size-xs); color: var(--text-secondary); transition: color 0.15s; }
    .l-footer-links a:hover { color: var(--text-primary); }

    /* ── Animations ────────────────────────────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes heroFloat {
      0%, 100% { transform: translateY(0px); }
      50%       { transform: translateY(-10px); }
    }

    /* ── Responsive ────────────────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .l-bento {
        grid-template-columns: 1fr 1fr;
      }
      .l-card--culinara { grid-column: 1 / 3; }
      .l-card--journaly { grid-column: 1; grid-row: auto; }
      .l-card--jym { grid-column: 2; grid-row: auto; }
      .l-card--ledger { grid-column: 1; grid-row: auto; }
      .l-card--echo { grid-column: 1 / 3; }
      .l-pillars { grid-template-columns: 1fr; gap: var(--space-lg); }
    }

    @media (max-width: 600px) {
      .l-hero { padding: 60px 0 50px; }
      .l-bento { grid-template-columns: 1fr; }
      .l-card--culinara,
      .l-card--journaly,
      .l-card--jym,
      .l-card--ledger,
      .l-card--echo { grid-column: 1; grid-row: auto; flex-direction: column; }
      .l-card--culinara .l-mockup-culinara,
      .l-card--jym .l-mockup-jym { width: 100%; }
    }
  `]
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);

  /** Honour the OS setting: no glare, entrance stagger or smooth scroll. */
  readonly reducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  onCardHover(event: MouseEvent) {
    if (this.reducedMotion) return;
    const card = event.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const x = (((event.clientX - rect.left) / rect.width) * 100).toFixed(1);
    const y = (((event.clientY - rect.top) / rect.height) * 100).toFixed(1);
    card.style.setProperty('--mouse-x', `${x}%`);
    card.style.setProperty('--mouse-y', `${y}%`);
  }

  onCardLeave(event: MouseEvent) {
    const card = event.currentTarget as HTMLElement;
    card.style.setProperty('--mouse-x', '50%');
    card.style.setProperty('--mouse-y', '50%');
  }

  scrollToModules() {
    document.getElementById('modules')?.scrollIntoView({ behavior: this.reducedMotion ? 'auto' : 'smooth' });
  }
}
