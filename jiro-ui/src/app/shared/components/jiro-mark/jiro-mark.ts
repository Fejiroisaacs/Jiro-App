import { Component, ElementRef, afterRenderEffect, input, viewChild } from '@angular/core';

export type MarkName =
  | 'jiro'
  | 'jym'
  | 'culinara'
  | 'journaly'
  | 'ledger'
  | 'echo'
  | 'exercises'
  | 'plan'
  | 'track';

/**
 * The module marks (brand tiles). Drawn inline so they follow the theme:
 * the mark uses `--mark-fg`, the accent parts `--color-accent`, cut-outs
 * `--mark-cut`, and the tile `--mark-bg`. All four are theme tokens, so
 * the tiles no longer look pasted on in dark mode.
 *
 *   <jiro-mark name="jym" [size]="28" />
 *   <jiro-mark name="ledger" [size]="48" />
 */
const ACCENT = 'style="fill:var(--color-accent)"';
const CUT = 'style="fill:var(--mark-cut)"';
const CUT_STROKE = 'style="stroke:var(--mark-cut)"';

const MARKS: Record<MarkName, string> = {
  jiro:
    '<g transform="translate(7,0)"><path d="M60 25v35c0 11-9 20-20 20s-20-9-20-20v-5h12v5c0 4.4 3.6 8 8 8s8-3.6 8-8V25h12z"/>' +
    `<path d="M35 20c0 10 12 15 12 15s0-10-12-15z" ${ACCENT}/></g>`,
  jym:
    `<g transform="translate(0,-2)"><rect x="30" y="47" width="40" height="10" rx="3" ${ACCENT}/>` +
    '<path d="M12 35h16a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V39a4 4 0 0 1 4-4z"/>' +
    '<path d="M72 35h16a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H72a4 4 0 0 1-4-4V39a4 4 0 0 1 4-4z"/></g>',
  culinara:
    '<g transform="translate(0,-2)"><rect x="42" y="20" width="16" height="25" rx="4"/>' +
    `<circle cx="50" cy="27" r="3" ${CUT}/>` +
    '<rect x="25" y="35" width="50" height="50" rx="8"/>' +
    `<path d="M44 50 c0 12 12 18 12 18 s0 -12 -12 -18 z" ${ACCENT}/></g>`,
  journaly:
    '<g transform="translate(0,-2)"><rect x="30" y="25" width="40" height="50" rx="4"/>' +
    `<line x1="38" y1="25" x2="38" y2="75" stroke-width="2" ${CUT_STROKE}/>` +
    `<path d="M55 25 v 25 l 6 -5 l 6 5 v -25 z" ${ACCENT}/>` +
    `<line x1="45" y1="50" x2="60" y2="50" stroke-width="2" stroke-linecap="round" ${CUT_STROKE}/>` +
    `<line x1="45" y1="60" x2="55" y2="60" stroke-width="2" stroke-linecap="round" ${CUT_STROKE}/></g>`,
  ledger:
    `<g transform="translate(0,2)"><rect x="30" y="25" width="40" height="35" rx="3" ${ACCENT}/>` +
    `<circle cx="50" cy="40" r="7" opacity="0.4" ${CUT}/>` +
    '<rect x="20" y="45" width="60" height="30" rx="4"/>' +
    `<rect x="28" y="53" width="12" height="8" rx="2" opacity="0.8" ${CUT}/>` +
    `<line x1="20" y1="45" x2="80" y2="45" stroke-width="3" opacity="0.5" ${CUT_STROKE}/></g>`,
  echo:
    '<g transform="translate(0,2)"><path d="M50 22 c-12 0 -20 10 -20 22 c0 12 -6 16 -6 16 h52 s-6 -4 -6 -16 c0 -12 -8 -22 -20 -22 z"/>' +
    '<path d="M50 16 c-3 0 -5 2 -5 5 h10 c0 -3 -2 -5 -5 -5 z"/><circle cx="50" cy="66" r="5"/>' +
    '<g fill="none" stroke-width="5" stroke-linecap="round">' +
    '<path d="M76 35 a 20 20 0 0 1 0 30" opacity="0.8" style="stroke:var(--color-accent)"/>' +
    '<path d="M82 25 a 35 35 0 0 1 0 50" stroke="currentColor"/></g></g>',
  exercises:
    '<g transform="translate(0,-2)"><circle cx="50" cy="24" r="7"/><rect x="22" y="34" width="56" height="6" rx="3"/>' +
    `<rect x="16" y="24" width="8" height="26" rx="3" ${ACCENT}/><rect x="76" y="24" width="8" height="26" rx="3" ${ACCENT}/>` +
    '<path d="M50 34 v22" stroke="currentColor" stroke-width="12" stroke-linecap="round"/>' +
    '<path d="M50 52 L34 68 L38 84" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M50 52 L66 68 L62 84" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/></g>',
  plan:
    '<g transform="translate(0,-2)"><rect x="28" y="30" width="44" height="50" rx="4" fill="none" stroke="currentColor" stroke-width="5"/>' +
    `<rect x="40" y="20" width="20" height="12" rx="2" ${ACCENT}/>` +
    '<line x1="38" y1="45" x2="62" y2="45" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
    '<line x1="38" y1="58" x2="62" y2="58" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
    '<line x1="38" y1="71" x2="52" y2="71" stroke="currentColor" stroke-width="4" stroke-linecap="round"/></g>',
  track:
    '<g transform="translate(0,-2)"><rect x="25" y="55" width="12" height="25" rx="3"/><rect x="44" y="40" width="12" height="40" rx="3"/>' +
    `<rect x="63" y="25" width="12" height="55" rx="3" ${ACCENT}/></g>`,
};

@Component({
  selector: 'jiro-mark',
  standalone: true,
  template: `
    <svg
      #svgEl
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      fill="currentColor"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.aria-hidden]="label() ? null : 'true'"
      [attr.role]="label() ? 'img' : null"
      [attr.aria-label]="label() || null"></svg>
  `,
  styles: [`
    :host {
      display: inline-flex;
      flex-shrink: 0;
      line-height: 0;
      color: var(--mark-fg);
      background: var(--mark-bg);
      border-radius: 24%;
      overflow: hidden;
    }
    :host(.plain) { background: none; border-radius: 0; }
    svg { display: block; }
  `],
  host: { '[class.plain]': '!tile()' },
})
export class JiroMarkComponent {
  name = input.required<MarkName>();
  size = input<number | string>(28);
  label = input<string>('');
  /** Draw the tile background. Off for the landing-page hero where the mark sits on its own. */
  tile = input(true);

  private readonly svgEl = viewChild.required<ElementRef<SVGSVGElement>>('svgEl');

  constructor() {
    afterRenderEffect(() => {
      this.svgEl().nativeElement.innerHTML = MARKS[this.name()];
    });
  }
}
