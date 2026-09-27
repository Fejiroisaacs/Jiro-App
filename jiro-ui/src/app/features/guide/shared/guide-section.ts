import { Component, ViewEncapsulation, input } from '@angular/core';

/** One guide task: h2 plus optional lead; `id` is the contents anchor, so keep it stable. */
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
