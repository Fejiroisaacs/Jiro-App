import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SessionHistoryComponent } from '../session-history/session-history';
import { BodyWeightComponent } from '../body-weight/body-weight';

@Component({
  selector: 'app-jym-track',
  standalone: true,
  imports: [CommonModule, SessionHistoryComponent, BodyWeightComponent],
  template: `
    <div class="tab-strip">
      <button class="tab-btn" [class.active]="tab() === 'sessions'" (click)="tab.set('sessions')">Sessions</button>
      <button class="tab-btn" [class.active]="tab() === 'bodyweight'" (click)="tab.set('bodyweight')">Body Weight</button>
    </div>
    <div class="tab-content">
      @if (tab() === 'sessions') {
        <app-session-history [embedded]="true" />
      } @else {
        <app-body-weight [embedded]="true" />
      }
    </div>
  `
})
export class JymTrackComponent {
  tab = signal<'sessions' | 'bodyweight'>('sessions');
}
