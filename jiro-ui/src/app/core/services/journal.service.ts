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
  { value: 'happy', label: 'Happy', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
  { value: 'calm', label: 'Calm', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z"/></svg>' },
  { value: 'energised', label: 'Energised', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' },
  { value: 'grateful', label: 'Grateful', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>' },
  { value: 'anxious', label: 'Anxious', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' },
  { value: 'sad', label: 'Sad', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>' },
  { value: 'tired', label: 'Tired', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' },
  { value: 'stressed', label: 'Stressed', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>' },
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
