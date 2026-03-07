import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExerciseLibraryComponent } from '../exercise-library/exercise-library';
import { PrWallComponent } from '../pr-wall/pr-wall';

@Component({
  selector: 'app-jym-exercises',
  standalone: true,
  imports: [CommonModule, ExerciseLibraryComponent, PrWallComponent],
  template: `
    <div class="tab-strip">
      <button class="tab-btn" [class.active]="tab() === 'exercises'" (click)="tab.set('exercises')">Exercises</button>
      <button class="tab-btn" [class.active]="tab() === 'prs'" (click)="tab.set('prs')">PRs</button>
    </div>
    <div class="tab-content">
      @if (tab() === 'exercises') {
        <app-exercise-library [embedded]="true" />
      } @else {
        <app-pr-wall [embedded]="true" />
      }
    </div>
  `
})
export class JymExercisesComponent {
  tab = signal<'exercises' | 'prs'>('exercises');
}
