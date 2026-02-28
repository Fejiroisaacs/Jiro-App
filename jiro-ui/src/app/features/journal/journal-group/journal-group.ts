import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  JournalService,
  JournalGroup,
  JournalGroupMember,
  JournalEntry,
  MOODS,
} from '../../../core/services/journal.service';
import { AuthService } from '../../../core/services/auth.service';
import { JournalWeekViewComponent, toISO, currentWeekBounds } from '../journal-week-view/journal-week-view';
import { JournalDayModalComponent } from '../journal-day-modal/journal-day-modal';
import { JiroButtonComponent } from '../../../shared/components/jiro-button/jiro-button';
import { JiroModalComponent } from '../../../shared/components/jiro-modal/jiro-modal';

@Component({
  selector: 'app-journal-group',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, JournalWeekViewComponent, JournalDayModalComponent, JiroButtonComponent, JiroModalComponent],
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
          <div class="group-header-info" *ngIf="group()">
            <div class="group-avatar-lg">{{ group()!.name[0].toUpperCase() }}</div>
            <div>
              <h1>{{ group()!.name }}</h1>
              <p class="text-secondary">{{ group()!.members.length }} member{{ group()!.members.length !== 1 ? 's' : '' }}</p>
            </div>
          </div>
        </div>
        <div class="header-actions" *ngIf="group()">
          <jiro-button variant="secondary" type="button" (click)="showMembers.set(true)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            Members
          </jiro-button>
          <jiro-button variant="primary" type="button" (click)="showNewEntry.set(true)">
            + Write
          </jiro-button>
        </div>
      </div>

      <!-- Loading -->
      <div *ngIf="loading()" class="state-center">
        <div class="spinner-lg"></div>
        <p>Loading group...</p>
      </div>

      <!-- Not found -->
      <div *ngIf="!loading() && !group()" class="state-center">
        <h3>Group not found</h3>
        <p class="text-secondary">This group may have been deleted or you don't have access.</p>
        <jiro-button variant="primary" type="button" (click)="router.navigate(['/journal'])">Back to Journaly</jiro-button>
      </div>

      <div *ngIf="!loading() && group()">

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
        <div *ngIf="loadingEntries()" class="state-center">
          <div class="spinner-lg"></div>
        </div>

        <div *ngIf="!loadingEntries() && weekEntries().length === 0" class="state-center">
          <h3>No entries this week</h3>
          <p class="text-secondary">Click any day above or use "Write" to add an entry.</p>
          <jiro-button variant="primary" type="button" (click)="showNewEntry.set(true)">Write Entry</jiro-button>
        </div>

        <div class="entries-feed" *ngIf="!loadingEntries() && weekEntries().length > 0">
          <div *ngFor="let e of weekEntries()" class="entry-card">
            <div class="entry-author">
              <div class="author-avatar">{{ authorInitial(e) }}</div>
              <div class="author-info">
                <span class="author-name">{{ authorName(e) }}</span>
                <span class="entry-date text-secondary">{{ formatDate(e.created_at) }}</span>
              </div>
              <span class="mood-chip" *ngIf="e.mood">{{ moodEmoji(e.mood) }}</span>
              <!-- Edit/delete for own entries -->
              <div class="entry-actions" *ngIf="isOwnEntry(e)">
                <button class="icon-btn" (click)="router.navigate(['/journal', e.id, 'edit'])" aria-label="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="icon-btn danger" (click)="confirmDelete(e)" aria-label="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                </button>
              </div>
            </div>
            <h3 class="entry-title" *ngIf="e.title">{{ e.title }}</h3>
            <p class="entry-body">{{ e.body }}</p>
            <div class="entry-images" *ngIf="e.images?.length">
              <img *ngFor="let img of e.images" [src]="img.file_url" [alt]="'Entry image'" class="entry-image" (click)="lightboxUrl.set(img.file_url)" />
            </div>
            <div class="tag-list" *ngIf="e.tags?.length">
              <span *ngFor="let t of (e.tags || [])" class="tag-chip">{{ t }}</span>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Day modal -->
    <journal-day-modal
      *ngIf="dayModalDate()"
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

    <!-- Members modal -->
    <jiro-modal *ngIf="showMembers()" title="Members" (close)="showMembers.set(false)">
      <div *ngIf="group()" class="members-list">
        <div *ngFor="let m of group()!.members" class="member-row">
          <div class="member-avatar">{{ memberInitial(m) }}</div>
          <div class="member-info">
            <span class="member-name">{{ m.username || m.email }}</span>
            <span class="member-status text-secondary" [class.pending]="m.status === 'pending'">
              {{ m.status === 'pending' ? 'Invite pending' : 'Member' }}
            </span>
          </div>
          <!-- Owner badge -->
          <span class="owner-badge" *ngIf="m.user_id === group()!.owner_id">Owner</span>
          <!-- Remove: owner can remove others, any member can leave -->
          <button
            *ngIf="canRemove(m)"
            class="icon-btn danger"
            (click)="removeMember(m)"
            [disabled]="removingMemberId() === m.user_id">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Invite section (owner only) -->
      <div class="invite-section" *ngIf="isOwner()">
        <h4 class="invite-title">Invite someone</h4>
        <div class="invite-row">
          <input
            type="email"
            class="invite-input"
            placeholder="friend@example.com"
            [(ngModel)]="inviteEmail"
            (keydown.enter)="sendInvite()" />
          <jiro-button variant="primary" type="button" [disabled]="!inviteEmail.trim() || inviting()" (click)="sendInvite()">
            {{ inviting() ? 'Sending...' : 'Invite' }}
          </jiro-button>
        </div>
        <p class="invite-error" *ngIf="inviteError()">{{ inviteError() }}</p>
        <p class="invite-success" *ngIf="inviteSuccess()">{{ inviteSuccess() }}</p>
      </div>

      <!-- Rename group (owner only) -->
      <div class="rename-section" *ngIf="isOwner()">
        <h4 class="invite-title">Rename group</h4>
        <div class="invite-row">
          <input
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

      <!-- Delete group (owner only) -->
      <div class="danger-zone" *ngIf="isOwner()">
        <jiro-button variant="danger" type="button" (click)="confirmDeleteGroup.set(true)">Delete Group</jiro-button>
      </div>
    </jiro-modal>

    <!-- New Entry modal -->
    <jiro-modal *ngIf="showNewEntry()" title="Write Entry" (close)="showNewEntry.set(false)">
      <div class="modal-form">
        <input type="text" class="form-control" [(ngModel)]="newTitle" placeholder="Title (optional)" maxlength="255" />
        <textarea class="form-control body-area" [(ngModel)]="newBody" placeholder="What's on your mind?" rows="6"></textarea>
        <div class="mood-row-modal">
          <button
            *ngFor="let m of moods"
            class="mood-chip-sm"
            [class.selected]="newMood === m.value"
            (click)="newMood = (newMood === m.value ? '' : m.value)"
            type="button">
            {{ m.emoji }}
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="showNewEntry.set(false)">Cancel</jiro-button>
        <jiro-button variant="primary" type="button" [disabled]="!newBody.trim() || postingEntry()" (click)="postEntry()">
          {{ postingEntry() ? 'Posting...' : 'Post' }}
        </jiro-button>
      </div>
    </jiro-modal>

    <!-- Delete entry confirm -->
    <jiro-modal *ngIf="deleteTarget()" title="Delete Entry" (close)="deleteTarget.set(null)">
      <p>Delete this entry? This cannot be undone.</p>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="deleteTarget.set(null)">Cancel</jiro-button>
        <jiro-button variant="danger" type="button" [disabled]="deleting()" (click)="deleteEntry()">
          {{ deleting() ? 'Deleting...' : 'Delete' }}
        </jiro-button>
      </div>
    </jiro-modal>

    <!-- Delete group confirm -->
    <jiro-modal *ngIf="confirmDeleteGroup()" title="Delete Group" (close)="confirmDeleteGroup.set(false)">
      <p>Are you sure you want to delete <strong>{{ group()?.name }}</strong>? All entries will be permanently removed.</p>
      <div class="modal-actions">
        <jiro-button variant="secondary" type="button" (click)="confirmDeleteGroup.set(false)">Cancel</jiro-button>
        <jiro-button variant="danger" type="button" [disabled]="deletingGroup()" (click)="deleteGroup()">
          {{ deletingGroup() ? 'Deleting...' : 'Delete Group' }}
        </jiro-button>
      </div>
    </jiro-modal>

    <!-- Lightbox -->
    <div class="lightbox" *ngIf="lightboxUrl()" (click)="lightboxUrl.set(null)">
      <img [src]="lightboxUrl()!" alt="Full size" />
    </div>
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
    .mood-chip { font-size: 1.1rem; margin-left: auto; }
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
    .member-status.pending { color: var(--color-warning, #d97706); }
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
    .invite-input:focus { outline: none; border-color: var(--color-primary); }
    .invite-error { font-size: var(--font-size-xs); color: var(--color-danger); margin-top: var(--space-xs); }
    .invite-success { font-size: var(--font-size-xs); color: var(--color-success, #16a34a); margin-top: var(--space-xs); }

    .danger-zone { margin-top: var(--space-lg); padding-top: var(--space-lg); border-top: 1px solid var(--border-color); }

    /* New entry modal */
    .modal-form { display: flex; flex-direction: column; gap: var(--space-sm); margin-bottom: var(--space-lg); }
    .form-control {
      font-family: inherit; font-size: var(--font-size-sm);
      border: 1px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: var(--bg-canvas); color: var(--text-primary); padding: 8px var(--space-sm);
    }
    .form-control:focus { outline: none; border-color: var(--color-primary); }
    .body-area { resize: vertical; min-height: 100px; font-family: Georgia, serif; line-height: 1.6; }
    .mood-row-modal { display: flex; gap: var(--space-xs); overflow-x: auto; scrollbar-width: none; }
    .mood-row-modal::-webkit-scrollbar { display: none; }
    .mood-chip-sm {
      font-size: 1.3rem; padding: 6px; border: 1.5px solid var(--border-color); border-radius: var(--border-radius-sm);
      background: none; cursor: pointer; flex-shrink: 0; min-width: 44px; min-height: 44px;
      transition: border-color 0.15s; display: flex; align-items: center; justify-content: center;
    }
    .mood-chip-sm.selected { border-color: var(--color-primary); background: color-mix(in srgb, var(--color-primary) 12%, transparent); }
    .modal-actions { display: flex; justify-content: flex-end; gap: var(--space-sm); }

    /* Lightbox */
    .lightbox {
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); z-index: 9999;
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
  moods = MOODS;
  groupId = '';

  group = signal<JournalGroup | null>(null);
  entries = signal<JournalEntry[]>([]);
  loading = signal(true);
  loadingEntries = signal(false);

  weekFrom = signal(currentWeekBounds().from);
  weekTo = signal(currentWeekBounds().to);

  weekEntries = computed(() => {
    const from = this.weekFrom();
    const to = this.weekTo();
    return this.entries().filter(e => {
      const key = toISO(new Date(e.created_at));
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
    return this.entries().filter(e => toISO(new Date(e.created_at)) === date);
  });

  currentUserId = computed(() => this.auth.user()?.id ?? null);

  showMembers = signal(false);
  showNewEntry = signal(false);
  confirmDeleteGroup = signal(false);

  inviteEmail = '';
  inviting = signal(false);
  inviteError = signal('');
  inviteSuccess = signal('');

  renameVal = '';
  renaming = signal(false);

  newTitle = '';
  newBody = '';
  newMood = '';
  postingEntry = signal(false);

  deleteTarget = signal<JournalEntry | null>(null);
  deleting = signal(false);

  deletingGroup = signal(false);
  removingMemberId = signal<string | null>(null);

  lightboxUrl = signal<string | null>(null);

  constructor(
    private svc: JournalService,
    private route: ActivatedRoute,
    public router: Router,
    private auth: AuthService,
  ) {}

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
    this.dayModalDate.set(toISO(new Date(entry.created_at)));
  }

  closeDayModal() {
    this.dayModalDate.set(null);
    this.dayModalInitEntry.set(null);
  }

  onDayModalNew() {
    this.closeDayModal();
    this.showNewEntry.set(true);
  }

  onDayModalEdit(id: string) {
    this.closeDayModal();
    this.router.navigate(['/journal', id, 'edit']);
  }

  onDayModalDelete(id: string) {
    const entry = this.entries().find(e => e.id === id);
    if (entry) this.confirmDelete(entry);
  }

  isOwner(): boolean {
    const g = this.group();
    const uid = this.auth.user()?.id;
    return !!g && !!uid && g.owner_id === uid;
  }

  isOwnEntry(e: JournalEntry): boolean {
    return e.user_id === this.auth.user()?.id;
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
        const code = err?.error?.code;
        if (code === 'USER_NOT_FOUND') {
          this.inviteError.set('No Jiro account found with that email.');
        } else if (code === 'ALREADY_MEMBER') {
          this.inviteError.set('That user is already a member.');
        } else {
          this.inviteError.set(err?.error?.message ?? 'Failed to send invite.');
        }
        this.inviting.set(false);
      },
    });
  }

  removeMember(m: JournalGroupMember) {
    this.removingMemberId.set(m.user_id);
    this.svc.removeMember(this.groupId, m.user_id).subscribe({
      next: () => {
        this.removingMemberId.set(null);
        const uid = this.auth.user()?.id;
        if (m.user_id === uid) {
          this.router.navigate(['/journal']);
        } else {
          this.svc.getGroup(this.groupId).subscribe(g => this.group.set(g));
        }
      },
      error: () => this.removingMemberId.set(null),
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

  postEntry() {
    if (!this.newBody.trim()) return;
    this.postingEntry.set(true);
    this.svc.createGroupEntry(this.groupId, {
      body: this.newBody.trim(),
      title: this.newTitle.trim() || undefined,
      mood: this.newMood || undefined,
    }).subscribe({
      next: e => {
        this.entries.update(es => [e, ...es]);
        this.newTitle = '';
        this.newBody = '';
        this.newMood = '';
        this.showNewEntry.set(false);
        this.postingEntry.set(false);
      },
      error: () => this.postingEntry.set(false),
    });
  }

  confirmDelete(e: JournalEntry) { this.deleteTarget.set(e); }

  deleteEntry() {
    const e = this.deleteTarget();
    if (!e) return;
    this.deleting.set(true);
    this.svc.deleteEntry(e.id).subscribe({
      next: () => {
        this.entries.update(es => es.filter(x => x.id !== e.id));
        this.deleteTarget.set(null);
        this.deleting.set(false);
      },
      error: () => this.deleting.set(false),
    });
  }

  deleteGroup() {
    this.deletingGroup.set(true);
    this.svc.deleteGroup(this.groupId).subscribe({
      next: () => { this.deletingGroup.set(false); this.router.navigate(['/journal']); },
      error: () => this.deletingGroup.set(false),
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

  moodEmoji(value: string): string {
    return MOODS.find(m => m.value === value)?.emoji ?? '';
  }
}
