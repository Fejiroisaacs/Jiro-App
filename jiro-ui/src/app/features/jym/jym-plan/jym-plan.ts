import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SplitListComponent } from '../split-list/split-list';
import { SeriesListComponent } from '../series-list/series-list';
import { JymTemplatesComponent } from '../templates/templates';

@Component({
  selector: 'app-jym-plan',
  standalone: true,
  imports: [CommonModule, SplitListComponent, SeriesListComponent, JymTemplatesComponent],
  template: `
    <div class="tab-strip">
      <button class="tab-btn" [class.active]="tab() === 'splits'" (click)="tab.set('splits')">Splits</button>
      <button class="tab-btn" [class.active]="tab() === 'series'" (click)="tab.set('series')">Series</button>
      <button class="tab-btn" [class.active]="tab() === 'templates'" (click)="tab.set('templates')">Templates</button>
    </div>
    <div class="tab-content">
      @if (tab() === 'splits') {
        <app-split-list [embedded]="true" />
      } @else if (tab() === 'series') {
        <app-series-list [embedded]="true" (goToSplits)="tab.set('splits')" />
      } @else {
        <app-jym-templates [embedded]="true" />
      }
    </div>
  `
})
export class JymPlanComponent {
  tab = signal<'splits' | 'series' | 'templates'>('splits');
}
