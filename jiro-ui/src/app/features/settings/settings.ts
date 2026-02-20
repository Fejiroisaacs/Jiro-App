import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserSettings } from '../../core/services/auth.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent],
  template: `
    <div class="settings">
      <h1>Settings</h1>

      <!-- Account -->
      <jiro-card class="settings-section">
        <h2>Account</h2>
        <div class="setting-row" *ngIf="authService.user() as user">
          <div>
            <label class="setting-label">Email</label>
            <p class="text-secondary">{{ user.email }}</p>
          </div>
        </div>
      </jiro-card>

      <!-- Preferences -->
      <jiro-card class="settings-section">
        <h2>Preferences</h2>

        <div class="setting-row">
          <div>
            <label class="setting-label">Weight Unit</label>
            <p class="text-secondary setting-desc">Used across all fitness tracking</p>
          </div>
          <select [(ngModel)]="weightUnit" (change)="save()" class="jiro-select">
            <option value="lbs">Pounds (lbs)</option>
            <option value="kg">Kilograms (kg)</option>
          </select>
        </div>

        <div class="setting-row">
          <div>
            <label class="setting-label">Timezone</label>
            <p class="text-secondary setting-desc">Used for reminder scheduling</p>
          </div>
          <select [(ngModel)]="timezone" (change)="save()" class="jiro-select">
            <option *ngFor="let tz of commonTimezones" [value]="tz">{{ tz }}</option>
          </select>
        </div>
      </jiro-card>

      <!-- Theme -->
      <jiro-card class="settings-section">
        <h2>Theme</h2>
        <p class="text-secondary">Choose your visual theme</p>
        <div class="theme-grid">
          <button
            *ngFor="let t of themes"
            class="theme-option"
            [class.selected]="settings().theme === t.value"
            (click)="selectTheme(t.value)">
            <div class="theme-swatch" [style.background]="t.color"></div>
            <span>{{ t.label }}</span>
          </button>
        </div>
      </jiro-card>

      <div class="save-status" *ngIf="saved()">
        Settings saved
      </div>
    </div>
  `,
  styles: [`
    .settings {
      max-width: 640px;
    }

    .settings h1 {
      font-size: var(--font-size-2xl);
      font-weight: 700;
      margin-bottom: var(--space-xl);
    }

    .settings-section {
      margin: var(--space-2xl);
    }

    .settings-section h2 {
      font-size: var(--font-size-lg);
      font-weight: 600;
      margin-bottom: var(--space-xs);
    }

    .theme-grid {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      margin-top: var(--space-md);
    }

    .theme-option {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-sm);
      padding: var(--space-md);
      border: 2px solid var(--border-color);
      border-radius: var(--border-radius);
      background: none;
      cursor: pointer;
      transition: border-color 0.2s;
      min-width: 80px;
      font-size: var(--font-size-sm);
      color: var(--text-primary);
    }

    .theme-option.selected {
      border-color: var(--color-primary);
    }

    .theme-option:hover {
      border-color: var(--color-primary);
    }

    .theme-swatch {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }

    .setting-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: var(--space-md) 0;
      border-bottom: 1px solid var(--border-color);
    }

    .setting-row:last-child {
      border-bottom: none;
    }

    .setting-label {
      font-weight: 500;
      font-size: var(--font-size-md);
    }

    .setting-desc {
      font-size: var(--font-size-sm);
      margin-top: 2px;
    }

    .jiro-select {
      padding: 8px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      cursor: pointer;
      outline: none;
    }

    .jiro-select:focus {
      border-color: var(--color-primary);
    }

    .save-status {
      position: fixed;
      bottom: var(--space-lg);
      right: var(--space-lg);
      background: var(--color-accent);
      color: white;
      padding: var(--space-sm) var(--space-lg);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      box-shadow: var(--shadow-md);
      animation: fadeIn 0.2s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})
export class SettingsComponent implements OnInit {
  settings = signal<UserSettings>({});
  saved = signal(false);
  weightUnit = 'lbs';
  timezone = 'America/New_York';

  themes = [
    { value: 'earth', label: 'Earth', color: '#5C4033' },
    { value: 'clay', label: 'Clay', color: '#C4956A' },
    { value: 'sand', label: 'Sand', color: '#D4C5A9' },
    { value: 'forest', label: 'Forest', color: '#4A6741' },
    { value: 'royal-blue', label: 'Royal Blue', color: '#2B55CC' },
    { value: 'midnight', label: 'Midnight', color: '#1A2B4A' },
    { value: 'crimson', label: 'Crimson', color: '#A32020' },
    { value: 'plum', label: 'Plum', color: '#6B3585' },
    { value: 'sage', label: 'Sage', color: '#5A7A65' },
    { value: 'slate', label: 'Slate', color: '#475B70' },
    { value: 'rust', label: 'Rust', color: '#A0422A' },
  ];

  commonTimezones = [
    'America/New_York',
    'America/Chicago',
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'Europe/London',
    'Europe/Berlin',
    'Europe/Paris',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Australia/Sydney',
    'Pacific/Auckland',
  ];

  constructor(public authService: AuthService) {}

  ngOnInit() {
    const user = this.authService.user();
    if (user?.settings) {
      const s = typeof user.settings === 'string' ? JSON.parse(user.settings) : user.settings;
      this.settings.set(s);
      this.weightUnit = s.weight_unit || 'lbs';
      this.timezone = s.timezone || 'America/New_York';
    }
  }

  selectTheme(theme: string) {
    this.settings.update(s => ({ ...s, theme }));
    this.save();
  }

  save() {
    const updates: Partial<UserSettings> = {
      theme: this.settings().theme,
      weight_unit: this.weightUnit,
      timezone: this.timezone,
    };

    this.authService.updateSettings(updates).subscribe({
      next: () => {
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
      },
    });
  }
}
