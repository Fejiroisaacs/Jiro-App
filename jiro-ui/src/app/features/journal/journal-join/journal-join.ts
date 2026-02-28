import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JournalService } from '../../../core/services/journal.service';
import { AuthService } from '../../../core/services/auth.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

type State = 'loading' | 'joining' | 'success' | 'error' | 'no-token' | 'not-logged-in';

@Component({
  selector: 'app-journal-join',
  standalone: true,
  imports: [CommonModule, RouterLink, JiroButtonComponent],
  template: `
    <div class="join-page">
      <div class="join-card">

        <!-- Logo / branding -->
        <div class="join-logo" aria-hidden="true">📔</div>
        <h1 class="join-title">Journaly</h1>

        <!-- Loading / joining -->
        <div *ngIf="state() === 'loading' || state() === 'joining'" class="join-state">
          <div class="spinner-lg"></div>
          <p class="text-secondary">{{ state() === 'loading' ? 'Preparing...' : 'Joining group...' }}</p>
        </div>

        <!-- Success -->
        <div *ngIf="state() === 'success'" class="join-state">
          <div class="join-icon success-icon" aria-hidden="true">✅</div>
          <h2>You're in!</h2>
          <p class="text-secondary">You've joined <strong>{{ groupName() }}</strong>. Start reading and writing together.</p>
          <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal/groups', groupId()])">
            Open Group
          </jiro-button>
          <a routerLink="/journal" class="secondary-link">Back to Journaly</a>
        </div>

        <!-- Error -->
        <div *ngIf="state() === 'error'" class="join-state">
          <div class="join-icon error-icon" aria-hidden="true">⚠️</div>
          <h2>Invite problem</h2>
          <p class="text-secondary">{{ errorMessage() }}</p>
          <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal'])">
            Go to Journaly
          </jiro-button>
        </div>

        <!-- No token in URL -->
        <div *ngIf="state() === 'no-token'" class="join-state">
          <div class="join-icon" aria-hidden="true">🔗</div>
          <h2>Invalid link</h2>
          <p class="text-secondary">This invite link appears to be incomplete. Ask the group owner to resend the invite.</p>
          <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal'])">
            Go to Journaly
          </jiro-button>
        </div>

        <!-- Not logged in -->
        <div *ngIf="state() === 'not-logged-in'" class="join-state">
          <div class="join-icon" aria-hidden="true">🔐</div>
          <h2>Sign in to join</h2>
          <p class="text-secondary">You need a Jiro account to accept this group invite.</p>
          <jiro-button variant="primary" type="button" (click)="goToLogin()">
            Sign In
          </jiro-button>
          <p class="create-account text-secondary">
            No account? <a routerLink="/register" class="link">Create one free</a>
          </p>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .join-page {
      min-height: 100vh;
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

    .join-logo { font-size: 2.5rem; line-height: 1; margin-bottom: var(--space-xs); }
    .join-title { font-size: var(--font-size-xl); font-weight: 700; margin: 0 0 var(--space-md); letter-spacing: -0.5px; }

    .join-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
      width: 100%;
      padding-top: var(--space-sm);
    }

    .join-icon { font-size: 2rem; line-height: 1; }
    .join-state h2 { margin: 0; font-size: var(--font-size-lg); }
    .join-state p { margin: 0; font-size: var(--font-size-sm); }

    .secondary-link {
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
  groupId = signal('');
  groupName = signal('');
  errorMessage = signal('');

  private token = '';

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private svc: JournalService,
    private auth: AuthService,
  ) {}

  ngOnInit() {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';

    if (!this.token) {
      this.state.set('no-token');
      return;
    }

    // Check if logged in
    if (!this.auth.user()) {
      this.state.set('not-logged-in');
      return;
    }

    this.joinGroup();
  }

  joinGroup() {
    this.state.set('joining');
    this.svc.joinGroup(this.token).subscribe({
      next: res => {
        this.groupId.set(res.group_id);
        this.groupName.set(res.group_name);
        this.state.set('success');
      },
      error: (err: any) => {
        const msg = err?.error?.message ?? 'The invite link is invalid or has expired.';
        this.errorMessage.set(msg);
        this.state.set('error');
      },
    });
  }

  goToLogin() {
    const returnPath = `/journal/join?token=${this.token}`;
    this.router.navigate(['/login'], { queryParams: { redirect: returnPath } });
  }
}
