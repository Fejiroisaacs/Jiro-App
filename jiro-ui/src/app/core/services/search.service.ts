import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

/**
 * One hit in a search group. Which optional fields are present depends on the
 * group: recipes carry `date`; exercises carry `subtitle` (muscle group);
 * sessions carry `subtitle` (session type), `date` and `in_progress`; journal
 * entries carry `snippet`, `date` and, for a group post, `group_id`.
 */
export interface SearchItem {
  id: string;
  /** Null for an untitled journal entry. */
  title: string | null;
  subtitle?: string;
  snippet?: string;
  date?: string;
  in_progress?: boolean;
  group_id?: string;
}

export interface SearchGroup {
  items: SearchItem[];
  has_more: boolean;
}

export interface SearchResponse {
  query: string;
  recipes: SearchGroup;
  exercises: SearchGroup;
  sessions: SearchGroup;
  journal: SearchGroup;
}

@Injectable({ providedIn: 'root' })
export class SearchService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/search`;

  search(q: string): Observable<SearchResponse> {
    return this.http.get<SearchResponse>(this.apiUrl, { params: new HttpParams().set('q', q) });
  }
}
