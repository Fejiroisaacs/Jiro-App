import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';

const KG_TO_LBS = 2.20462;

/** Colour themes that ship. Anything else stored on the user falls back to earth. */
export const THEMES = ['earth', 'forest', 'slate'] as const;
export type Theme = (typeof THEMES)[number];

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private auth = inject(AuthService);

  private parsedSettings = computed(() => {
    const s = this.auth.user()?.settings;
    return ((typeof s === 'string' ? JSON.parse(s) : s) ?? {}) as Record<string, unknown>;
  });

  weightUnit = computed<string>(() => (this.parsedSettings()['weight_unit'] as string | undefined) ?? 'lbs');
  theme = computed<Theme>(() => {
    const stored = this.parsedSettings()['theme'] as string;
    return (THEMES as readonly string[]).includes(stored) ? (stored as Theme) : 'earth';
  });

  /** The raw stored dashboard layout. Unvalidated: read it through resolveLayout(). */
  dashboard = computed<unknown>(() => this.parsedSettings()['dashboard']);

  // Dark mode is stored in localStorage — works without a round-trip and persists across sessions
  private _darkMode = signal<boolean>(
    typeof localStorage !== 'undefined' && localStorage.getItem('jiro_dark') === '1'
  );
  darkMode = this._darkMode.asReadonly();

  toggleDarkMode() {
    const next = !this._darkMode();
    this._darkMode.set(next);
    localStorage.setItem('jiro_dark', next ? '1' : '0');
  }

  /** Convert a stored kg value to the user's preferred display unit. */
  toDisplay(kg: number): number {
    return this.weightUnit() === 'lbs'
      ? Math.round(kg * KG_TO_LBS * 10) / 10
      : kg;
  }

  /** Convert a user-entered value in the preferred unit back to kg for storage. */
  toKg(value: number): number {
    return this.weightUnit() === 'lbs' ? value / KG_TO_LBS : value;
  }

  unitLabel(): string {
    return this.weightUnit();
  }
}
