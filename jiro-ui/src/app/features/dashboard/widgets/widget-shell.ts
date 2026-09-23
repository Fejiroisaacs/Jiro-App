import { Component, input } from '@angular/core';
import { JiroCardComponent } from '../../../shared/components/jiro-card/jiro-card';
import { JiroMarkComponent } from '../../../shared/components/jiro-mark/jiro-mark';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';
import { WidgetDef } from '../widget-catalog';

/** undefined while loading, null when the request failed. */
export type WidgetData<T> = T | null | undefined;

export type WidgetState = 'loading' | 'failed' | 'ready';

export function widgetState<T>(data: WidgetData<T>): WidgetState {
  return data === undefined ? 'loading' : data === null ? 'failed' : 'ready';
}

/** Loading placeholder shapes, each matching the card it stands in for. */
export type SkeletonKind = 'stat' | 'list' | 'month' | 'strip';

let shellSeq = 0;

/**
 * Card frame every dashboard widget shares: header (module mark, module
 * name, and what the card shows as a subtitle), then a
 * skeleton, a "not available" line, or the projected content.
 *
 *   <dash-widget-shell [def]="def" [state]="state()" skeleton="stat">
 *     @if (data(); as d) { ... }
 *   </dash-widget-shell>
 *
 * Anything with a `head` attribute is projected to the right of the title.
 */
@Component({
  selector: 'dash-widget-shell',
  standalone: true,
  imports: [JiroCardComponent, JiroMarkComponent, JiroSkeletonComponent],
  template: `
    <jiro-card fill>
      <section class="ws" [attr.aria-labelledby]="titleId" [attr.aria-busy]="state() === 'loading' ? 'true' : null">
        <div class="ws-head">
          <jiro-mark [name]="def().mark" [size]="32" />
          <h2 class="ws-title" [id]="titleId">
            <span class="ws-name">{{ def().name }}</span>
            @if (def().subtitle) {
              <span class="sr-only">, </span>
              <span class="ws-sub">{{ def().subtitle }}</span>
            }
          </h2>
          <ng-content select="[head]"></ng-content>
        </div>

        @switch (state()) {
          @case ('loading') {
            <span class="sr-only">Loading</span>
            @switch (skeleton()) {
              @case ('list') {
                <div class="sk-list">
                  @for (i of three; track i) {
                    <div class="sk-row">
                      <jiro-skeleton height="16px" width="75%" />
                      <jiro-skeleton height="12px" width="40%" />
                    </div>
                  }
                </div>
              }
              @case ('month') {
                <div class="sk-month">
                  <div class="sk-stack">
                    <jiro-skeleton height="12px" width="35%" />
                    <jiro-skeleton height="40px" width="55%" />
                    <jiro-skeleton [lines]="3" />
                  </div>
                  <div class="sk-stack">
                    <jiro-skeleton height="12px" width="25%" />
                    <jiro-skeleton [lines]="3" height="20px" />
                  </div>
                </div>
              }
              @case ('strip') {
                <div class="sk-strip">
                  @for (i of fourteen; track i) {
                    <span class="sk-cell"></span>
                  }
                </div>
              }
              @default {
                <div class="sk-stack">
                  <jiro-skeleton height="34px" width="60%" />
                  <jiro-skeleton [lines]="2" />
                  <jiro-skeleton height="40px" width="45%" />
                </div>
              }
            }
          }
          @case ('failed') {
            <p class="ws-failed">{{ def().unavailable }} is not available right now.</p>
          }
          @default {
            <ng-content></ng-content>
          }
        }
      </section>
    </jiro-card>
  `,
  styles: [`
    :host { display: block; height: 100%; min-width: 0; }

    .ws { display: flex; flex-direction: column; flex: 1; min-width: 0; }

    .ws-head {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      min-height: 32px;
      margin-bottom: var(--space-md);
    }
    .ws-title {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      margin: 0;
      font-family: var(--font-family);
      line-height: var(--line-height-tight);
    }
    .ws-name {
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }
    .ws-sub {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
    }

    .ws-failed { font-size: var(--font-size-sm); color: var(--text-muted); }

    .sk-stack { display: flex; flex-direction: column; gap: var(--space-sm); }
    .sk-list { display: flex; flex-direction: column; gap: var(--space-md); }
    .sk-row { display: flex; flex-direction: column; gap: 6px; }
    .sk-month {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
      gap: var(--space-xl);
    }
    .sk-strip { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 6px; }
    .sk-cell {
      display: block;
      width: 100%;
      max-width: 24px;
      aspect-ratio: 1;
      justify-self: center;
      border-radius: var(--border-radius-sm);
      background: var(--bg-surface-hover);
    }

    @media (max-width: 900px) {
      .sk-month { grid-template-columns: 1fr; gap: var(--space-lg); }
    }
    @media (max-width: 480px) {
      .sk-strip { gap: 3px; }
    }
  `],
})
export class WidgetShellComponent {
  def = input.required<WidgetDef>();
  state = input.required<WidgetState>();
  skeleton = input<SkeletonKind>('stat');

  readonly titleId = `dash-widget-title-${++shellSeq}`;
  readonly three = [0, 1, 2];
  readonly fourteen = Array.from({ length: 14 }, (_, i) => i);
}

/**
 * Text styles the widget bodies share. Each widget component includes these
 * in its own styles array (component styles are encapsulated).
 */
export const WIDGET_TEXT_STYLES = `
  :host { display: block; height: 100%; min-width: 0; }

  .tile-big {
    font-family: var(--font-family-display);
    font-size: var(--font-size-xl);
    font-weight: 600;
    color: var(--text-primary);
    line-height: var(--line-height-tight);
    overflow-wrap: anywhere;
  }
  .tile-num {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: var(--space-sm);
    font-family: var(--font-family-display);
    font-size: var(--font-size-3xl);
    font-weight: 600;
    line-height: 1;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }
  .tile-unit { font-family: var(--font-family); font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }
  .tile-sub { margin-top: var(--space-xs); font-size: var(--font-size-sm); color: var(--text-secondary); }
  .tile-muted { font-size: var(--font-size-sm); color: var(--text-muted); }
  /* The action row sits at the bottom of the card, so tiles in one row line up. */
  .tile-action { margin-top: auto; padding-top: var(--space-md); }
  .tile-done { display: inline-flex; align-items: center; gap: 6px; color: var(--color-positive); font-size: var(--font-size-sm); font-weight: 600; }
  .tile-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 44px;
    font-size: var(--font-size-sm);
    font-weight: 500;
  }
`;
