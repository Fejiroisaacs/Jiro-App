import { Component, DestroyRef, ElementRef, OnInit, PLATFORM_ID, afterRenderEffect, inject, signal, untracked, viewChildren } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService, demoLoginErrorMessage } from '../../core/services/auth.service';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { JiroLogoComponent } from '../../shared/components/jiro-logo/jiro-logo';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';

@Component({
  selector: 'app-landing',
  standalone: true,
  host: { '[class.reveal-ready]': 'revealReady()' },
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

      <main>
      <!-- ── Hero ──────────────────────────────────────────────────────────── -->
      <!-- Split at desktop: copy on the left, the screenshot on the right,
           bleeding off the viewport's right edge. Below 900px it stacks. -->
      <section class="l-hero">
        <div class="l-hero-grid">
          <div class="l-hero-copy">
            <h1 class="l-hero-title">Your life, in one place.</h1>
            <p class="l-hero-sub">
              One modular platform for your recipes, workouts, journal, and more.
              No ads. No clutter. Just your life, beautifully organised.
            </p>
            <div class="l-hero-actions">
              <a routerLink="/register" class="l-btn l-btn--primary">Get started</a>
              <!-- The demo signs in through the API, so it needs JavaScript;
                   before hydration the click simply does nothing yet. -->
              <button type="button" class="l-btn l-btn--secondary" [disabled]="demoLoading()"
                      [attr.aria-busy]="demoLoading() ? 'true' : null" (click)="tryDemo()">
                @if (demoLoading()) { <span class="spinner spinner--sm l-btn-spinner" aria-hidden="true"></span> }
                Try the demo
              </button>
              <!-- A real href, so this works without JavaScript and is reachable
                   by keyboard. The handler only upgrades the jump to a smooth
                   scroll; preventDefault is conditional on that. -->
              <a href="#modules" class="l-btn l-btn--ghost" (click)="scrollToModules($event)">Explore modules</a>
            </div>
            @if (demoError()) {
              <p class="l-hero-error" role="alert">{{ demoError() }}</p>
            }
          </div>

          <!-- The real dashboard. Light and dark shots, shown to match the app's
               own dark-mode setting (html.dark). Phones get a portrait phone
               shot: the desktop one is unreadable at that width. The light
               pair is the eager/high-priority one; the dark pair is lazy, so a
               light-mode visitor never downloads it. -->
          <div class="l-hero-shot-wrap">
            <picture class="shot-light">
              <source media="(max-width: 600px)" srcset="/images/landing/dashboard-phone-light.webp" width="780" height="1280" />
              <img class="l-hero-shot" width="2160" height="1350"
                fetchpriority="high" decoding="async" alt="The Jiro dashboard: last workout, journal streak, cook streak, a body weight trend, recent recipes, the month's income and spending with budget bars, and a two-week activity strip." src="/images/landing/dashboard-light.webp" />
            </picture>
            <picture class="shot-dark">
              <source media="(max-width: 600px)" srcset="/images/landing/dashboard-phone-dark.webp" width="780" height="1280" />
              <img class="l-hero-shot" width="2160" height="1350"
                loading="lazy" decoding="async" alt="The Jiro dashboard: last workout, journal streak, cook streak, a body weight trend, recent recipes, the month's income and spending with budget bars, and a two-week activity strip." src="/images/landing/dashboard-dark.webp" />
            </picture>
          </div>
        </div>
      </section>

      <!-- ── Module Bento ───────────────────────────────────────────────────── -->
      <section class="l-modules" id="modules">
        <div #reveal data-reveal="modules" class="l-section-inner l-reveal" [class.is-visible]="revealed().has('modules')">
          <h2 class="l-section-title l-section-title--with-lead">Every corner of your life, covered.</h2>
          <p class="l-section-lead">
            All modules share the same design language, data layer, and account. No juggling five separate apps.
            Use only what you need. Each module is independent but lives in the same elegant workspace.
          </p>

          <div class="l-bento">

            <!-- Culinara — large -->
            <div class="l-card l-card--culinara">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <jiro-mark name="culinara" [size]="24" />
                </div>
                <h3 class="l-card-name">Culinara</h3>
                <p class="l-card-desc">Perfect your recipes. Log every trial, promote the winner to your permanent cookbook.</p>
              </div>
              <div class="l-card-shot">
                <img class="shot-light" width="1456" height="464" loading="lazy" decoding="async"
                  alt="The Culinara recipe list: recipe cards with tags, a star rating, trial counts and the main ingredients." src="/images/landing/culinara-light.webp" />
                <img class="shot-dark" width="1456" height="464" loading="lazy" decoding="async"
                  alt="The Culinara recipe list: recipe cards with tags, a star rating, trial counts and the main ingredients." src="/images/landing/culinara-dark.webp" />
              </div>
            </div>

            <!-- Journaly — tall -->
            <div class="l-card l-card--journaly">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <jiro-mark name="journaly" [size]="24" />
                </div>
                <h3 class="l-card-name">Journaly</h3>
                <p class="l-card-desc">Private reflections or shared journals. Track your mood, write daily, watch your streak grow.</p>
              </div>
              <div class="l-card-shot">
                <img class="shot-light" width="720" height="1440" loading="lazy" decoding="async"
                  alt="Journaly on a phone: a writing streak, and a chart of how the last thirty days felt broken down by mood." src="/images/landing/journaly-light.webp" />
                <img class="shot-dark" width="720" height="1440" loading="lazy" decoding="async"
                  alt="Journaly on a phone: a writing streak, and a chart of how the last thirty days felt broken down by mood." src="/images/landing/journaly-dark.webp" />
              </div>
            </div>

            <!-- Jym — medium -->
            <div class="l-card l-card--jym">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <jiro-mark name="jym" [size]="24" />
                </div>
                <h3 class="l-card-name">Jym</h3>
                <p class="l-card-desc">Log sets, track volume, and visualise your strength journey with PR detection and progress charts.</p>
              </div>
              <div class="l-card-shot">
                <img class="shot-light" width="800" height="600" loading="lazy" decoding="async"
                  alt="A Jym session in progress: logged sets with weights and reps." src="/images/landing/jym-light.webp" />
                <img class="shot-dark" width="800" height="600" loading="lazy" decoding="async"
                  alt="A Jym session in progress: logged sets with weights and reps." src="/images/landing/jym-dark.webp" />
              </div>
            </div>

            <!-- Ledger — medium -->
            <div class="l-card l-card--ledger">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <jiro-mark name="ledger" [size]="24" />
                </div>
                <h3 class="l-card-name">Ledger</h3>
                <p class="l-card-desc">Track spending, set budgets, and watch your net worth grow over time.</p>
              </div>
              <div class="l-card-shot">
                <img class="shot-light" width="996" height="750" loading="lazy" decoding="async"
                  alt="The Ledger month card: net for the month, income, expenses and savings rate." src="/images/landing/ledger-light.webp" />
                <img class="shot-dark" width="996" height="750" loading="lazy" decoding="async"
                  alt="The Ledger month card: net for the month, income, expenses and savings rate." src="/images/landing/ledger-dark.webp" />
              </div>
            </div>

            <!-- Echo — small -->
            <div class="l-card l-card--echo">
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
        <div #reveal data-reveal="privacy" class="l-section-inner l-reveal" [class.is-visible]="revealed().has('privacy')">
          <h2 class="l-section-title" id="l-privacy-title">Private by default</h2>
          <ul class="l-privacy-list">
            <li><jiro-icon name="check-circle" [size]="24" /><span>No ads</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>No third-party scripts</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>No third-party analytics</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>Your data exports in one click</span></li>
            <li><jiro-icon name="check-circle" [size]="24" /><span>Your data is never sold</span></li>
          </ul>
        </div>
      </section>

      <!-- ── Final CTA ──────────────────────────────────────────────────────── -->
      <section class="l-final">
        <div #reveal data-reveal="final" class="l-final-inner l-reveal" [class.is-visible]="revealed().has('final')">
          <h2>Bring it into one place.</h2>
          <a routerLink="/register" class="l-btn l-btn--primary l-btn--lg">Get started</a>
        </div>
      </section>
      </main>

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
    .l-btn--secondary {
      gap: var(--space-sm);
      background: var(--bg-surface);
      color: var(--color-primary);
      border: 1px solid var(--color-primary);
    }
    .l-btn--secondary:hover:not(:disabled) { background: rgba(var(--color-primary-rgb), 0.08); }
    .l-btn:disabled { cursor: progress; opacity: 0.75; transform: none; }
    .l-btn-spinner { border-color: transparent; border-top-color: currentColor; }
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
    .l-hero-actions .l-btn { white-space: nowrap; }
    .l-hero-error {
      margin: var(--space-sm) 0 0;
      font-size: var(--font-size-sm);
      color: var(--color-danger);
    }

    /* ── Hero screenshot ───────────────────────────────────────────────────── */
    /* Light/dark screenshot pairs follow the app's own dark-mode class. */
    .l-hero-shot-wrap picture.shot-dark,
    .l-card-shot img.shot-dark { display: none; }
    :host-context(html.dark) .l-hero-shot-wrap picture.shot-light,
    :host-context(html.dark) .l-card-shot img.shot-light { display: none; }
    :host-context(html.dark) .l-hero-shot-wrap picture.shot-dark,
    :host-context(html.dark) .l-card-shot img.shot-dark { display: block; }

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
    /* The frame hugs the picture: sized by the image, not stretched to the
       card, so the border and shadow never wrap empty space below it. */
    .l-card--journaly .l-card-shot img {
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 100%;
      margin: 0 auto;
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

    /* Card base. Static on purpose: the cards aren't links, so they don't
       lift on hover. Hard offset shadow like jiro-card. */
    .l-card {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: calc(var(--border-radius) * 1.5);
      box-shadow: var(--shadow-sm);
      padding: var(--space-lg);
      display: flex;
      flex-direction: column;
      gap: var(--space-md);
      overflow: hidden;
      position: relative;
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
    @media (min-width: 601px) {
      .l-privacy-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    @media (min-width: 1024px) {
      .l-privacy-list { grid-template-columns: repeat(5, minmax(0, 1fr)); }
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
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private revealObserver?: IntersectionObserver;

  protected readonly demoLoading = signal(false);
  protected readonly demoError = signal('');

  /** Honour the OS setting: no glare, section reveal or smooth scroll. */
  readonly reducedMotion =
    this.isBrowser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  private readonly revealEls = viewChildren<ElementRef<HTMLElement>>('reveal');
  /** Sections that have scrolled into view, or were on screen from the start. */
  protected readonly revealed = signal<ReadonlySet<string>>(new Set());
  /** Only once this is true can a section be hidden, so the prerendered page and
   *  a visit without JavaScript always show everything. */
  protected readonly revealReady = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revealObserver?.disconnect());
    if (this.isBrowser && !this.reducedMotion && typeof IntersectionObserver !== 'undefined') {
      // Re-runs whenever the section elements change. The state lives in a
      // signal bound to the template, so a re-render that swaps in new nodes
      // keeps it; the old version set classes on the first nodes it saw and
      // left their replacements hidden for good.
      afterRenderEffect(() => this.observeReveals(this.revealEls()));
    }
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
   * One scroll reveal per section. Sections already on screen are revealed in
   * the same change detection that turns on `.reveal-ready`, so nothing that
   * is already visible ever flashes out.
   */
  private observeReveals(els: readonly ElementRef<HTMLElement>[]) {
    this.revealObserver?.disconnect();
    const done = untracked(this.revealed);
    const observer = new IntersectionObserver(entries => {
      const seen = entries.filter(e => e.isIntersecting).map(e => e.target as HTMLElement);
      if (!seen.length) return;
      seen.forEach(el => observer.unobserve(el));
      this.revealed.update(set => new Set([...set, ...seen.map(el => el.dataset['reveal']!)]));
    }, { rootMargin: '0px 0px -10% 0px' });
    this.revealObserver = observer;

    const onScreen: string[] = [];
    for (const { nativeElement: el } of els) {
      const id = el.dataset['reveal']!;
      if (done.has(id)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) onScreen.push(id);
      else observer.observe(el);
    }
    if (onScreen.length) this.revealed.update(set => new Set([...set, ...onScreen]));
    this.revealReady.set(true);
  }

  /** Signs in to the shared, look-only demo account and opens the dashboard. */
  tryDemo() {
    if (this.demoLoading()) return;
    this.demoLoading.set(true);
    this.demoError.set('');
    this.auth.demoLogin().subscribe({
      next: () => this.router.navigateByUrl('/dashboard'),
      error: err => {
        this.demoLoading.set(false);
        this.demoError.set(demoLoginErrorMessage(err));
      },
    });
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
