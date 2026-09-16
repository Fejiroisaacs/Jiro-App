import { Component, computed, input } from '@angular/core';
import { JournalEntry, MOODS } from '../../../core/services/journal.service';
import { JiroEmptyStateComponent } from '../../../shared/components/jiro-empty-state/jiro-empty-state';

interface MoodCount {
  value: string;
  label: string;
  color: string;
  count: number;
  /** Share of the widest bar, so the longest row always fills the track. */
  pct: number;
}

/**
 * How the last 30 days have mostly felt: one row per mood that appears, with
 * its share drawn as a bar.
 *
 * Deliberately plain CSS rather than Chart.js. The whole chart is eight rows of
 * a single number, the journal bundle carries no charting library today, and
 * CSS bars follow the theme without needing a redraw.
 */
@Component({
  selector: 'journal-mood-trend',
  standalone: true,
  imports: [JiroEmptyStateComponent],
  template: `
    @if (counts().length === 0 || total() < 3) {
      <div class="moodtrend moodtrend--empty">
        <jiro-empty-state
          compact
          icon="notebook"
          heading="Not enough to chart yet"
          [message]="emptyMessage()" />
      </div>
    } @else {
      <div class="moodtrend">
        <div class="moodtrend-head">
          <h2 class="moodtrend-title">How the last 30 days felt</h2>
          <span class="moodtrend-total">{{ total() }} {{ total() === 1 ? 'entry' : 'entries' }}</span>
        </div>

        <ul class="moodtrend-rows">
          @for (m of counts(); track m.value) {
            <li class="moodtrend-row" [attr.aria-label]="m.label + ', ' + m.count + (m.count === 1 ? ' entry' : ' entries')">
              <span class="moodtrend-label">{{ m.label }}</span>
              <span class="moodtrend-track" aria-hidden="true">
                <span class="moodtrend-bar" [style.width.%]="m.pct" [style.background]="m.color"></span>
              </span>
              <span class="moodtrend-count" aria-hidden="true">{{ m.count }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }

    .moodtrend {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-lg);
      margin-bottom: var(--space-xl);
    }
    .moodtrend--empty { padding: var(--space-sm); }

    .moodtrend-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .moodtrend-title {
      font-family: var(--font-family-display);
      font-size: var(--font-size-md);
      font-weight: 600;
      color: var(--text-primary);
    }

    .moodtrend-total {
      font-size: var(--font-size-xs);
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .moodtrend-rows { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }

    .moodtrend-row {
      display: grid;
      grid-template-columns: 5.5rem 1fr 2rem;
      align-items: center;
      gap: var(--space-sm);
    }

    .moodtrend-label {
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .moodtrend-track {
      display: block;
      height: 14px;
      border-radius: var(--border-radius-sm);
      background: var(--bg-canvas);
      overflow: hidden;
    }

    .moodtrend-bar {
      display: block;
      height: 100%;
      border-radius: var(--border-radius-sm);
      min-width: 3px;
    }

    .moodtrend-count {
      font-size: var(--font-size-sm);
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    @media (max-width: 600px) {
      .moodtrend-row { grid-template-columns: 4.5rem 1fr 1.75rem; }
      .moodtrend-label { font-size: var(--font-size-xs); }
    }
  `]
})
export class MoodTrendComponent {
  /** Entries from the last 30 days; anything without a mood is ignored. */
  entries = input.required<JournalEntry[]>();

  readonly counts = computed<MoodCount[]>(() => {
    const tally = new Map<string, number>();
    for (const e of this.entries()) {
      if (!e.mood) continue;
      tally.set(e.mood, (tally.get(e.mood) ?? 0) + 1);
    }
    const rows = MOODS
      .filter(m => tally.has(m.value))
      .map(m => ({ value: m.value, label: m.label, color: m.color, count: tally.get(m.value)!, pct: 0 }))
      .sort((a, b) => b.count - a.count);

    const top = rows[0]?.count ?? 0;
    return top === 0 ? rows : rows.map(r => ({ ...r, pct: Math.round((r.count / top) * 100) }));
  });

  /** Entries in the window that actually carry a mood. */
  readonly total = computed(() => this.counts().reduce((sum, m) => sum + m.count, 0));

  readonly emptyMessage = computed(() => {
    const n = this.total();
    if (n === 0) return 'Add a mood to an entry and this chart starts filling in.';
    return `Just ${n} ${n === 1 ? 'entry has' : 'entries have'} a mood so far. A few more and the pattern shows.`;
  });
}
