import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SettingsService } from './settings.service';
import { IconName } from '../../shared/icons/icons.generated';

const API_URL = `${environment.apiUrl}/journal`;

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface JournalImage {
  id: string;
  entry_id: string;
  user_id: string;
  object_key: string;
  file_url: string;
  created_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  group_id: string | null;
  title: string | null;
  body: string;
  mood: string | null;
  tags: string[] | null;
  images: JournalImage[] | null;
  /** The author's own collections holding the entry; only on getEntry. */
  collection_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface JournalGroup {
  id: string;
  owner_id: string;
  name: string;
  members: JournalGroupMember[];
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface JournalGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  invited_by: string;
  status: 'pending' | 'active';
  joined_at: string | null;
  created_at: string;
  email?: string;
  username?: string;
}

export interface JournalCollection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  cover_image_url: string | null;
  entry_count: number;
  created_at: string;
  updated_at: string;
}

export interface JournalStreak {
  current_streak: number;
  longest_streak: number;
  total_entries: number;
  last_entry_at: string | null;
}

export interface JournalCalendar {
  year: number;
  month: number;
  days: number[];
}

export interface JoinGroupResponse {
  group_id: string;
  group_name: string;
  already_member: boolean;
}

/** A group's copyable invite link. `token` is only present when just made. */
export interface JournalInviteLink {
  token?: string;
  expires_at: string;
  created_at: string;
}

/** What an invite token opens, read before joining. */
export interface JoinPreview {
  kind: 'link' | 'email';
  group_id?: string;
  group_name: string;
  member_count: number;
  expires_at: string;
  already_member: boolean;
}

/** How long a new invite link works, as the API sets it. */
export const INVITE_LINK_DAYS = 7;

export interface CreateEntryRequest {
  title?: string;
  body: string;
  mood?: string;
  tags?: string[];
  created_at?: string;
  collection_ids?: string[];
}

export interface UpdateEntryRequest {
  title?: string;
  body?: string;
  mood?: string | null;
  tags?: string[];
  /** The entry's full set of collections; omit to leave membership alone. */
  collection_ids?: string[];
}

