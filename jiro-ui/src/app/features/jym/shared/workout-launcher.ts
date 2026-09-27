import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CreateSessionRequest, JymService } from '../../../core/services/jym.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { SettingsService } from '../../../core/services/settings.service';
import { formatInstant } from '../../../core/utils/format-date';

/** The API's 409 body when another workout is still open. */
interface OpenWorkout {
  session_id: string;
  routine_name: string | null;
  started_at: string;
}

/**
 * Every "start a workout" button goes through here: one request at a time, a
 * Resume / Start new choice while another workout is open, and a message when
 * the start fails.
 */
@Injectable({ providedIn: 'root' })
export class WorkoutLauncher {
  private readonly jym = inject(JymService);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly settings = inject(SettingsService);

  readonly starting = signal(false);

  async start(req: CreateSessionRequest): Promise<void> {
    if (this.starting()) return;
    this.starting.set(true);
    try {
      await this.open(req);
    } finally {
      this.starting.set(false);
    }
  }

  private async open(req: CreateSessionRequest): Promise<void> {
    try {
      const s = await firstValueFrom(this.jym.startSession(req));
      await this.router.navigate(['/jym/session', s.id], { state: { targets: s.targets } });
    } catch (err) {
      const body = (err as HttpErrorResponse)?.error?.error as ({ code?: string } & Partial<OpenWorkout>) | undefined;
      if (body?.code === 'SESSION_IN_PROGRESS' && body.session_id && !req.force) {
        const name = body.routine_name ?? 'A freestyle workout';
        const when = body.started_at ? formatInstant(body.started_at, this.settings.timezone(), { weekday: true }) : 'earlier';
        const choice = await this.confirm.choose({
          title: 'Workout in progress',
          message: `${name} from ${when} isn't finished yet.`,
          confirmLabel: 'Resume it',
          altLabel: 'Start new',
          cancelLabel: 'Cancel',
          danger: false,
        });
        if (choice === 'confirm') await this.router.navigate(['/jym/session', body.session_id]);
        else if (choice === 'alt') await this.open({ ...req, force: true });
        return;
      }
      // The interceptor already explains demo and unverified refusals; ToastService drops this one after them.
      this.toast.error('Could not start the workout. Try again.');
    }
  }
}
