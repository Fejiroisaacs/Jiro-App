import { Component, OnInit, inject, signal, computed } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  JournalService,
  JournalGroup,
  JournalGroupMember,
  JournalEntry,
  JournalInviteLink,
  INVITE_LINK_DAYS,
  MOODS,
} from '../../../core/services/journal.service';
import { AuthService } from '../../../core/services/auth.service';
import { JournalWeekViewComponent, currentWeekBounds } from '../journal-week-view/journal-week-view';
import { SettingsService } from '../../../core/services/settings.service';
import { dayKey } from '../../../core/utils/day';
import { JournalDayModalComponent } from '../journal-day-modal/journal-day-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { ConfirmService } from '../../../core/services/confirm.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-journal-group',
  standalone: true,
  imports: [FormsModule, RouterLink, JournalWeekViewComponent, JournalDayModalComponent, JiroButtonComponent, JiroModalComponent, SafeHtmlPipe],
  template: `
    <div class="group-page">

      <!-- Top bar -->
      <div class="page-header">
        <div class="header-left">
          <a routerLink="/journal/groups" class="back-link">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15,18 9,12 15,6"/>
            </svg>
            Groups
          </a>
          @if (group()) {
<div class="group-header-info">
            <div class="group-avatar-lg">{{ group()!.name[0].toUpperCase() }}</div>
            <div>
              <h1>{{ group()!.name }}</h1>
              <p class="text-secondary">{{ group()!.members.length }} member{{ group()!.members.length !== 1 ? 's' : '' }}</p>
            </div>
          </div>
}
        </div>
        @if (group()) {
<div class="header-actions">
          <jiro-button variant="secondary" type="button" (click)="openMembers()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Members
          </jiro-button>
          <jiro-button variant="primary" type="button" (click)="writeEntry()">
            + Write
          </jiro-button>
        </div>
}
      </div>

      <!-- Loading -->
      @if (loading()) {
<div class="state-center">
        <span class="spinner"></span>
        <p>Loading group...</p>
      </div>
}

      <!-- Not found -->
      @if (!loading() && !group()) {
<div class="state-center">
        <h3>Group not found</h3>
        <p class="text-secondary">This group may have been deleted or you don't have access.</p>
        <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal'])">Back to Journaly</jiro-button>
      </div>
}

      @if (!loading() && group()) {
<div>

        <!-- Week view calendar -->
        <journal-week-view
          [entries]="entries()"
          [showAuthor]="true"
          [memberMap]="memberMap()"
          [loading]="loadingEntries()"
          (dayClick)="openDayModal($event)"
          (entryClick)="openEntryModal($event)"
          (weekChange)="onWeekChange($event)">
        </journal-week-view>

        <!-- Feed: entries for current week -->
        @if (loadingEntries()) {
<div class="state-center">
          <span class="spinner"></span>
        </div>
}

        @if (!loadingEntries() && weekEntries().length === 0) {
<div class="state-center">
          <h3>No entries this week</h3>
          <p class="text-secondary">Click any day above or use "Write" to add an entry.</p>
          <jiro-button variant="primary" type="button" (click)="writeEntry()">Write Entry</jiro-button>
        </div>
}

        @if (!loadingEntries() && weekEntries().length > 0) {
<div class="entries-feed">
          @for (e of weekEntries(); track e) {
<div class="entry-card">
            <div class="entry-author">
              <div class="author-avatar">{{ authorInitial(e) }}</div>
              <div class="author-info">
                <span class="author-name">{{ authorName(e) }}</span>
                <span class="entry-date text-secondary">{{ formatDate(e.created_at) }}</span>
              </div>
              @if (e.mood) {
<span class="mood-chip" [innerHTML]="moodIcon(e.mood) | safeHtml"></span>
}
              <!-- Edit/delete for own entries -->
              @if (isOwnEntry(e)) {
<div class="entry-actions">
                <button class="icon-btn" (click)="router.navigate(['/journal', e.id, 'edit'])" aria-label="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-btn danger" type="button" (click)="deleteEntry(e)" aria-label="Delete this entry">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              </div>
}
            </div>
            @if (e.title) {
<h3 class="entry-title">{{ e.title }}</h3>
}
            <p class="entry-body">{{ e.body }}</p>
            @if (e.images?.length) {
<div class="entry-images">
              @for (img of e.images; track img) {
<img [src]="img.file_url" [alt]="'Entry image'" class="entry-image" (click)="lightboxUrl.set(img.file_url)" />
}
            </div>
}
            @if (e.tags?.length) {
<div class="tag-list">
              @for (t of (e.tags || []); track t) {
<span class="tag-chip">{{ t }}</span>
}
            </div>
}
          </div>
}
        </div>
}
      </div>
}

    </div>

    <!-- Day modal -->
    @if (dayModalDate()) {
<journal-day-modal
     
      [date]="dayModalDate()!"
      [entries]="dayModalEntries()"
      [initialEntry]="dayModalInitEntry()"
      [showAuthor]="true"
      [memberMap]="memberMap()"
      [ownUserId]="currentUserId()"
      (close)="closeDayModal()"
      (newEntry)="onDayModalNew()"
      (editEntry)="onDayModalEdit($event)"
      (deleteEntry)="onDayModalDelete($event)">
    </journal-day-modal>
}

    <!-- Members modal -->
    @if (showMembers()) {
<jiro-modal title="Members" (close)="showMembers.set(false)">
      @if (group()) {
<div class="members-list">
        @for (m of group()!.members; track m) {
<div class="member-row">
          <div class="member-avatar">{{ memberInitial(m) }}</div>
          <div class="member-info">
            <span class="member-name">{{ m.username || m.email }}</span>
            <span class="member-status text-secondary" [class.pending]="m.status === 'pending'">
              {{ m.status === 'pending' ? 'Invite pending' : 'Member' }}
            </span>
          </div>
          <!-- Owner badge -->
          @if (m.user_id === group()!.owner_id) {
<span class="owner-badge">Owner</span>
}
          <!-- Remove: owner can remove others, any member can leave -->
          @if (canRemove(m)) {
<button
            type="button"
            class="icon-btn danger"
            (click)="removeMember(m)"
            [attr.aria-label]="removeLabel(m)"
            [disabled]="removingMemberId() === m.user_id">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
}
        </div>
}
      </div>
}

      <!-- Invite link (owner only) -->
      @if (isOwner()) {
<div class="invite-section">
        <h3 class="invite-title">Invite link</h3>
        <p class="invite-help text-secondary">
          Anyone with a Jiro account who opens the link while signed in can join. A link works for {{ inviteLinkDays }} days, and making a new one turns the old one off.
        </p>
        @if (linkLoading()) {
          <p class="invite-help text-secondary">Checking for a link...</p>
        } @else if (newLinkUrl()) {
          <div class="invite-row">
            <label class="sr-only" for="invite-link-url">Invite link</label>
            <input
              id="invite-link-url"
              #linkInput
              type="text"
              class="invite-input"
              readonly
              [value]="newLinkUrl()"
              (focus)="linkInput.select()" />
            <jiro-button variant="primary" type="button" (click)="copyLink(linkInput)">Copy</jiro-button>
          </div>
          <p class="invite-help text-secondary">Works until {{ formatExpiry(inviteLink()!.expires_at) }}. Copy it now: for your privacy Jiro keeps only a scrambled copy, so it cannot show this link again.</p>
        } @else if (inviteLink()) {
          <p class="invite-help">A link is on until {{ formatExpiry(inviteLink()!.expires_at) }}. Jiro cannot show it again; make a new link to copy one.</p>
        }
        @if (!linkLoading()) {
        <div class="link-actions">
          <jiro-button variant="secondary" type="button" [disabled]="linkBusy()" (click)="createLink()">
            {{ inviteLink() ? 'Make a new link' : 'Create invite link' }}
          </jiro-button>
          @if (inviteLink()) {
            <jiro-button variant="danger" type="button" [disabled]="linkBusy()" (click)="revokeLink()">Turn off link</jiro-button>
          }
        </div>
        }
        @if (linkError()) {
<p class="invite-error" role="alert">{{ linkError() }}</p>
}
      </div>
}

      <!-- Invite section (owner only) -->
      @if (isOwner()) {
<div class="invite-section">
        <h3 class="invite-title">Invite by email</h3>
        <div class="invite-row">
          <label class="sr-only" for="invite-email">Email address to invite</label>
          <input
            id="invite-email"
            type="email"
            class="invite-input"
            placeholder="friend@example.com"
            [(ngModel)]="inviteEmail"
            (keydown.enter)="sendInvite()" />
          <jiro-button variant="primary" type="button" [disabled]="!inviteEmail.trim() || inviting()" (click)="sendInvite()">
            {{ inviting() ? 'Sending...' : 'Invite' }}
          </jiro-button>
        </div>
        @if (inviteError()) {
<p class="invite-error" role="alert">{{ inviteError() }}</p>
}
        @if (inviteSuccess()) {
<p class="invite-success" role="status">{{ inviteSuccess() }}</p>
}
      </div>
}

      <!-- Rename group (owner only) -->
      @if (isOwner()) {
<div class="rename-section">
        <h3 class="invite-title">Rename group</h3>
        <div class="invite-row">
          <label class="sr-only" for="rename-group">New group name</label>
          <input
            id="rename-group"
            type="text"
            class="invite-input"
            [(ngModel)]="renameVal"
            maxlength="100"
            placeholder="New name..." />
          <jiro-button variant="secondary" type="button" [disabled]="!renameVal.trim() || renaming()" (click)="renameGroup()">
            {{ renaming() ? 'Saving...' : 'Rename' }}
          </jiro-button>
        </div>
      </div>
}

      <!-- Delete group (owner only) -->
      @if (isOwner()) {
<div class="danger-zone">
        <jiro-button block variant="danger" type="button" (click)="deleteGroup()">Delete group</jiro-button>
      </div>
}
    </jiro-modal>
}



    <!-- Lightbox -->
    @if (lightboxUrl()) {
<div class="lightbox" (click)="lightboxUrl.set(null)">
      <img [src]="lightboxUrl()!" alt="Full size" />
    </div>
}
  `,
  styles: [`
    .group-page { max-width: 760px; }

    .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: var(--space-xl); gap: var(--space-md); }
    .header-left { display: flex; flex-direction: column; gap: var(--space-sm); }
    .back-link {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
      text-decoration: none;
      transition: color 0.15s;
    }
    .back-link:hover { color: var(--color-primary); text-decoration: none; }
    .group-header-info { display: flex; align-items: center; gap: var(--space-md); }
    .group-avatar-lg {
      width: 48px; height: 48px; border-radius: 50%;
      background: color-mix(in srgb, var(--color-primary) 20%, transparent);
      color: var(--color-primary); display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: var(--font-size-lg); flex-shrink: 0;
    }
    .group-header-info h1 { margin: 0 0 2px; }
    .header-actions { display: flex; gap: var(--space-sm); flex-shrink: 0; }

    /* State */
    .state-center { display: flex; flex-direction: column; align-items: center; text-align: center; gap: var(--space-sm); padding: var(--space-xl) 0; }

    /* Feed */
    .entries-feed { display: flex; flex-direction: column; gap: var(--space-lg); }
    .entry-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      padding: var(--space-lg);
    }
    .entry-author { display: flex; align-items: center; gap: var(--space-sm); margin-bottom: var(--space-sm); }
    .author-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: color-mix(in srgb, var(--color-primary) 15%, transparent);
      color: var(--color-primary); display: flex; align-items: center; justify-content: center;
      font-weight: 700; font-size: var(--font-size-sm); flex-shrink: 0;
    }
    .author-info { display: flex; flex-direction: column; gap: 1px; flex: 1; }
    .author-name { font-weight: 600; font-size: var(--font-size-sm); }
    .entry-date { font-size: var(--font-size-xs); }
    .mood-chip { display: inline-flex; align-items: center; margin-left: auto; color: var(--text-secondary); }
    .entry-actions { display: flex; gap: 4px; }
    .icon-btn {
      background: none; border: none; cursor: pointer; padding: 4px; border-radius: var(--border-radius-sm);
      color: var(--text-secondary); display: flex; align-items: center; transition: color 0.12s, background 0.12s;
    }
    .icon-btn.danger:hover { color: var(--color-danger); background: color-mix(in srgb, var(--color-danger) 10%, transparent); }
    .entry-title { font-size: var(--font-size-md); font-weight: 600; margin: 0 0 var(--space-xs); }
    .entry-body { font-size: var(--font-size-sm); line-height: 1.7; margin: 0 0 var(--space-sm); white-space: pre-wrap; }
    .entry-images { display: flex; gap: var(--space-sm); flex-wrap: wrap; margin-bottom: var(--space-sm); }
    .entry-image { width: 100px; height: 80px; object-fit: cover; border-radius: var(--border-radius-sm); cursor: zoom-in; }
    .tag-list { display: flex; flex-wrap: wrap; gap: 4px; }
    .tag-chip { font-size: 0.65rem; padding: 2px 6px; background: var(--bg-surface-hover); border-radius: 99px; color: var(--text-secondary); }

    /* Members modal */
    .members-list { display: flex; flex-direction: column; gap: var(--space-xs); margin-bottom: var(--space-lg); }
    .member-row {
      display: flex; align-items: center; gap: var(--space-sm);
      padding: var(--space-sm) 0; border-bottom: 1px solid var(--border-color);
    }
    .member-row:last-child { border-bottom: none; }
    .member-avatar {
      width: 34px; height: 34px; border-radius: 50%;
      background: var(--bg-surface-hover); color: var(--text-secondary);
      display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: var(--font-size-sm); flex-shrink: 0;
    }
    .member-info { flex: 1; display: flex; flex-direction: column; gap: 1px; }
    .member-name { font-size: var(--font-size-sm); font-weight: 500; }
    .member-status { font-size: var(--font-size-xs); }
    .member-status.pending { color: var(--color-warning); }
    .owner-badge { font-size: var(--font-size-xs); padding: 2px 8px; background: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); border-radius: 99px; }

    /* Invite */
    .invite-section, .rename-section { margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--border-color); }
    .invite-title { font-size: var(--font-size-sm); font-weight: 600; margin: 0 0 var(--space-sm); }
    .invite-row { display: flex; gap: var(--space-sm); }
    .invite-input {
      flex: 1; font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-canvas); color: var(--text-primary); padding: 8px var(--space-sm);
    }
    .invite-input:focus { border-color: var(--color-primary); }
    .invite-error { font-size: var(--font-size-xs); color: var(--color-danger); margin-top: var(--space-xs); }
    .invite-help { font-size: var(--font-size-xs); margin: 0 0 var(--space-sm); line-height: 1.5; }
    .invite-row + .invite-help { margin-top: var(--space-xs); }
    .invite-input { min-width: 0; }
    .link-actions { display: flex; flex-wrap: wrap; gap: var(--space-sm); }
    .invite-success { font-size: var(--font-size-xs); color: var(--color-success); margin-top: var(--space-xs); }

    .danger-zone { margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--border-color); }

    /* New entry modal */
    .modal-form { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-lg); }
    .form-control {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-canvas); color: var(--text-primary); padding: 8px var(--space-sm);
    }
    .form-control:focus { border-color: var(--color-primary); }
    .body-area { resize: vertical; min-height: 100px; font-family: Georgia, serif; line-height: 1.6; }
    .mood-row-modal { display: flex; gap: var(--space-xs); overflow-x: auto; scrollbar-width: none; }
    .mood-row-modal::-webkit-scrollbar { display: none; }
    .mood-chip-sm {
      padding: 6px; border: 1.5px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: none; cursor: pointer; flex-shrink: 0; min-width: 44px; min-height: 44px;
      color: var(--text-primary);
      transition: border-color 0.15s, color 0.15s; display: flex; align-items: center; justify-content: center;
    }
    .mood-chip-sm.selected { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary); }
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.85); z-index: var(--z-overlay);
      display: flex; align-items: center; justify-content: center; cursor: zoom-out;
    }
    .lightbox img { max-width: 90vw; max-height: 90vh; object-fit: contain; border-radius: var(--border-radius); }

    @media (max-width: 600px) {
      .page-header { flex-direction: column; }
      .header-actions { width: 100%; justify-content: flex-end; }
      .entry-images { flex-wrap: wrap; }
      .entry-image { width: calc(50% - var(--space-xs)); height: 100px; }
    }
  `]
})
export class JournalGroupComponent implements OnInit {
  groupId = '';

