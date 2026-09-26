import { Component, OnInit, inject, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JournalService, JoinPreview } from '../../../core/services/journal.service';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroLogoComponent } from '../../../shared/components/jiro-logo/jiro-logo';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';

type State =
  | 'loading'      // waiting for auth, then the preview
  | 'no-token'
  | 'not-logged-in'
  | 'ready'        // preview shown, Join offered
  | 'already'      // already in the group
  | 'demo'         // the look-only demo: can see, cannot join
  | 'joining'
  | 'success'
  | 'unverified'   // the account must verify its email before joining
  | 'error';

@Component({
  selector: 'app-journal-join',
  standalone: true,
  imports: [RouterLink, JiroButtonComponent, JiroIconComponent, JiroLogoComponent, JiroSkeletonComponent],
  template: `
    <main class="join-page">
      <div class="join-card">

        <jiro-logo class="join-logo" [size]="32" />
        <h1 class="join-title">Journaly</h1>

        <div aria-live="polite" class="join-live">
        <!-- Loading / joining -->
        @if (state() === 'loading' || state() === 'joining') {
<div class="join-state">
          <div class="join-skeleton" aria-hidden="true">
            <jiro-skeleton height="22px" width="60%" />
            <jiro-skeleton [lines]="2" height="14px" />
            <jiro-skeleton height="40px" />
          </div>
          <p class="sr-only">{{ state() === 'loading' ? 'Opening your invite...' : 'Joining the group...' }}</p>
        </div>
}

        <!-- Preview: ready to join -->
        @if (state() === 'ready' && preview(); as p) {
<div class="join-state">
          <h2>Join {{ p.group_name }}?</h2>
          <p class="text-secondary">
            A shared journal with {{ p.member_count }} {{ p.member_count === 1 ? 'member' : 'members' }}.
            Members read each other's entries in the group; your own journal stays private.
          </p>
          <jiro-button block variant="primary" type="button" (click)="joinGroup()">Join group</jiro-button>
          <p class="join-note text-secondary">This invite works until {{ formatExpiry(p.expires_at) }}.</p>
          <a routerLink="/journal" class="secondary-link">Not now</a>
        </div>
}

        <!-- Already a member -->
        @if (state() === 'already' && preview(); as p) {
<div class="join-state">
          <h2>You're already in {{ p.group_name }}</h2>
          <p class="text-secondary">Nothing to do here.</p>
          <jiro-button block variant="primary" type="button" (click)="router.navigate(['/journal/groups', p.group_id])">Open group</jiro-button>
        </div>
}

        <!-- Demo: look-only -->
        @if (state() === 'demo') {
<div class="join-state">
          <h2>{{ preview() ? 'Invited to ' + preview()!.group_name : 'Group invite' }}</h2>
          <p class="text-secondary">
            The demo is look-only, so it cannot join groups. Leave the demo and create your own account, and this invite opens again afterwards.
          </p>
          <jiro-button block variant="primary" type="button" (click)="leaveDemoToRegister()">Create an account</jiro-button>
          <a routerLink="/journal" class="secondary-link">Back to the demo</a>
        </div>
}

        <!-- Success -->
        @if (state() === 'success') {
<div class="join-state">
          <div class="join-icon success-icon" aria-hidden="true">
            <jiro-icon name="check-circle" [size]="36" />
          </div>
          <h2>You're in!</h2>
          <p class="text-secondary">You've joined <strong>{{ groupName() }}</strong>. Start reading and writing together.</p>
          <jiro-button block variant="primary" type="button" (click)="router.navigate(['/journal/groups', groupId()])">
            Open group
          </jiro-button>
          <a routerLink="/journal" class="secondary-link">Back to Journaly</a>
        </div>
}

        <!-- Unverified email -->
        @if (state() === 'unverified') {
<div class="join-state">
          <h2>Verify your email first</h2>
          <p class="text-secondary">
            Jiro sent a link to your email when you signed up. Open it, then come back to this page and join.
          </p>
          <jiro-button block variant="primary" type="button" (click)="joinGroup()">I've verified, join now</jiro-button>
          <a routerLink="/journal" class="secondary-link">Go to Journaly</a>
        </div>
}

        <!-- Error -->
        @if (state() === 'error') {
<div class="join-state">
          <div class="join-icon error-icon" aria-hidden="true">
            <jiro-icon name="warning" [size]="36" />
          </div>
          <h2>This invite does not work</h2>
          <p class="text-secondary">{{ errorMessage() }}</p>
          <jiro-button block variant="primary" type="button" (click)="router.navigate(['/journal'])">
            Go to Journaly
          </jiro-button>
        </div>
}

        <!-- No token in URL -->
        @if (state() === 'no-token') {
<div class="join-state">
          <div class="join-icon" aria-hidden="true">
            <jiro-icon name="link" [size]="36" />
          </div>
          <h2>Invalid link</h2>
          <p class="text-secondary">This invite link is incomplete. Check you copied all of it, or ask the group owner to send it again.</p>
          <jiro-button block variant="primary" type="button" (click)="router.navigate(['/journal'])">
            Go to Journaly
          </jiro-button>
        </div>
}

        <!-- Not logged in -->
        @if (state() === 'not-logged-in') {
<div class="join-state">
          <div class="join-icon" aria-hidden="true">
            <jiro-icon name="lock" [size]="36" />
          </div>
          <h2>Sign in to join</h2>
          <p class="text-secondary">You've been invited to a shared journal. Sign in, or create a free Jiro account, and you'll come straight back here.</p>
          <jiro-button block variant="primary" type="button" (click)="goTo('/login')">
            Sign in
          </jiro-button>
          <p class="create-account text-secondary">
            No account? <a [routerLink]="['/register']" [queryParams]="{ returnUrl: returnPath() }" class="link">Create one free</a>
          </p>
        </div>
}
        </div>

      </div>
    </main>
  `,
  styles: [`
    .join-page {
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-canvas);
      padding: var(--space-xl) var(--space-md);
    }

    .join-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
      padding: var(--space-xl) var(--space-xl);
      max-width: 420px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
    }

    .join-logo { margin-bottom: var(--space-xs); color: var(--text-primary); }
    .join-skeleton { display: flex; flex-direction: column; gap: var(--space-sm); width: 100%; }
    .join-title { font-size: var(--font-size-xl); font-weight: 700; margin: 0 0 var(--space-md); letter-spacing: -0.5px; }
    .join-live { width: 100%; }

    .join-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
      width: 100%;
      padding-top: var(--space-sm);
    }

    .join-icon { color: var(--text-secondary); }
    .join-icon.success-icon { color: var(--color-positive); }
    .join-icon.error-icon { color: var(--color-warning); }
    .join-state h2 { margin: 0; font-size: var(--font-size-lg); overflow-wrap: anywhere; }
    .join-state p { margin: 0; font-size: var(--font-size-sm); line-height: 1.5; }
    .join-state .join-note { font-size: var(--font-size-xs); }

    .secondary-link {
      display: inline-flex;
      align-items: center;
      min-height: 32px;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
      margin-top: var(--space-xs);
    }
    .secondary-link:hover { color: var(--color-primary); text-decoration: underline; }

    .create-account { font-size: var(--font-size-sm); margin-top: var(--space-xs); }
    .link { color: var(--color-primary); text-decoration: underline; }

    @media (max-width: 480px) {
      .join-card { padding: var(--space-lg); }
    }
  `]
})
export class JournalJoinComponent implements OnInit {
  state = signal<State>('loading');
  preview = signal<JoinPreview | null>(null);
  groupId = signal('');
  groupName = signal('');
  errorMessage = signal('');
  returnPath = signal('');

