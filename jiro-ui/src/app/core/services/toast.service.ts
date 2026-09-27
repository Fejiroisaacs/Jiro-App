import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  kind: ToastKind;
}

export interface ToastOptions {
  kind?: ToastKind;
  /** Milliseconds before auto-dismiss. 0 keeps the toast until clicked. */
  duration?: number;
}

/**
 * One queue for transient confirmations ("Settings saved", "Failed to send").
 * Rendered once per layout by <jiro-toaster>. Inline "Copied!" style feedback
 * that belongs next to a control should stay inline; this is for outcomes.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly _toasts = signal<Toast[]>([]);
  readonly toasts = this._toasts.asReadonly();
  private seq = 0;
  private lastNoticeAt = 0;
  private quietUntil = 0;

  show(message: string, options: ToastOptions = {}): number {
    const id = ++this.seq;
    const kind = options.kind ?? 'success';
    this._toasts.update(list => [...list, { id, message, kind }]);
    const duration = options.duration ?? 3000;
    if (duration > 0) setTimeout(() => this.dismiss(id), duration);
    return id;
  }

  success(message: string, duration?: number) {
    return this.show(message, { kind: 'success', duration });
  }

  error(message: string, duration = 4500) {
    // Right after a read-only notice, a "could not save" toast would only repeat it.
    if (Date.now() < this.quietUntil) return -1;
    return this.show(message, { kind: 'error', duration });
  }

  /** Why a demo write was refused, once per burst: repeats and error toasts within `burstMs` are dropped. */
  readOnlyNotice(message: string, burstMs = 2000) {
    const now = Date.now();
    const inBurst = now - this.lastNoticeAt < burstMs;
    this.lastNoticeAt = now;
    this.quietUntil = now + burstMs;
    if (!inBurst) this.show(message, { kind: 'info', duration: 5000 });
  }

  info(message: string, duration?: number) {
    return this.show(message, { kind: 'info', duration });
  }

  dismiss(id: number) {
    this._toasts.update(list => list.filter(t => t.id !== id));
  }
}