  group = signal<JournalGroup | null>(null);
  entries = signal<JournalEntry[]>([]);
  loading = signal(true);
  loadingEntries = signal(false);

  private readonly settings = inject(SettingsService);

  /** The week the calendar shows, as day keys in the viewer's zone. */
  weekFrom = signal(currentWeekBounds(this.settings.timezone()).from);
  weekTo = signal(currentWeekBounds(this.settings.timezone()).to);

  weekEntries = computed(() => {
    const from = this.weekFrom();
    const to = this.weekTo();
    return this.entries().filter(e => {
      const key = this.dayOf(e.created_at);
      return key >= from && key <= to;
    });
  });

  memberMap = computed(() => {
    const g = this.group();
    if (!g) return {} as Record<string, string>;
    const map: Record<string, string> = {};
    for (const m of g.members) {
      map[m.user_id] = m.username ?? m.email ?? 'Unknown';
    }
    return map;
  });

  dayModalDate = signal<string | null>(null);
  dayModalInitEntry = signal<JournalEntry | null>(null);
  dayModalEntries = computed(() => {
    const date = this.dayModalDate();
    if (!date) return [];
    return this.entries().filter(e => this.dayOf(e.created_at) === date);
  });

  currentUserId = computed(() => this.auth.user()?.id ?? null);

