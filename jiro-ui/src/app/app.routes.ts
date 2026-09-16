import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';

// `title` feeds the document title ("Transactions · Jiro") and the mobile top
// bar on drill-down pages. `data.moduleNav: false` hides the module tab row on
// pages that own their own sticky chrome.
export const routes: Routes = [
  // Public landing page — component redirects to /dashboard if already authenticated
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent),
  },
  {
    path: 'login',
    title: 'Sign in',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Create account',
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
        title: 'Dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'settings',
        title: 'Settings',
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent),
      },
      {
        path: 'guide',
        title: 'Guide',
        loadComponent: () => import('./features/guide/guide').then(m => m.GuideComponent),
      },
      {
        path: 'guide/jym',
        title: 'Jym guide',
        loadComponent: () => import('./features/guide/jym-guide').then(m => m.JymGuideComponent),
      },
      {
        path: 'culinara',
        title: 'Culinara',
        loadComponent: () => import('./features/culinara/recipe-list/recipe-list').then(m => m.RecipeListComponent),
      },
      {
        path: 'culinara/shopping',
        title: 'Grocery list',
        loadComponent: () => import('./features/culinara/shopping-list/shopping-list').then(m => m.ShoppingListComponent),
      },
      {
        path: 'culinara/meal-planner',
        title: 'Meal planner',
        loadComponent: () => import('./features/culinara/meal-planner/meal-planner').then(m => m.MealPlannerComponent),
      },
      {
        path: 'culinara/discover',
        title: 'Discover recipes',
        loadComponent: () => import('./features/culinara/discover/discover').then(m => m.DiscoverComponent),
      },
      {
        path: 'culinara/discover/:id',
        title: 'Shared recipe',
        loadComponent: () => import('./features/culinara/discover/discover-detail').then(m => m.CulinaraDiscoverDetailComponent),
      },
      // Focus screen: both the module row and the bottom bar step aside so the
      // cook footer owns the bottom of the viewport. Must precede 'culinara/:id',
      // which matches by prefix.
      {
        path: 'culinara/:id/cook',
        title: 'Cook mode',
        data: { moduleNav: false, mobileNav: false },
        loadComponent: () => import('./features/culinara/cook-mode/cook-mode').then(m => m.CookModeComponent),
      },
      {
        path: 'culinara/:id',
        title: 'Recipe',
        loadComponent: () => import('./features/culinara/recipe-detail/recipe-detail').then(m => m.RecipeDetailComponent),
      },
      {
        path: 'jym',
        title: 'Jym',
        loadComponent: () => import('./features/jym/jym-dashboard/jym-dashboard').then(m => m.JymDashboardComponent),
      },
      // ── Jym container pages (consolidate sub-sections) ──────────────────────
      {
        path: 'jym/exercises',
        title: 'Exercises',
        loadComponent: () => import('./features/jym/jym-exercises/jym-exercises').then(m => m.JymExercisesComponent),
      },
      {
        path: 'jym/plan',
        title: 'Plan',
        loadComponent: () => import('./features/jym/jym-plan/jym-plan').then(m => m.JymPlanComponent),
      },
      {
        path: 'jym/track',
        title: 'Track',
        loadComponent: () => import('./features/jym/jym-track/jym-track').then(m => m.JymTrackComponent),
      },
      // ── Jym legacy redirects (old flat routes → new container routes) ────────
      { path: 'jym/train', redirectTo: 'jym/exercises', pathMatch: 'full' },
      { path: 'jym/prs', redirectTo: 'jym/exercises', pathMatch: 'full' },
      { path: 'jym/splits', redirectTo: 'jym/plan', pathMatch: 'full' },
      { path: 'jym/series', redirectTo: 'jym/plan', pathMatch: 'full' },
      { path: 'jym/templates', redirectTo: 'jym/plan', pathMatch: 'full' },
      { path: 'jym/sessions', redirectTo: 'jym/track', pathMatch: 'full' },
      { path: 'jym/bodyweight', redirectTo: 'jym/track', pathMatch: 'full' },
      // ── Jym drill-down pages (push navigation, bottom nav stays visible) ────
      {
        path: 'jym/splits/:id',
        title: 'Split',
        loadComponent: () => import('./features/jym/split-detail/split-detail').then(m => m.SplitDetailComponent),
      },
      {
        path: 'jym/exercises/:id',
        title: 'Exercise',
        loadComponent: () => import('./features/jym/exercise-detail/exercise-detail').then(m => m.ExerciseDetailComponent),
      },
      {
        path: 'jym/session/:id',
        title: 'Session',
        data: { moduleNav: false },
        loadComponent: () => import('./features/jym/session-player/session-player').then(m => m.SessionPlayerComponent),
      },
      {
        path: 'jym/session-summary',
        title: 'Session summary',
        data: { moduleNav: false },
        loadComponent: () => import('./features/jym/session-summary/session-summary').then(m => m.SessionSummaryComponent),
      },
      {
        path: 'jym/series/:id',
        title: 'Series',
        loadComponent: () => import('./features/jym/series-detail/series-detail').then(m => m.SeriesDetailComponent),
      },
      {
        path: 'jym/discover',
        title: 'Discover splits',
        loadComponent: () => import('./features/jym/discover/discover').then(m => m.DiscoverComponent),
      },
      {
        path: 'jym/discover/:id',
        title: 'Shared split',
        loadComponent: () => import('./features/jym/discover/discover-detail').then(m => m.DiscoverDetailComponent),
      },
      {
        path: 'jym/how-to',
        title: 'How to use Jym',
        loadComponent: () => import('./features/jym/how-to-use/how-to-use').then(m => m.HowToUseComponent),
      },
      // ── Ledger ────────────────────────────────────────────────────────────
      {
        path: 'ledger',
        title: 'Ledger',
        loadComponent: () => import('./features/ledger/ledger-hub/ledger-hub').then(m => m.LedgerHubComponent),
      },
      {
        path: 'ledger/transactions',
        title: 'Transactions',
        loadComponent: () => import('./features/ledger/transactions/transaction-log').then(m => m.TransactionLogComponent),
      },
      {
        path: 'ledger/accounts',
        title: 'Accounts',
        loadComponent: () => import('./features/ledger/accounts/accounts-page').then(m => m.AccountsPageComponent),
      },
      {
        path: 'ledger/budgets',
        title: 'Budgets',
        loadComponent: () => import('./features/ledger/budgets/budgets-page').then(m => m.BudgetsPageComponent),
      },
      {
        path: 'ledger/networth',
        title: 'Net worth',
        loadComponent: () => import('./features/ledger/networth/networth-page').then(m => m.NetWorthPageComponent),
      },
      {
        path: 'ledger/compare',
        title: 'Compare periods',
        loadComponent: () => import('./features/ledger/compare/comparison-page').then(m => m.ComparisonPageComponent),
      },
      // ── Journaly ──────────────────────────────────────────────────────────
      {
        path: 'journal',
        title: 'Journaly',
        loadComponent: () => import('./features/journal/journal-home/journal-home').then(m => m.JournalHomeComponent),
      },
      {
        path: 'journal/new',
        title: 'New entry',
        loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent),
      },
      {
        path: 'journal/:id/edit',
        title: 'Edit entry',
        loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent),
      },
      {
        path: 'journal/groups',
        title: 'Groups',
        loadComponent: () => import('./features/journal/journal-groups-list/journal-groups-list').then(m => m.JournalGroupsListComponent),
      },
      {
        path: 'journal/groups/:id',
        title: 'Group',
        loadComponent: () => import('./features/journal/journal-group/journal-group').then(m => m.JournalGroupComponent),
      },
      {
        path: 'journal/collections',
        title: 'Collections',
        loadComponent: () => import('./features/journal/journal-collections-list/journal-collections-list').then(m => m.JournalCollectionsListComponent),
      },
      {
        path: 'journal/collections/:id',
        title: 'Collection',
        loadComponent: () => import('./features/journal/journal-collection/journal-collection').then(m => m.JournalCollectionComponent),
      },
    ],
  },
  // Journal join — public route (no auth guard; component redirects to login if needed)
  {
    path: 'journal/join',
    title: 'Join a journal group',
    loadComponent: () => import('./features/journal/journal-join/journal-join').then(m => m.JournalJoinComponent),
  },
  {
    path: 'jym/share/:share_id',
    title: 'Shared workout',
    loadComponent: () => import('./features/jym/share-preview/share-preview').then(m => m.SharePreviewComponent),
  },
  {
    path: 'forgot-password',
    title: 'Forgot password',
    loadComponent: () => import('./features/auth/forgot-password').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    title: 'Reset password',
    loadComponent: () => import('./features/auth/reset-password').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'verify-email',
    title: 'Verify email',
    loadComponent: () => import('./features/auth/verify-email').then(m => m.VerifyEmailComponent),
  },
  // Admin panel — login at exact /admin, layout handles /admin/*
  {
    path: 'admin',
    pathMatch: 'full',
    title: 'Admin',
    loadComponent: () => import('./features/admin/admin-login').then(m => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Admin dashboard',
        loadComponent: () => import('./features/admin/admin-dashboard').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'users',
        title: 'Admin users',
        loadComponent: () => import('./features/admin/admin-users').then(m => m.AdminUsersComponent),
      },
      {
        path: 'users/:id',
        title: 'Admin user',
        loadComponent: () => import('./features/admin/admin-user-detail').then(m => m.AdminUserDetailComponent),
      },
      {
        path: 'events',
        title: 'Admin events',
        loadComponent: () => import('./features/admin/admin-events').then(m => m.AdminEventsComponent),
      },
      {
        path: 'feedback',
        title: 'Admin feedback',
        loadComponent: () => import('./features/admin/admin-feedback').then(m => m.AdminFeedbackComponent),
      },
    ],
  },
  {
    path: 'culinara/share/:token',
    title: 'Shared recipe',
    loadComponent: () => import('./features/culinara/recipe-share/recipe-share').then(m => m.RecipeShareComponent),
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFoundComponent),
  },
];
