import { Component, ElementRef, HostListener, computed, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { SettingsService } from '../../../core/services/settings.service';
import { JiroIconComponent } from '../jiro-icon/jiro-icon';
import { JiroModalComponent } from '../jiro-modal/jiro-modal';
import { JiroFeedbackFormComponent } from '../jiro-feedback-form/jiro-feedback-form';

let menuSeq = 0;

/**
 * Avatar button that opens the account menu: Settings, Send feedback,
 * Dark mode, Log out. Used in the desktop sidebar footer (opens upward)
 * and the mobile top bar (opens downward). Keyboard: Enter/Space or
 * Arrow keys open, arrows move, Escape closes and returns focus, Tab leaves.
 */
@Component({
  selector: 'jiro-user-menu',
  standalone: true,
  imports: [RouterLink, JiroIconComponent, JiroModalComponent, JiroFeedbackFormComponent],
  template: `
    <div class="um" [class.um--up]="direction() === 'up'" [class.um--down]="direction() === 'down'" [class.um--compact]="compact()">
      <button
        #trigger
        type="button"
        class="um-trigger"
        aria-haspopup="menu"
        [attr.aria-expanded]="open()"
        [attr.aria-controls]="menuId"
        [attr.aria-label]="compact() ? 'Account menu for ' + name() : null"
        (click)="toggle()"
        (keydown)="onTriggerKeydown($event)">
        <span class="um-avatar" aria-hidden="true">
          @if (avatarUrl(); as url) {
            <img [src]="url" alt="" class="um-avatar-img">
          } @else {
            {{ initial() }}
          }
        </span>
        @if (!compact()) {
          <span class="um-name">{{ name() }}</span>
          <jiro-icon [name]="direction() === 'up' ? 'caret-up' : 'caret-down'" [size]="14" />
        }
      </button>

      @if (open()) {
        <div class="um-menu" role="menu" [id]="menuId" (keydown)="onMenuKeydown($event)">
          <div class="um-head">
            <span class="um-head-name">{{ name() }}</span>
            <span class="um-head-email">{{ email() }}</span>
          </div>
          <a role="menuitem" class="um-item" routerLink="/settings" (click)="close()">
            <jiro-icon name="gear" [size]="16" /> Settings
          </a>
          <button role="menuitem" class="um-item" type="button" (click)="openFeedback()">
            <jiro-icon name="chat-circle" [size]="16" /> Send feedback
          </button>
          <button role="menuitemcheckbox" class="um-item" type="button" [attr.aria-checked]="dark()" (click)="toggleDark()">
            <jiro-icon [name]="dark() ? 'sun' : 'moon'" [size]="16" /> Dark mode
            <span class="um-state">{{ dark() ? 'On' : 'Off' }}</span>
          </button>
          <button role="menuitem" class="um-item um-item--danger" type="button" (click)="logout()">
            <jiro-icon name="sign-out" [size]="16" /> Log out
          </button>
        </div>
      }
    </div>

    @if (feedbackOpen()) {
      <jiro-modal title="Send feedback" maxWidth="440px" (close)="feedbackOpen.set(false)">
        <jiro-feedback-form (sent)="feedbackOpen.set(false)" />
      </jiro-modal>
    }
  `,
  styles: [`
    :host { display: block; }
    .um { position: relative; }

    .um-trigger {
      display: flex;
      align-items: center;
      gap: var(--space-sm);
      width: 100%;
      padding: 6px 8px;
      border: none;
      border-radius: var(--border-radius);
      background: none;
      color: inherit;
      font: inherit;
      text-align: left;
      cursor: pointer;
      transition: background 0.15s;
    }
    .um-trigger:hover { background: rgba(128, 128, 128, 0.15); }
    .um-trigger:focus-visible { outline-color: currentColor; outline-offset: -2px; }
    .um--compact .um-trigger { width: auto; justify-content: center; padding: 4px; }

    .um-avatar {
      width: 32px;
      height: 32px;
      flex-shrink: 0;
      border-radius: 50%;
      background: var(--color-primary);
      color: var(--text-on-primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size-sm);
      font-weight: 600;
      overflow: hidden;
    }
    .um-avatar-img { width: 100%; height: 100%; object-fit: cover; }

    .um-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: var(--font-size-sm);
      font-weight: 500;
    }

    .um-menu {
      position: absolute;
      z-index: var(--z-dropdown);
      min-width: 240px;
      padding: var(--space-xs);
      background: var(--bg-surface);
      color: var(--text-primary);
      border: 1px solid var(--border-color);
      border-radius: var(--border-radius);
      box-shadow: var(--shadow-md);
    }
    .um--up .um-menu { bottom: calc(100% + 6px); left: 0; }
    .um--up.um--compact .um-menu { bottom: 0; left: calc(100% + 8px); }
    .um--down .um-menu { top: calc(100% + 6px); right: 0; }

    .um-head {
      display: flex;
      flex-direction: column;
      padding: var(--space-sm) var(--space-md);
      border-bottom: 1px solid var(--border-color);
      margin-bottom: var(--space-xs);
    }
    .um-head-name { font-size: var(--font-size-sm); font-weight: 600; }
    .um-head-email { font-size: var(--font-size-xs); color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; }

    .um-item {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 9px 12px;
      border: none;
      border-radius: var(--border-radius-sm);
      background: none;
      color: var(--text-primary);
      font: inherit;
      font-size: var(--font-size-sm);
      text-align: left;
      text-decoration: none;
      cursor: pointer;
    }
    .um-item:hover, .um-item:focus-visible { background: var(--bg-surface-hover); text-decoration: none; outline-offset: -2px; }
    .um-item--danger { color: var(--color-negative); }
    .um-state { margin-left: auto; font-size: var(--font-size-xs); color: var(--text-muted); }
  `]
})
export class JiroUserMenuComponent {
  direction = input<'up' | 'down'>('up');
  compact = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly auth = inject(AuthService);
  private readonly settings = inject(SettingsService);
  private readonly trigger = viewChild.required<ElementRef<HTMLButtonElement>>('trigger');

  readonly menuId = `jiro-user-menu-${++menuSeq}`;
  readonly open = signal(false);
  readonly feedbackOpen = signal(false);

  readonly name = computed(() => {
    const u = this.auth.user();
    return u?.display_name || u?.email || '';
  });
  readonly email = computed(() => this.auth.user()?.email ?? '');
  readonly avatarUrl = computed(() => this.auth.user()?.avatar_url ?? null);
  readonly initial = computed(() => (this.name()[0] ?? '?').toUpperCase());
  readonly dark = this.settings.darkMode;

  toggle() {
    this.open() ? this.close() : this.openMenu();
  }

  openMenu(focus: 'first' | 'last' = 'first') {
    this.open.set(true);
    // The menu renders on the next change detection; focus after it exists.
    setTimeout(() => {
      const items = this.items();
      items[focus === 'first' ? 0 : items.length - 1]?.focus();
    }, 0);
  }

  close(refocus = false) {
    if (!this.open()) return;
    this.open.set(false);
    if (refocus) this.trigger().nativeElement.focus();
  }

  onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') { event.preventDefault(); this.openMenu('first'); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); this.openMenu('last'); }
    else if (event.key === 'Escape' && this.open()) { event.preventDefault(); this.close(true); }
  }

  onMenuKeydown(event: KeyboardEvent) {
    const items = this.items();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const move = (i: number) => { event.preventDefault(); items[(i + items.length) % items.length]?.focus(); };
    switch (event.key) {
      case 'ArrowDown': move(index + 1); break;
      case 'ArrowUp': move(index - 1); break;
      case 'Home': move(0); break;
      case 'End': move(items.length - 1); break;
      case 'Escape': event.preventDefault(); this.close(true); break;
      case 'Tab': this.close(); break;
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.open()) return;
    if (this.host.nativeElement.contains(event.target as Node)) return;
    this.close();
  }

  toggleDark() {
    this.settings.toggleDarkMode();
  }

  openFeedback() {
    this.close();
    this.feedbackOpen.set(true);
  }

  logout() {
    this.close();
    this.auth.logout();
  }

  private items(): HTMLElement[] {
    return Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('[role="menuitem"], [role="menuitemcheckbox"]'));
  }
}
