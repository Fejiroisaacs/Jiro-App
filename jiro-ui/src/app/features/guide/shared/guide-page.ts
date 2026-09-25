import { Component, ViewEncapsulation, afterNextRender, contentChildren, inject, input } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DOCUMENT, Location } from '@angular/common';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { filter } from 'rxjs/operators';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroMarkComponent, MarkName } from '../../../shared/components/jiro-mark/jiro-mark';
import { GuideSectionComponent } from './guide-section';

/**
 * The layout every guide uses: back link, mark, h1, one-line intro, and a
 * contents list built from the `guide-section`s projected into it.
 *
 *   <guide-page heading="Jym guide" mark="jym" intro="Plan your training, log workouts and track progress.">
 *     <guide-section id="log-a-workout" title="Log a workout">...</guide-section>
 *   </guide-page>
 *
 * Also holds the shared reading styles for guide content (paragraphs, lists,
 * links, kbd), which is why it is not view-encapsulated: every selector is
 * scoped under `guide-page`.
 */
@Component({
  selector: 'guide-page',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterLink, JiroIconComponent, JiroMarkComponent],
  template: `
    <article class="gd-page">
      @if (back()) {
        <a routerLink="/guide" class="gd-back">
          <jiro-icon name="caret-left" [size]="14" />
          Back to all guides
        </a>
      }
      <header class="gd-head">
        <jiro-mark [name]="mark()" [size]="48" />
        <div class="gd-head-text">
          <h1 class="gd-title">{{ heading() }}</h1>
          <p class="gd-intro">{{ intro() }}</p>
        </div>
      </header>

      @if (sections().length) {
        <nav class="gd-toc" aria-labelledby="gd-toc-label">
          <p class="gd-toc-label" id="gd-toc-label">On this page</p>
          <ol class="gd-toc-list">
            @for (s of sections(); track s.id()) {
              <li><a [href]="path + '#' + s.id()" (click)="jump($event, s.id())">{{ s.title() }}</a></li>
            }
          </ol>
        </nav>
      }

      <div class="gd-body">
        <ng-content />
      </div>
    </article>
  `,
  styles: [`
    guide-page { display: block; }

    .gd-page {
      max-width: 880px;
    }

    .gd-back {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-bottom: var(--space-md);
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
    .gd-back:hover { color: var(--text-primary); text-decoration: none; }

    .gd-head {
      display: flex;
      align-items: flex-start;
      gap: var(--space-md);
      margin-bottom: var(--space-lg);
    }
    .gd-head jiro-mark { flex-shrink: 0; }
    .gd-head-text { min-width: 0; }
    .gd-title {
      font-size: var(--font-size-3xl);
      color: var(--text-primary);
      margin: 0;
    }
    .gd-intro {
      margin: var(--space-xs) 0 0;
      color: var(--text-secondary);
      font-size: var(--font-size-lg);
      max-width: 60ch;
    }

    .gd-toc {
      max-width: 72ch;
      margin-bottom: var(--space-2xl);
      padding: var(--space-md) var(--space-lg);
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
    }
    .gd-toc-label {
      margin: 0 0 var(--space-sm);
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }
    .gd-toc-list {
      margin: 0;
      padding-left: 1.4em;
      display: grid;
      gap: 6px;
    }
    .gd-toc-list li::marker { color: var(--text-muted); }
    .gd-toc-list a { text-decoration: underline; text-underline-offset: 3px; text-decoration-thickness: 1px; }

    /* Reading styles for guide content. Text keeps a comfortable line
       length; screenshots may use the full page width. */
    guide-page .gd-body p,
    guide-page .gd-body > ul,
    guide-page .gd-section > ul,
    guide-page .gd-section > ol:not(.gd-steps-list) {
      max-width: 72ch;
    }
    guide-page .gd-body p { margin: 0 0 var(--space-md); }
    guide-page .gd-section > ul,
    guide-page .gd-section > ol:not(.gd-steps-list) {
      margin: 0 0 var(--space-md);
      padding-left: 1.4em;
    }
    guide-page .gd-section li + li { margin-top: 4px; }
    guide-page .gd-body a:not(.gd-back) {
      text-decoration: underline;
      text-underline-offset: 3px;
      text-decoration-thickness: 1px;
    }
    guide-page .gd-body strong { font-weight: 600; color: var(--text-primary); }
    guide-page .gd-body kbd {
      display: inline-block;
      padding: 0 6px;
      font-family: var(--font-family);
      font-size: 0.85em;
      line-height: 1.5;
      color: var(--text-primary);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-bottom-width: 2px;
      border-radius: var(--border-radius-sm);
    }

    @media (max-width: 600px) {
      .gd-head jiro-mark { display: none; }
      .gd-title { font-size: var(--font-size-2xl); }
      .gd-intro { font-size: var(--font-size-md); }
      .gd-toc { padding: var(--space-md); margin-bottom: var(--space-xl); }
    }
  `],
})
export class GuidePageComponent {
  readonly heading = input.required<string>();
  readonly mark = input.required<MarkName>();
  readonly intro = input.required<string>();
  /** Show the "Back to all guides" link. */
  readonly back = input(true);

  readonly sections = contentChildren(GuideSectionComponent);

  private readonly doc = inject(DOCUMENT);
  /** This page's own path, so contents links are real URLs (`/guide/jym#id`) that work without JavaScript. */
  readonly path = inject(Location).path().split(/[?#]/)[0];

  constructor() {
    // Arriving on /guide/x#section: the section did not exist when the browser
    // looked for it, so scroll there once it has rendered. A later hash change
    // on this page is a router navigation, and the app scrolls to the top on
    // every NavigationEnd; this subscriber runs after that one.
    afterNextRender(() => this.scrollToHash());
    inject(Router).events.pipe(
      filter(e => e instanceof NavigationEnd),
      takeUntilDestroyed(),
    ).subscribe(() => this.scrollToHash());
  }

  private scrollToHash() {
    const id = decodeURIComponent(this.doc.defaultView?.location.hash.slice(1) ?? '');
    if (id) this.doc.getElementById(id)?.scrollIntoView({ block: 'start' });
  }

  /** Smooth scroll to a section (instant under reduced motion), then move focus to its heading. */
  jump(event: MouseEvent, id: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = this.doc.getElementById(id);
    if (!target) return;
    event.preventDefault();
    const win = this.doc.defaultView;
    const reduce = win?.matchMedia('(prefers-reduced-motion: reduce)').matches ?? true;
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    this.doc.getElementById(id + '-title')?.focus({ preventScroll: true });
    win?.history.replaceState(win.history.state, '', this.path + '#' + id);
  }
}
