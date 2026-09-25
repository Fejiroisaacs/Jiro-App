import { Component, ViewEncapsulation, input } from '@angular/core';

/**
 * One task in a guide, such as "Log a workout". Renders the h2 and an optional
 * lead line; everything inside it is the guide's own content (paragraphs,
 * `guide-steps`, `guide-shot`, `guide-tip`).
 *
 *   <guide-section id="log-a-workout" title="Log a workout" lead="Start a session and record each set.">
 *     ...
 *   </guide-section>
 *
 * `id` is the anchor the contents list links to, so keep it stable and
 * lowercase-with-dashes. The parent `guide-page` picks up every section.
 */
@Component({
  selector: 'guide-section',
  standalone: true,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'gd-section', '[attr.id]': 'id()' },
  template: `
    <h2 class="gd-section-title" [id]="id() + '-title'" tabindex="-1">{{ title() }}</h2>
    @if (lead()) {
      <p class="gd-section-lead">{{ lead() }}</p>
    }
    <ng-content />
  `,
  styles: [`
    .gd-section {
      display: block;
      /* Clear the sticky phone top bar when jumped to from the contents list. */
      scroll-margin-top: calc(var(--topbar-height, 0px) + var(--space-lg));
    }
    .gd-section + .gd-section {
      margin-top: var(--space-2xl);
      padding-top: var(--space-xl);
      border-top: 1px solid var(--border-color);
    }
    .gd-section-title {
      font-size: var(--font-size-xl);
      color: var(--text-primary);
      margin: 0 0 var(--space-sm);
    }
    .gd-section-title:focus { outline: none; }
    .gd-section-title:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 4px;
      border-radius: var(--border-radius-sm);
    }
    .gd-section-lead {
      color: var(--text-secondary);
      margin: 0 0 var(--space-md);
    }
  `],
})
export class GuideSectionComponent {
  readonly id = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input<string>('');
}
