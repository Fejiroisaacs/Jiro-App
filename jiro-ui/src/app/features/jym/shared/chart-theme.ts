/**
 * Chart.js cannot read CSS custom properties, so charts ask for the current
 * theme's colours here and get plain strings back. Call this inside the draw
 * routine (not once at construction) so a redraw after a theme or dark-mode
 * change picks up the new palette.
 */
export interface ChartTones {
  /** Main series. */
  primary: string;
  /** Second series. */
  warning: string;
  /** Third series. */
  accent: string;
  /** Fourth series. */
  secondary: string;
  /** A muted series used for comparisons. */
  muted: string;
  /** Tick labels. */
  tick: string;
  /** Grid lines. */
  grid: string;
  /** Tint under a filled line, as rgba. */
  primaryFill: string;
}

function read(css: CSSStyleDeclaration, name: string, fallback: string): string {
  return css.getPropertyValue(name).trim() || fallback;
}

export function chartTones(): ChartTones {
  const css = getComputedStyle(document.documentElement);
  const primaryRgb = read(css, '--color-primary-rgb', '110, 49, 40');
  return {
    primary: read(css, '--color-primary', '#6E3128'),
    warning: read(css, '--color-warning', '#956B3D'),
    accent: read(css, '--color-accent', '#4A6741'),
    secondary: read(css, '--color-secondary', '#D4C5A9'),
    muted: read(css, '--text-muted', '#756861'),
    tick: read(css, '--text-secondary', '#6B5E57'),
    grid: `rgba(${read(css, '--shadow-rgb', '92, 64, 51')}, 0.12)`,
    primaryFill: `rgba(${primaryRgb}, 0.1)`,
  };
}
