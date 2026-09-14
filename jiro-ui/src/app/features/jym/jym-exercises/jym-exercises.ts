import { Location } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ExerciseLibraryComponent } from '../exercise-library/exercise-library';
import { PrWallComponent } from '../pr-wall/pr-wall';
import { JiroTabStripComponent, TabOption, tabFromRoute, writeTabToUrl } from '../../../shared/components/jiro-tab-strip/jiro-tab-strip';

type Tab = 'exercises' | 'prs';
const TABS: TabOption<Tab>[] = [
  { value: 'exercises', label: 'Exercises' },
  { value: 'prs', label: 'PRs' },
];

@Component({
  selector: 'app-jym-exercises',
  standalone: true,
  imports: [ExerciseLibraryComponent, PrWallComponent, JiroTabStripComponent],
  template: `
    <jiro-tab-strip [tabs]="tabs" [value]="tab()" label="Exercises sections" (valueChange)="setTab($event)" />
    <div class="tab-content">
      @if (tab() === 'exercises') {
        <app-exercise-library [embedded]="true" />
      } @else {
        <app-pr-wall [embedded]="true" />
      }
    </div>
  `,
  styles: [`.tab-content { padding-top: var(--space-lg); }`]
})
export class JymExercisesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  readonly tabs = TABS;
  tab = signal<Tab>(tabFromRoute(this.route, TABS.map(t => t.value), 'exercises'));

  setTab(value: string) {
    this.tab.set(value as Tab);
    writeTabToUrl(this.router, this.location, this.route, value);
  }
}
