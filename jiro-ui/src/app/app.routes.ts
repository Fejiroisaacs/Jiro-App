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
        path: 'culinara/meal-planner',
        loadComponent: () => import('./features/culinara/meal-planner/meal-planner').then(m => m.MealPlannerComponent),
      },
      {
        path: 'culinara/:id',
        loadComponent: () => import('./features/culinara/recipe-detail/recipe-detail').then(m => m.RecipeDetailComponent),
      },
      {
        path: 'jym',
        loadComponent: () => import('./features/jym/jym-dashboard/jym-dashboard').then(m => m.JymDashboardComponent),
      },
      {
        path: 'jym/templates',
        loadComponent: () => import('./features/jym/templates/templates').then(m => m.JymTemplatesComponent),
      },
      {
        path: 'jym/splits',
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
        path: 'jym/discover',
        loadComponent: () => import('./features/jym/discover/discover').then(m => m.DiscoverComponent),
      },
      {
        path: 'jym/discover/:id',
        loadComponent: () => import('./features/jym/discover/discover-detail').then(m => m.DiscoverDetailComponent),
      },
      {
        path: 'jym/how-to',
        loadComponent: () => import('./features/jym/how-to-use/how-to-use').then(m => m.HowToUseComponent),
      },
      // ── Journaly ──────────────────────────────────────────────────────────
      {
        path: 'journal',
        loadComponent: () => import('./features/journal/journal-home/journal-home').then(m => m.JournalHomeComponent),
      },
      {
        path: 'journal/new',
        loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent),
      },
      {
        path: 'journal/:id/edit',
        loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent),
      },
      {
        path: 'journal/groups',
        loadComponent: () => import('./features/journal/journal-groups-list/journal-groups-list').then(m => m.JournalGroupsListComponent),
      },
      {
        path: 'journal/groups/:id',
        loadComponent: () => import('./features/journal/journal-group/journal-group').then(m => m.JournalGroupComponent),
      },
      {
        path: 'journal/collections',
        loadComponent: () => import('./features/journal/journal-collections-list/journal-collections-list').then(m => m.JournalCollectionsListComponent),
      },
      {
        path: 'journal/collections/:id',
        loadComponent: () => import('./features/journal/journal-collection/journal-collection').then(m => m.JournalCollectionComponent),
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
    ],
  },
  // Journal join — public route (no auth guard; component redirects to login if needed)
  {
    path: 'journal/join',
    loadComponent: () => import('./features/journal/journal-join/journal-join').then(m => m.JournalJoinComponent),
  },
  {
    path: 'jym/share/:share_id',
    loadComponent: () => import('./features/jym/share-preview/share-preview').then(m => m.SharePreviewComponent),
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
  // Admin panel — login at exact /admin, layout handles /admin/*
  {
    path: 'admin',
    pathMatch: 'full',
    loadComponent: () => import('./features/admin/admin-login').then(m => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/admin-dashboard').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/admin-users').then(m => m.AdminUsersComponent),
      },
      {
        path: 'users/:id',
        loadComponent: () => import('./features/admin/admin-user-detail').then(m => m.AdminUserDetailComponent),
      },
      {
        path: 'events',
        loadComponent: () => import('./features/admin/admin-events').then(m => m.AdminEventsComponent),
      },
    ],
  },
  {
    path: 'culinara/share/:token',
    loadComponent: () => import('./features/culinara/recipe-share/recipe-share').then(m => m.RecipeShareComponent),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