  private token = '';
  private readonly settings = inject(SettingsService);

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private svc: JournalService,
    private auth: AuthService,
  ) { }

  async ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.returnPath.set(`/journal/join?token=${encodeURIComponent(this.token)}`);

    if (!this.token) {
      this.state.set('no-token');
      return;
    }

    // A cached user may still be refreshing; wait until auth has settled.
    await this.auth.whenInitialized();
    if (!this.auth.isAuthenticated()) {
      this.state.set('not-logged-in');
      return;
    }

    this.svc.previewInvite(this.token).subscribe({
      next: p => {
        this.preview.set(p);
        if (this.auth.isDemo()) this.state.set('demo');
        else if (p.already_member) this.state.set('already');
        else this.state.set('ready');
      },
      error: (err: any) => this.fail(err),
    });
  }

  joinGroup() {
    this.state.set('joining');
    this.svc.joinGroup(this.token).subscribe({
      next: res => {
        this.groupId.set(res.group_id);
        this.groupName.set(res.group_name);
        this.state.set('success');
      },
      error: (err: any) => this.fail(err),
    });
  }

  private fail(err: any) {
    const code = err?.error?.error?.code;
    if (code === 'DEMO_READ_ONLY') { this.state.set('demo'); return; }
    if (code === 'EMAIL_NOT_VERIFIED') { this.state.set('unverified'); return; }
    if (err?.status === 401) { this.state.set('not-logged-in'); return; }
    if (err?.status === 429) {
      this.errorMessage.set('Too many tries in a row. Wait a minute, then open the link again.');
    } else {
      this.errorMessage.set(err?.error?.error?.message ?? 'Something went wrong opening this invite. Try the link again.');
    }
    this.state.set('error');
  }

  goTo(path: '/login' | '/register') {
    this.router.navigate([path], { queryParams: { returnUrl: this.returnPath() } });
  }

  /** Signs out of the demo, then opens registration that returns here. */
  leaveDemoToRegister() {
    this.auth.logout(`/register?returnUrl=${encodeURIComponent(this.returnPath())}`);
  }

  formatExpiry(s: string): string {
    return new Date(s).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
      timeZone: this.settings.timezone(),
    });
  }
}
