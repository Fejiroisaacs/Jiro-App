import { Component, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService, UserSettings } from '../../core/services/auth.service';
import { SettingsService } from '../../core/services/settings.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, JiroCardComponent, JiroButtonComponent, JiroInputComponent],
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
          <div class="verified-badge" *ngIf="user.email_verified">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Verified
          </div>
          <div class="unverified-badge" *ngIf="!user.email_verified">
            Not verified
          </div>
        </div>
      </jiro-card>

      <!-- Profile -->
      <jiro-card class="settings-section">
        <h2>Profile</h2>

        <div class="profile-form">
          <div class="form-field">
            <label class="setting-label">Display Name</label>
            <p class="text-secondary setting-desc">How your name appears across the app</p>
            <jiro-input
              [(ngModel)]="displayName"
              placeholder="Your name"
              [style.margin-top]="'8px'">
            </jiro-input>
          </div>

          <div class="form-field">
            <label class="setting-label">Username</label>
            <p class="text-secondary setting-desc">Lowercase letters, numbers and underscores — used in share links</p>
            <jiro-input
              [(ngModel)]="username"
              [placeholder]="usernamePlaceholder"
              [style.margin-top]="'8px'">
            </jiro-input>
          </div>

          <div class="form-field">
            <label class="setting-label">Bio</label>
            <p class="text-secondary setting-desc">A short description about yourself</p>
            <textarea
              [(ngModel)]="bio"
              class="bio-textarea"
              rows="3"
              placeholder="Tell us a bit about yourself..."></textarea>
          </div>

          <div class="profile-actions">
            <jiro-button variant="primary" (click)="saveProfile()" [disabled]="profileSaving()">
              {{ profileSaving() ? 'Saving...' : 'Save Profile' }}
            </jiro-button>
            <span class="profile-error" *ngIf="profileError()">{{ profileError() }}</span>
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

        <!-- Dark mode toggle -->
        <div class="setting-row">
          <div>
            <label class="setting-label">Dark Mode</label>
            <p class="text-secondary setting-desc">Switch between light and dark interface</p>
          </div>
          <button class="dark-mode-toggle" [class.active]="settingsService.darkMode()" (click)="settingsService.toggleDarkMode()">
            <span class="toggle-track">
              <span class="toggle-thumb"></span>
            </span>
            <span>{{ settingsService.darkMode() ? 'On' : 'Off' }}</span>
          </button>
        </div>

        <p class="text-secondary" style="margin-top: var(--space-md);">Color theme</p>
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

    .verified-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: var(--font-size-xs);
      font-weight: 600;
      color: var(--color-accent);
      background: rgba(var(--color-accent-rgb, 74, 103, 65), 0.1);
      padding: 4px 10px;
      border-radius: 20px;
    }

    .unverified-badge {
      font-size: var(--font-size-xs);
      color: var(--text-secondary);
      background: var(--bg-surface-hover);
      padding: 4px 10px;
      border-radius: 20px;
    }

    .profile-form {
      display: flex;
      flex-direction: column;
      gap: var(--space-lg);
    }

    .form-field {
      display: flex;
      flex-direction: column;
    }

    .bio-textarea {
      margin-top: 8px;
      padding: 10px 12px;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      background: var(--bg-surface);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      resize: vertical;
      outline: none;
      transition: border-color 0.15s;
    }

    .bio-textarea:focus {
      border-color: var(--color-primary);
    }

    .profile-actions {
      display: flex;
      align-items: center;
      gap: var(--space-md);
    }

    .profile-error {
      font-size: var(--font-size-sm);
      color: var(--color-danger);
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

    .dark-mode-toggle {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      background: none;
      border: none;
      cursor: pointer;
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      font-family: inherit;
      padding: 0;
    }
    .toggle-track {
      position: relative;
      width: 40px;
      height: 22px;
      background: var(--border-color);
      border-radius: 11px;
      transition: background 0.2s;
      display: block;
    }
    .dark-mode-toggle.active .toggle-track {
      background: var(--color-primary);
    }
    .toggle-thumb {
      position: absolute;
      top: 3px;
      left: 3px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: white;
      transition: transform 0.2s;
      display: block;
    }
    .dark-mode-toggle.active .toggle-thumb {
      transform: translateX(18px);
    }
  `]
})
export class SettingsComponent implements OnInit {
  settings = signal<UserSettings>({});
  saved = signal(false);
  weightUnit = 'lbs';
  timezone = 'America/New_York';

  // Profile fields
  displayName = '';
  username = '';
  bio = '';
  usernamePlaceholder = 'e.g. myusername';
  profileSaving = signal(false);
  profileError = signal<string | null>(null);

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

  constructor(public authService: AuthService, public settingsService: SettingsService) {}

  ngOnInit() {
    const user = this.authService.user();
    if (user?.settings) {
      const s = typeof user.settings === 'string' ? JSON.parse(user.settings) : user.settings;
      this.settings.set(s);
      this.weightUnit = s.weight_unit || 'lbs';
      this.timezone = s.timezone || 'America/New_York';
    }
    if (user) {
      this.displayName = user.display_name ?? '';
      this.username = user.username ?? '';
      this.bio = user.bio ?? '';
      this.usernamePlaceholder = user.email.split('@')[0];
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

  saveProfile() {
    this.profileSaving.set(true);
    this.profileError.set(null);

    const payload: { username?: string; display_name?: string; bio?: string } = {};
    if (this.username.trim()) payload.username = this.username.trim().toLowerCase();
    if (this.displayName.trim()) payload.display_name = this.displayName.trim();
    payload.bio = this.bio.trim();

    this.authService.updateProfile(payload).subscribe({
      next: () => {
        this.profileSaving.set(false);
        this.saved.set(true);
        setTimeout(() => this.saved.set(false), 2000);
      },
      error: (err) => {
        this.profileSaving.set(false);
        const msg = err?.error?.error?.message ?? 'Failed to save profile';
        this.profileError.set(msg);
      },
    });
  }
}
