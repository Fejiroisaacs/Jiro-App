import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { JymService, SharePreview } from '../../../core/services/jym.service';
import { AuthService } from '../../../core/services/auth.service';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';

@Component({
  selector: 'app-share-preview',
  standalone: true,
  imports: [CommonModule, JiroButtonComponent],
  template: `
    <div class="share-page">
      <div class="share-container">

        <div class="brand">
          <span class="brand-logo">Jiro</span>
          <span class="brand-dot">·</span>
          <span class="brand-sub">Split Share</span>
        </div>

        <!-- Loading -->
        <div *ngIf="loading()" class="state-message">
          <div class="spinner"></div>
          <p class="text-secondary">Loading split...</p>
        </div>

        <!-- Error -->
        <div *ngIf="!loading() && error()" class="state-message">
          <div class="error-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2>{{ errorTitle() }}</h2>
          <p class="text-secondary">{{ error() }}</p>
        </div>

        <!-- Preview -->
        <div *ngIf="!loading() && !error() && preview()" class="preview-card">
          <div class="preview-header">
            <div>
              <p class="preview-label">Shared Split</p>
              <h1 class="preview-title">{{ preview()!.split_name }}</h1>
              <p class="preview-sub text-secondary">{{ preview()!.routines.length }} training {{ preview()!.routines.length === 1 ? 'day' : 'days' }}</p>
            </div>
          </div>

          <div class="routines-list">
            <div *ngFor="let r of preview()!.routines" class="routine-row">
              <div class="routine-header">
                <span class="day-chip">Day {{ r.day_order }}</span>
                <span class="routine-name">{{ r.name }}</span>
              </div>
              <div class="exercises-list">
                <div *ngFor="let ex of r.exercises" class="ex-row">
                  <span class="ex-name">{{ ex.name }}</span>
                  <span class="ex-meta">
                    <span *ngIf="ex.muscle_group" class="ex-muscle">{{ ex.muscle_group }}</span>
                    <span class="ex-targets">{{ ex.target_sets }}×{{ ex.target_reps }}</span>
                  </span>
                </div>
                <div *ngIf="r.exercises.length === 0" class="ex-empty text-secondary">No exercises</div>
              </div>
            </div>
          </div>

          <div class="import-section">
            <div *ngIf="!isLoggedIn()" class="import-info">
              <p class="text-secondary">Sign in to import this split into your Jym library.</p>
              <jiro-button variant="primary" type="button" (click)="goToLogin()">
                Sign in to Import
              </jiro-button>
            </div>
            <div *ngIf="isLoggedIn() && !imported()" class="import-info">
              <p class="text-secondary">This split will be copied into your account — exercises will be matched by name or created for you.</p>
              <jiro-button variant="primary" type="button" [disabled]="importing()" (click)="importSplit()">
                {{ importing() ? 'Importing...' : 'Import to My Account' }}
              </jiro-button>
            </div>
            <div *ngIf="imported()" class="import-success">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4caf50" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <p>Split imported! <button class="link-btn" (click)="goToSplit()">Open it →</button></p>
            </div>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }

    .share-page {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: var(--bg-canvas); padding: var(--space-lg);
    }

    .share-container { width: 100%; max-width: 560px; }

    .brand {
      display: flex; align-items: center; gap: var(--space-xs);
      margin-bottom: var(--space-xl);
    }

    .brand-logo { font-size: var(--font-size-lg); font-weight: 700; color: var(--color-primary); }
    .brand-dot { color: var(--text-muted); }
    .brand-sub { font-size: var(--font-size-sm); color: var(--text-muted); }

    .state-message {
      display: flex; flex-direction: column; align-items: center;
      gap: var(--space-md); padding: var(--space-2xl); text-align: center;
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
    }

    .spinner {
      width: 32px; height: 32px; border: 2px solid var(--border-color);
      border-top-color: var(--color-primary); border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

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
      background: rgba(122,59,46,0.1); color: var(--color-primary);
      border-radius: 8px; white-space: nowrap;
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
      border-radius: 4px; padding: 1px 6px;
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

    .import-info ::ng-deep .jiro-btn { width: auto; align-self: flex-start; }

    .import-success {
      display: flex; align-items: center; gap: var(--space-sm);
      color: #4caf50;
    }

    .link-btn {
      background: none; border: none; color: var(--color-primary);
      cursor: pointer; font-size: inherit; padding: 0; text-decoration: underline;
    }

    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class SharePreviewComponent implements OnInit {
  loading = signal(true);
  error = signal('');
  errorTitle = signal('Link not found');
  preview = signal<SharePreview | null>(null);
  importing = signal(false);
  imported = signal(false);

  private shareId = '';
  private newSplitId = '';

  isLoggedIn = signal(false);

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
      error: () => this.importing.set(false),
    });
  }

  goToSplit() {
    this.router.navigate(['/jym/splits', this.newSplitId]);
  }
}
