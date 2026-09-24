import { Component, ElementRef, Injector, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { JiroModalComponent } from '../../shared/components/jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';
import { JiroMarkComponent } from '../../shared/components/jiro-mark/jiro-mark';
import { DashboardLayout, WIDGET_BY_ID, defaultLayout, widgetLabel } from './widget-catalog';

let dialogSeq = 0;

/**
 * Show, hide and reorder dashboard widgets. Works on a draft: nothing is
 * saved until Save, and Esc, Cancel or the backdrop discard the draft.
 * The opener owns focus return (it knows which button opened this).
 */
@Component({
  selector: 'dash-customise-dashboard',
  standalone: true,
  imports: [JiroModalComponent, JiroButtonComponent, JiroIconComponent, JiroMarkComponent],
  template: `
    <jiro-modal title="Customise dashboard" maxWidth="560px" (close)="cancel.emit()">
      <p class="cd-intro">Choose which cards show and the order they appear in.</p>

      <ul class="cd-list">
        @for (row of rows(); track row.id; let i = $index, first = $first, last = $last) {
          <li class="cd-row" [class.cd-row--off]="!row.visible">
            <label class="cd-label">
              <input
                type="checkbox"
                class="cd-check"
                [attr.cdkFocusInitial]="first ? '' : null"
                [checked]="row.visible"
                [attr.aria-label]="row.checkLabel"
                (change)="toggle(i, $any($event.target).checked)" />
              <jiro-mark [name]="row.mark" [size]="28" />
              <span class="cd-text">
                <span class="cd-name">{{ row.name }}</span>
                @if (row.subtitle) {
                  <span class="cd-sub">{{ row.subtitle }}</span>
                }
              </span>
            </label>
            <div class="cd-moves">
              <button
                type="button"
                class="cd-move"
                [id]="moveId(row.id, 'up')"
                [disabled]="first"
                [attr.aria-label]="'Move ' + row.label + ' up'"
                (click)="move(i, -1)">
                <jiro-icon name="caret-up" [size]="18" />
              </button>
              <button
                type="button"
                class="cd-move"
                [id]="moveId(row.id, 'down')"
                [disabled]="last"
                [attr.aria-label]="'Move ' + row.label + ' down'"
                (click)="move(i, 1)">
                <jiro-icon name="caret-down" [size]="18" />
              </button>
            </div>
          </li>
        }
      </ul>

      <p class="sr-only" aria-live="polite">{{ announcement() }}</p>

      <div class="cd-foot">
        <jiro-button variant="secondary" (click)="reset()">Reset to default</jiro-button>
        <span class="cd-spacer"></span>
        <jiro-button variant="secondary" (click)="cancel.emit()">Cancel</jiro-button>
        <jiro-button (click)="save.emit(draft())">Save</jiro-button>
      </div>
    </jiro-modal>
  `,
  styles: [`
    .cd-intro { margin: 0 0 var(--space-md); font-size: var(--font-size-sm); color: var(--text-secondary); }

    .cd-list {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
    }
    .cd-row {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-xs) var(--space-xs) var(--space-xs) var(--space-md);
    }
    .cd-row + .cd-row { border-top: 1px solid var(--border-color); }

    .cd-label {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      flex: 1;
      min-width: 0;
      min-height: 44px;
      cursor: pointer;
    }
    .cd-check {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      margin: 0;
      accent-color: var(--color-primary);
      cursor: pointer;
    }
    .cd-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .cd-name {
      font-size: var(--font-size-xs);
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }
    .cd-sub { font-size: var(--font-size-sm); font-weight: 600; color: var(--text-primary); }
    .cd-row--off .cd-sub, .cd-row--off .cd-name { color: var(--text-muted); }
    .cd-row--off jiro-mark { opacity: 0.5; }

    .cd-moves { display: flex; gap: var(--space-xs); flex-shrink: 0; }
    .cd-move {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      padding: 0;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-primary);
      cursor: pointer;
    }
    .cd-move:hover:not(:disabled) { background: var(--bg-surface-hover); }
    .cd-move:disabled { color: var(--text-muted); opacity: 0.45; cursor: not-allowed; }

    .cd-foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: var(--space-sm);
      margin-top: var(--space-lg);
    }
    .cd-spacer { flex: 1; }

    @media (max-width: 480px) {
      .cd-row { padding-left: var(--space-sm); }
      .cd-foot { --jiro-btn-width: 100%; }
      .cd-foot jiro-button { flex: 1 1 100%; }
      .cd-spacer { display: none; }
    }
  `],
})
export class CustomiseDashboardComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly uid = `cd-${++dialogSeq}`;

  /** The layout on screen now; the draft starts as a copy of it. */
  layout = input.required<DashboardLayout>();
  save = output<DashboardLayout>();
  cancel = output<void>();

  private readonly edited = signal<DashboardLayout | null>(null);
  readonly draft = computed(() => this.edited() ?? copy(this.layout()));
  readonly announcement = signal('');

  readonly rows = computed(() =>
    this.draft().widgets.map(w => {
      const def = WIDGET_BY_ID.get(w.id)!;
      return { id: w.id, visible: w.visible, mark: def.mark, name: def.name, subtitle: def.subtitle, label: widgetLabel(def),
        // The checkbox name, spelled out so it reads the same everywhere: "Show Jym: Last workout".
        checkLabel: def.subtitle ? `Show ${def.name}: ${def.subtitle}` : `Show ${def.name}`,
      };
    }),
  );

  moveId(id: string, dir: 'up' | 'down'): string {
    return `${this.uid}-${id}-${dir}`;
  }

  toggle(index: number, visible: boolean) {
    const next = copy(this.draft());
    next.widgets[index].visible = visible;
    this.edited.set(next);
  }

  move(index: number, delta: -1 | 1) {
    const next = copy(this.draft());
    const to = index + delta;
    if (to < 0 || to >= next.widgets.length) return;
    const [item] = next.widgets.splice(index, 1);
    next.widgets.splice(to, 0, item);
    this.edited.set(next);

    const label = widgetLabel(WIDGET_BY_ID.get(item.id)!);
    this.announcement.set(`${label} moved to position ${to + 1} of ${next.widgets.length}`);

    // The row's DOM node moves, which drops focus. Put it back on the same
    // button, or on the other one when the row reached an end.
    const pressed = delta < 0 ? 'up' : 'down';
    const other = delta < 0 ? 'down' : 'up';
    afterNextRender(() => {
      const root = this.host.nativeElement;
      const same = root.querySelector<HTMLButtonElement>(`#${this.moveId(item.id, pressed)}`);
      const target = same && !same.disabled ? same : root.querySelector<HTMLButtonElement>(`#${this.moveId(item.id, other)}`);
      target?.focus();
    }, { injector: this.injector });
  }

  reset() {
    this.edited.set(defaultLayout());
    this.announcement.set('Default layout restored. Save to keep it.');
  }
}

function copy(layout: DashboardLayout): DashboardLayout {
  return { v: layout.v, widgets: layout.widgets.map(w => ({ ...w })) };
}