export interface ListEntriesParams {
  q?: string;
  mood?: string;
  tag?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/**
 * The moods a journal entry can carry, in a deliberate order: the warm,
 * energetic end first, through to the cool and heavy end. Anything that lists
 * or charts moods should follow this order rather than sorting alphabetically.
 *
 * `color` is a literal hex rather than a token on purpose. It is a categorical
 * scale: the eight values have to stay distinguishable from one another and
 * stable across themes, the way MUSCLE_COLORS does in the Jym summary, and the
 * chart needs a plain string. Every hue clears 3:1 as a non-text fill against
 * both surface colours, light (#FFFDF9) and dark (#261D18).
 */
export const MOODS = [
  { value: 'happy', label: 'Happy', color: '#AE7E22', icon: 'smiley' },
  { value: 'grateful', label: 'Grateful', color: '#9C6EA8', icon: 'heart' },
  { value: 'energised', label: 'Energised', color: '#BD5629', icon: 'lightning' },
  { value: 'calm', label: 'Calm', color: '#5A8060', icon: 'cloud' },
  { value: 'tired', label: 'Tired', color: '#8A7F76', icon: 'moon' },
  { value: 'sad', label: 'Sad', color: '#5D7A99', icon: 'smiley-sad' },
  { value: 'anxious', label: 'Anxious', color: '#3F8579', icon: 'warning-circle' },
  { value: 'stressed', label: 'Stressed', color: '#B55048', icon: 'fire' },
] as const satisfies readonly { value: string; label: string; color: string; icon: IconName }[];

export type Mood = (typeof MOODS)[number];

/** The mood's full record, or null when the value is unknown or absent. */
export function moodMeta(value: string | null | undefined): Mood | null {
  if (!value) return null;
  return MOODS.find(m => m.value === value) ?? null;
}

/** The mood's colour, falling back to the muted text token for unknown values. */
export function moodColor(value: string | null | undefined): string {
  return moodMeta(value)?.color ?? 'var(--text-muted)';
}

/** The mood's display label, falling back to the raw value. */
export function moodLabel(value: string | null | undefined): string {
  return moodMeta(value)?.label ?? (value ?? '');
}

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class JournalService {
  constructor(private http: HttpClient) { }

  private readonly settings = inject(SettingsService);

  /** Browser zone hint for day-based endpoints; the API uses it only when the account has no timezone. */
  private tzParams(): HttpParams {
    return new HttpParams().set('tz', this.settings.timezone());
  }

  // Entries
  createEntry(req: CreateEntryRequest): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${API_URL}/entries`, req);
  }

  listEntries(params: ListEntriesParams = {}): Observable<JournalEntry[]> {
    let p = new HttpParams();
    if (params.q) p = p.set('q', params.q);
    if (params.mood) p = p.set('mood', params.mood);
    if (params.tag) p = p.set('tag', params.tag);
    if (params.from) p = p.set('from', params.from);
    if (params.to) p = p.set('to', params.to);
    if (params.limit) p = p.set('limit', params.limit);
    if (params.offset) p = p.set('offset', params.offset);
    return this.http.get<JournalEntry[]>(`${API_URL}/entries`, { params: p });
  }

  /** One page plus X-Total-Count; without the header the total is a lower bound. */
  listEntriesPage(params: ListEntriesParams = {}): Observable<{ entries: JournalEntry[]; total: number }> {
    let p = new HttpParams();
    if (params.q) p = p.set('q', params.q);
    if (params.mood) p = p.set('mood', params.mood);
    if (params.tag) p = p.set('tag', params.tag);
    if (params.from) p = p.set('from', params.from);
    if (params.to) p = p.set('to', params.to);
    if (params.limit) p = p.set('limit', params.limit);
    if (params.offset) p = p.set('offset', params.offset);
    return this.http.get<JournalEntry[]>(`${API_URL}/entries`, { params: p, observe: 'response' }).pipe(
      map(res => {
        const entries = res.body ?? [];
        const header = Number(res.headers.get('X-Total-Count'));
        const total = res.headers.has('X-Total-Count') && Number.isFinite(header)
          ? header
          : entries.length + (params.offset ?? 0);
        return { entries, total };
      }),
    );
  }

  getEntry(id: string): Observable<JournalEntry> {
    return this.http.get<JournalEntry>(`${API_URL}/entries/${id}`);
  }

  updateEntry(id: string, req: UpdateEntryRequest): Observable<JournalEntry> {
    return this.http.put<JournalEntry>(`${API_URL}/entries/${id}`, req);
  }

  deleteEntry(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/entries/${id}`);
  }

  // Streak & Calendar
  getStreak(): Observable<JournalStreak> {
    return this.http.get<JournalStreak>(`${API_URL}/streak`, { params: this.tzParams() });
  }

  getCalendar(year: number, month: number): Observable<JournalCalendar> {
    return this.http.get<JournalCalendar>(`${API_URL}/calendar`, {
      params: this.tzParams().set('year', year).set('month', month),
    });
  }

  // Images
  presignImage(entryId: string, contentType: string, contentLength: number): Observable<{ upload_url: string; object_key: string }> {
    return this.http.post<{ upload_url: string; object_key: string }>(
      `${API_URL}/entries/${entryId}/images/presign`,
      { content_type: contentType, content_length: contentLength }
    );
  }

  confirmImage(entryId: string, objectKey: string): Observable<JournalImage> {
    return this.http.post<JournalImage>(`${API_URL}/entries/${entryId}/images/confirm`, { object_key: objectKey });
  }

  deleteImage(imageId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/images/${imageId}`);
  }

  // Groups
  createGroup(name: string): Observable<JournalGroup> {
    return this.http.post<JournalGroup>(`${API_URL}/groups`, { name });
  }

  listGroups(): Observable<JournalGroup[]> {
    return this.http.get<JournalGroup[]>(`${API_URL}/groups`);
  }

  getGroup(id: string): Observable<JournalGroup> {
    return this.http.get<JournalGroup>(`${API_URL}/groups/${id}`);
  }

  updateGroup(id: string, name: string): Observable<JournalGroup> {
    return this.http.put<JournalGroup>(`${API_URL}/groups/${id}`, { name });
  }

  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/groups/${id}`);
  }

  inviteMember(groupId: string, email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${API_URL}/groups/${groupId}/invite`, { email });
  }

  removeMember(groupId: string, userId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/groups/${groupId}/members/${userId}`);
  }

  joinGroup(token: string): Observable<JoinGroupResponse> {
    return this.http.post<JoinGroupResponse>(`${API_URL}/groups/join`, {}, { params: { token } });
  }

  previewInvite(token: string): Observable<JoinPreview> {
    return this.http.get<JoinPreview>(`${API_URL}/groups/join/preview`, { params: { token } });
  }

  getInviteLink(groupId: string): Observable<JournalInviteLink | null> {
    return this.http.get<{ link: JournalInviteLink | null }>(`${API_URL}/groups/${groupId}/invite-link`).pipe(map(r => r.link));
  }

  /** Makes a new link; any earlier link stops working. */
  createInviteLink(groupId: string): Observable<JournalInviteLink> {
    return this.http.post<JournalInviteLink>(`${API_URL}/groups/${groupId}/invite-link`, {});
  }

  revokeInviteLink(groupId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/groups/${groupId}/invite-link`);
  }

  createGroupEntry(groupId: string, req: CreateEntryRequest): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${API_URL}/groups/${groupId}/entries`, req);
  }

  listGroupEntries(groupId: string): Observable<JournalEntry[]> {
    return this.http.get<JournalEntry[]>(`${API_URL}/groups/${groupId}/entries`);
  }

  getGroupCalendar(groupId: string, year: number, month: number): Observable<JournalCalendar> {
    return this.http.get<JournalCalendar>(`${API_URL}/groups/${groupId}/calendar`, {
      params: this.tzParams().set('year', year).set('month', month),
    });
  }

  // Collections
  createCollection(name: string, description?: string): Observable<JournalCollection> {
    return this.http.post<JournalCollection>(`${API_URL}/collections`, { name, description });
  }

  listCollections(): Observable<JournalCollection[]> {
    return this.http.get<JournalCollection[]>(`${API_URL}/collections`);
  }

  getCollection(id: string): Observable<{ collection: JournalCollection; entries: JournalEntry[] }> {
    return this.http.get<{ collection: JournalCollection; entries: JournalEntry[] }>(`${API_URL}/collections/${id}`);
  }

  updateCollection(id: string, req: { name?: string; description?: string }): Observable<JournalCollection> {
    return this.http.put<JournalCollection>(`${API_URL}/collections/${id}`, req);
  }

  deleteCollection(id: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/collections/${id}`);
  }

  addEntryToCollection(collectionId: string, entryId: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/collections/${collectionId}/entries`, { entry_id: entryId });
  }

  removeEntryFromCollection(collectionId: string, entryId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/collections/${collectionId}/entries/${entryId}`);
  }
}
