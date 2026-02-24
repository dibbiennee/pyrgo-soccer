import Phaser from 'phaser';
import { LayoutManager } from '../utils/LayoutManager';
import { SoundManager } from '../audio/SoundManager';
import { THEME, drawGradientBackground } from '../ui/UITheme';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    const L = new LayoutManager(this);

    // Background
    drawGradientBackground(this);

    // Logo "PYRGO SOCCER" above the loading bar
    const logo = this.add.text(L.cx, L.cy - L.unit(0.15), 'PYRGO SOCCER', {
      fontSize: L.fontSize('title'),
      fontFamily: 'Arial Black, Arial',
      color: THEME.primaryHex,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5);
    logo.setShadow(0, 0, '#00d4ff80', 20);

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
    const barWidth = L.w * 0.5;
    const barHeight = L.unit(0.04);

    const progressBox = this.add.graphics();
    progressBox.fillStyle(THEME.cardBg, 0.8);
    progressBox.fillRoundedRect(L.cx - barWidth / 2, L.cy - barHeight / 2, barWidth, barHeight, 4);

    const progressBar = this.add.graphics();

    const loadingText = this.add.text(L.cx, L.cy + L.unit(0.06), 'Loading...', {
      fontSize: L.fontSize('small'),
      fontFamily: 'Arial',
      color: THEME.textSecondary,
    }).setOrigin(0.5);

    const innerPad = barWidth * 0.0125;
    const innerWidth = barWidth - innerPad * 2;
    const innerHeight = barHeight - innerPad * 2;

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(THEME.primary, 1);
      progressBar.fillRoundedRect(
        L.cx - barWidth / 2 + innerPad,
        L.cy - barHeight / 2 + innerPad,
        innerWidth * value,
        innerHeight,
        3,
      );
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
