import { Component, HostListener, ElementRef, ViewChild, inject, OnInit } from '@angular/core';
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
          <p class="l-eyebrow">Personal Command Center</p>
          <h1 class="l-hero-title">Your Life,<br><em>Unified.</em></h1>
          <p class="l-hero-sub">
            One modular platform for your recipes, workouts, journal, and more.
            No ads. No clutter. Just your life, beautifully organised.
          </p>
          <div class="l-hero-actions">
            <a routerLink="/register" class="l-btn l-btn--primary">Sign up</a>
            <a class="l-btn l-btn--ghost" (click)="scrollToModules()">Explore modules</a>
          </div>
        </div>

        <!-- Hero Dashboard Mockup -->
        <div class="l-hero-mockup-wrapper">
          <div class="l-dashboard-mockup" #dashboardMockup>
            <!-- Sidebar -->
            <div class="l-mock-sidebar">
              <div class="l-mock-brand">
                <div class="l-mock-logo-mark">J</div><div class="l-mock-line w-12"></div>
              </div>
              <div class="l-mock-menu">
                <div class="l-mock-menu-item l-mock-menu-item--active"><div class="l-mock-icon"></div><div class="l-mock-line w-16"></div></div>
                <div class="l-mock-menu-label"><div class="l-mock-line w-10"></div></div>
                <div class="l-mock-menu-item"><img src="/icons/culinara-icon.svg" width="16" height="16" alt="" style="opacity:0.75;border-radius:4px;flex-shrink:0"><div class="l-mock-line w-20"></div></div>
                <div class="l-mock-menu-item"><img src="/icons/jym-icon.svg" width="16" height="16" alt="" style="opacity:0.75;border-radius:4px;flex-shrink:0"><div class="l-mock-line w-10"></div></div>
                <div class="l-mock-menu-item"><img src="/icons/journaly-icon.svg" width="16" height="16" alt="" style="opacity:0.75;border-radius:4px;flex-shrink:0"><div class="l-mock-line w-18"></div></div>
                <div class="l-mock-menu-item"><img src="/icons/ledger-icon.svg" width="16" height="16" alt="" style="opacity:0.75;border-radius:4px;flex-shrink:0"><div class="l-mock-line w-16"></div></div>
              </div>
            </div>
            <!-- Main Area -->
            <div class="l-mock-main">
              <div class="l-mock-header">
                <div class="l-mock-greeting">
                  <div class="l-mock-h1"></div>
                  <div class="l-mock-sub"></div>
                </div>
                <div class="l-mock-avatar"></div>
              </div>
              <div class="l-mock-grid">
                <!-- Culinara recap -->
                <div class="l-mock-card">
                  <div class="l-mock-card-header"><div class="l-mock-icon-bg"></div></div>
                  <div class="l-mock-card-body">
                    <div class="l-mock-line w-full" style="height:9px;opacity:0.85"></div>
                    <div class="l-mock-mini-stars">
                      <div class="l-mock-star l-mock-star--on"></div>
                      <div class="l-mock-star l-mock-star--on"></div>
                      <div class="l-mock-star l-mock-star--on"></div>
                      <div class="l-mock-star l-mock-star--on"></div>
                      <div class="l-mock-star"></div>
                    </div>
                  </div>
                </div>
                <!-- Jym recap -->
                <div class="l-mock-card">
                  <div class="l-mock-card-header"><div class="l-mock-icon-bg"></div></div>
                  <div class="l-mock-card-body">
                    <div class="l-mock-line w-3-4" style="height:8px;opacity:0.8"></div>
                    <div class="l-mock-mini-bars">
                      <div class="l-mock-mini-bar" style="height:10px"></div>
                      <div class="l-mock-mini-bar" style="height:14px"></div>
                      <div class="l-mock-mini-bar" style="height:11px"></div>
                      <div class="l-mock-mini-bar l-mock-mini-bar--peak" style="height:20px"></div>
                      <div class="l-mock-mini-bar" style="height:16px"></div>
                      <div class="l-mock-mini-bar" style="height:13px"></div>
                    </div>
                  </div>
                </div>
                <!-- Journaly recap -->
                <div class="l-mock-card">
                  <div class="l-mock-card-header"><div class="l-mock-icon-bg"></div></div>
                  <div class="l-mock-card-body">
                    <div class="l-mock-streak-display">12</div>
                    <div class="l-mock-line w-2-3" style="height:6px;opacity:0.45"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Decorative orbs -->
        <div class="l-orb l-orb--1"></div>
        <div class="l-orb l-orb--2"></div>
      </section>

      <!-- ── Module Bento ───────────────────────────────────────────────────── -->
      <section class="l-modules" id="modules">
        <div class="l-section-inner">
          <p class="l-section-label">The Modules</p>
          <h2 class="l-section-title">Every corner of your life, covered.</h2>

          <div class="l-bento" [@bentoEntrance]>

            <!-- Culinara — large -->
            <div class="l-card l-card--culinara" (mousemove)="onCardHover($event)" (mouseleave)="onCardLeave($event)">
              <div class="l-card-content">
                <div class="l-card-icon">
                  <img src="/icons/culinara-icon.svg" width="24" height="24" alt="Culinara" />
                </div>
                <h3 class="l-card-name">Culinara</h3>
                <p class="l-card-desc">Perfect your recipes. Log every trial, promote the winner to your permanent cookbook.</p>
              </div>
              <div class="l-card-mockup l-mockup-culinara">
                <div class="mc-recipe-card">
                  <div class="mc-recipe-tag">Base Recipe</div>
                  <div class="mc-recipe-title">Sourdough Loaf</div>
                  <div class="mc-recipe-meta">
                    <span class="mc-star filled">★</span>
                    <span class="mc-star filled">★</span>
                    <span class="mc-star filled">★</span>
                    <span class="mc-star filled">★</span>
                    <span class="mc-star">★</span>
                    <span class="mc-trial-count">3 trials</span>
                  </div>
                  <div class="mc-recipe-row"><span class="mc-label">Calories</span><span class="mc-val">240 kcal</span></div>
                  <div class="mc-recipe-row"><span class="mc-label">Protein</span><span class="mc-val">8 g</span></div>
                  <div class="mc-recipe-row"><span class="mc-label">Carbs</span><span class="mc-val">44 g</span></div>
                </div>
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
              <div class="l-card-mockup l-mockup-journaly">
                <div class="mj-entry-preview">
                  <div class="mj-entry-date">Mar 3, 2026</div>
                  <div class="mj-entry-line mj-entry-line--full"></div>
                  <div class="mj-entry-line mj-entry-line--three-quarter"></div>
                </div>
                <div class="mj-streak">
                  <span class="mj-streak-num">12</span>
                  <span class="mj-streak-label">day streak</span>
                </div>
                <div class="mj-moods">
                  <span class="mj-mood" style="background: rgba(245,158,11,0.15); color: #d97706;">Happy</span>
                  <span class="mj-mood" style="background: rgba(6,182,212,0.15); color: #0891b2;">Calm</span>
                  <span class="mj-mood mj-mood--active" style="background: rgba(139,92,246,0.15); color: #7c3aed;">Grateful</span>
                  <span class="mj-mood" style="background: rgba(16,185,129,0.15); color: #059669;">Energised</span>
                </div>
                <div class="mj-week">
                  @for (d of weekDots; track d; let i = $index) {
                    <div class="mj-dot" [class.mj-dot--filled]="d"></div>
                  }
                </div>
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
              <div class="l-card-mockup l-mockup-jym">
                <div class="mjym-top">
                  <div class="mjym-exercise">Bench Press</div>
                  <div class="mjym-set-row"><span class="mjym-set-num">Set 3</span><span class="mjym-set-data">180 lb × 5</span><span class="mjym-set-pr">PR</span></div>
                </div>
                <div class="mjym-bar-chart">
                  @for (h of barHeights; track h; let i = $index) {
                    <div class="mjym-bar" [style.height.px]="h" [class.mjym-bar--pr]="i === 4"></div>
                  }
                </div>
                <div class="mjym-pr-badge">
                  <img src="/icons/badge-icon.svg" width="28" height="28" alt="PR badge" />
                  <span>+5 kg</span>
                </div>
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
              <div class="l-card-mockup l-mockup-ledger">
                <div class="ml-networth">
                  <div class="ml-nw-label">Net Worth</div>
                  <div class="ml-nw-value">$12,840</div>
                  <div class="ml-nw-delta">↑ +$340 this month</div>
                </div>
                <div class="ml-txn-list">
                  <div class="ml-txn">
                    <div class="ml-txn-dot ml-txn-dot--income"></div>
                    <div class="ml-txn-body"><div class="ml-txn-name">Salary</div><div class="ml-txn-date">Mar 1</div></div>
                    <div class="ml-txn-amt ml-txn-amt--income">+$2,400</div>
                  </div>
                  <div class="ml-txn">
                    <div class="ml-txn-dot ml-txn-dot--expense"></div>
                    <div class="ml-txn-body"><div class="ml-txn-name">Groceries</div><div class="ml-txn-date">Mar 2</div></div>
                    <div class="ml-txn-amt ml-txn-amt--expense">−$85</div>
                  </div>
                  <div class="ml-txn">
                    <div class="ml-txn-dot ml-txn-dot--expense"></div>
                    <div class="ml-txn-body"><div class="ml-txn-name">Coffee</div><div class="ml-txn-date">Mar 3</div></div>
                    <div class="ml-txn-amt ml-txn-amt--expense">−$6</div>
                  </div>
                </div>
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
          <p class="l-section-label">Why Jiro</p>
          <h2 class="l-section-title">Built different, on purpose.</h2>
          <div class="l-pillars">
            <div class="l-pillar">
              <div class="l-pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <h4>Private by default</h4>
              <p>Your data is yours. No tracking, no selling, no ads. Ever.</p>
            </div>
            <div class="l-pillar">
              <div class="l-pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                  <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93A10 10 0 1 0 21 12"/><path d="M21 12V2h-10"/>
                </svg>
              </div>
              <h4>One coherent system</h4>
              <p>All modules share the same design language, data layer, and account — no juggling five separate apps.</p>
            </div>
            <div class="l-pillar">
              <div class="l-pillar-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
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
          <a routerLink="/register" class="l-btn l-btn--primary l-btn--lg">Create your account</a>
        </div>
        <div class="l-orb l-orb--3"></div>
      </section>

      <!-- ── Footer ─────────────────────────────────────────────────────────── -->
      <footer class="l-footer">
        <div class="l-footer-inner">
          <span class="l-footer-logo">Jiro</span>
          <span class="l-footer-copy">© 2026 Jiro. All rights reserved.</span>
          <div class="l-footer-links">
            <a routerLink="/login">Log in</a>
            <a routerLink="/register">Register</a>
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
      color: #fff;
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
      color: #fff;
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
    .l-eyebrow {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--color-primary);
      margin: 0 0 var(--space-md);
      animation: fadeUp 0.5s ease both;
    }
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
    .l-hero-mockup-wrapper {
      position: relative;
      margin: 60px auto 0;
      max-width: 900px;
      perspective: 1200px;
      z-index: 2;
      animation: fadeUp 1s 0.25s cubic-bezier(0.16, 1, 0.3, 1) both,
                 heroFloat 7s 1.25s ease-in-out infinite;
    }
    .l-hero-mockup-wrapper:hover {
      animation: fadeUp 1s 0.25s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    .l-hero-mockup-wrapper::before {
      content: '';
      position: absolute;
      bottom: -15%; left: 10%; right: 10%; height: 40%;
      background: radial-gradient(ellipse at center, color-mix(in srgb, var(--color-primary) 30%, transparent) 0%, transparent 70%);
      filter: blur(40px);
      z-index: -1;
      opacity: 0.6;
      transform: scaleY(0.5);
    }
    .l-dashboard-mockup {
      display: flex;
      height: 480px;
      background: var(--bg-surface);
      border: 1px solid color-mix(in srgb, var(--border-color) 80%, transparent);
      border-radius: 16px;
      box-shadow: 0 32px 64px rgba(0,0,0,0.12), 0 0 0 1px rgba(255,255,255,0.05) inset;
      overflow: hidden;
      transform: rotateX(8deg) rotateY(-4deg) rotateZ(2deg) scale(0.95);
      transform-style: preserve-3d;
      transition: transform 0.1s ease-out;
    }
    /* Abstract Sidebar */
    .l-mock-sidebar {
      width: 200px;
      border-right: 1px solid var(--border-color);
      background: color-mix(in srgb, var(--bg-canvas) 50%, transparent);
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 32px;
    }
    .l-mock-brand { display: flex; align-items: center; gap: 8px; }
    .l-mock-logo-mark { font-weight: 800; color: var(--color-primary); font-size: 1.2rem; }
    .l-mock-line { height: 6px; border-radius: 4px; background: var(--border-color); }
    .w-12 { width: 48px; } .w-16 { width: 64px; } .w-10 { width: 40px; } .w-20 { width: 80px; } .w-18 { width: 72px; } .w-24 { width: 96px; }
    .w-full { width: 100%; } .w-3-4 { width: 75%; } .w-2-3 { width: 66%; } .w-5-6 { width: 83%; } .w-1-2 { width: 50%; }
    .l-mock-menu { display: flex; flex-direction: column; gap: 12px; }
    .l-mock-menu-item { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 8px; }
    .l-mock-menu-item--active { background: color-mix(in srgb, var(--color-primary) 10%, transparent); }
    .l-mock-menu-item--active .l-mock-icon { background: var(--color-primary); opacity: 0.8; }
    .l-mock-menu-item--active .l-mock-line { background: var(--color-primary); opacity: 0.8; }
    .l-mock-menu-label { padding: 4px 12px; opacity: 0.6; margin-top: 16px; }
    .l-mock-icon { width: 16px; height: 16px; border-radius: 4px; background: var(--border-color); }
    /* Abstract Main Content */
    .l-mock-main {
      flex: 1;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 40px;
      background: var(--bg-canvas);
    }
    .l-mock-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .l-mock-greeting { display: flex; flex-direction: column; gap: 12px; }
    .l-mock-h1 { width: 180px; height: 24px; border-radius: 6px; background: var(--text-primary); opacity: 0.9; }
    .l-mock-sub { width: 120px; height: 8px; border-radius: 4px; background: var(--text-secondary); opacity: 0.5; }
    .l-mock-avatar { width: 40px; height: 40px; border-radius: 50%; background: var(--border-color); }
    .l-mock-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    .l-mock-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.03);
    }
    .l-mock-card-header { display: flex; align-items: center; }
    .l-mock-icon-bg { width: 32px; height: 32px; border-radius: 8px; background: color-mix(in srgb, var(--text-primary) 10%, transparent); }
    .l-mock-card-body { display: flex; flex-direction: column; gap: 8px; }
    .l-mock-mini-stars { display: flex; gap: 3px; margin-top: 4px; }
    .l-mock-star { width: 8px; height: 8px; border-radius: 50%; background: var(--border-color); }
    .l-mock-star--on { background: #f59e0b; }
    .l-mock-mini-bars { display: flex; align-items: flex-end; gap: 3px; height: 24px; margin-top: 4px; }
    .l-mock-mini-bar { flex: 1; background: color-mix(in srgb, var(--color-primary) 30%, transparent); border-radius: 2px 2px 0 0; }
    .l-mock-mini-bar--peak { background: var(--color-primary); }
    .l-mock-streak-display { font-size: 1.6rem; font-weight: 800; color: var(--color-primary); line-height: 1; margin-top: 2px; }

    @media (max-width: 900px) {
      .l-hero-mockup-wrapper {
        transform: scale(0.82);
        transform-origin: top center;
        margin-top: 20px;
        margin-bottom: -86px; /* compensate: 480 * (1-0.82) ≈ 86px */
      }
      .l-dashboard-mockup { transform: rotateX(0) rotateY(0) rotateZ(0) scale(1); }
      .l-hero-mockup-wrapper:hover .l-dashboard-mockup { transform: scale(1); }
    }
    @media (max-width: 600px) {
      .l-hero-mockup-wrapper {
        display: none;
      }
    }

    /* ── Section shared ────────────────────────────────────────────────────── */
    .l-section-label {
      font-size: var(--font-size-xs);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      color: var(--color-primary);
      margin: 0 0 var(--space-sm);
    }
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
      flex-direction: row;
      gap: var(--space-xl);
      align-items: center;
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
    .l-card-mockup { flex-shrink: 0; }
    .l-mockup-culinara { width: 200px; }
    .mc-recipe-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-md);
      display: flex;
      flex-direction: column;
      gap: 8px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.06);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s;
    }
    .l-card--culinara:hover .mc-recipe-card {
      transform: translateY(-4px) scale(1.02);
      box-shadow: 0 16px 40px rgba(0,0,0,0.1);
    }
    .mc-recipe-tag {
      font-size: 0.65rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--color-primary);
    }
    .mc-recipe-title { font-size: var(--font-size-md); font-weight: 700; color: var(--text-primary); }
    .mc-recipe-meta { display: flex; align-items: center; gap: 2px; }
    .mc-star { font-size: 0.75rem; color: var(--border-color); }
    .mc-star.filled { color: #f59e0b; }
    .mc-trial-count { font-size: var(--font-size-xs); color: var(--text-secondary); margin-left: 4px; }
    .mc-recipe-row {
      display: flex;
      justify-content: space-between;
      font-size: var(--font-size-xs);
      padding-top: 4px;
      border-top: 1px solid var(--border-color);
    }
    .mc-label { color: var(--text-secondary); }
    .mc-val { font-weight: 600; color: var(--text-primary); }

    /* ── Journaly mockup ───────────────────────────────────────────────────── */
    .l-mockup-journaly { display: flex; flex-direction: column; gap: var(--space-sm); margin-top: auto; }
    .mj-streak {
      display: flex;
      align-items: baseline;
      gap: var(--space-xs);
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
      border-radius: var(--border-radius-sm);
      padding: var(--space-sm) var(--space-md);
      box-shadow: 0 4px 12px color-mix(in srgb, var(--color-primary) 10%, transparent);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .l-card--journaly:hover .mj-streak {
      transform: scale(1.05) rotate(2deg);
    }
    .mj-streak-num { font-size: 2rem; font-weight: 800; color: var(--color-primary); line-height: 1; }
    .mj-streak-label { font-size: var(--font-size-xs); color: var(--text-secondary); }
    .mj-moods { display: flex; flex-wrap: wrap; gap: 5px; }
    .mj-mood {
      font-size: 0.68rem;
      padding: 3px 9px;
      border-radius: 99px;
      font-weight: 500;
    }
    .mj-week { display: flex; gap: 5px; }
    .mj-dot {
      flex: 1;
      height: 6px;
      border-radius: 99px;
      background: var(--border-color);
      transition: background 0.2s;
    }
    .mj-dot--filled { background: var(--color-primary); }
    .mj-entry-preview {
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-sm);
      padding: var(--space-xs) var(--space-sm);
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .mj-entry-date { font-size: 0.6rem; font-weight: 700; color: var(--color-primary); text-transform: uppercase; letter-spacing: 0.5px; }
    .mj-entry-line { height: 5px; border-radius: 3px; background: var(--border-color); opacity: 0.7; }
    .mj-entry-line--full { width: 100%; }
    .mj-entry-line--three-quarter { width: 75%; }

    /* ── Jym mockup ────────────────────────────────────────────────────────── */
    .l-mockup-jym { flex-shrink: 0; width: 100%; }
    .mjym-bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      height: 70px;
      padding-bottom: 2px;
    }
    .mjym-bar {
      flex: 1;
      background: color-mix(in srgb, var(--color-primary) 25%, transparent);
      border-radius: 3px 3px 0 0;
      transition: background 0.2s, transform 0.3s, opacity 0.3s;
    }
    .mjym-bar--pr {
      background: var(--color-primary);
    }
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
    .mjym-pr-badge {
      display: flex;
      align-items: center;
      gap: 5px;
      width: fit-content;
      margin: 6px auto 0;
      font-size: var(--font-size-xs);
      font-weight: 700;
      color: var(--color-primary);
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 25%, transparent);
      border-radius: 99px;
      padding: 4px 10px 4px 6px;
      transition: transform 0.3s, box-shadow 0.3s;
      animation: prPulse 2.5s infinite cubic-bezier(0.16, 1, 0.3, 1);
    }
    .l-card--jym:hover .mjym-pr-badge {
      transform: translateY(-4px) scale(1.05);
    }
    .mjym-pr-badge img { display: block; flex-shrink: 0; }
    .l-mockup-jym { flex-shrink: 0; width: 100%; }
    .mjym-top { margin-bottom: 8px; }
    .mjym-exercise { font-size: 0.72rem; font-weight: 700; color: var(--text-primary); opacity: 0.85; margin-bottom: 4px; }
    .mjym-set-row { display: flex; align-items: center; gap: 6px; font-size: 0.68rem; }
    .mjym-set-num { color: var(--text-secondary); }
    .mjym-set-data { font-weight: 600; color: var(--text-primary); }
    .mjym-set-pr { background: var(--color-primary); color: #fff; font-size: 0.6rem; font-weight: 700; padding: 1px 5px; border-radius: 99px; }

    /* ── Ledger mockup ─────────────────────────────────────────────────────── */
    .l-mockup-ledger { display: flex; flex-direction: column; gap: var(--space-sm); width: 100%; margin-top: auto; }
    .ml-networth {
      background: color-mix(in srgb, var(--color-primary) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--color-primary) 20%, transparent);
      border-radius: var(--border-radius-sm);
      padding: var(--space-sm) var(--space-md);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .l-card--ledger:hover .ml-networth { transform: translateY(-3px); }
    .ml-nw-label { font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
    .ml-nw-value { font-size: 1.4rem; font-weight: 800; color: var(--text-primary); line-height: 1.2; }
    .ml-nw-delta { font-size: 0.68rem; color: #16a34a; font-weight: 600; margin-top: 2px; }
    .ml-txn-list { display: flex; flex-direction: column; gap: 0; }
    .ml-txn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border-color);
    }
    .ml-txn:last-child { border-bottom: none; }
    .ml-txn-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .ml-txn-dot--income { background: #16a34a; }
    .ml-txn-dot--expense { background: #dc2626; }
    .ml-txn-body { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .ml-txn-name { font-weight: 600; color: var(--text-primary); font-size: 0.72rem; }
    .ml-txn-date { font-size: 0.62rem; color: var(--text-secondary); }
    .ml-txn-amt { font-weight: 700; font-size: 0.72rem; flex-shrink: 0; }
    .ml-txn-amt--income { color: #16a34a; }
    .ml-txn-amt--expense { color: #dc2626; }

    /* ── Why Jiro ──────────────────────────────────────────────────────────── */
    .l-why { padding: 80px 0; }
    .l-pillars { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-xl); }
    .l-pillar { display: flex; flex-direction: column; gap: var(--space-sm); }
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
      .l-card--culinara { grid-column: 1 / 3; flex-direction: column; }
      .l-card--culinara .l-mockup-culinara { width: 100%; }
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

  @ViewChild('dashboardMockup') dashboardMockup!: ElementRef;

  weekDots = [true, true, true, false, true, true, false];
  barHeights = [30, 42, 38, 50, 65, 55, 48];

  ngOnInit() {
    if (this.auth.isAuthenticated()) {
      this.router.navigate(['/dashboard'], { replaceUrl: true });
    }
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent) {
    if (!this.dashboardMockup) return;
    if (!window.matchMedia('(hover: hover)').matches) return;

    const xPos = (event.clientX / window.innerWidth - 0.5) * 2;
    const yPos = (event.clientY / window.innerHeight - 0.5) * 2;
    const rotateX = yPos * -10;
    const rotateY = xPos * 10;

    this.dashboardMockup.nativeElement.style.transform =
      `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(2deg) scale(0.95)`;
  }

  onCardHover(event: MouseEvent) {
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
    document.getElementById('modules')?.scrollIntoView({ behavior: 'smooth' });
  }
}
