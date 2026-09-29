import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { JymService } from '../../../core/services/jym.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

/** Saves a workout's exercises, sets and reps as a template; used by the player and the summary. */
@Component({
  selector: 'jym-save-template-dialog',
  standalone: true,
  imports: [FormsModule, JiroModalComponent, JiroButtonComponent],
  template: `
    <jiro-modal sheet title="Save as template" maxWidth="420px" (close)="close.emit()">
      <p class="hint">Keeps this workout's exercises, sets and reps to start from another day.</p>
      <label class="field-label" for="template-name">Name</label>
      <input
        id="template-name"
        class="name-input"
        type="text"
        maxlength="80"
        enterkeyhint="done"
        placeholder="e.g. Push Day A"
        [(ngModel)]="name"
        [attr.aria-invalid]="error() ? true : null"
        [attr.aria-describedby]="error() ? 'template-name-error' : null"
        (keydown.enter)="save()" />
      @if (error()) {
        <p class="error" id="template-name-error" role="alert">{{ error() }}</p>
      }
      <div class="actions">
        <jiro-button variant="secondary" size="lg" type="button" (click)="close.emit()">Cancel</jiro-button>
        <jiro-button size="lg" type="button" [disabled]="!name.trim()" [loading]="saving()" (click)="save()">Save template</jiro-button>
      </div>
    </jiro-modal>
  `,
  styles: [`
    .hint { font-size: var(--font-size-sm); color: var(--text-secondary); line-height: 1.5; margin-bottom: var(--space-md); }
    .field-label { display: block; font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); margin-bottom: var(--space-xs); }
    .name-input {
      width: 100%; box-sizing: border-box; min-height: 44px; padding: 10px 12px;
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-surface); color: var(--text-primary);
      font-size: var(--font-size-base); font-family: inherit;
    }
    .name-input:focus { border-color: var(--color-primary); }
    .name-input::placeholder { color: var(--text-muted); }
    .error { font-size: var(--font-size-sm); color: var(--color-negative); margin-top: var(--space-xs); }
    .actions { display: flex; justify-content: flex-end; gap: var(--space-sm); margin-top: var(--space-lg); }
    @media (max-width: 600px) { .actions { --jiro-btn-width: 100%; } .actions > * { flex: 1; } }
  `],
})
export class SaveTemplateDialogComponent implements OnInit {
  readonly sessionId = input.required<string>();
  readonly initialName = input('');
  readonly close = output<void>();

  private readonly jym = inject(JymService);
  private readonly toast = inject(ToastService);

  name = '';
  readonly saving = signal(false);
  readonly error = signal('');

  ngOnInit() {
    this.name = this.initialName();
  }

  save() {
    const name = this.name.trim();
    if (!name || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.jym.createTemplateFromSession(this.sessionId(), name).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(`Template "${name}" saved`);
        this.close.emit();
      },
      error: () => {
        this.saving.set(false);
        this.error.set('Could not save the template. Log at least one set first.');
      },
    });
  }
}
