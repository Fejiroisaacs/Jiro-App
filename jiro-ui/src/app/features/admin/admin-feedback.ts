import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, FeedbackItem } from '../../core/services/admin.service';

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature',
  other: 'Other',
};

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="feedback-page">
      <h1 class="page-title">Feedback</h1>

      <div *ngIf="loading()" class="state-msg">Loading...</div>
      <div *ngIf="error()" class="error-msg">{{ error() }}</div>

      <div class="table-wrap" *ngIf="!loading() && items().length > 0">
        <table class="feedback-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Type</th>
              <th>Message</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let item of items()">
              <td class="time-cell">{{ formatTime(item.created_at) }}</td>
              <td class="user-cell">
                <span class="user-email">{{ item.email }}</span>
                <span class="dim" *ngIf="item.username"> · {{ item.username }}</span>
              </td>
              <td><span class="type-chip" [class]="'type-chip--' + item.type">{{ typeLabel(item.type) }}</span></td>
              <td class="msg-cell">{{ item.message }}</td>
              <td>
                <button class="del-btn" (click)="delete(item.id)" title="Delete">✕</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div *ngIf="!loading() && items().length === 0" class="state-msg">No feedback yet.</div>

      <div *ngIf="items().length > 0" class="pagination">
        <button class="page-btn" [disabled]="offset() === 0" (click)="changePage(-1)">Prev</button>
        <span class="page-label">Page {{ page() }}</span>
        <button class="page-btn" [disabled]="items().length < pageSize" (click)="changePage(1)">Next</button>
      </div>
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
    .state-msg { color: var(--text-secondary); }
    .error-msg { color: #e05c5c; }
    .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .feedback-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 560px; }
    .feedback-table th {
      text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary); font-size: 11px; text-transform: uppercase;
      letter-spacing: 0.05em; white-space: nowrap;
    }
    .feedback-table td { padding: 10px 10px; border-bottom: 1px solid var(--border-color); vertical-align: top; }
    .time-cell { color: var(--text-secondary); white-space: nowrap; font-size: 12px; }
    .user-cell { font-size: 13px; white-space: nowrap; }
    .user-email { color: var(--text-primary); }
    .dim { color: var(--text-secondary); }
    .type-chip {
      display: inline-block; padding: 2px 10px; border-radius: 10px;
      font-size: 12px; font-weight: 500; white-space: nowrap;
      background: color-mix(in srgb, var(--color-primary) 10%, transparent);
      color: var(--color-primary);
    }
    .type-chip--bug { background: rgba(220,53,69,0.1); color: #c0392b; }
    .type-chip--feature { background: rgba(40,167,69,0.1); color: #1e7e34; }
    .msg-cell { max-width: 360px; line-height: 1.4; color: var(--text-primary); }
    .del-btn {
      background: none; border: none; cursor: pointer; color: var(--text-secondary);
      font-size: 14px; padding: 2px 6px; border-radius: 4px; transition: color 0.15s;
    }
    .del-btn:hover { color: var(--color-danger); }
    .pagination { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .page-btn {
      padding: 7px 16px; border: 1px solid var(--border-color); border-radius: 6px;
      background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font-size: 13px;
    }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-label { font-size: 13px; color: var(--text-secondary); }
  `]
})
export class AdminFeedbackComponent implements OnInit {
  items = signal<FeedbackItem[]>([]);
  loading = signal(true);
  error = signal('');
  offset = signal(0);
  readonly pageSize = 20;

  page = () => Math.floor(this.offset() / this.pageSize) + 1;

  constructor(private adminService: AdminService) {}

  ngOnInit() { this.load(); }

  changePage(dir: number) {
    this.offset.update(o => Math.max(0, o + dir * this.pageSize));
    this.load();
  }

  private load() {
    this.loading.set(true);
    this.adminService.listFeedback(this.offset()).subscribe({
      next: items => { this.items.set(items); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Failed to load feedback'); },
    });
  }

  delete(id: string) {
    this.adminService.deleteFeedback(id).subscribe({
      next: () => this.items.update(list => list.filter(i => i.id !== id)),
    });
  }

  typeLabel(type: string): string {
    return TYPE_LABELS[type] ?? type;
  }

  formatTime(iso: string) {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  }
}
