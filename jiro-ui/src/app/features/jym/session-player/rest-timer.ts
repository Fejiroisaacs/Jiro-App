import { signal } from '@angular/core';

/**
 * The rest between sets: `length` is this rest (+30s grows it). It counts from its start time, so it stays right
 * after a locked screen, and beeps and vibrates when done, then hides after 3 s.
 */
export class RestTimer {
  readonly active = signal(false);
  readonly remaining = signal(0);
  readonly length = signal(90);
  readonly done = signal(false);

  private interval: ReturnType<typeof setInterval> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private startedAt: Date | null = null;
  private audioCtx: AudioContext | null = null;

  start(seconds: number) {
    this.clear();
    this.warmUpAudio();
    this.startedAt = new Date();
    this.length.set(seconds);
    this.remaining.set(seconds);
    this.done.set(false);
    this.active.set(true);
    // Tick at 500ms so the display snaps quickly after screen unlock
    this.interval = setInterval(() => this.tick(), 500);
  }

  /** Re-reads the clock; called by the interval and when the screen comes back. */
  tick() {
    if (!this.startedAt) return;
    const elapsed = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
    const rem = Math.max(0, this.length() - elapsed);
    this.remaining.set(rem);
    if (rem <= 0 && !this.done()) {
      this.clear();
      this.done.set(true);
      this.playBeep();
      // Kept so a rest started in these 3 s isn't hidden by the old one.
      this.hideTimer = setTimeout(() => {
        this.hideTimer = null;
        this.active.set(false);
        this.done.set(false);
      }, 3000);
    }
  }

  skip() {
    this.clear();
    this.active.set(false);
    this.done.set(false);
  }

  /** Lengthens this rest only; after the beep it starts a fresh rest of that length. */
  add(seconds: number) {
    if (this.done()) {
      this.start(seconds);
    } else {
      this.length.update(d => d + seconds);
      this.remaining.update(r => r + seconds);
    }
  }

  display(): string {
    const s = this.remaining();
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** Stops the timers; the player calls it when it goes away. */
  clear() {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.startedAt = null;
  }

  // Call during a user gesture so the AudioContext is created/unlocked while
  // the browser permits it — avoids the "play blocked, no user gesture" error
  // that fires when we try to create one from the timer callback.
  warmUpAudio() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      // Unlock immediately if it was suspended (happens after screen lock)
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    } catch (_) {}
  }

  private playBeep() {
    // Vibrate: short-pause-short-pause-long (works even with silent mode on Android)
    try { navigator.vibrate?.([150, 80, 150, 80, 400]); } catch (_) {}

    // Audio ping: three ascending tones using the pre-warmed context
    try {
      const ctx = this.audioCtx;
      if (!ctx) return;
      // resume() is async — schedule tones only after the context is running
      const play = () => {
        const tones = [660, 880, 1100];
        tones.forEach((freq, i) => {
          const offset = i * 0.22;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.4, ctx.currentTime + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.3);
          osc.start(ctx.currentTime + offset);
          osc.stop(ctx.currentTime + offset + 0.35);
        });
      };
      if (ctx.state === 'suspended') {
        ctx.resume().then(play);
      } else {
        play();
      }
    } catch (_) { /* audio not supported */ }
  }
}
