import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/guards/auth.guard';
import { PRIVATE_PAGE } from './core/site.config';

// `title` feeds the document title ("Transactions · Jiro") and the mobile top
// bar on drill-down pages. `data.moduleNav: false` hides the module tab row on
// pages that own their own sticky chrome.
//
// Every route also carries SEO data that `SeoService` reads on navigation:
//   description  the meta description, always present
//   index        true only for the handful of pages in PUBLIC_ROUTES; absent or
//                false emits `noindex, nofollow`
//   canonical    an absolute path, set only where two URLs render the same thing
//   schema       which JSON-LD type the page should emit, if any
// `PRIVATE_PAGE` carries `index: false` plus a generic description, so a route
// added without thinking about SEO is excluded from search rather than exposed.
export const routes: Routes = [
  // Public landing page — component redirects to /dashboard if already authenticated
  {
    path: '',
    pathMatch: 'full',
    title: 'Your life, in one place',
    data: {
      index: true,
      description:
        'Your life, in one place: recipes, workouts, journal and money. Private by default, with no ads and no third-party tracking.',
      ogType: 'website',
    },
    loadComponent: () => import('./features/landing/landing').then(m => m.LandingComponent),
  },
  {
    path: 'login',
    title: 'Sign in',
    canActivate: [guestGuard],
    data: {
      index: true,
      description: 'Sign in to Jiro to reach your recipes, workouts, journal and accounts.',
    },
    loadComponent: () => import('./features/auth/login').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Create account',
    canActivate: [guestGuard],
    data: {
      index: true,
      description: 'Create a Jiro account and start with whichever module you need first. Free, and your data stays yours.',
    },
    loadComponent: () => import('./features/auth/register').then(m => m.RegisterComponent),
  },
  // Legal pages: public, no guard, outside the app shell like the landing page.
  {
    path: 'privacy',
    title: 'Privacy policy',
    data: {
      index: true,
      description: 'What information Jiro keeps, why, where it is stored, and what you can do about it.',
    },
    loadComponent: () => import('./features/legal/privacy').then(m => m.PrivacyComponent),
  },
  {
    path: 'terms',
    title: 'Terms of use',
    data: {
      index: true,
      description: 'The rules for using Jiro, what stays yours, and the limits of the service.',
    },
    loadComponent: () => import('./features/legal/terms').then(m => m.TermsComponent),
  },
  // Opt-in public content, in the normal app shell but with no guard. These two
  // pages read endpoints the API already serves anonymously, and they are the
  // only crawlable content in the app besides the marketing page. Ordering
  // matters: this block has to precede the guarded '' parent below, whose
  // 'culinara/:id' route would otherwise match 'culinara/discover' and redirect
  // a visitor (and a crawler) to the login page. pathMatch: 'full' keeps the
  // detail routes falling through to the guarded parent, where they belong.
  {
    path: '',
    loadComponent: () => import('./layouts/main-layout/main-layout').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'culinara/discover',
        pathMatch: 'full',
        title: 'Discover recipes',
        data: {
          index: true,
          description:
            'Browse recipes Jiro cooks have chosen to publish, with their ingredients and steps, and save any of them to your own library.',
          schema: 'Recipe',
        },
        loadComponent: () => import('./features/culinara/discover/discover').then(m => m.DiscoverComponent),
      },
      {
        path: 'jym/discover',
        pathMatch: 'full',
        title: 'Discover splits',
        data: {
          index: true,
          description:
            'Training splits shared by other Jiro lifters, with the routines and exercises each one builds on.',
          schema: 'ExercisePlan',
        },
        loadComponent: () => import('./features/jym/discover/discover').then(m => m.DiscoverComponent),
      },
    ],
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layouts/main-layout/main-layout').then(m => m.MainLayoutComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Dashboard',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/dashboard/dashboard').then(m => m.DashboardComponent),
      },
      {
        path: 'settings',
        title: 'Settings',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/settings/settings').then(m => m.SettingsComponent),
      },
      {
        path: 'guide',
        title: 'Guide',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/guide/guide').then(m => m.GuideComponent),
      },
      // One of the user's days across all four modules. Bare /day, a bad date
      // and a future one are all replaced with today by the page itself, since
      // "today" depends on the signed-in user's timezone.
      {
        path: 'day',
        title: 'Day',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/day/day-page').then(m => m.DayPageComponent),
      },
      {
        path: 'day/:date',
        title: 'Day',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/day/day-page').then(m => m.DayPageComponent),
      },
      {
        path: 'guide/basics',
        title: 'Getting around Jiro',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/guide/basics/basics-guide').then(m => m.BasicsGuideComponent),
      },
      {
        path: 'guide/jym',
        title: 'Jym guide',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/guide/jym/jym-guide').then(m => m.JymGuideComponent),
      },
      {
        path: 'guide/culinara',
        title: 'Culinara guide',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/guide/culinara/culinara-guide').then(m => m.CulinaraGuideComponent),
      },
      {
        path: 'guide/journaly',
        title: 'Journaly guide',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/guide/journaly/journaly-guide').then(m => m.JournalyGuideComponent),
      },
      {
        path: 'guide/ledger',
        title: 'Ledger guide',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/guide/ledger/ledger-guide').then(m => m.LedgerGuideComponent),
      },
      {
        path: 'culinara',
        title: 'Culinara',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/culinara/recipe-list/recipe-list').then(m => m.RecipeListComponent),
      },
      { path: 'culinara/shopping', redirectTo: '/culinara/grocery-list', pathMatch: 'full' },
      {
        path: 'culinara/grocery-list',
        title: 'Grocery list',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/culinara/shopping-list/shopping-list').then(m => m.ShoppingListComponent),
      },
      {
        path: 'culinara/meal-planner',
        title: 'Meal planner',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/culinara/meal-planner/meal-planner').then(m => m.MealPlannerComponent),
      },
      {
        path: 'culinara/discover/:id',
        title: 'Shared recipe',
        // The same recipe as 'culinara/:id', differing only by who owns it.
        data: { ...PRIVATE_PAGE, schema: 'Recipe' },
        loadComponent: () => import('./features/culinara/discover/discover-detail').then(m => m.CulinaraDiscoverDetailComponent),
      },
      // Focus screen: both the module row and the bottom bar step aside so the
      // cook footer owns the bottom of the viewport. Must precede 'culinara/:id',
      // which matches by prefix.
      {
        path: 'culinara/:id/cook',
        title: 'Cook mode',
        data: { ...PRIVATE_PAGE, moduleNav: false, mobileNav: false },
        loadComponent: () => import('./features/culinara/cook-mode/cook-mode').then(m => m.CookModeComponent),
      },
      {
        path: 'culinara/:id',
        title: 'Recipe',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/culinara/recipe-detail/recipe-detail').then(m => m.RecipeDetailComponent),
      },
      {
        path: 'jym',
        title: 'Jym',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/jym-dashboard/jym-dashboard').then(m => m.JymDashboardComponent),
      },
      // ── Jym container pages (consolidate sub-sections) ──────────────────────
      {
        path: 'jym/exercises',
        title: 'Exercises',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/jym-exercises/jym-exercises').then(m => m.JymExercisesComponent),
      },
      {
        path: 'jym/plan',
        title: 'Plan',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/jym-plan/jym-plan').then(m => m.JymPlanComponent),
      },
      {
        path: 'jym/track',
        title: 'Track',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/jym-track/jym-track').then(m => m.JymTrackComponent),
      },
      // ── Jym legacy redirects (old flat routes → new container routes) ────────
      { path: 'jym/train', redirectTo: '/jym/exercises', pathMatch: 'full' },
      { path: 'jym/prs', redirectTo: () => '/jym/exercises?tab=prs', pathMatch: 'full' },
      { path: 'jym/splits', redirectTo: '/jym/plan', pathMatch: 'full' },
      { path: 'jym/series', redirectTo: () => '/jym/plan?tab=series', pathMatch: 'full' },
      { path: 'jym/templates', redirectTo: () => '/jym/plan?tab=templates', pathMatch: 'full' },
      { path: 'jym/sessions', redirectTo: '/jym/track', pathMatch: 'full' },
      { path: 'jym/bodyweight', redirectTo: () => '/jym/track?tab=bodyweight', pathMatch: 'full' },
      // ── Jym drill-down pages (push navigation, bottom nav stays visible) ────
      {
        path: 'jym/splits/:id',
        title: 'Split',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/split-detail/split-detail').then(m => m.SplitDetailComponent),
      },
      {
        path: 'jym/exercises/:id',
        title: 'Exercise',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/exercise-detail/exercise-detail').then(m => m.ExerciseDetailComponent),
      },
      {
        path: 'jym/session/:id',
        title: 'Session',
        data: { ...PRIVATE_PAGE, moduleNav: false },
        loadComponent: () => import('./features/jym/session-player/session-player').then(m => m.SessionPlayerComponent),
      },
      {
        path: 'jym/session-summary',
        title: 'Session summary',
        data: { ...PRIVATE_PAGE, moduleNav: false },
        loadComponent: () => import('./features/jym/session-summary/session-summary').then(m => m.SessionSummaryComponent),
      },
      {
        path: 'jym/series/:id',
        title: 'Series',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/series-detail/series-detail').then(m => m.SeriesDetailComponent),
      },
      {
        path: 'jym/discover/:id',
        title: 'Shared split',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/jym/discover/discover-detail').then(m => m.DiscoverDetailComponent),
      },
      // The old Jym how-to page; the guide replaced it.
      { path: 'jym/how-to', redirectTo: '/guide/jym', pathMatch: 'full' },
      // ── Ledger ────────────────────────────────────────────────────────────
      {
        path: 'ledger',
        title: 'Ledger',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/ledger/ledger-hub/ledger-hub').then(m => m.LedgerHubComponent),
      },
      {
        path: 'ledger/transactions',
        title: 'Transactions',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/ledger/transactions/transaction-log').then(m => m.TransactionLogComponent),
      },
      {
        path: 'ledger/accounts',
        title: 'Accounts',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/ledger/accounts/accounts-page').then(m => m.AccountsPageComponent),
      },
      {
        path: 'ledger/budgets',
        title: 'Budgets',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/ledger/budgets/budgets-page').then(m => m.BudgetsPageComponent),
      },
      { path: 'ledger/networth', redirectTo: '/ledger/net-worth', pathMatch: 'full' },
      {
        path: 'ledger/net-worth',
        title: 'Net worth',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/ledger/networth/networth-page').then(m => m.NetWorthPageComponent),
      },
      {
        path: 'ledger/compare',
        title: 'Compare periods',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/ledger/compare/comparison-page').then(m => m.ComparisonPageComponent),
      },
      // ── Journaly ──────────────────────────────────────────────────────────
      {
        path: 'journal',
        title: 'Journaly',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-home/journal-home').then(m => m.JournalHomeComponent),
      },
      {
        path: 'journal/new',
        title: 'New entry',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent),
      },
      {
        path: 'journal/entries',
        title: 'All entries',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-entries/journal-entries').then(m => m.JournalEntriesComponent),
      },
      {
        path: 'journal/:id/edit',
        title: 'Edit entry',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-editor/journal-editor').then(m => m.JournalEditorComponent),
      },
      {
        path: 'journal/groups',
        title: 'Groups',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-groups-list/journal-groups-list').then(m => m.JournalGroupsListComponent),
      },
      {
        path: 'journal/groups/:id',
        title: 'Group',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-group/journal-group').then(m => m.JournalGroupComponent),
      },
      {
        path: 'journal/collections',
        title: 'Collections',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-collections-list/journal-collections-list').then(m => m.JournalCollectionsListComponent),
      },
      {
        path: 'journal/collections/:id',
        title: 'Collection',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/journal/journal-collection/journal-collection').then(m => m.JournalCollectionComponent),
      },
    ],
  },
  // Journal join — public route (no auth guard; component redirects to login if needed)
  {
    path: 'journal/join',
    title: 'Join a journal group',
    data: {
      ...PRIVATE_PAGE,
      description: 'Accept an invitation to a shared Jiro journal.',
    },
    loadComponent: () => import('./features/journal/journal-join/journal-join').then(m => m.JournalJoinComponent),
  },
  {
    path: 'jym/share/:share_id',
    title: 'Shared workout',
    data: {
      ...PRIVATE_PAGE,
      // Unlisted, not public: whoever holds the link can read it, but it must
      // never appear in search results.
      description: 'A training split someone shared with you.',
    },
    loadComponent: () => import('./features/jym/share-preview/share-preview').then(m => m.SharePreviewComponent),
  },
  {
    path: 'forgot-password',
    title: 'Forgot password',
    data: { ...PRIVATE_PAGE, description: 'Send yourself a Jiro password reset link.' },
    loadComponent: () => import('./features/auth/forgot-password').then(m => m.ForgotPasswordComponent),
  },
  {
    path: 'reset-password',
    title: 'Reset password',
    data: { ...PRIVATE_PAGE, description: 'Choose a new password for your Jiro account.' },
    loadComponent: () => import('./features/auth/reset-password').then(m => m.ResetPasswordComponent),
  },
  {
    path: 'verify-email',
    title: 'Verify email',
    data: { ...PRIVATE_PAGE, description: 'Confirm your email address for your Jiro account.' },
    loadComponent: () => import('./features/auth/verify-email').then(m => m.VerifyEmailComponent),
  },
  // Admin panel — gated on the user's is_admin flag.
  // Until now this tree had no canActivate at all, so an anonymous visitor
  // could load and render the admin shell; only the data fetch failed.
  {
    path: 'admin',
    canActivate: [adminGuard],
    loadComponent: () => import('./features/admin/admin-layout').then(m => m.AdminLayoutComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Admin dashboard',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/admin/admin-dashboard').then(m => m.AdminDashboardComponent),
      },
      {
        path: 'users',
        title: 'Admin users',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/admin/admin-users').then(m => m.AdminUsersComponent),
      },
      {
        path: 'users/:id',
        title: 'Admin user',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/admin/admin-user-detail').then(m => m.AdminUserDetailComponent),
      },
      {
        path: 'events',
        title: 'Admin events',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/admin/admin-events').then(m => m.AdminEventsComponent),
      },
      {
        path: 'feedback',
        title: 'Admin feedback',
        data: { ...PRIVATE_PAGE },
        loadComponent: () => import('./features/admin/admin-feedback').then(m => m.AdminFeedbackComponent),
      },
    ],
  },
  {
    path: 'culinara/share/:token',
    title: 'Shared recipe',
    data: {
      ...PRIVATE_PAGE,
      // Unlisted, not public — same reasoning as the shared workout above.
      description: 'A recipe someone shared with you.',
    },
    loadComponent: () => import('./features/culinara/recipe-share/recipe-share').then(m => m.RecipeShareComponent),
  },
  {
    path: '**',
    title: 'Page not found',
    data: { ...PRIVATE_PAGE, description: 'That page does not exist.' },
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFoundComponent),
  },
];
