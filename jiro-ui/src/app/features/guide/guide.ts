import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { JiroMarkComponent, MarkName } from '../../shared/components/jiro-mark/jiro-mark';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';

interface ModuleCard {
  label: string;
  mark: MarkName;
  route: string | null;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterModule, JiroMarkComponent, JiroPageHeaderComponent],
  template: `
    <div class="guide-page">
      <jiro-page-header heading="Guide" subtitle="Learn how to get the most out of Jiro" />
      <div class="module-grid">
        @for (m of modules; track m.label) {
          @if (m.route) {
            <a [routerLink]="m.route" class="module-card">
              <jiro-mark [name]="m.mark" [size]="48" />
              <span>{{ m.label }}</span>
            </a>
          } @else {
            <div class="module-card disabled">
              <jiro-mark [name]="m.mark" [size]="48" />
              <span>{{ m.label }}</span>
              <span class="soon">Soon</span>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .guide-page {
      max-width: 860px;
    }

    .module-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
      gap: 16px;
    }

    .module-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 20px 12px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      text-decoration: none;
      color: var(--text-primary);
      font-size: 0.875rem;
      font-weight: 500;
      transition: box-shadow 0.15s, border-color 0.15s;
      cursor: pointer;
      position: relative;
    }

    .module-card:hover:not(.disabled) {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
      text-decoration: none;
    }

    .module-card.disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }

    .soon {
      position: absolute;
      top: 8px;
      right: 8px;
      font-size: 0.65rem;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      color: var(--text-secondary);
      background: var(--bg-canvas);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      padding: 1px 5px;
    }
  `]
})
export class GuideComponent {
  modules: ModuleCard[] = [
    { label: 'Jym',      mark: 'jym',      route: '/guide/jym' },
    { label: 'Culinara', mark: 'culinara', route: null },
    { label: 'Journaly', mark: 'journaly', route: null },
    { label: 'Ledger',   mark: 'ledger',   route: null },
  ];
}
