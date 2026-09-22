import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SplitListComponent } from '../split-list/split-list';
import { SeriesListComponent } from '../series-list/series-list';
import { JymTemplatesComponent } from '../templates/templates';
import { JiroTabStripComponent, TabOption, tabFromRoute, writeTabToUrl } from '../../../shared/components/jiro-tab-strip/jiro-tab-strip';

type Tab = 'splits' | 'series' | 'templates';
const TABS: TabOption<Tab>[] = [
  { value: 'splits', label: 'Splits' },
  { value: 'series', label: 'Series' },
  { value: 'templates', label: 'Templates' },
];

@Component({
  selector: 'app-jym-plan',
  standalone: true,
  imports: [SplitListComponent, SeriesListComponent, JymTemplatesComponent, JiroTabStripComponent],
  template: `
    <h1 class="sr-only">Plan</h1>
    <jiro-tab-strip [tabs]="tabs" [value]="tab()" label="Plan sections" (valueChange)="setTab($event)" />
    <div class="tab-content">
      @if (tab() === 'splits') {
        <app-split-list [embedded]="true" />
      } @else if (tab() === 'series') {
        <app-series-list [embedded]="true" (goToSplits)="setTab('splits')" />
      } @else {
        <app-jym-templates [embedded]="true" />
      }
    </div>
  `,
  styles: [`.tab-content { padding-top: var(--space-lg); }`]
})
export class JymPlanComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly tabs = TABS;
  tab = signal<Tab>(tabFromRoute(this.route, TABS.map(t => t.value), 'splits'));

  setTab(value: string) {
    this.tab.set(value as Tab);
    writeTabToUrl(this.router, this.location, this.route, value);
  }
}
