import { Component, DestroyRef, ElementRef, OnInit, PLATFORM_ID, afterNextRender, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, JiroIconComponent, JiroLogoComponent, JiroMarkComponent],
  template: `
    <div class="landing">

      <!-- ── Nav ───────────────────────────────────────────────────────────── -->
      <nav class="l-nav" aria-label="Main">
        <div class="l-nav-inner">
          <!-- The logo is a span inside a link, never a heading: the hero keeps the h1. -->
          <a routerLink="/" class="l-logo" aria-label="Jiro home">
            <jiro-logo [size]="30" />
          </a>
          <div class="l-nav-links">
            <a routerLink="/login" class="l-nav-login">Log in</a>
            <a routerLink="/register" class="l-nav-cta">Get started</a>
          </div>
        </div>
      </nav>

      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <!-- Split at desktop: copy on the left, the screenshot on the right,
           bleeding off the viewport's right edge. Below 900px it stacks. -->
      <section class="l-hero">
        <div class="l-hero-grid">
          <div class="l-hero-copy">
            <h1 class="l-hero-title">Your Life,<br><em>Unified.</em></h1>
            <p class="l-hero-sub">
              One modular platform for your recipes, workouts, journal, and more.
              No ads. No clutter. Just your life, beautifully organised.
            </p>
            <div class="l-hero-actions">
              <a routerLink="/register" class="l-btn l-btn--primary">Get started</a>
              <!-- A real href, so this works without JavaScript and is reachable
                   by keyboard. The handler only upgrades the jump to a smooth
                   scroll; preventDefault is conditional on that. -->
              <a href="#modules" class="l-btn l-btn--ghost" (click)="scrollToModules($event)">Explore modules</a>
            </div>
          </div>

          <!-- The real dashboard, shot in dark mode. Re-shoot after UI changes.
               Phones get a portrait phone shot: the desktop one is unreadable
               at that width. -->
          <div class="l-hero-shot-wrap">
            <picture>
              <source
                media="(max-width: 600px)"
                srcset="/images/landing/dashboard-phone-dark.webp"
                width="780"
                height="1280" />
              <img
                class="l-hero-shot"
                src="/images/landing/dashboard.webp"
                width="1440"
                height="900"
                fetchpriority="high"
                decoding="async"
                alt="The Jiro dashboard in dark mode: a workout in progress, a journal streak, a cook streak, the month's income and spending, budget bars and a two-week activity strip." />
            </picture>
          </div>
        </div>
      </section>

      <!-- ── Module Bento ───────────────────────────────────────────────────── -->
      <section class="l-modules" id="modules">
        <div class="l-section-inner l-reveal">
          <h2 class="l-section-title l-section-title--with-lead">Every corner of your life, covered.</h2>
          <p class="l-section-lead">
            All modules share the same design language, data layer, and account. No juggling five separate apps.
            Use only what you need. Each module is independent but lives in the same elegant workspace.
          </p>

          <div class="l-bento">

            <!-- Culinara — large -->
            <div class="l-card l-card--culinara" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <jiro-mark name="culinara" [size]="24" />
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
                  <jiro-mark name="journaly" [size]="24" />
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
                  <jiro-mark name="jym" [size]="24" />
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
                  <jiro-mark name="ledger" [size]="24" />
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
                  <jiro-mark name="echo" [size]="24" />
                </div>
                <h3 class="l-card-name">Echo</h3>
                <p class="l-card-desc">Smart reminders that fit your rhythm. Recurring schedules, multi-channel delivery.</p>
              </div>
              <div class="l-card-badge">Coming soon</div>
            </div>

          </div>
        </div>
      </section>

      <!-- ── Privacy ────────────────────────────────────────────────────────── -->
      <!-- Every line here must stay literally true. The product keeps a
           first-party event log, so "no analytics" or "no tracking" would not. -->
      <section class="l-privacy" aria-labelledby="l-privacy-title">
        <div class="l-section-inner l-reveal">
          <h2 class="l-section-title" id="l-privacy-title">Private by default</h2>
          <ul class="l-privacy-list">
            <li><jiro-icon name="check-circle" [size]="24" /><span>No ads</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>No third-party scripts</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>No third-party analytics</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>Your data exports in one click</span></li>
          </ul>
          <p class="l-privacy-note">Self-host it if you would rather not take our word for it.</p>
        </div>
      </section>

      <!-- ── Final CTA ──────────────────────────────────────────────────────── -->
      <section class="l-final">
        <div class="l-final-inner l-reveal">
          <h2>Ready to organise your chaos?</h2>
          <a routerLink="/register" class="l-btn l-btn--primary l-btn--lg">Get started</a>
        </div>
      </section>

      <!-- ── Footer ─────────────────────────────────────────────────────────── -->
      <footer class="l-footer">
        <div class="l-footer-inner">
          <div class="l-footer-brand">
            <jiro-logo [size]="22" />
            <span class="l-footer-copy">© 2026 Jiro.</span>
          </div>
          <nav class="l-footer-nav" aria-label="Footer">
            <!-- Journaly and Ledger have no public page yet, so they are text. -->
            <ul class="l-footer-list" aria-label="Modules">
              <li><a routerLink="/culinara/discover">Culinara</a></li>
              <li><a routerLink="/jym/discover">Jym</a></li>
              <li><span>Journaly</span></li>
              <li><span>Ledger</span></li>
            </ul>
            <ul class="l-footer-list" aria-label="Jiro">
              <li><a routerLink="/login">Log in</a></li>
              <li><a routerLink="/register">Get started</a></li>
              <li><a routerLink="/privacy">Privacy</a></li>
              <li><a routerLink="/terms">Terms</a></li>
            </ul>
          </nav>
        </div>
      </footer>

    </div>
  `,
  styles: [`
    :host { display: block; }

    /* ── Reset / Base ──────────────────────────────────────────────────────── */
    .landing {
      min-height: 100dvh;
      background: var(--bg-canvas);
      color: var(--text-primary);
      overflow-x: hidden;
    }

    a { text-decoration: none; cursor: pointer; }

    /* ── Layout helpers ────────────────────────────────────────────────────── */
    .l-nav-inner,
    .l-section-inner,
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
      z-index: var(--z-sticky);
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
    .l-logo {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      color: var(--text-primary);
      border-radius: var(--border-radius-sm);
    }
    .l-nav-links { display: flex; align-items: center; gap: var(--space-sm); }
    .l-nav-login,
    .l-nav-cta {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      padding: 0 14px;
      font-size: var(--font-size-sm);
      border-radius: var(--border-radius-sm);
    }
    .l-nav-login {
      color: var(--text-secondary);
      transition: color 0.15s;
    }
    .l-nav-login:hover { color: var(--text-primary); }
    .l-nav-cta {
      font-weight: 600;
      color: var(--color-primary);
      border: 1.5px solid var(--color-primary);
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
      min-height: 44px;
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
    }
    .l-btn--ghost {
      background: transparent;
      color: var(--text-secondary);
      border: 1px solid var(--border-color);
    }
    .l-btn--ghost:hover { color: var(--text-primary); border-color: var(--text-secondary); }
    .l-btn--lg { padding: 14px 32px; font-size: var(--font-size-md); }

    /* ── Hero ──────────────────────────────────────────────────────────────── */
    /* Mobile first: one column, copy then image, inside the page gutter. */
    .l-hero {
      position: relative;
      padding: 60px 0 50px;
      overflow: hidden;
    }
    .l-hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-xl);
      max-width: 1080px;
      margin: 0 auto;
      padding: 0 var(--space-xl);
    }
    .l-hero-title {
      font-size: clamp(2.6rem, 5.5vw, 4.75rem);
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
      margin: 0 0 var(--space-xl);
      line-height: 1.65;
      animation: fadeUp 0.6s 0.1s ease both;
    }
    .l-hero-actions {
      display: flex;
      gap: var(--space-sm);
      flex-wrap: wrap;
      animation: fadeUp 0.65s 0.15s ease both;
    }

    /* ── Hero screenshot ───────────────────────────────────────────────────── */
    .l-hero-shot-wrap { min-width: 0; }
    .l-hero-shot-wrap picture { display: block; }
    .l-hero-shot {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      box-shadow: var(--shadow-lg);
      background: var(--bg-surface);
    }

    @media (min-width: 601px) {
      .l-hero { padding: 100px 0 80px; }
    }

    /* Desktop split. The grid drops its right padding and its max-width, and
       its left padding keeps the copy on the same line as the 1080px
       container below; the image is wider than its column, so it runs past
       the viewport's right edge and the section clips it. */
    @media (min-width: 900px) {
      .l-hero-grid {
        max-width: none;
        margin: 0;
        grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
        align-items: center;
        gap: var(--space-3xl);
        padding-right: 0;
        padding-left: max(var(--space-xl), calc((100% - 1080px) / 2 + var(--space-xl)));
      }
      .l-hero-shot-wrap { width: 125%; }
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
    /* A title with a lead under it gives up most of its bottom margin. */
    .l-section-title--with-lead { margin-bottom: var(--space-md); }
    .l-section-lead {
      font-size: var(--font-size-md);
      color: var(--text-secondary);
      line-height: 1.65;
      max-width: 640px;
      margin: 0 0 var(--space-xl);
    }

    /* ── Section reveal ────────────────────────────────────────────────────── */
    /* One reveal per section. The hidden state only exists once the observer
       is running (the host gets .reveal-ready from JS), so the prerendered
       page and a page without JS show everything. Sections already on screen
       are marked visible before that class lands, so they never flash. */
    @media (prefers-reduced-motion: no-preference) {
      :host(.reveal-ready) .l-reveal:not(.is-visible) {
        opacity: 0;
        transform: translateY(12px);
      }
      :host(.reveal-ready) .l-reveal.is-visible {
        transition:
          opacity 600ms cubic-bezier(0.16, 1, 0.3, 1),
          transform 600ms cubic-bezier(0.16, 1, 0.3, 1);
      }
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

    /* Card base. Hard offset shadow like jiro-card: small at rest, medium
       on hover, lifting toward the light. */
    .l-card {
      --mouse-x: 50%;
      --mouse-y: 50%;
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: calc(var(--border-radius) * 1.5);
      box-shadow: var(--shadow-sm);
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
      box-shadow: var(--shadow-md);
      transform: translate(-2px, -2px);
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

    /* Echo: a full-width strip under the grid */
    .l-card--echo {
      grid-column: 1 / 4;
      flex-direction: row;
      align-items: center;
      gap: var(--space-xl);
    }
    .l-card--echo .l-card-content { flex: 1; }
    .l-card-badge {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 5px 12px;
      border: 1.5px dashed var(--border-color);
      border-radius: var(--border-radius-pill);
      color: var(--text-secondary);
      flex-shrink: 0;
    }

    .l-card-content { display: flex; flex-direction: column; gap: var(--space-xs); }
    .l-card-icon {
      width: 40px; height: 40px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: var(--space-xs);
    }
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

    /* ── Privacy ───────────────────────────────────────────────────────────── */
    .l-privacy { padding: 80px 0; }
    .l-privacy-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: var(--space-md) var(--space-xl);
    }
    .l-privacy-list li {
      display: flex;
      align-items: flex-start;
      gap: var(--space-sm);
      padding-top: var(--space-md);
      border-top: 1px solid var(--border-color);
      font-family: var(--font-family-display);
      font-size: var(--font-size-xl);
      font-weight: 600;
      line-height: 1.25;
      color: var(--text-primary);
    }
    .l-privacy-list jiro-icon {
      color: var(--color-accent);
      margin-top: 2px;
    }
    .l-privacy-note {
      margin: var(--space-xl) 0 0;
      font-size: var(--font-size-md);
      color: var(--text-secondary);
      line-height: 1.6;
    }
    @media (min-width: 601px) {
      .l-privacy-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (min-width: 900px) {
      .l-privacy-list { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }

    /* ── Final CTA ─────────────────────────────────────────────────────────── */
    .l-final {
      border-top: 1px solid var(--border-color);
      padding: 100px 0;
      text-align: center;
      background: var(--bg-surface);
    }
    .l-final h2 {
      font-size: clamp(1.8rem, 4vw, 3rem);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 var(--space-xl);
    }

    /* ── Footer ────────────────────────────────────────────────────────────── */
    .l-footer {
      border-top: 1px solid var(--border-color);
      padding: var(--space-lg) 0;
    }
    .l-footer-inner {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-lg) var(--space-xl);
      flex-wrap: wrap;
    }
    .l-footer-brand {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
      color: var(--text-primary);
      padding-top: 10px;
    }
    .l-footer-copy { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .l-footer-nav { display: flex; flex-wrap: wrap; gap: 0 var(--space-2xl); }
    .l-footer-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
    }
    .l-footer-list a,
    .l-footer-list span {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
    .l-footer-list a { transition: color 0.15s; }
    .l-footer-list a:hover { color: var(--text-primary); }

    /* ── Animations ────────────────────────────────────────────────────────── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @media (prefers-reduced-motion: reduce) {
      .l-hero-title,
      .l-hero-sub,
      .l-hero-actions { animation: none; }
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
    }

    @media (max-width: 600px) {
      .l-bento { grid-template-columns: 1fr; }
      .l-card--culinara,
      .l-card--journaly,
      .l-card--jym,
      .l-card--ledger,
      .l-card--echo { grid-column: 1; grid-row: auto; flex-direction: column; }
    }
  `]
})
export class LandingComponent implements OnInit {
  private auth = inject(AuthService);
  private router = inject(Router);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private revealObserver?: IntersectionObserver;

