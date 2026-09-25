import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { JiroMarkComponent, MarkName } from '../../shared/components/jiro-mark/jiro-mark';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';

interface GuideCard {
  label: string;
  description: string;
  mark: MarkName;
  route: string;
}

@Component({
  selector: 'app-guide',
  standalone: true,
  imports: [RouterModule, JiroMarkComponent, JiroPageHeaderComponent],
  template: `
    <div class="guide-page">
      <jiro-page-header heading="Guide" subtitle="Learn how to get the most out of Jiro" />
      <ul class="module-grid">
        @for (g of guides; track g.route) {
          <li>
            <a [routerLink]="g.route" class="module-card">
              <jiro-mark [name]="g.mark" [size]="48" />
              <span class="card-label">{{ g.label }}</span>
              <span class="card-desc">{{ g.description }}</span>
            </a>
          </li>
        }
      </ul>
    </div>
  `,
  styles: [`
    .guide-page {
      max-width: 860px;
    }

    .module-grid {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
      gap: 16px;
    }
    .module-grid li { display: flex; }

    .module-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 6px;
      padding: 20px 16px;
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius-lg);
      text-decoration: none;
      color: var(--text-primary);
      transition: box-shadow 0.15s, border-color 0.15s;
    }
    .module-card jiro-mark { margin-bottom: 4px; }

    .module-card:hover {
      border-color: var(--color-primary);
      box-shadow: var(--shadow-md);
      text-decoration: none;
    }

    .card-label {
      font-size: var(--font-size-md);
      font-weight: 600;
    }

    .card-desc {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }

    @media (prefers-reduced-motion: reduce) {
      .module-card { transition: none; }
    }
  `]
})
export class GuideComponent {
  readonly guides: GuideCard[] = [
    { label: 'Getting around Jiro', mark: 'jiro',     route: '/guide/basics',   description: 'The dashboard, search, settings and your data.' },
    { label: 'Jym',                 mark: 'jym',      route: '/guide/jym',      description: 'Plan your training, log workouts and track progress.' },
    { label: 'Culinara',            mark: 'culinara', route: '/guide/culinara', description: 'Save recipes, cook from them and plan meals.' },
    { label: 'Journaly',            mark: 'journaly', route: '/guide/journaly', description: 'Write entries, look back and share with groups.' },
    { label: 'Ledger',              mark: 'ledger',   route: '/guide/ledger',   description: 'Track accounts, spending, budgets and net worth.' },
  ];
}
