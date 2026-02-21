import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register').then(m => m.RegisterComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/main-layout/main-layout').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent),
      },
      {
        path: 'culinara',
        loadComponent: () => import('./features/culinara/recipe-list/recipe-list').then(m => m.RecipeListComponent),
      },
      {
        path: 'culinara/shopping',
        loadComponent: () => import('./features/culinara/shopping-list/shopping-list').then(m => m.ShoppingListComponent),
      },
      {
        path: 'culinara/:id',
        loadComponent: () => import('./features/culinara/recipe-detail/recipe-detail').then(m => m.RecipeDetailComponent),
      },
      {
        path: 'jym',
        loadComponent: () => import('./features/jym/split-list/split-list').then(m => m.SplitListComponent),
      },
      {
        path: 'jym/splits/:id',
        loadComponent: () => import('./features/jym/split-detail/split-detail').then(m => m.SplitDetailComponent),
      },
      {
        path: 'jym/exercises',
        loadComponent: () => import('./features/jym/exercise-library/exercise-library').then(m => m.ExerciseLibraryComponent),
      },
      {
        path: 'jym/exercises/:id',
        loadComponent: () => import('./features/jym/exercise-detail/exercise-detail').then(m => m.ExerciseDetailComponent),
      },
      {
        path: 'jym/session/:id',
        loadComponent: () => import('./features/jym/session-player/session-player').then(m => m.SessionPlayerComponent),
      },
      {
        path: 'jym/sessions',
        loadComponent: () => import('./features/jym/session-history/session-history').then(m => m.SessionHistoryComponent),
      },
      {
        path: 'jym/bodyweight',
        loadComponent: () => import('./features/jym/body-weight/body-weight').then(m => m.BodyWeightComponent),
      },
      {
        path: 'jym/series',
        loadComponent: () => import('./features/jym/series-list/series-list').then(m => m.SeriesListComponent),
      },
      {
        path: 'jym/series/:id',
        loadComponent: () => import('./features/jym/series-detail/series-detail').then(m => m.SeriesDetailComponent),
      },
      {
        path: 'jym/prs',
        loadComponent: () => import('./features/jym/pr-wall/pr-wall').then(m => m.PrWallComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'verify-email',
    loadComponent: () => import('./features/auth/verify-email').then(m => m.VerifyEmailComponent),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
