import { Injectable, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

/**
 * Sets the document title from the route's `title` ("Transactions · Jiro")
 * and exposes the bare page title so the mobile top bar can show it.
 */
@Injectable({ providedIn: 'root' })
export class JiroTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  readonly current = signal('');

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const page = this.buildTitle(snapshot) ?? '';
    this.current.set(page);
    this.title.setTitle(page ? `${page} · Jiro` : 'Jiro');
  }
}
