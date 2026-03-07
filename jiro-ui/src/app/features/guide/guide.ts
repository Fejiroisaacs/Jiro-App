import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface ModuleCard {
  label: string;
  icon: string;
  route: string | null;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterModule],
  template: `
    <div class="guide-page">
      <div class="page-header">
        <h1>Guide</h1>
        <p class="subtitle">Learn how to get the most out of Jiro</p>
      </div>
      <div class="module-grid">
        @for (m of modules; track m.label) {
          @if (m.route) {
            <a [routerLink]="m.route" class="module-card">
              <img [src]="m.icon" [alt]="m.label" width="48" height="48" />
              <span>{{ m.label }}</span>
            </a>
          } @else {
            <div class="module-card disabled">
              <img [src]="m.icon" [alt]="m.label" width="48" height="48" />
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
      padding: 24px 16px;
    }

    .page-header {
      margin-bottom: 32px;
    }

    .page-header h1 {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0 0 4px;
    }

    .subtitle {
      color: var(--text-secondary);
      font-size: 0.875rem;
      margin: 0;
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
    { label: 'Jym',      icon: '/icons/jym-icon.svg',      route: '/guide/jym' },
    { label: 'Culinara', icon: '/icons/culinara-icon.svg', route: null },
    { label: 'Journaly', icon: '/icons/journaly-icon.svg', route: null },
    { label: 'Ledger',   icon: '/icons/ledger-icon.svg',   route: null },
  ];
}