  showMembers = signal(false);


  readonly inviteLinkDays = INVITE_LINK_DAYS;
  /** The group's working link (never its token once fetched again). */
  inviteLink = signal<JournalInviteLink | null>(null);
  /** The full URL of a link made in this visit; the only time it is known. */
  newLinkUrl = signal('');
  linkLoading = signal(false);
  linkBusy = signal(false);
  linkError = signal('');

  inviteEmail = '';
  inviting = signal(false);
  inviteError = signal('');
  inviteSuccess = signal('');

  renameVal = '';
  renaming = signal(false);



  removingMemberId = signal<string | null>(null);

  private readonly confirmService = inject(ConfirmService);
  private readonly toast = inject(ToastService);

  lightboxUrl = signal<string | null>(null);

  constructor(
    private svc: JournalService,
    private route: ActivatedRoute,
    public router: Router,
    private auth: AuthService,
  ) { }

  ngOnInit() {
    this.groupId = this.route.snapshot.paramMap.get('id') ?? '';
    this.svc.getGroup(this.groupId).subscribe({
      next: g => {
        this.group.set(g);
        this.renameVal = g.name;
        this.loading.set(false);
        this.loadEntries();
      },
      error: () => this.loading.set(false),
    });
  }

  loadEntries() {
    this.loadingEntries.set(true);
    this.svc.listGroupEntries(this.groupId).subscribe({
      next: e => { this.entries.set(e); this.loadingEntries.set(false); },
      error: () => this.loadingEntries.set(false),
    });
  }

