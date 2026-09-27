import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AdminService, AnalyticsEvent } from '../../core/services/admin.service';
import { SettingsService } from '../../core/services/settings.service';
import { formatInstant } from '../../core/utils/format-date';

const EVENT_TYPES = [
  '', 'user.register', 'user.login',
  'session.start', 'session.finish',
  'recipe.create', 'recipe.cook',
  'split.share', 'split.import',
  'export.csv',
];

@Component({
  selector: 'app-admin-events',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="events-page">
      <h1 class="page-title">Events</h1>

      <form class="filter-bar" (ngSubmit)="search()">
        <select class="filter-input" [(ngModel)]="eventFilter" name="event" aria-label="Event type">
          @for (e of eventTypes; track e) {
<option [value]="e">{{ e || 'All events' }}</option>
}
        </select>
        <input class="filter-input uid-input" type="text" [(ngModel)]="userIdFilter" name="uid" aria-label="Filter by user ID" placeholder="Filter by user ID..." />
        <button class="search-btn" type="submit">Filter</button>
      </form>

      @if (loading()) {
<div class="state-msg">Loading...</div>
}
      @if (error()) {
<div class="error-msg">{{ error() }}</div>
}

      @if (!loading() && events().length > 0) {
<div class="table-wrap" tabindex="0" role="region" aria-label="Events table">
        <table class="events-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>User</th>
              <th class="hide-sm">Properties</th>
            </tr>
          </thead>
          <tbody>
            @for (e of events(); track e) {
<tr>
              <td class="time-cell">{{ formatTime(e.occurred_at) }}</td>
              <td><span class="event-chip">{{ e.event }}</span></td>
              <td class="user-cell">
                @if (e.user_id) {

                  <span class="user-name" (click)="goToUser(e.user_id)" title="{{ e.user_id }}">
                    {{ e.username ? '@' + e.username : e.user_email ?? e.user_id }}
                  </span>
                
} @else {
<span class="dim">Anonymous</span>
}
                
              </td>
              <td class="props-cell hide-sm">{{ e.properties ? (e.properties | json) : 'None' }}</td>
            </tr>
}
          </tbody>
        </table>
      </div>
}

      @if (!loading() && events().length === 0) {
<div class="state-msg">No events found.</div>
}

      @if (events().length > 0) {
<div class="pagination">
        <button class="page-btn" [disabled]="page() <= 1" (click)="changePage(-1)">Prev</button>
        <span class="page-label">Page {{ page() }}</span>
        <button class="page-btn" [disabled]="events().length < pageSize" (click)="changePage(1)">Next</button>
      </div>
}
    </div>
  `,
  styles: [`
    .page-title { font-size: 24px; font-weight: 700; margin-bottom: 20px; }
    .filter-bar { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
    .filter-input {
      padding: 8px 12px; border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary); font-size: 14px;
    }
    .filter-input:focus { border-color: var(--color-primary); }
    select.filter-input { min-width: 150px; }
    .uid-input { flex: 1; min-width: 160px; }
    .search-btn {
      padding: 8px 18px; background: var(--color-primary); color: var(--text-on-primary);
      border: none; border-radius: var(--border-radius); font-size: 14px; cursor: pointer; white-space: nowrap;
    }
    .state-msg { color: var(--text-secondary); }
    .error-msg { color: var(--color-negative); }
    .table-wrap { position: relative; overflow-x: auto; -webkit-overflow-scrolling: touch; }
    .table-wrap:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; }
    .events-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 520px; }
    .events-table th {
      text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border-color);
      color: var(--text-secondary); font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em;
      white-space: nowrap;
    }
    .events-table td { padding: 8px 10px; border-bottom: 1px solid var(--border-color); vertical-align: middle; }
    .time-cell { color: var(--text-secondary); white-space: nowrap; font-size: 12px; }
    .event-chip {
      background: rgba(var(--color-primary-rgb), 0.12); color: var(--color-primary-text);
      padding: 2px 8px; border-radius: var(--border-radius-pill); font-size: 12px; font-weight: 500; white-space: nowrap;
    }
    .user-cell { max-width: 180px; }
    .user-name {
      font-size: 13px; color: var(--color-primary-text); cursor: pointer;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: block;
    }
    .user-name:hover { text-decoration: underline; }
    .dim { color: var(--text-secondary); }
    .props-cell { font-size: 11px; color: var(--text-secondary); font-family: monospace; max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .pagination { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
    .page-btn {
      padding: 7px 16px; border: 1px solid var(--border-color); border-radius: var(--border-radius);
      background: var(--bg-surface); color: var(--text-primary); cursor: pointer; font-size: 13px;
    }
    .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .page-label { font-size: 13px; color: var(--text-secondary); }
    @media (max-width: 600px) {
      .page-title { font-size: 20px; margin-bottom: 14px; }
      .hide-sm { display: none; }
      .filter-bar { gap: 6px; }
      .uid-input { min-width: 0; }
    }
  `]
})
export class AdminEventsComponent implements OnInit {
  private readonly settings = inject(SettingsService);
  events = signal<AnalyticsEvent[]>([]);
  loading = signal(true);
  error = signal('');
  page = signal(1);
  eventFilter = '';
  userIdFilter = '';
  readonly pageSize = 50;
  readonly eventTypes = EVENT_TYPES;

  constructor(private adminService: AdminService, private router: Router) {}

  ngOnInit() { this.load(); }

  search() { this.page.set(1); this.load(); }

  changePage(d: number) { this.page.update(p => p + d); this.load(); }

  goToUser(userId: string) {
    this.router.navigate(['/admin/users', userId]);
  }

  private load() {
    this.loading.set(true);
    this.adminService.listEvents(this.eventFilter, this.userIdFilter.trim(), this.page()).subscribe({
      next: events => { this.events.set(events); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set('Failed to load events'); }
    });
  }

  formatTime(iso: string) {
    const tz = this.settings.timezone();
    return `${formatInstant(iso, tz)}, ${new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: tz })}`;
  }
}