  /** Honour the OS setting: no glare, section reveal or smooth scroll. */
  readonly reducedMotion =
    this.isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revealObserver?.disconnect());
    // Browser only: afterNextRender never runs during prerender.
    afterNextRender(() => this.setUpReveal());
  }

  async ngOnInit() {
    // Wait for the startup token refresh to settle before deciding. The stored
    // user is restored synchronously, so a visitor arriving with a stale
    // session would otherwise be sent to /dashboard, bounced back to /login by
    // the guard, and never see the page they actually asked for.
    await this.auth.whenInitialized();
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  /**
   * One scroll reveal per section. Sections already on screen are marked
   * visible first, then the host gets `.reveal-ready`, which is what hides
   * the rest; both happen in the same task, so nothing on screen flashes.
   */
  private setUpReveal() {
    if (!this.isBrowser || this.reducedMotion || typeof IntersectionObserver === 'undefined') return;

    const root = this.host.nativeElement;
    const viewportHeight = window.innerHeight;
    const pending = Array.from(root.querySelectorAll<HTMLElement>('.l-reveal')).filter(el => {
      const rect = el.getBoundingClientRect();
      const onScreen = rect.top < viewportHeight && rect.bottom > 0;
      if (onScreen) el.classList.add('is-visible');
      return !onScreen;
    });
    if (!pending.length) return;

    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    }, { rootMargin: '0px 0px -10% 0px' });
    this.revealObserver = observer;
    pending.forEach(el => observer.observe(el));
    root.classList.add('reveal-ready');
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

  /**
   * The link already works on its own: `href="#modules"` jumps there with no
   * JavaScript at all. This only upgrades the jump to a smooth scroll, so it
   * takes over the event solely when it is actually going to do something
   * different from the browser's default.
   */
  scrollToModules(event: Event) {
    if (this.reducedMotion) return;
    const target = document.getElementById('modules');
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth' });
  }
}
