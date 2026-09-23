import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { ToastService } from '../../core/services/toast.service';
import { DashboardLayout, isDefault, resolveLayout } from './widget-catalog';

/**
 * The user's dashboard layout, read from settings.dashboard and reconciled
 * with the widget catalog. Saves are optimistic: the new layout shows at once
 * and is rolled back if the request fails.
 */
@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly toast = inject(ToastService);

  /** The layout being saved, shown until the server confirms it. */
  private readonly pending = signal<DashboardLayout | null>(null);
  private readonly stored = computed(() => resolveLayout(this.settings.dashboard()));

  readonly layout = computed(() => this.pending() ?? this.stored());

  save(draft: DashboardLayout): void {
    const previous = this.pending();
    const snapshot = { v: draft.v, widgets: draft.widgets.map(w => ({ ...w })) };
    this.pending.set(snapshot);

    // The default layout is stored as "no key", so a later change to the
    // default order reaches users who never customised.
    const body = isDefault(snapshot) ? { dashboard: null } : { dashboard: snapshot };

    let saved = false;
    this.auth.updateSettings(body).subscribe({
      next: () => {
        saved = true;
        // Only clear if a newer save has not replaced this one meanwhile.
        if (this.pending() === snapshot) this.pending.set(null);
        this.toast.success('Dashboard saved');
      },
      error: (err: unknown) => {
        if (this.pending() === snapshot) this.pending.set(previous);
        this.toast.error(saveErrorMessage(err), 6000);
      },
      complete: () => {
        // The auth interceptor completes without a value when the session has
        // expired and it logs the user out; do not leave the draft showing.
        if (!saved && this.pending() === snapshot) this.pending.set(previous);
      },
    });
  }
}

function saveErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse && err.status === 403) {
    if (err.error?.error?.code === 'EMAIL_NOT_VERIFIED') {
      return 'Verify your email first to save your dashboard. Check your inbox, or resend the email from Settings.';
    }
  }
  return 'Your dashboard could not be saved. Try again.';
}
