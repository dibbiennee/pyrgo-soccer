import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { setupResponsiveCamera } from '../utils/responsive';

declare const __APP_VERSION__: string;

export class MainMenuScene extends Phaser.Scene {
  private stopMenuMusic: (() => void) | null = null;
  private settingsElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('MainMenu');
  }

  create(): void {
    setupResponsiveCamera(this);
    fadeIn(this);

    // ── Background ──────────────────────────────────
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0d0d1a);

    // Stylised field gradient (bottom half)
    const fieldGfx = this.add.graphics();
    fieldGfx.fillStyle(0x0a2a15, 1);
    fieldGfx.fillRect(0, GAME_HEIGHT * 0.6, GAME_WIDTH, GAME_HEIGHT * 0.4);
    fieldGfx.fillStyle(0x0c3318, 0.5);
    fieldGfx.fillRect(0, GAME_HEIGHT * 0.6, GAME_WIDTH, 2);

    // Field markings (subtle)
    const markGfx = this.add.graphics();
    markGfx.lineStyle(1, 0xffffff, 0.08);
    markGfx.lineBetween(GAME_WIDTH / 2, GAME_HEIGHT * 0.65, GAME_WIDTH / 2, GAME_HEIGHT);
    markGfx.strokeCircle(GAME_WIDTH / 2, GAME_HEIGHT * 0.82, 40);

    // Floating particles (star-like)
    for (let i = 0; i < 20; i++) {
      const px = Math.random() * GAME_WIDTH;
      const py = Math.random() * GAME_HEIGHT * 0.55;
      const size = 1 + Math.random() * 2;
      const p = this.add.arc(px, py, size, 0, 360, false, 0x00ccff, 0.15 + Math.random() * 0.3);
      this.tweens.add({
        targets: p,
        y: py - 15 - Math.random() * 20,
        x: px + (Math.random() - 0.5) * 30,
        alpha: 0,
        duration: 3000 + Math.random() * 4000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 3000,
      });
    }

    // ── Logo ────────────────────────────────────────
    const title = this.add.text(GAME_WIDTH / 2, 75, 'PYRGO SOCCER', {
      fontSize: '48px',
      fontFamily: 'Arial Black, Arial',
      color: '#00ccff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScale(0);

    // Scale-in with Back.easeOut
    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 800,
      ease: 'Back.easeOut',
    });

    // Pulsing glow effect on title
    this.tweens.add({
      targets: title,
      alpha: { from: 0.85, to: 1 },
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 800,
    });

    // Subtitle
    const subtitle = this.add.text(GAME_WIDTH / 2, 120, 'Head Soccer Battle!', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      duration: 600,
      delay: 500,
    });

    // Bouncing ball decoration
    const ball = this.add.arc(GAME_WIDTH / 2, 190, 12, 0, 360, false, 0xffffff);
    ball.setStrokeStyle(2, 0x333333);
    this.tweens.add({
      targets: ball,
      y: 175,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Buttons ─────────────────────────────────────
    const leftX = GAME_WIDTH / 2 - 120;
    const rightX = GAME_WIDTH / 2 + 120;

    // Left column (play modes)
    createButton(this, leftX, 230, 'VS CPU', () => {
      transitionTo(this, 'CharSelect', { mode: 'cpu' });
    }, { width: 220, height: 44 });

    createButton(this, leftX, 280, 'LOCAL MATCH', () => {
      transitionTo(this, 'CharSelect', { mode: 'local' });
    }, { width: 220, height: 44 });

    createButton(this, leftX, 330, 'ONLINE MATCH', () => {
      transitionTo(this, 'CharSelect', { mode: 'online' });
    }, { width: 220, height: 44 });

    // Right column (character + community + how to play)
    createButton(this, rightX, 230, 'CREATE PLAYER', () => {
      transitionTo(this, 'CharacterCreator', { returnTo: 'MainMenu' });
    }, { width: 220, height: 44 });

    createButton(this, rightX, 280, 'COMMUNITY', () => {
      transitionTo(this, 'CommunityGallery');
    }, { width: 220, height: 44 });

    createButton(this, rightX, 330, 'HOW TO PLAY', () => {
      transitionTo(this, 'HowToPlay');
    }, { width: 220, height: 44 });

    // ── Gear icon (Settings) — top right ────────────
    const gearText = this.add.text(GAME_WIDTH - 30, 20, '\u2699', {
      fontSize: '28px', fontFamily: 'Arial', color: '#666688',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    gearText.on('pointerover', () => gearText.setColor('#00ccff'));
    gearText.on('pointerout', () => gearText.setColor('#666688'));
    gearText.on('pointerdown', () => {
      SoundManager.getInstance().menuClick();
      this.showSettings();
    });

    // ── Version/Credits ─────────────────────────────
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 12, `v${version}  |  PYRGO GAMES`, {
      fontSize: '10px',
      fontFamily: 'Arial',
      color: '#444466',
    }).setOrigin(0.5, 1);

    // ── Menu music ──────────────────────────────────
    this.stopMenuMusic = SoundManager.getInstance().menuLoop();
    SoundManager.getInstance().sceneWhoosh();
  }

  private showSettings(): void {
    // Destroy any existing settings
    this.destroySettings();

    const overlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.85)
      .setDepth(50).setInteractive();

    const titleText = this.add.text(GAME_WIDTH / 2, 70, 'SETTINGS', {
      fontSize: '32px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(51);

    // Sound toggle
    const sm = SoundManager.getInstance();
    const soundBtn = this.add.text(GAME_WIDTH / 2, 150, `Sound: ${sm.enabled ? 'ON' : 'OFF'}`, {
      fontSize: '20px', fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });

    soundBtn.on('pointerdown', () => {
      sm.enabled = !sm.enabled;
      this.game.registry.set('soundOn', sm.enabled);
      soundBtn.setText(`Sound: ${sm.enabled ? 'ON' : 'OFF'}`);
      if (sm.enabled) {
        sm.menuClick();
        this.stopMenuMusic = sm.menuLoop();
      } else if (this.stopMenuMusic) {
        this.stopMenuMusic();
        this.stopMenuMusic = null;
      }
    });

    // Version display
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    const versionText = this.add.text(GAME_WIDTH / 2, 200, `Version: ${version}`, {
      fontSize: '14px', fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5).setDepth(51);

    // Reset Data button
    const resetBtn = createButton(this, GAME_WIDTH / 2, 250, 'RESET DATA', () => {
      this.showResetConfirm();
    }, { width: 180, height: 36, depth: 52, fillColor: 0x994444, strokeColor: 0xff4444 });

    // Credits button
    const creditsBtn = createButton(this, GAME_WIDTH / 2, 300, 'CREDITS', () => {
      this.destroySettings();
      transitionTo(this, 'Credits');
    }, { depth: 52, width: 180, height: 36 });

    // Close
    const closeBtn = createButton(this, GAME_WIDTH / 2, 360, '\u2190 BACK', () => {
      this.destroySettings();
    }, { depth: 52 });

    this.settingsElements = [overlay, titleText, soundBtn, versionText, resetBtn.container, creditsBtn.container, closeBtn.container];
  }

  private showResetConfirm(): void {
    const confirmOverlay = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.9)
      .setDepth(60).setInteractive();

    const confirmText = this.add.text(GAME_WIDTH / 2, 160, 'Reset all data?\nThis cannot be undone.', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ff4444', align: 'center',
    }).setOrigin(0.5).setDepth(61);

    const confirmElements: Phaser.GameObjects.GameObject[] = [confirmOverlay, confirmText];

    const yesBtn = createButton(this, GAME_WIDTH / 2 - 80, 230, 'YES, RESET', () => {
      localStorage.clear();
      confirmElements.forEach(e => e.destroy());
      yesBtn.container.destroy();
      noBtn.container.destroy();
      this.destroySettings();
      this.scene.restart();
    }, { width: 140, height: 36, depth: 62, fillColor: 0x994444, strokeColor: 0xff4444 });

    const noBtn = createButton(this, GAME_WIDTH / 2 + 80, 230, 'CANCEL', () => {
      confirmElements.forEach(e => e.destroy());
      yesBtn.container.destroy();
      noBtn.container.destroy();
    }, { width: 140, height: 36, depth: 62 });

    confirmElements.push(yesBtn.container, noBtn.container);
  }

  private destroySettings(): void {
    this.settingsElements.forEach(e => e.destroy());
    this.settingsElements = [];
  }

  shutdown(): void {
    this.tweens.killAll();
    if (this.stopMenuMusic) {
      this.stopMenuMusic();
      this.stopMenuMusic = null;
    }
  }
}
