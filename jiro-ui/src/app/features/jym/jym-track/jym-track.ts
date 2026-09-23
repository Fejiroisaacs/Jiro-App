import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
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
    <h1 class="sr-only">Track</h1>
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

  constructor() {
    // The component is reused when a link (e.g. global search's
    // ?tab=sessions&session=<id>) lands on this page while it is already open,
    // so follow ?tab= on every navigation, not just the first.
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd), takeUntilDestroyed())
      .subscribe(() => {
        const q = this.router.parseUrl(this.router.url).queryParamMap.get('tab');
        if (q && TABS.some(t => t.value === q)) this.tab.set(q as Tab);
      });
  }

  setTab(value: string) {
    this.tab.set(value as Tab);
    writeTabToUrl(this.router, this.location, this.route, value);
  }
}
