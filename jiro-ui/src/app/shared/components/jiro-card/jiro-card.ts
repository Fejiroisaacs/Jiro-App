import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'jiro-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="jiro-card" [class.clickable]="clickable">
      <ng-content></ng-content>
    </div>
  `,
  styles: [`
    .jiro-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      padding: var(--space-lg);
      box-shadow: var(--shadow-sm);
      transition: box-shadow 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }

    .jiro-card.clickable {
      cursor: pointer;
    }

    .jiro-card.clickable:hover {
      box-shadow: var(--shadow-md);
      transform: translate(-2px, -2px);
    }
  `]
})
export class JiroCardComponent {
  @Input() clickable = false;
}