  onWeekChange(range: { from: string; to: string }) {
    this.weekFrom.set(range.from);
    this.weekTo.set(range.to);
  }

  openDayModal(date: string) {
    this.dayModalInitEntry.set(null);
    this.dayModalDate.set(date);
  }

  openEntryModal(entry: JournalEntry) {
    this.dayModalInitEntry.set(entry);
    this.dayModalDate.set(this.dayOf(entry.created_at));
  }

  /** The viewer's calendar day of an instant, as the week view cuts it. */
  private dayOf(instant: string): string {
    return dayKey(instant, this.settings.timezone());
  }

  closeDayModal() {
    this.dayModalDate.set(null);
    this.dayModalInitEntry.set(null);
  }

  onDayModalNew() {
    const date = this.dayModalDate();
    this.closeDayModal();
    this.writeEntry(date ?? undefined);
  }

  onDayModalEdit(id: string) {
    this.closeDayModal();
    this.router.navigate(['/journal', id, 'edit']);
  }

  onDayModalDelete(id: string) {
    const entry = this.entries().find(e => e.id === id);
    if (entry) this.deleteEntry(entry);
  }

  isOwner(): boolean {
    const g = this.group();
    const uid = this.auth.user()?.id;
    return !!g && !!uid && g.owner_id === uid;
  }

