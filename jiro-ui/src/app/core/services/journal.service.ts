import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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
  created_at: string;
  updated_at: string;
}

export interface JournalGroup {
  id: string;
  owner_id: string;
  name: string;
  members: JournalGroupMember[];
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
}

export interface CreateEntryRequest {
  title?: string;
  body: string;
  mood?: string;
  tags?: string[];
  created_at?: string;
}

export interface UpdateEntryRequest {
  title?: string;
  body?: string;
  mood?: string | null;
  tags?: string[];
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

export const MOODS = [
  { value: 'happy', label: 'Happy', emoji: '😊' },
  { value: 'calm', label: 'Calm', emoji: '😌' },
  { value: 'energised', label: 'Energised', emoji: '⚡' },
  { value: 'grateful', label: 'Grateful', emoji: '🙏' },
  { value: 'anxious', label: 'Anxious', emoji: '😰' },
  { value: 'sad', label: 'Sad', emoji: '😔' },
  { value: 'tired', label: 'Tired', emoji: '😴' },
  { value: 'stressed', label: 'Stressed', emoji: '😤' },
] as const;

// ─── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class JournalService {
  constructor(private http: HttpClient) { }

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
    return this.http.get<JournalStreak>(`${API_URL}/streak`);
  }

  getCalendar(year: number, month: number): Observable<JournalCalendar> {
    return this.http.get<JournalCalendar>(`${API_URL}/calendar`, {
      params: new HttpParams().set('year', year).set('month', month),
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
    return this.http.post<JoinGroupResponse>(`${API_URL}/groups/join?token=${token}`, {});
  }

  createGroupEntry(groupId: string, req: CreateEntryRequest): Observable<JournalEntry> {
    return this.http.post<JournalEntry>(`${API_URL}/groups/${groupId}/entries`, req);
  }

  listGroupEntries(groupId: string): Observable<JournalEntry[]> {
    return this.http.get<JournalEntry[]>(`${API_URL}/groups/${groupId}/entries`);
  }

  getGroupCalendar(groupId: string, year: number, month: number): Observable<JournalCalendar> {
    return this.http.get<JournalCalendar>(`${API_URL}/groups/${groupId}/calendar`, {
      params: new HttpParams().set('year', year).set('month', month),
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
