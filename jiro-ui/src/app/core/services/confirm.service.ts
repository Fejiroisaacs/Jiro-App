import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  /** Defaults to "Delete". */
  confirmLabel?: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  /** Danger styling on the confirm button. Defaults to true. */
  danger?: boolean;
}

/** choose(): a second way forward, shown between Cancel and the confirm button. */
export interface ChooseOptions extends ConfirmOptions {
  altLabel: string;
}

export type ConfirmChoice = 'confirm' | 'alt' | 'cancel';

export interface PendingConfirm {
  options: Required<ConfirmOptions> & { altLabel: string | null };
  resolve: (choice: ConfirmChoice) => void;
}

/**
 * In-app replacement for window.confirm(). Resolves true when the user
 * confirms, false on cancel, backdrop click or Escape.
 *
 *   if (!(await this.confirmService.confirm({ title: 'Delete recipe?', message: '...' }))) return;
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly _pending = signal<PendingConfirm | null>(null);
  readonly pending = this._pending.asReadonly();

  confirm(options: ConfirmOptions): Promise<boolean> {
    return this.open({ ...options, altLabel: null }).then(choice => choice === 'confirm');
  }

  /** Three ways out: 'confirm', 'alt' for the middle button, or 'cancel' (also backdrop and Escape). */
  choose(options: ChooseOptions): Promise<ConfirmChoice> {
    return this.open(options);
  }

  resolve(choice: ConfirmChoice) {
    const pending = this._pending();
    if (!pending) return;
    this._pending.set(null);
    pending.resolve(choice);
  }

  private open(options: ConfirmOptions & { altLabel: string | null }): Promise<ConfirmChoice> {
    // Only one dialog at a time; a second request cancels the first.
    this._pending()?.resolve('cancel');
    return new Promise<ConfirmChoice>(resolve => {
      this._pending.set({
        options: {
          confirmLabel: 'Delete',
          cancelLabel: 'Cancel',
          danger: true,
          ...options,
        },
        resolve,
      });
    });
  }
}