  isOwnEntry(e: JournalEntry): boolean {
    return e.user_id === this.auth.user()?.id;
  }

  /** Same wording removeMember()'s confirm dialog uses, for the icon-only button beside it. */
  removeLabel(m: JournalGroupMember): string {
    if (m.user_id === this.auth.user()?.id) return 'Leave group';
    return `Remove ${m.username ?? m.email ?? 'this member'}`;
  }

  canRemove(m: JournalGroupMember): boolean {
    const uid = this.auth.user()?.id;
    if (!uid) return false;
    const g = this.group();
    if (!g) return false;
    if (uid === g.owner_id && m.user_id !== uid) return true;
    if (uid === m.user_id && uid !== g.owner_id) return true;
    return false;
  }

  sendInvite() {
    if (!this.inviteEmail.trim()) return;
    this.inviting.set(true);
    this.inviteError.set('');
    this.inviteSuccess.set('');
    this.svc.inviteMember(this.groupId, this.inviteEmail.trim()).subscribe({
      next: () => {
        this.inviteSuccess.set(`Invite sent to ${this.inviteEmail.trim()}.`);
        this.inviteEmail = '';
        this.inviting.set(false);
        this.svc.getGroup(this.groupId).subscribe(g => this.group.set(g));
      },
      error: (err: any) => {
        const code = err?.error?.error?.code;
        if (code === 'USER_NOT_FOUND') {
          this.inviteError.set('No Jiro account found with that email.');
        } else if (code === 'ALREADY_MEMBER') {
          this.inviteError.set('That user is already a member.');
        } else {
          this.inviteError.set(err?.error?.error?.message ?? 'Failed to send invite.');
        }
        this.inviting.set(false);
      },
    });
  }

