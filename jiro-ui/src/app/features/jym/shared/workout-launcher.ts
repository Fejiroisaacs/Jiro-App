import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CreateSessionRequest, JymService } from '../../../core/services/jym.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';
import { SettingsService } from '../../../core/services/settings.service';
import { formatInstant } from '../../../core/utils/format-date';
import { timeInZone } from '../../../core/utils/day';
import { isStale } from '../stale-workout';
import { clearDraft } from './session-draft';

/** The API's 409 body when another workout is still open. */
interface OpenWorkout {
  session_id: string;
  routine_name: string | null;
  started_at: string;
  set_count?: number;
  last_set_at?: string | null;
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
      await this.router.navigate(['/jym/session', s.id]);
    } catch (err) {
      const body = (err as HttpErrorResponse)?.error?.error as ({ code?: string } & Partial<OpenWorkout>) | undefined;
      if (body?.code === 'SESSION_IN_PROGRESS' && body.session_id && !req.force) {
        const name = body.routine_name ?? 'A freestyle workout';
        const when = body.started_at ? formatInstant(body.started_at, this.settings.timezone(), { weekday: true }) : 'earlier';
        if (body.started_at && isStale({ started_at: body.started_at, last_set_at: body.last_set_at ?? null })) {
          await this.closeForgotten(req, body as OpenWorkout, name, when);
          return;
        }
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

  /**
   * The open workout was forgotten (nothing logged for hours): offer to finish it at its last set,
   * or discard it when empty, and then start. "Start new" would only leave it open for longer.
   */
  private async closeForgotten(req: CreateSessionRequest, open: OpenWorkout, name: string, when: string): Promise<void> {
    const empty = !open.set_count || !open.last_set_at;
    const lastSet = open.last_set_at ? timeInZone(open.last_set_at, this.settings.timezone()) : '';
    const choice = await this.confirm.choose({
      title: 'Last workout not finished',
      message: empty
        ? `${name} from ${when} has nothing logged.`
        : `${name} from ${when} was never finished. Its last set was at ${lastSet}.`,
      confirmLabel: empty ? 'Discard it and start' : 'Finish it and start',
      altLabel: 'Resume it',
      cancelLabel: 'Cancel',
      danger: empty,
    });
    if (choice === 'alt') {
      await this.router.navigate(['/jym/session', open.session_id]);
      return;
    }
    if (choice !== 'confirm') return;
    try {
      if (empty) await firstValueFrom(this.jym.deleteSession(open.session_id));
      else await firstValueFrom(this.jym.updateSession(open.session_id, { ended_at: open.last_set_at! }));
      clearDraft(open.session_id);
    } catch {
      this.toast.error('Could not close the old workout. Try again.');
      return;
    }
    await this.open(req);
  }
}
