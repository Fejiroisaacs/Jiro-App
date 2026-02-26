import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

const API = environment.apiUrl;

@Injectable({ providedIn: 'root' })
export class UploadService {
  constructor(private http: HttpClient) {}

  /**
   * Full avatar upload flow:
   * 1. Request presign URL from API
   * 2. PUT file directly to R2 via fetch (bypasses Angular interceptors — no JWT sent to R2)
   * 3. Confirm with API so it saves avatar_url
   * Returns the final avatar_url.
   */
  uploadAvatar(file: File, onProgress?: (pct: number) => void): Observable<string> {
    const presignBody = {
      content_type: file.type,
      content_length: file.size,
    };

    return this.http
      .post<{ upload_url: string; object_key: string }>(`${API}/upload/avatar/presign`, presignBody)
      .pipe(
        switchMap(({ upload_url, object_key }) =>
          from(this.putToStorage(upload_url, file, onProgress)).pipe(
            switchMap(() =>
              this.http
                .patch<{ avatar_url: string }>(`${API}/upload/avatar/confirm`, { object_key })
                .pipe(map(res => res.avatar_url))
            )
          )
        )
      );
  }

  deleteAvatar(): Observable<void> {
    return this.http.delete<void>(`${API}/upload/avatar`);
  }

  private putToStorage(url: string, file: File, onProgress?: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url);
      xhr.setRequestHeader('Content-Type', file.type);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            onProgress(Math.round((e.loaded / e.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(file);
    });
  }
}