  openMembers() {
    this.showMembers.set(true);
    if (!this.isOwner() || this.newLinkUrl()) return;
    this.linkLoading.set(true);
    this.linkError.set('');
    this.svc.getInviteLink(this.groupId).subscribe({
      next: link => { this.inviteLink.set(link); this.linkLoading.set(false); },
      error: () => { this.linkLoading.set(false); this.linkError.set('Could not check the invite link.'); },
    });
  }

  async createLink() {
    if (this.inviteLink()) {
      const ok = await this.confirmService.confirm({
        title: 'Make a new invite link?',
        message: 'The current link stops working. Anyone who already joined stays in the group.',
        confirmLabel: 'Make new link',
        danger: false,
      });
      if (!ok) return;
    }
    this.linkBusy.set(true);
    this.linkError.set('');
    this.svc.createInviteLink(this.groupId).subscribe({
      next: link => {
        this.inviteLink.set(link);
        this.newLinkUrl.set(`${window.location.origin}/journal/join?token=${link.token}`);
        this.linkBusy.set(false);
      },
      error: (err: any) => {
        this.linkBusy.set(false);
        this.linkError.set(err?.error?.error?.message ?? 'Could not make an invite link.');
      },
    });
  }

  async revokeLink() {
    const ok = await this.confirmService.confirm({
      title: 'Turn off the invite link?',
      message: 'Nobody new can join with it. Anyone who already joined stays in the group.',
      confirmLabel: 'Turn off link',
      danger: true,
    });
    if (!ok) return;
    this.linkBusy.set(true);
    this.linkError.set('');
    this.svc.revokeInviteLink(this.groupId).subscribe({
      next: () => {
        this.inviteLink.set(null);
        this.newLinkUrl.set('');
        this.linkBusy.set(false);
        this.toast.success('Invite link turned off');
      },
      error: (err: any) => {
        this.linkBusy.set(false);
        this.linkError.set(err?.error?.error?.message ?? 'Could not turn off the link.');
      },
    });
  }

