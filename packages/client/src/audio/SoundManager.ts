/**
 * Procedural sound effects using Web Audio API — no external assets needed.
 */
export class SoundManager {
  private static instance: SoundManager;
  private ctx: AudioContext | null = null;
  private _enabled = true;

  static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  get enabled(): boolean { return this._enabled; }
  set enabled(val: boolean) {
    this._enabled = val;
    try { localStorage.setItem('pyrgo_sound', val ? '1' : '0'); } catch { /* noop */ }
  }

  /** Load saved preference from localStorage */
  loadPreference(): void {
    try {
      const saved = localStorage.getItem('pyrgo_sound');
      if (saved !== null) this._enabled = saved === '1';
    } catch { /* noop */ }
  }

  private getCtx(): AudioContext | null {
    if (!this._enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /** Kick sound: frequency sweep 200 → 80 Hz */
  kick(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Bounce / rimbalzo: quick tick at 400 Hz */
  bounce(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  /** Goal scored: arpeggio C-E-G */
  goal(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime + i * 0.12;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
      osc.start(t);
      osc.stop(t + 0.25);
    });
  }

  /** Super activation: ascending sweep */
  super(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(800, t + 0.3);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  }

  /** Countdown beep: short 880 Hz tone */
  countdown(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, t);
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Whistle: double tone (referee whistle) */
  whistle(): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    [0, 0.15].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime + delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      osc.start(t);
      osc.stop(t + 0.12);
    });
  }

  // ═══════════════════════════════════════════════════
  // NEW Phase 3 sounds
  // ═══════════════════════════════════════════════════

  /** Menu click: 600Hz sine, 50ms */
  menuClick(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  /** Scene transition whoosh: noise sweep, 300ms */
  sceneWhoosh(): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(500, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(4000, ctx.currentTime + 0.15);
    filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(ctx.currentTime);
    noise.stop(ctx.currentTime + 0.3);
  }

  /** VS dramatic hit: 80Hz sine + 200Hz triangle, 400ms */
  vsDramaticHit(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const t = ctx.currentTime;

    // Low bass
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(80, t);
    gain1.gain.setValueAtTime(0.3, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
    osc1.start(t);
    osc1.stop(t + 0.4);

    // Higher impact
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(200, t);
    gain2.gain.setValueAtTime(0.2, t);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc2.start(t);
    osc2.stop(t + 0.3);
  }

  /** Countdown beep (lower pitch for VS screen): 440Hz sine, 150ms */
  countdownBeep(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.start(t);
    osc.stop(t + 0.15);
  }

  /** Crowd cheer: noise burst with bandpass 2kHz, 800ms */
  crowdCheer(): void {
    const ctx = this.getCtx();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.8;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2000, ctx.currentTime);
    filter.Q.setValueAtTime(0.8, ctx.currentTime);

    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
    gain.gain.setValueAtTime(0.15, t + 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + 0.8);
  }

  /** Crowd ambient: brown noise loop at low volume. Returns stop function. */
  crowdAmbient(): (() => void) | null {
    const ctx = this.getCtx();
    if (!ctx) return null;

    // Brown noise via filtered white noise
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.06, ctx.currentTime);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();

    return () => {
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      setTimeout(() => { try { noise.stop(); } catch { /* already stopped */ } }, 350);
    };
  }

  /** Victory jingle: ascending arpeggio C-E-G-C, 600ms */
  victoryJingle(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime + i * 0.15;
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  /** Defeat sound: descending arpeggio G-E-C, 800ms */
  defeatSound(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const notes = [783.99, 659.25, 523.25]; // G5, E5, C5

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      const t = ctx.currentTime + i * 0.25;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  /** Creator click: 500Hz triangle, 30ms */
  creatorClick(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(500, t);
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    osc.start(t);
    osc.stop(t + 0.03);
  }

  // ═══════════════════════════════════════════════════
  // Phase 4 online sounds
  // ═══════════════════════════════════════════════════

  /** Notification ping: 800Hz sine, 100ms — opponent joined/ready */
  notificationPing(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.start(t);
    osc.stop(t + 0.1);
  }

  /** Warning buzz: 150Hz sawtooth, 200ms — disconnect warning */
  warningBuzz(): void {
    const ctx = this.getCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const t = ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, t);
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  /** Menu music loop: bass sine + pad triangle. Returns stop function. */
  menuLoop(): (() => void) | null {
    const ctx = this.getCtx();
    if (!ctx) return null;

    // Bass line — simple oscillating sine
    const bass = ctx.createOscillator();
    const bassGain = ctx.createGain();
    bass.connect(bassGain);
    bassGain.connect(ctx.destination);
    bass.type = 'sine';
    bass.frequency.setValueAtTime(110, ctx.currentTime);
    bassGain.gain.setValueAtTime(0.06, ctx.currentTime);
    bass.start();

    // Pad — triangle chord
    const pad = ctx.createOscillator();
    const padGain = ctx.createGain();
    pad.connect(padGain);
    padGain.connect(ctx.destination);
    pad.type = 'triangle';
    pad.frequency.setValueAtTime(220, ctx.currentTime);
    padGain.gain.setValueAtTime(0.03, ctx.currentTime);
    pad.start();

    // Slow LFO on bass frequency for movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.connect(lfoGain);
    lfoGain.connect(bass.frequency);
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.3, ctx.currentTime);
    lfoGain.gain.setValueAtTime(15, ctx.currentTime);
    lfo.start();

    return () => {
      const t = ctx.currentTime;
      bassGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      padGain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      setTimeout(() => {
        try { bass.stop(); pad.stop(); lfo.stop(); } catch { /* already stopped */ }
      }, 600);
    };
  }
}
