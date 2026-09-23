import { Injectable, signal } from '@angular/core';

/** Open/closed state of the global search palette (Ctrl/Cmd+K). */
@Injectable({ providedIn: 'root' })
export class SearchPaletteService {
  private readonly _open = signal(false);
  readonly open = this._open.asReadonly();

  openPalette() { this._open.set(true); }
  close() { this._open.set(false); }
  toggle() { this._open.update(v => !v); }
}
