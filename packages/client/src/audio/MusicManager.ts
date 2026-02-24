/**
 * Background music manager using HTML5 Audio API.
 * Plays 6 MP3 songs in sequence, with volume control for gameplay mode.
 */
const SONG_COUNT = 6;
const SONG_NAMES = [
  'Ela É Sensacional',
  'Eu quero que tu me leva',
  'GOZALO',
  'Pique do Ombrinho',
  'Treme o Bumbum',
  'TUCA TUCADA',
];

const BASE_VOLUME = 0.4;
const GAMEPLAY_VOLUME_RATIO = 0.3; // effective: 0.12 during gameplay

export class MusicManager {
  private static instance: MusicManager;

  private audio: HTMLAudioElement | null = null;
  private currentIndex = 0;
  private started = false;
  private gameplayMode = false;
  private enabled = true;
  private duckInterval: ReturnType<typeof setInterval> | null = null;

  static getInstance(): MusicManager {
    if (!MusicManager.instance) {
      MusicManager.instance = new MusicManager();
    }
    return MusicManager.instance;
  }

  /** Start music playback from a random song. Idempotent after first call. */
  start(): void {
    if (this.started) return;
    this.started = true;
    this.currentIndex = Math.floor(Math.random() * SONG_COUNT);
    this.playCurrent();
  }

  /** Switch to a specific song by index. */
  switchTo(index: number): void {
    this.currentIndex = ((index % SONG_COUNT) + SONG_COUNT) % SONG_COUNT;
    this.playCurrent();
  }

  /** Toggle between menu volume and lower gameplay volume. */
  setGameplayMode(active: boolean): void {
    this.gameplayMode = active;
    this.updateVolume();
  }

  /** Respond to sound toggle from settings. */
  onSoundToggle(soundEnabled: boolean): void {
    this.enabled = soundEnabled;
    if (!this.audio) return;
    if (soundEnabled) {
      this.updateVolume();
      if (this.audio.paused && this.started) {
        this.audio.play().catch(() => {});
      }
    } else {
      this.audio.pause();
    }
  }

  /** Play a one-shot MP3 sound effect (e.g. super move SFX). */
  playEffect(url: string): void {
    if (!this.enabled) return;
    const sfx = new Audio(url);
    sfx.volume = BASE_VOLUME;
    sfx.play().catch(() => {});
  }

  getCurrentIndex(): number {
    return this.currentIndex;
  }

  getCurrentName(): string {
    return SONG_NAMES[this.currentIndex] ?? `Song ${this.currentIndex + 1}`;
  }

  getSongCount(): number {
    return SONG_COUNT;
  }

  private playCurrent(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.removeEventListener('ended', this.onEnded);
    }

    this.audio = new Audio(`/music/song${this.currentIndex + 1}.mp3`);
    this.updateVolume();
    this.audio.addEventListener('ended', this.onEnded);

    if (this.enabled) {
      this.audio.play().catch(() => {});
    }
  }

  private onEnded = (): void => {
    this.currentIndex = (this.currentIndex + 1) % SONG_COUNT;
    this.playCurrent();
  };

  /** Duck music to 10% volume in ~200ms for super move activation. */
  duckForSuper(): void {
    if (!this.audio || !this.enabled) return;
    this.clearDuckInterval();
    const target = BASE_VOLUME * 0.1;
    const current = this.audio.volume;
    const steps = 12; // ~200ms at 60fps
    const decrement = (current - target) / steps;
    let count = 0;
    this.duckInterval = setInterval(() => {
      count++;
      if (!this.audio) { this.clearDuckInterval(); return; }
      this.audio.volume = Math.max(target, current - decrement * count);
      if (count >= steps) this.clearDuckInterval();
    }, 16);
  }

  /** Restore music volume in ~500ms after super move ends. */
  unduckAfterSuper(): void {
    if (!this.audio || !this.enabled) return;
    this.clearDuckInterval();
    const target = this.gameplayMode ? BASE_VOLUME * GAMEPLAY_VOLUME_RATIO : BASE_VOLUME;
    const current = this.audio.volume;
    const steps = 30; // ~500ms at 60fps
    const increment = (target - current) / steps;
    let count = 0;
    this.duckInterval = setInterval(() => {
      count++;
      if (!this.audio) { this.clearDuckInterval(); return; }
      this.audio.volume = Math.min(target, current + increment * count);
      if (count >= steps) this.clearDuckInterval();
    }, 16);
  }

  private clearDuckInterval(): void {
    if (this.duckInterval) {
      clearInterval(this.duckInterval);
      this.duckInterval = null;
    }
  }

  private updateVolume(): void {
    if (!this.audio) return;
    this.clearDuckInterval();
    this.audio.volume = this.gameplayMode
      ? BASE_VOLUME * GAMEPLAY_VOLUME_RATIO
      : BASE_VOLUME;
  }
}
