import { Component, inject, signal, OnInit } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AuthService, UserSettings } from '../../core/services/auth.service';
import { SettingsService, Theme } from '../../core/services/settings.service';
import { UploadService } from '../../core/services/upload.service';
import { JiroCardComponent } from '../../shared/components/jiro-card/jiro-card';
import { JiroButtonComponent } from '../../shared/components/jiro-button/jiro-button';
import { JiroInputComponent } from '../../shared/components/jiro-input/jiro-input';
import { JiroPageHeaderComponent } from '../../shared/components/jiro-page-header/jiro-page-header';
import { ToastService } from '../../core/services/toast.service';
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, JiroCardComponent, JiroButtonComponent, JiroInputComponent, JiroPageHeaderComponent],
  template: `
    <div class="settings">
      <jiro-page-header heading="Settings" subtitle="Account, profile, preferences and theme" />

      <!-- Account -->
      <jiro-card class="settings-section">
        <h2>Account</h2>
        @if (authService.user(); as user) {
<div class="setting-row">
          <div>
            <label class="setting-label">Email</label>
            <p class="text-secondary">{{ user.email }}</p>
          </div>
          @if (user.email_verified) {
<div class="verified-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Verified
          </div>
}
          @if (!user.email_verified) {
<div class="unverified-badge">
            Not verified
          </div>
}
        </div>
}
      </jiro-card>

      <!-- Profile -->
      <jiro-card class="settings-section">
        <h2>Profile</h2>

        <!-- Avatar -->
        <div class="avatar-row">
          <div class="avatar-preview">
            @if (authService.user()?.avatar_url) {
<img [src]="authService.user()!.avatar_url" alt="Avatar" class="avatar-img">
}
            @if (!authService.user()?.avatar_url) {
<div class="avatar-placeholder">
              {{ (authService.user()?.display_name || authService.user()?.email || '?')[0].toUpperCase() }}
            </div>
}
          </div>
          <div class="avatar-actions">
            <label class="avatar-upload-btn">
              <input type="file" accept="image/jpeg,image/png,image/webp" (change)="onAvatarFileChange($event)" style="display:none">
              {{ avatarUploading() ? (avatarProgress() + '%') : 'Upload photo' }}
            </label>
            @if (authService.user()?.avatar_url) {
<button class="avatar-remove-btn" (click)="removeAvatar()">Remove</button>
}
          </div>
          @if (avatarError()) {
<span class="profile-error">{{ avatarError() }}</span>
}
        </div>

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
            @if (profileError()) {
<span class="profile-error">{{ profileError() }}</span>
}
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
            @for (tz of commonTimezones; track tz) {
<option [value]="tz">{{ tz }}</option>
}
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
          @for (t of themes; track t) {
<button
           
            class="theme-option"
            [class.selected]="settings().theme === t.value"
            (click)="selectTheme(t.value)">
            <div class="theme-swatch" [style.background]="t.color"></div>
            <span>{{ t.label }}</span>
          </button>
}
        </div>
      </jiro-card>

    </div>
  `,
  styles: [`
    .settings {
      max-width: 640px;
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
    }

    .jiro-select:focus {
      border-color: var(--color-primary);
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

    /* Avatar */
    .avatar-row {
      display: flex;
      align-items: center;
      gap: var(--space-lg);
      padding-bottom: var(--space-lg);
      margin-bottom: var(--space-lg);
      border-bottom: 1px solid var(--border-color);
      flex-wrap: wrap;
    }

    .avatar-preview {
      flex-shrink: 0;
      width: 72px;
      height: 72px;
      border-radius: 50%;
      overflow: hidden;
    }

    .avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .avatar-placeholder {
      width: 100%;
      height: 100%;
      background: var(--color-primary);
      color: var(--text-on-primary);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 700;
    }

    .avatar-actions {
      display: flex;
      flex-direction: column;
      gap: var(--space-sm);
    }

    .avatar-upload-btn {
      display: inline-block;
      padding: 7px 16px;
      background: var(--color-primary);
      color: var(--text-on-primary);
      border-radius: var(--border-radius);
      font-size: var(--font-size-sm);
      font-weight: 500;
      cursor: pointer;
      transition: opacity 0.15s;
      text-align: center;
      min-width: 110px;
    }

    .avatar-upload-btn:hover { opacity: 0.88; }

    .avatar-remove-btn {
      background: none;
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
      padding: 6px 16px;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s, color 0.15s;
    }

    .avatar-remove-btn:hover {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
  `]
})
export class SettingsComponent implements OnInit {
  settings = signal<UserSettings>({});
  private readonly toast = inject(ToastService);
  weightUnit = 'lbs';
  timezone = 'America/New_York';

  // Profile fields
  displayName = '';
  username = '';
  bio = '';
  usernamePlaceholder = 'e.g. myusername';
  profileSaving = signal(false);
  profileError = signal<string | null>(null);
  avatarUploading = signal(false);
  avatarProgress = signal(0);
  avatarError = signal<string | null>(null);

  // Swatches show each theme's primary colour.
  themes: { value: Theme; label: string; color: string }[] = [
    { value: 'earth', label: 'Earth', color: '#6E3128' },
    { value: 'forest', label: 'Forest', color: '#4A6741' },
    { value: 'slate', label: 'Slate', color: '#475B70' },
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

  constructor(public authService: AuthService, public settingsService: SettingsService, private uploadService: UploadService) {}

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
        this.toast.success('Settings saved');
      },
    });
  }

  onAvatarFileChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      this.avatarError.set('Please select a JPEG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.avatarError.set('Image must be under 5 MB.');
      return;
    }

    this.avatarError.set(null);
    this.avatarUploading.set(true);
    this.avatarProgress.set(0);

    this.uploadService.uploadAvatar(file, pct => this.avatarProgress.set(pct)).subscribe({
      next: (avatarUrl) => {
        this.authService.updateAvatar(avatarUrl);
        this.avatarUploading.set(false);
        this.avatarProgress.set(0);
      },
      error: () => {
        this.avatarError.set('Upload failed. Please try again.');
        this.avatarUploading.set(false);
      },
    });
  }

  removeAvatar() {
    this.uploadService.deleteAvatar().subscribe({
      next: () => this.authService.clearAvatar(),
      error: () => this.avatarError.set('Failed to remove avatar.'),
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
        this.toast.success('Profile saved');
      },
      error: (err) => {
        this.profileSaving.set(false);
        const msg = err?.error?.error?.message ?? 'Failed to save profile';
        this.profileError.set(msg);
      },
    });
  }
}
