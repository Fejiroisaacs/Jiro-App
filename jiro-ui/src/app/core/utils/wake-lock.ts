/** The subset of the Screen Wake Lock API we use; it is not in every lib.dom. */
interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
}

/**
 * Keeps the screen on while held. Absent in Firefox, rejected on low battery, and iOS only has it from
 * Safari 16.4, so every failure is swallowed: no wake lock is a dimmer screen, not a broken page.
 * Browsers drop the lock whenever the tab hides, so it asks again when the tab comes back.
 */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinelLike | null = null;
  private held = false;

  hold() {
    if (this.held) return;
    this.held = true;
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    void this.request();
  }

  release() {
    if (!this.held) return;
    this.held = false;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    const s = this.sentinel;
    this.sentinel = null;
    s?.release().catch(() => { /* already gone */ });
  }

  private async request() {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    try {
      const s = await nav.wakeLock.request('screen');
      // Released while the request was pending.
      if (this.held) this.sentinel = s; else void s.release();
    } catch {
      this.sentinel = null;
    }
  }

  private readonly onVisibilityChange = () => {
    if (document.visibilityState === 'visible' && this.held && (!this.sentinel || this.sentinel.released)) {
      void this.request();
    }
  };
}
