import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SessionHistoryComponent } from '../session-history/session-history';
import { BodyWeightComponent } from '../body-weight/body-weight';
import { JiroTabStripComponent, TabOption, tabFromRoute, writeTabToUrl } from '../../../shared/components/jiro-tab-strip/jiro-tab-strip';

type Tab = 'sessions' | 'bodyweight';
const TABS: TabOption<Tab>[] = [
  { value: 'sessions', label: 'Sessions' },
  { value: 'bodyweight', label: 'Body Weight' },
];

@Component({
  selector: 'app-jym-track',
  standalone: true,
  imports: [SessionHistoryComponent, BodyWeightComponent, JiroTabStripComponent],
  template: `
    <jiro-tab-strip [tabs]="tabs" [value]="tab()" label="Track sections" (valueChange)="setTab($event)" />
    <div class="tab-content">
      @if (tab() === 'sessions') {
        <app-session-history [embedded]="true" />
      } @else {
        <app-body-weight [embedded]="true" />
      }
    </div>
  `,
  styles: [`.tab-content { padding-top: var(--space-lg); }`]
})
export class JymTrackComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly tabs = TABS;
  tab = signal<Tab>(tabFromRoute(this.route, TABS.map(t => t.value), 'sessions'));

  setTab(value: string) {
    this.tab.set(value as Tab);
    writeTabToUrl(this.router, this.location, this.route, value);
  }
}
