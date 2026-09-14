import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FeedbackService } from '../../../core/services/feedback.service';
import { ToastService } from '../../../core/services/toast.service';
import { JiroButtonComponent } from '../jiro-button/jiro-button';

type FeedbackType = 'bug' | 'feature' | 'other';

/** The feedback form, used inside a modal from the user menu. */
@Component({
  selector: 'jiro-feedback-form',
  standalone: true,
  imports: [FormsModule, JiroButtonComponent],
  template: `
    <form class="ff" (ngSubmit)="submit()">
      <div class="ff-types" role="group" aria-label="Feedback type">
        @for (t of types; track t.value) {
          <button
            type="button"
            class="ff-type"
            [class.ff-type--active]="type() === t.value"
            [attr.aria-pressed]="type() === t.value"
            (click)="type.set(t.value)">
            {{ t.label }}
          </button>
        }
      </div>
      <label class="ff-label" [attr.for]="textareaId">What happened, or what would help?</label>
      <textarea
        class="ff-textarea"
        [id]="textareaId"
        name="message"
        [(ngModel)]="message"
        rows="5"
        placeholder="The more specific, the better."></textarea>
      <div class="ff-actions">
        <jiro-button type="submit" [loading]="sending()" [disabled]="!message.trim()">Send</jiro-button>
      </div>
    </form>
  `,
  styles: [`
    .ff { display: flex; flex-direction: column; gap: var(--space-sm); }
    .ff-types { display: flex; gap: 6px; }
    .ff-type {
      flex: 1;
      padding: 8px 4px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-secondary);
      font-size: var(--font-size-xs);
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition: border-color 0.15s, color 0.15s, background 0.15s;
    }
    .ff-type:hover { border-color: var(--color-primary); color: var(--color-primary); }
    .ff-type--active {
      background: rgba(var(--color-primary-rgb), 0.12);
      border-color: var(--color-primary);
      color: var(--color-primary);
    }
    .ff-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); margin-top: var(--space-xs); }
    .ff-textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      line-height: var(--line-height-body);
      resize: vertical;
    }
    .ff-textarea:focus { border-color: var(--color-primary); }
    .ff-actions { display: flex; justify-content: flex-end; margin-top: var(--space-xs); }
  `]
})
export class JiroFeedbackFormComponent {
  private static seq = 0;
  readonly textareaId = `jiro-feedback-${++JiroFeedbackFormComponent.seq}`;

  private readonly feedbackService = inject(FeedbackService);
  private readonly toast = inject(ToastService);

  readonly types: { value: FeedbackType; label: string }[] = [
    { value: 'bug', label: 'Bug' },
    { value: 'feature', label: 'Idea' },
    { value: 'other', label: 'Other' },
  ];

  type = signal<FeedbackType>('bug');
  message = '';
  sending = signal(false);
  sent = output<void>();

  submit() {
    const message = this.message.trim();
    if (!message || this.sending()) return;
    this.sending.set(true);
    this.feedbackService.submit({ type: this.type(), message }).subscribe({
      next: () => {
        this.sending.set(false);
        this.message = '';
        this.toast.success('Thanks, your feedback was sent.');
        this.sent.emit();
      },
      error: () => {
        this.sending.set(false);
        this.toast.error('Could not send feedback. Please try again.');
      },
    });
  }
}
