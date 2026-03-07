import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { JournalService, JournalGroup } from '../../../core/services/journal.service';
import { JournalQuickNavComponent } from '../journal-quick-nav/journal-quick-nav';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-journal-groups-list',
  standalone: true,
  imports: [CommonModule, FormsModule, JournalQuickNavComponent, JiroButtonComponent, JiroModalComponent],
  template: `
    <div class="groups-page">

      <div class="page-header">
        <div>
          <h1>Journaly</h1>
          <p class="text-secondary">Your reflection space</p>
        </div>
      </div>

      <journal-quick-nav></journal-quick-nav>

      <div class="section-row">
        <h2 class="section-title">My Groups</h2>
        <jiro-button variant="secondary" type="button" (click)="showCreate.set(true)">+ New Group</jiro-button>
      </div>

      <div *ngIf="loading()" class="state-box">
        <div class="spinner-lg"></div>
      </div>

      <div *ngIf="!loading() && groups().length === 0" class="state-box">
        <h3>No groups yet</h3>
        <p class="text-secondary">Create a group and invite friends to journal together.</p>
        <jiro-button variant="primary" type="button" (click)="showCreate.set(true)">Create Group</jiro-button>
      </div>

      <div class="groups-grid" *ngIf="!loading() && groups().length > 0">
        <div
          *ngFor="let g of groups()"
          class="group-card"
          (click)="router.navigate(['/journal/groups', g.id])">
          <div class="group-avatar">{{ g.name[0].toUpperCase() }}</div>
          <div class="group-info">
            <span class="group-name">{{ g.name }}</span>
            <span class="group-members text-secondary">{{ g.member_count }} member{{ g.member_count !== 1 ? 's' : '' }}</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="group-arrow">
            <polyline points="9,18 15,12 9,6"/>
          </svg>
        </div>
      </div>
    </div>

    <jiro-modal *ngIf="showCreate()" title="New Group" (close)="showCreate.set(false)">
      <div class="modal-form">
        <label class="form-label">Group name</label>
        <input type="text" class="form-control" [(ngModel)]="newName" placeholder="e.g. Weekend Adventures" maxlength="100" />
      </div>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="showCreate.set(false)">Cancel</jiro-button>
        <jiro-button variant="primary" type="button" [disabled]="!newName.trim() || creating()" (click)="createGroup()">
          {{ creating() ? 'Creating...' : 'Create' }}
        </jiro-button>
      </div>
    </jiro-modal>
  `,
  styles: [`
    .groups-page { max-width: 860px; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-xl); }
    .page-header h1 { margin: 0 0 var(--space-xs); }

    .section-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-lg); }
    .section-title { font-size: var(--font-size-lg); font-weight: 600; margin: 0; }

    .state-box { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-sm); padding: var(--space-xl) 0; }

    .groups-grid { display: flex; flex-direction: column; gap: var(--space-sm); }
    .group-card {
      display: flex; align-items: center; gap: var(--space-md);
      background: var(--bg-surface); border: 1px solid var(--border-color);
      border-radius: var(--border-radius); padding: var(--space-md) var(--space-lg);
      cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s;
    }
    .group-card:hover { border-color: var(--color-primary); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
    .group-avatar {
      width: 42px; height: 42px; border-radius: 50%;
      background: color-mix(in srgb, var(--color-primary) 20%, transparent);
      color: var(--color-primary); display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: var(--font-size-md); flex-shrink: 0;
    }
    .group-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .group-name { font-weight: 600; font-size: var(--font-size-sm); }
    .group-members { font-size: var(--font-size-xs); }
    .group-arrow { color: var(--text-secondary); flex-shrink: 0; }

    .modal-form { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-lg); }
    .form-label { font-size: var(--font-size-sm); font-weight: 500; color: var(--text-secondary); }
    .form-control {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-canvas); color: var(--text-primary); padding: 8px var(--space-sm);
    }
    .form-control:focus { outline: none; border-color: var(--color-primary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }
  `]
})
export class JournalGroupsListComponent implements OnInit {
  groups = signal<JournalGroup[]>([]);
  loading = signal(true);
  showCreate = signal(false);
  newName = '';
  creating = signal(false);

  constructor(private svc: JournalService, public router: Router) { }

  ngOnInit() {
    this.svc.listGroups().subscribe({
      next: g => { this.groups.set(g); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  createGroup() {
    if (!this.newName.trim()) return;
    this.creating.set(true);
    this.svc.createGroup(this.newName.trim()).subscribe({
      next: g => {
        this.newName = '';
        this.showCreate.set(false);
        this.creating.set(false);
        this.router.navigate(['/journal/groups', g.id]);
      },
      error: () => this.creating.set(false),
    });
  }
}
