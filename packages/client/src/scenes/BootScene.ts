import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import { SoundManager } from '../audio/SoundManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const width = GAME_WIDTH;
    const height = GAME_HEIGHT;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0d0d1a);

    // Logo "PYRGO SOCCER" above the loading bar
    const logo = this.add.text(width / 2, height / 2 - 70, 'PYRGO SOCCER', {
      fontSize: '42px',
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
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 12, 320, 24, 4);

    const progressBar = this.add.graphics();

    const loadingText = this.add.text(width / 2, height / 2 + 25, 'Loading...', {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#888899',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x00ccff, 1);
      progressBar.fillRoundedRect(width / 2 - 155, height / 2 - 8, 310 * value, 16, 3);
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
