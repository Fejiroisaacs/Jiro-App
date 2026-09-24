import type { MarkName } from '../../shared/components/jiro-mark/jiro-mark';
import type { WidgetSource } from '../../core/services/dashboard.service';

/**
 * The dashboard widgets that ship, in their default order. The stored layout
 * (settings.dashboard) only holds ids and visibility; everything else lives
 * here, so adding a widget is a frontend change only. The API checks ids by
 * pattern (^[a-z][a-z0-9_]{0,39}$), not against this list.
 */

export type WidgetId =
  | 'workout'
  | 'journal'
  | 'kitchen'
  | 'body_weight'
  | 'recent_recipes'
  | 'ledger_month'
  | 'activity';

export type { WidgetSource };

export type WidgetSpan = 'compact' | 'wide';

export interface WidgetDef {
  id: WidgetId;
  /** Module mark shown in the card header. */
  mark: MarkName;
  /** Card header name: the module, matching the sidebar (audit D3.1). */
  name: string;
  /** What the card shows, under the name. Empty when the name says it all. */
  subtitle: string;
  /** Used in "<unavailable> is not available right now". */
  unavailable: string;
  span: WidgetSpan;
  defaultVisible: boolean;
  sources: readonly WidgetSource[];
}

export const WIDGETS: readonly WidgetDef[] = [
  { id: 'workout', mark: 'jym', name: 'Jym', subtitle: 'Last workout', unavailable: 'Jym', span: 'compact', defaultVisible: true, sources: ['sessions'] },
  { id: 'journal', mark: 'journaly', name: 'Journaly', subtitle: 'Streak', unavailable: 'Journaly', span: 'compact', defaultVisible: true, sources: ['journalStreak', 'journalCalendar'] },
  { id: 'kitchen', mark: 'culinara', name: 'Culinara', subtitle: 'Cook streak', unavailable: 'Culinara', span: 'compact', defaultVisible: true, sources: ['cookStreak'] },
  { id: 'body_weight', mark: 'jym', name: 'Jym', subtitle: 'Body weight', unavailable: 'Body weight', span: 'compact', defaultVisible: true, sources: ['bodyWeights'] },
  { id: 'recent_recipes', mark: 'culinara', name: 'Culinara', subtitle: 'Recent recipes', unavailable: 'Recent recipes', span: 'compact', defaultVisible: true, sources: ['recentRecipes'] },
  { id: 'ledger_month', mark: 'ledger', name: 'Ledger', subtitle: 'This month', unavailable: 'Ledger', span: 'wide', defaultVisible: true, sources: ['ledgerAccounts', 'ledgerSummary', 'ledgerBudgets'] },
  { id: 'activity', mark: 'jiro', name: 'Last 14 days', subtitle: '', unavailable: 'Activity', span: 'wide', defaultVisible: true, sources: ['sessions', 'journalCalendar'] },
];

/** How a widget is referred to on its own ("Body weight", "Last 14 days"). */
export function widgetLabel(def: WidgetDef): string {
  return def.subtitle || def.name;
}

export const WIDGET_BY_ID: ReadonlyMap<WidgetId, WidgetDef> = new Map(WIDGETS.map(w => [w.id, w]));

export const LAYOUT_VERSION = 1;

export interface LayoutEntry {
  id: WidgetId;
  visible: boolean;
}

export interface DashboardLayout {
  v: typeof LAYOUT_VERSION;
  widgets: LayoutEntry[];
}

export function defaultLayout(catalog: readonly WidgetDef[] = WIDGETS): DashboardLayout {
  return { v: LAYOUT_VERSION, widgets: catalog.map(w => ({ id: w.id, visible: w.defaultVisible })) };
}

export const DEFAULT_LAYOUT: DashboardLayout = defaultLayout();

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x);
}

/**
 * Reconciles a stored layout with the catalog:
 *  - anything that is not a v1 layout of {id: string, visible: boolean} entries gives the default;
 *  - unknown ids (a widget that was removed) and repeated ids (first one wins) are dropped;
 *  - catalog widgets missing from the stored list are appended at the end with their
 *    default visibility. Hidden widgets are stored as visible:false, so a missing id
 *    means a widget added after the layout was saved.
 * Pure: same input, same output, never mutates the input.
 */
export function resolveLayout(stored: unknown, catalog: readonly WidgetDef[] = WIDGETS): DashboardLayout {
  if (!isRecord(stored) || stored['v'] !== LAYOUT_VERSION || !Array.isArray(stored['widgets'])) {
    return defaultLayout(catalog);
  }
  const entries = stored['widgets'] as unknown[];
  if (!entries.every(e => isRecord(e) && typeof e['id'] === 'string' && typeof e['visible'] === 'boolean')) {
    return defaultLayout(catalog);
  }

  const known = new Map(catalog.map(w => [w.id as string, w]));
  const seen = new Set<string>();
  const widgets: LayoutEntry[] = [];
  for (const e of entries as { id: string; visible: boolean }[]) {
    const def = known.get(e.id);
    if (!def || seen.has(e.id)) continue;
    seen.add(e.id);
    widgets.push({ id: def.id, visible: e.visible });
  }
  for (const w of catalog) {
    if (!seen.has(w.id)) widgets.push({ id: w.id, visible: w.defaultVisible });
  }
  return { v: LAYOUT_VERSION, widgets };
}

export function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  return a.widgets.length === b.widgets.length
    && a.widgets.every((w, i) => w.id === b.widgets[i].id && w.visible === b.widgets[i].visible);
}

/** True when the layout is exactly the default, so saving it can clear the stored key instead. */
export function isDefault(layout: DashboardLayout, catalog: readonly WidgetDef[] = WIDGETS): boolean {
  return sameLayout(layout, defaultLayout(catalog));
}

/** Every source the visible widgets need, deduplicated. */
export function sourcesFor(layout: DashboardLayout): Set<WidgetSource> {
  const out = new Set<WidgetSource>();
  for (const w of layout.widgets) {
    if (!w.visible) continue;
    for (const s of WIDGET_BY_ID.get(w.id)?.sources ?? []) out.add(s);
  }
  return out;
}
