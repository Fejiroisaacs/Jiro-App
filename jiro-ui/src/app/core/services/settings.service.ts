import { Injectable, computed, inject } from '@angular/core';
import { AuthService } from './auth.service';

const KG_TO_LBS = 2.20462;

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private auth = inject(AuthService);

  private parsedSettings = computed(() => {
    const s = this.auth.user()?.settings;
    return ((typeof s === 'string' ? JSON.parse(s) : s) ?? {}) as Record<string, string>;
  });

  weightUnit = computed<string>(() => this.parsedSettings()['weight_unit'] ?? 'kg');
  theme = computed<string>(() => this.parsedSettings()['theme'] ?? 'earth');

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
