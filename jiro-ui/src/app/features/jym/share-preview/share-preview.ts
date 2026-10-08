import { Component, OnInit, inject, signal } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { JymService, SharePreview } from '../../../core/services/jym.service';
import { planText } from '../plan-text';
import { distanceUnit, kindOf } from '../exercise-kind';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroLogoComponent } from '../../../shared/components/jiro-logo/jiro-logo';
import { JiroIconComponent } from '../../../shared/components/jiro-icon/jiro-icon';
import { JiroSkeletonComponent } from '../../../shared/components/jiro-skeleton/jiro-skeleton';

@Component({
  selector: 'app-share-preview',
  standalone: true,
  imports: [JiroButtonComponent, RouterLink, JiroLogoComponent, JiroIconComponent, JiroSkeletonComponent],
  template: `
    <main class="share-page">
      <div class="share-container">

        <div class="brand">
          <a routerLink="/" class="brand-logo" aria-label="Jiro home"><jiro-logo [size]="28" /></a>
          <span class="brand-sub">Split share</span>
        </div>

        <!-- Loading -->
        @if (loading()) {
          <div class="preview-card" role="status" aria-label="Loading shared split">
            <div class="preview-header">
              <jiro-skeleton width="25%" height="12px" />
              <jiro-skeleton width="60%" height="30px" class="sk-gap" />
              <jiro-skeleton width="30%" height="14px" class="sk-gap" />
            </div>
            @for (i of [1, 2, 3]; track i) {
              <div class="routine-row"><jiro-skeleton [lines]="3" /></div>
            }
          </div>
        }

        <!-- Error -->
        @if (!loading() && error()) {
<div class="state-message">
          <jiro-icon name="warning-circle" [size]="32" class="error-icon" />
          <h1 class="preview-title">{{ errorTitle() }}</h1>
          <p class="text-secondary">{{ error() }}</p>
          <a [routerLink]="isLoggedIn() ? '/jym' : '/'" class="link-btn">{{ isLoggedIn() ? 'Go to Jym' : 'Go to Jiro' }}</a>
        </div>
}

        <!-- Preview -->
        @if (!loading() && !error() && preview()) {
<div class="preview-card">
          <div class="preview-header">
            <div>
              <p class="preview-label">Shared split</p>
              <h1 class="preview-title">{{ preview()!.split_name }}</h1>
              <p class="preview-sub text-secondary">{{ preview()!.routines.length }} training {{ preview()!.routines.length === 1 ? 'day' : 'days' }}</p>
            </div>
          </div>

          <div class="routines-list">
            @for (r of preview()!.routines; track r) {
<div class="routine-row">
              <div class="routine-header">
                <span class="day-chip">Day {{ r.day_order }}</span>
                <span class="routine-name">{{ r.name }}</span>
              </div>
              <div class="exercises-list">
                @for (ex of r.exercises; track ex) {
<div class="ex-row">
                  <span class="ex-name">{{ ex.name }}</span>
                  <span class="ex-meta">
                    @if (ex.muscle_group) {
<span class="ex-muscle">{{ ex.muscle_group }}</span>
}
                    <span class="ex-targets">{{ planChip(ex) }}</span>
                  </span>
                </div>
}
                @if (r.exercises.length === 0) {
<div class="ex-empty text-secondary">No exercises</div>
}
              </div>
            </div>
}
          </div>

          <div class="import-section">
            @if (!isLoggedIn()) {
<div class="import-info">
              <p class="text-secondary">Sign in to import this split into your Jym library.</p>
              <jiro-button variant="primary" type="button" (click)="goToLogin()">
                Sign in to import
              </jiro-button>
            </div>
}
            @if (isLoggedIn() && !imported()) {
<div class="import-info">
              <p class="text-secondary">This split will be copied into your account. Exercises will be matched by name or created for you.</p>
              <jiro-button variant="primary" type="button" [disabled]="importing()" (click)="importSplit()">
                {{ importing() ? 'Importing...' : 'Import to my account' }}
              </jiro-button>
            </div>
}
            @if (imported()) {
<div class="import-success">
              <jiro-icon name="check" [size]="20" />
              <p>Split imported! <button class="link-btn icon-link" (click)="goToSplit()">Open it <jiro-icon name="arrow-right" [size]="14" /></button></p>
            </div>
}
          </div>
        </div>
}

      </div>
    </main>
  `,
  styles: [`
    :host { display: block; }

    .share-page {
      min-height: 100dvh; display: flex; align-items: center; justify-content: center;
      background: var(--bg-canvas); padding: var(--space-lg);
    }

    .share-container { width: 100%; max-width: 560px; }

    .brand {
      display: flex; align-items: center; gap: var(--space-xs);
      margin-bottom: var(--space-xl);
    }

    .brand-logo { display: inline-flex; color: var(--text-primary); text-decoration: none; margin-right: var(--space-sm); }
    .brand-sub { font-size: var(--font-size-sm); color: var(--text-muted); }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
    }

    .sk-gap { margin-top: var(--space-sm); }

    .error-icon { color: var(--color-danger); }

    .preview-card {
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); overflow: hidden;
    }

    .preview-header {
      padding: var(--space-xl) var(--space-xl) var(--space-lg);
      border-bottom: 1px solid var(--border-color);
    }

    .preview-label {
      font-size: var(--font-size-xs); text-transform: uppercase; letter-spacing: 0.5px;
      color: var(--text-muted); margin-bottom: var(--space-xs);
    }

    .preview-title { font-size: var(--font-size-2xl); font-weight: 700; }

    .preview-sub { font-size: var(--font-size-sm); margin-top: var(--space-xs); }

    .routines-list { display: flex; flex-direction: column; }

    .routine-row { border-bottom: 1px solid var(--border-color); padding: var(--space-md) var(--space-xl); }

    .routine-header { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); }

    .day-chip {
      font-size: var(--font-size-xs); font-weight: 600; padding: 2px 8px;
      background: rgba(var(--color-primary-rgb), 0.1); color: var(--color-primary);
      border-radius: var(--border-radius-pill); white-space: nowrap;
    }

    .routine-name { font-size: var(--font-size-md); font-weight: 600; }

    .exercises-list { display: flex; flex-direction: column; gap: 4px; }

    .ex-row {
      display: flex; align-items: center; justify-content: space-between;
      gap: var(--space-sm); padding: 5px 0;
    }

    .ex-name { font-size: var(--font-size-sm); }

    .ex-meta { display: flex; align-items: center; gap: var(--space-sm); flex-shrink: 0; }

    .ex-muscle {
      font-size: var(--font-size-xs); color: var(--text-muted);
      background: var(--bg-canvas); border: 1px solid var(--border-color);
      border-radius: var(--border-radius-pill); padding: 1px 6px;
    }

    .ex-targets {
      font-size: var(--font-size-xs); font-weight: 600;
      color: var(--text-secondary); min-width: 36px; text-align: right;
    }

    .ex-empty { font-size: var(--font-size-sm); padding: var(--space-xs) 0; }

    .import-section {
      padding: var(--space-lg) var(--space-xl);
      background: var(--bg-canvas);
    }

    .import-info {
      display: flex; flex-direction: column; gap: var(--space-md);
    }


    .import-success {
      display: flex; align-items: center; gap: var(--space-sm);
      color: var(--color-positive);
    }

    .link-btn {
      background: none; border: none; color: var(--color-primary);
      cursor: pointer; font-size: inherit; padding: 0; text-decoration: underline;
    }

    .icon-link { display: inline-flex; align-items: center; gap: 4px; }
  `]
})
export class SharePreviewComponent implements OnInit {
  readonly planText = planText;
  private readonly settings = inject(SettingsService);
  /** The plan chip in the exercise's own terms: reps, a hold or a distance. */
  planChip(x: Parameters<typeof planText>[0] & { kind?: string | null }): string {
    return planText(x, 'short', { kind: kindOf(x.kind), distanceUnit: distanceUnit(this.settings.weightUnit()) });
  }
  loading = signal(true);
  error = signal('');
  errorTitle = signal('Link not found');
  preview = signal<SharePreview | null>(null);
  importing = signal(false);
  imported = signal(false);

