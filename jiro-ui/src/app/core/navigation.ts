import { IconName } from '../shared/icons/icons.generated';
import { MarkName } from '../shared/components/jiro-mark/jiro-mark';

/**
 * The one description of Jiro's navigation. The shell renders it as the
 * desktop module tab row and as the mobile bottom bar; nothing else in the
 * app hand-writes section links.
 */
export interface NavTab {
  label: string;
  /** Shorter label for the five-slot mobile bar (about 72px per slot); defaults to `label`. */
  mobileLabel?: string;
  route: string;
  /** Match the route exactly (module homes). Others match by prefix. */
  exact?: boolean;
  icon?: IconName;
  mark?: MarkName;
  /** `false` keeps a tab off the five-slot mobile bar (still reachable on desktop and via the mobile overflow chips). */
  mobile?: boolean;
}

export type ModuleId = 'jym' | 'culinara' | 'journal' | 'ledger';

export interface ModuleNav {
  id: ModuleId;
  label: string;
  mark: MarkName;
  home: string;
  tabs: NavTab[];
}

export const MODULES: ModuleNav[] = [
  {
    id: 'jym',
    label: 'Jym',
    mark: 'jym',
    home: '/jym',
    tabs: [
      { label: 'Jym', route: '/jym', exact: true, mark: 'jym' },
      { label: 'Exercises', route: '/jym/exercises', mark: 'exercises' },
      { label: 'Plan', route: '/jym/plan', mark: 'plan' },
      { label: 'Track', route: '/jym/track', mark: 'track' },
    ],
  },
  {
    id: 'culinara',
    label: 'Culinara',
    mark: 'culinara',
    home: '/culinara',
    tabs: [
      { label: 'Culinara', route: '/culinara', exact: true, mark: 'culinara' },
      { label: 'Discover', route: '/culinara/discover', icon: 'magnifying-glass' },
      { label: 'Meal Planner', mobileLabel: 'Planner', route: '/culinara/meal-planner', icon: 'calendar-blank' },
      { label: 'Grocery List', mobileLabel: 'Grocery', route: '/culinara/shopping', icon: 'basket' },
    ],
  },
  {
    id: 'journal',
    label: 'Journaly',
    mark: 'journaly',
    home: '/journal',
    tabs: [
      { label: 'Journaly', route: '/journal', exact: true, mark: 'journaly' },
      { label: 'Entries', route: '/journal/entries', icon: 'list' },
      { label: 'Groups', route: '/journal/groups', icon: 'users' },
      { label: 'Collections', route: '/journal/collections', icon: 'folder' },
    ],
  },
  {
    id: 'ledger',
    label: 'Ledger',
    mark: 'ledger',
    home: '/ledger',
    tabs: [
      { label: 'Overview', route: '/ledger', exact: true, mark: 'ledger' },
      { label: 'Transactions', mobileLabel: 'Activity', route: '/ledger/transactions', icon: 'receipt' },
      { label: 'Accounts', route: '/ledger/accounts', icon: 'bank' },
      { label: 'Budgets', route: '/ledger/budgets', icon: 'wallet' },
      { label: 'Net Worth', route: '/ledger/networth', icon: 'chart-line-up', mobile: false },
      { label: 'Compare', route: '/ledger/compare', icon: 'arrows-left-right', mobile: false },
    ],
  },
];

/** Leads every module's mobile bar back to the hub. */
export const JIRO_HOME_TAB: NavTab = { label: 'Jiro', route: '/dashboard', mark: 'jiro' };

/** The hub's own mobile bar. */
export const HUB_TABS: NavTab[] = [
  { label: 'Home', route: '/dashboard', exact: true, mark: 'jiro' },
  // '/day' redirects to today's /day/<date>; matched by prefix so it stays active on any day.
  { label: 'Today', route: '/day', icon: 'calendar-blank' },
  { label: 'Guide', route: '/guide', icon: 'book-open' },
  { label: 'Settings', route: '/settings', icon: 'gear' },
];

/** Which module a URL belongs to, by path prefix; null on hub pages. */
export function moduleForUrl(url: string): ModuleNav | null {
  const path = url.split('?')[0].split('#')[0];
  return MODULES.find(m => path === m.home || path.startsWith(m.home + '/')) ?? null;
}

/** True when the path is one of the module's section tabs rather than a drill-down page. */
export function isSectionPath(module: ModuleNav, url: string): boolean {
  const path = url.split('?')[0].split('#')[0];
  return module.tabs.some(t => t.route === path);
}
