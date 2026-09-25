import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CreateSeriesRequest, JymService } from '../../../../core/services/jym.service';
import { JiroButtonComponent } from '../../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../../shared/components/jiro-modal/jiro-modal';

type Duration = 'open' | 'weeks' | 'sessions';

let seq = 0;

/** "Start series" dialog shared by Plan's split cards and the split page; creates and opens the series. */
@Component({
  selector: 'jym-new-series-modal',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent, JiroModalComponent],
  template: `
    <jiro-modal title="Start Series" maxWidth="440px" (close)="closed.emit()">
      <form class="series-form" (ngSubmit)="create()">
        <div class="form-group">
          <label class="form-label" [for]="uid + '-name'">Series name</label>
          <input [id]="uid + '-name'" class="form-input" type="text" [(ngModel)]="name" name="seriesName"
            placeholder="e.g. Cut Phase 1" required />
        </div>

        <fieldset class="form-group dur-fieldset">
          <legend class="form-label">Length</legend>
          <div class="dur-options">
            @for (opt of options; track opt.value) {
              <label class="dur-btn" [class.active]="duration === opt.value">
                <input type="radio" class="sr-only" [name]="uid + '-duration'" [value]="opt.value" [(ngModel)]="duration" />
                {{ opt.label }}
              </label>
            }
          </div>
        </fieldset>

        @if (duration === 'weeks') {
          <div class="form-group">
            <label class="form-label" [for]="uid + '-weeks'">Number of weeks</label>
            <input [id]="uid + '-weeks'" class="form-input" type="number" [(ngModel)]="targetWeeks" name="targetWeeks" min="1" max="52" />
          </div>
        }
        @if (duration === 'sessions') {
          <div class="form-group">
            <label class="form-label" [for]="uid + '-sessions'">Number of sessions</label>
            <input [id]="uid + '-sessions'" class="form-input" type="number" [(ngModel)]="targetSessions" name="targetSessions" min="1" max="200" />
          </div>
        }

        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }

        <div class="form-actions">
          <jiro-button variant="secondary" type="button" (click)="closed.emit()">Cancel</jiro-button>
          <jiro-button variant="primary" type="submit" [disabled]="saving() || !name.trim()">
            {{ saving() ? 'Starting...' : 'Start Series' }}
          </jiro-button>
        </div>
      </form>
    </jiro-modal>
  `,
  styles: [`
    .series-form { display: flex; flex-direction: column; gap: var(--space-md); }
    .form-group { display: flex; flex-direction: column; gap: var(--space-xs); margin: 0; }
    .dur-fieldset { border: none; padding: 0; min-width: 0; }
    .form-label {
      font-size: var(--font-size-lg); font-weight: 600; color: var(--text-primary);
      font-family: 'Newsreader', serif; padding: 0;
    }
    .dur-fieldset .form-label { margin-bottom: var(--space-xs); }
    .form-input {
      padding: 10px 0; border: none; border-bottom: 2px dashed var(--border-color);
      border-radius: 0; background: transparent; color: var(--text-primary);
      font-size: var(--font-size-md); font-family: inherit; width: 100%; box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .form-input:focus { border-bottom-color: var(--color-primary); }
    .dur-options { display: flex; gap: var(--space-xs); }
    .dur-btn {
      flex: 1; padding: 8px 12px; min-height: 40px; box-sizing: border-box;
      display: flex; align-items: center; justify-content: center; text-align: center;
      border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-secondary);
      font-size: var(--font-size-sm); cursor: pointer; transition: all 0.15s;
    }
    .dur-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .dur-btn:focus-within { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .dur-btn.active {
      background: rgba(var(--color-primary-rgb), 0.1); border-color: var(--color-primary);
      color: var(--color-primary); font-weight: 600;
    }
    .form-error { margin: 0; font-size: var(--font-size-sm); color: var(--color-danger); }
    .form-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-xs); }
  `],
})
export class JymNewSeriesModalComponent implements OnInit {
  private readonly jymService = inject(JymService);
  private readonly router = inject(Router);

  splitId = input.required<string>();
  defaultName = input('');
  closed = output<void>();

  readonly uid = `new-series-${++seq}`;
  readonly options: { value: Duration; label: string }[] = [
    { value: 'open', label: 'Open-ended' },
    { value: 'weeks', label: 'Weeks' },
    { value: 'sessions', label: 'Sessions' },
  ];

  name = '';
  duration: Duration = 'open';
  targetWeeks = 8;
  targetSessions = 20;
  saving = signal(false);
  error = signal('');

  ngOnInit() {
    this.name = this.defaultName();
  }

  create() {
    const name = this.name.trim();
    if (!name) return;
    this.saving.set(true);
    this.error.set('');
    const req: CreateSeriesRequest = {
      split_id: this.splitId(),
      name,
      duration_type: this.duration,
      ...(this.duration === 'weeks' ? { target_weeks: this.targetWeeks } : {}),
      ...(this.duration === 'sessions' ? { target_sessions: this.targetSessions } : {}),
    };
    this.jymService.createSeries(req).subscribe({
      next: sr => {
        this.saving.set(false);
        this.closed.emit();
        this.router.navigate(['/jym/series', sr.id]);
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not start the series. Try again.');
      },
    });
  }
}
