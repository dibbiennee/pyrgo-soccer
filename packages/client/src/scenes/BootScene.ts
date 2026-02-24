import Phaser from 'phaser';
import { CANVAS_W, CANVAS_H } from '../utils/responsive';
import { SoundManager } from '../audio/SoundManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;

    // Background
    this.add.rectangle(cx, cy, CANVAS_W, CANVAS_H, 0x0d0d1a);

    // Logo "PYRGO SOCCER" above the loading bar
    const logo = this.add.text(cx, cy - 80, 'PYRGO SOCCER', {
      fontSize: '40px',
      fontFamily: 'Arial Black, Arial',
      color: '#00ccff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);

    // Pulsing logo glow
    this.tweens.add({
      targets: logo,
      alpha: { from: 0.7, to: 1 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Progress bar
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222244, 0.8);
    progressBox.fillRoundedRect(cx - 200, cy - 14, 400, 28, 4);

    const progressBar = this.add.graphics();

    const loadingText = this.add.text(cx, cy + 30, 'Loading...', {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#888899',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ccff, 1);
      progressBar.fillRoundedRect(cx - 195, cy - 10, 390 * value, 20, 3);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
    });

    // Load sound preference
    SoundManager.getInstance().loadPreference();

    // Placeholder load to show loading bar
    for (let i = 0; i < 10; i++) {
      this.load.image(`placeholder_${i}`, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }
  }

  create(): void {
    // Fade into main menu
    this.cameras.main.fadeOut(400, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('MainMenu');
    });
  }
}
