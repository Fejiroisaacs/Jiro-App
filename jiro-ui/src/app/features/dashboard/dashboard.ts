import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroMarkComponent, MarkName } from '../../shared/components/jiro-mark/jiro-mark';
import { AuthService } from '../../core/services/auth.service';

interface ModuleCard {
  name: string;
  description: string;
  mark: MarkName;
  route: string;
  available: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, JiroCardComponent, JiroMarkComponent],
  template: `
    <div class="dashboard">
      <div class="dashboard-header">
        <h1>App Center</h1>
        <p class="text-secondary">Welcome back{{ userName() ? ', ' + userName() : '' }}</p>
      </div>

      <div class="modules-grid">
        <jiro-card
          *ngFor="let mod of modules"
          [clickable]="mod.available"
          [routerLink]="mod.available ? mod.route : null"
          class="module-card">
          <jiro-mark [name]="mod.mark" [size]="48" class="module-mark" />
          <h3 class="module-name">{{ mod.name }}</h3>
          <p class="module-desc text-secondary">{{ mod.description }}</p>
          <span *ngIf="!mod.available" class="module-badge">Coming Soon</span>
        </jiro-card>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-header {
      margin-bottom: var(--space-xl);
    }

    .dashboard-header h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      color: var(--text-primary);
    }

    .dashboard-header p {
      margin-top: var(--space-xs);
    }

    .modules-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-lg);
    }

    .module-card {
      position: relative;
    }

    .module-mark {
      margin-bottom: var(--space-md);
    }

    .module-name {
      font-size: var(--font-size-lg);
      font-weight: 600;
      margin-bottom: var(--space-xs);
    }

    .module-desc {
      font-size: var(--font-size-sm);
      line-height: 1.5;
    }

    .module-badge {
      display: inline-block;
      margin-top: var(--space-sm);
      padding: 2px 10px;
      font-size: var(--font-size-xs);
      background: var(--color-secondary);
      color: var(--text-secondary);
      border-radius: 12px;
      font-weight: 500;
    }
  `]
})
export class DashboardComponent {
  modules: ModuleCard[] = [
    {
      name: 'Jym',
      description: 'Structured progressive overload tracking. Plan workouts, log sessions, chase PRs.',
      mark: 'jym',
      route: '/jym',
      available: true,
    },
    {
      name: 'Culinara',
      description: 'Recipe notebook. Track and plan meals, compare results, improve your dishes.',
      mark: 'culinara',
      route: '/culinara',
      available: true,
    },
    {
      name: 'Journaly',
      description: 'Personal knowledge base. Organize and share your thoughts.',
      mark: 'journaly',
      route: '/journal',
      available: true,
    },
    {
      name: 'Ledger',
      description: 'Financial tracking and budgeting.',
      mark: 'ledger',
      route: '/ledger',
      available: true,
    },
    {
      name: 'Echo',
      description: 'Active reminder engine with multi-channel notifications. Never miss a critical task.',
      mark: 'echo',
      route: '/echo',
      available: false,
    },
  ];

  constructor(private authService: AuthService) { }

  userName(): string {
    const user = this.authService.user();
    if (!user) return '';
    return user.display_name || user.email.split('@')[0];
  }
}
