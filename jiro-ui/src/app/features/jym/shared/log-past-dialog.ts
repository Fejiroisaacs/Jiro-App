import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin, of, switchMap } from 'rxjs';
import { JymService, Routine } from '../../../core/services/jym.service';
import { SettingsService } from '../../../core/services/settings.service';
import { addDays, fromZonedInput, todayKey } from '../../../core/utils/day';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

/** Logs a workout after the fact: created finished at the chosen times, then opened for its sets. */
@Component({
  selector: 'jym-log-past-dialog',
  standalone: true,
  imports: [FormsModule, JiroModalComponent, JiroButtonComponent],
  template: `
    <jiro-modal sheet title="Log a past workout" maxWidth="440px" (close)="close.emit()">
      <p class="hint">For a workout you didn't record at the time. You add its sets next.</p>
      <div class="field">
        <label class="field-label" for="past-start">Started</label>
        <input id="past-start" class="field-input" type="datetime-local" [(ngModel)]="startText" />
      </div>
      <div class="field">
        <label class="field-label" for="past-end">Finished</label>
        <input id="past-end" class="field-input" type="datetime-local" [(ngModel)]="endText" />
      </div>
      <div class="field">
        <label class="field-label" for="past-plan">Workout</label>
        <select id="past-plan" class="field-input" [(ngModel)]="routineId" [attr.aria-busy]="plansLoading() || null">
          <option value="">Freestyle</option>
          @for (g of plans(); track g.label) {
            <optgroup [label]="g.label">
              @for (r of g.routines; track r.id) {
                <option [value]="r.id">{{ r.name }}</option>
              }
            </optgroup>
          }
        </select>
        <p class="help">A day of a split or a template fills in its exercises and targets.</p>
      </div>
      @if (error()) {
        <p class="error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <jiro-button variant="secondary" size="lg" type="button" (click)="close.emit()">Cancel</jiro-button>
        <jiro-button size="lg" type="button" [loading]="saving()" (click)="create()">Add sets</jiro-button>
      </div>
    </jiro-modal>
  `,
  styles: [`
    .hint { font-size: var(--font-size-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-md); }
    .field { margin-bottom: var(--space-md); }
    .field-label { display: block; font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); margin-bottom: var(--space-xs); }
    .field-input {
      width: 100%; box-sizing: border-box; min-height: 48px; padding: 10px 12px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-md); font-family: inherit;
    }
    .field-input:focus { border-color: var(--color-primary); }
    .help { font-size: var(--font-size-xs); color: var(--text-secondary); margin-top: var(--space-xs); }
    .error { font-size: var(--font-size-sm); color: var(--color-negative); margin-bottom: var(--space-sm); }
    .actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-md); }
    @media (max-width: 600px) { .actions > * { flex: 1; --jiro-btn-width: 100%; } }
  `],
})
export class LogPastDialogComponent implements OnInit {
  /** The day to start on (YYYY-MM-DD); yesterday when not given. */
  readonly day = input<string | null>(null);
  readonly close = output<void>();

  private readonly jym = inject(JymService);
  private readonly settings = inject(SettingsService);
  private readonly router = inject(Router);

  startText = '';
  endText = '';
  routineId = '';
  readonly plans = signal<{ label: string; routines: Routine[] }[]>([]);
  readonly plansLoading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');

  ngOnInit() {
    const day = this.day() ?? addDays(todayKey(this.settings.timezone()), -1);
    this.startText = `${day}T18:00`;
    this.endText = `${day}T19:00`;
    // Each split's days, then the templates; a failure just leaves Freestyle.
    forkJoin([this.jym.listSplits(), this.jym.listTemplates()]).pipe(
      switchMap(([splits, templates]) => forkJoin([
        splits.length ? forkJoin(splits.map(s => this.jym.getSplit(s.id))) : of([]),
        of(templates),
      ])),
    ).subscribe({
      next: ([splits, templates]) => {
        const groups = splits
          .filter(s => s.routines.length)
          .map(s => ({ label: s.name, routines: [...s.routines].sort((a, b) => a.day_order - b.day_order) }));
        if (templates.length) groups.push({ label: 'Templates', routines: templates });
        this.plans.set(groups);
        this.plansLoading.set(false);
      },
      error: () => this.plansLoading.set(false),
    });
  }

  create() {
    if (this.saving()) return;
    const tz = this.settings.timezone();
    const start = fromZonedInput(this.startText, tz);
    const end = fromZonedInput(this.endText, tz);
    if (!start || !end) {
      this.error.set('Enter when it started and finished.');
      return;
    }
    if (Date.parse(end) <= Date.parse(start)) {
      this.error.set('The end must be after the start.');
      return;
    }
    this.error.set('');
    this.saving.set(true);
    this.jym.startSession({ routine_id: this.routineId || undefined, started_at: start, ended_at: end }).subscribe({
      next: s => {
        this.saving.set(false);
        this.close.emit();
        this.router.navigate(['/jym/sessions', s.id, 'edit'], { state: { back: this.router.url } });
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.status === 400 && err?.error?.error?.message
          ? err.error.error.message
          : 'Could not log the workout. Try again.');
      },
    });
  }
}
