import { Component, computed, input } from '@angular/core';

/**
 * Loading placeholder shaped like the content it stands in for.
 *
 *   <jiro-skeleton [lines]="3" />
 *   <jiro-skeleton height="48px" width="60%" />
 *
 * Shimmer runs on background-position; the global reduced-motion rule
 * stops it.
 */
@Component({
  selector: 'jiro-skeleton',
  standalone: true,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (i of rows(); track i) {
      <span class="sk" [style.height]="height()" [style.width]="i === rows().length - 1 && rows().length > 1 ? '70%' : width()"></span>
    }
  `,
  styles: [`
    :host { display: flex; flex-direction: column; gap: 8px; }
    .sk {
      display: block;
      border-radius: var(--border-radius-sm);
      background: linear-gradient(90deg, var(--bg-surface-hover) 25%, var(--border-color) 50%, var(--bg-surface-hover) 75%);
      background-size: 200% 100%;
      animation: sk-shimmer 1.4s ease-in-out infinite;
    }
    @keyframes sk-shimmer {
      from { background-position: 200% 0; }
      to { background-position: -200% 0; }
    }
  `]
})
export class JiroSkeletonComponent {
  lines = input<number>(1);
  height = input<string>('14px');
  width = input<string>('100%');
  readonly rows = computed(() => Array.from({ length: Math.max(1, this.lines()) }, (_, i) => i));
}