  private shareId = '';
  private newSplitId = '';

  isLoggedIn = signal(false);

  private readonly toast = inject(ToastService);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private jymService: JymService,
    private authService: AuthService,
  ) {}

  ngOnInit() {
    this.shareId = this.route.snapshot.paramMap.get('share_id') || '';
    this.isLoggedIn.set(!!this.authService.user());

    this.jymService.getSharePreview(this.shareId).subscribe({
      next: p => { this.preview.set(p); this.loading.set(false); },
      error: err => {
        this.loading.set(false);
        if (err.status === 410) {
          this.errorTitle.set('Link expired');
          this.error.set('This share link has expired and is no longer available.');
        } else if (err.status === 0) {
          this.errorTitle.set('Cannot connect');
          this.error.set('Unable to reach the server. Make sure the API is running.');
        } else {
          this.errorTitle.set('Link not found');
          this.error.set('This share link is invalid or has been revoked.');
        }
      },
    });
  }

  goToLogin() {
    this.router.navigate(['/login'], { queryParams: { returnUrl: `/jym/share/${this.shareId}` } });
  }

  importSplit() {
    this.importing.set(true);
    this.jymService.importShare(this.shareId).subscribe({
      next: res => {
        this.newSplitId = res.split_id;
        this.importing.set(false);
        this.imported.set(true);
      },
      error: () => {
        this.importing.set(false);
        this.toast.error('Could not add this split. Try again.');
      },
    });
  }

  goToSplit() {
    this.router.navigate(['/jym/splits', this.newSplitId]);
  }
}
