import { Component, OnInit, signal } from '@angular/core';

import { AdminService, FeedbackItem } from '../../core/services/admin.service';
import { JiroIconComponent } from '../../shared/components/jiro-icon/jiro-icon';

const TYPE_LABELS: Record<string, string> = {
  bug: 'Bug',
  feature: 'Feature',
  other: 'Other',
};

@Component({
  selector: 'app-admin-feedback',
  standalone: true,
  imports: [JiroIconComponent],
  template: `
    <div class="feedback-page">
      <h1 class="page-title">Feedback</h1>

      @if (loading()) {
<div class="state-msg">Loading...</div>
}
      @if (error()) {
<div class="error-msg">{{ error() }}</div>
}

      @if (!loading() && items().length > 0) {
<div class="table-wrap">
        <table class="feedback-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>User</th>
              <th>Type</th>
              <th>Message</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            @for (item of items(); track item) {
<tr>
              <td class="time-cell">{{ formatTime(item.created_at) }}</td>
              <td class="user-cell">
                <span class="user-email">{{ item.email }}</span>
                @if (item.username) {
<span class="dim"> · {{ item.username }}</span>
}
              </td>
              <td><span class="type-chip" [class]="'type-chip--' + item.type">{{ typeLabel(item.type) }}</span></td>
              <td class="msg-cell">{{ item.message }}</td>
              <td>
                <button class="del-btn" type="button" (click)="delete(item.id)" title="Delete"><jiro-icon name="x" [size]="14" label="Delete feedback" /></button>
              </td>
            </tr>
}
          </tbody>
        </table>
      </div>
}

      @if (!loading() && items().length === 0) {
<div class="state-msg">No feedback yet.</div>
}

      @if (items().length > 0) {
<div class="pagination">
        <button class="page-btn" [disabled]="offset() === 0" (click)="changePage(-1)">Prev</button>
        <span class="page-label">Page {{ page() }}</span>
        <button class="page-btn" [disabled]="items().length < pageSize" (click)="changePage(1)">Next</button>
      </div>
}
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
    .state-msg { color: var(--text-secondary); }
    .error-msg { color: var(--color-negative); }
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
    .type-chip--bug { background: color-mix(in srgb, var(--color-negative) 12%, transparent); color: var(--color-negative); }
    .type-chip--feature { background: color-mix(in srgb, var(--color-positive) 14%, transparent); color: var(--color-positive); }
    .msg-cell { max-width: 360px; line-height: 1.4; color: var(--text-primary); }
    .del-btn {
      background: none; border: none; cursor: pointer; color: var(--text-secondary);
      display: inline-flex; padding: 4px 6px; border-radius: 4px; transition: color 0.15s;
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
