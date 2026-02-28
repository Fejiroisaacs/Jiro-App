import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FeedbackSubmit {
  type: 'bug' | 'feature' | 'other';
  message: string;
}

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private readonly url = `${environment.apiUrl}/feedback`;

  constructor(private http: HttpClient) {}

  submit(req: FeedbackSubmit): Observable<void> {
    return this.http.post<void>(this.url, req);
  }
}
