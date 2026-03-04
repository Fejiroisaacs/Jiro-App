import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { AuthService } from '../../core/services/auth.service';

interface ModuleCard {
  name: string;
  description: string;
  icon: string;
  route: string;
  color: string;
  available: boolean;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, JiroCardComponent],
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
          <div class="module-icon" [style.background]="mod.color">
            <img [src]="mod.icon" [alt]="mod.name + ' icon'" class="module-icon-img">
          </div>
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

    .module-icon {
      width: 48px;
      height: 48px;
      border-radius: var(--border-radius);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: var(--space-md);
      overflow: hidden;
      flex-shrink: 0;
    }

    .module-icon-img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    @media (max-width: 480px) {
      .module-icon {
        width: 40px;
        height: 40px;
      }
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
      icon: '/icons/jym-icon.svg',
      route: '/jym',
      color: 'rgba(122, 59, 46, 0.15)',
      available: true,
    },
    {
      name: 'Culinara',
      description: 'Recipe notebook. Track and plan meals, compare results, improve your dishes.',
      icon: '/icons/culinara-icon.svg',
      route: '/culinara',
      color: 'rgba(196, 149, 106, 0.25)',
      available: true,
    },
    {
      name: 'Journaly',
      description: 'Personal knowledge base. Organize and share your thoughts.',
      icon: '/icons/journaly-icon.svg',
      route: '/journaly',
      color: 'rgba(122, 103, 65, 0.15)',
      available: true,
    },
    {
      name: 'Ledger',
      description: 'Financial tracking and budgeting.',
      icon: '/icons/ledger-icon.svg',
      route: '/ledger',
      color: 'rgba(122, 103, 65, 0.15)',
      available: true,
    },
    {
      name: 'Echo',
      description: 'Active reminder engine with multi-channel notifications. Never miss a critical task.',
      icon: '/icons/echo-icon.svg',
      route: '/echo',
      color: 'rgba(74, 103, 65, 0.15)',
      available: false,
    },
  ];

  constructor(private authService: AuthService) { }

  userName(): string {
    const user = this.authService.user();
    if (!user) return '';
    return user.email.split('@')[0];
  }
}