  async copyLink(input: HTMLInputElement) {
    const url = this.newLinkUrl();
    try {
      await navigator.clipboard.writeText(url);
      this.toast.success('Invite link copied');
    } catch {
      // No clipboard access (older browser, insecure context): select it so
      // the owner can copy it themselves.
      input.focus();
      input.select();
      this.toast.error('Could not copy. The link is selected; copy it from there.');
    }
  }

  formatExpiry(s: string): string {
    return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: this.settings.timezone() });
  }

  async removeMember(m: JournalGroupMember) {
    const leaving = m.user_id === this.auth.user()?.id;
    const who = m.username ?? m.email ?? 'this member';
    const ok = await this.confirmService.confirm({
      title: leaving ? 'Leave this group?' : `Remove ${who}?`,
      message: leaving
        ? 'Your own entries stay in the group. You will need a new invite to come back.'
        : 'They lose access to the group. The entries they wrote stay.',
      confirmLabel: leaving ? 'Leave group' : 'Remove member',
      danger: true,
    });
    if (!ok) return;
    this.removingMemberId.set(m.user_id);
    this.svc.removeMember(this.groupId, m.user_id).subscribe({
      next: () => {
        this.removingMemberId.set(null);
        if (leaving) {
          this.toast.success('You left the group');
          this.router.navigate(['/journal']);
        } else {
          this.toast.success(`${who} removed`);
          this.svc.getGroup(this.groupId).subscribe(g => this.group.set(g));
        }
      },
      error: () => {
        this.removingMemberId.set(null);
        this.toast.error(leaving ? 'Could not leave the group.' : 'Could not remove that member.');
      },
    });
  }

  renameGroup() {
    if (!this.renameVal.trim()) return;
    this.renaming.set(true);
    this.svc.updateGroup(this.groupId, this.renameVal.trim()).subscribe({
      next: g => { this.group.set(g); this.renaming.set(false); },
      error: () => this.renaming.set(false),
    });
  }

  writeEntry(date?: string) {
    const params: any = { group: this.groupId };
    if (date) params.date = date;
    this.router.navigate(['/journal/new'], { queryParams: params });
  }

  async deleteEntry(e: JournalEntry) {
    const ok = await this.confirmService.confirm({
      title: 'Delete this entry?',
      message: 'It is removed from the group for everyone, permanently.',
      confirmLabel: 'Delete entry',
      danger: true,
    });
    if (!ok) return;
    this.svc.deleteEntry(e.id).subscribe({
      next: () => {
        this.entries.update(es => es.filter(x => x.id !== e.id));
        this.toast.success('Entry deleted');
      },
      error: () => this.toast.error('Could not delete the entry.'),
    });
  }

  async deleteGroup() {
    const name = this.group()?.name ?? 'this group';
    const ok = await this.confirmService.confirm({
      title: `Delete ${name}?`,
      message: 'The group and every entry written in it are removed for all its members. This cannot be undone.',
      confirmLabel: 'Delete group',
      danger: true,
    });
    if (!ok) return;
    this.svc.deleteGroup(this.groupId).subscribe({
      next: () => {
        this.toast.success(`${name} deleted`);
        this.router.navigate(['/journal']);
      },
      error: () => this.toast.error('Could not delete the group.'),
    });
  }

  authorInitial(e: JournalEntry): string {
    const m = this.group()?.members.find(x => x.user_id === e.user_id);
    return ((m?.username ?? m?.email ?? '?')[0]).toUpperCase();
  }

  authorName(e: JournalEntry): string {
    const m = this.group()?.members.find(x => x.user_id === e.user_id);
    return m?.username ?? m?.email ?? 'Unknown';
  }

  memberInitial(m: JournalGroupMember): string {
    return ((m.username ?? m.email ?? '?')[0]).toUpperCase();
  }

  formatDate(s: string): string {
    return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  moodIcon(value: string): string {
    return MOODS.find(m => m.value === value)?.icon ?? '';
  }
}
