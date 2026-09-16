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

export interface PendingConfirm {
  options: Required<ConfirmOptions>;
  resolve: (confirmed: boolean) => void;
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
    // Only one dialog at a time; a second request cancels the first.
    this._pending()?.resolve(false);
    return new Promise<boolean>(resolve => {
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

  resolve(confirmed: boolean) {
    const pending = this._pending();
    if (!pending) return;
    this._pending.set(null);
    pending.resolve(confirmed);
  }
}
