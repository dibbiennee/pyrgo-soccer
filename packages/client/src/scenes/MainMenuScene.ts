import Phaser from 'phaser';
import { LayoutManager } from '../utils/LayoutManager';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';

declare const __APP_VERSION__: string;

export class MainMenuScene extends Phaser.Scene {
  private stopMenuMusic: (() => void) | null = null;
  private settingsElements: Phaser.GameObjects.GameObject[] = [];
  private L!: LayoutManager;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    fadeIn(this);
    const L = new LayoutManager(this);
    this.L = L;

    // ── Background ──────────────────────────────────
    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x0d0d1a);

    // Stylised field gradient (bottom half)
    const fieldGfx = this.add.graphics();
    fieldGfx.fillStyle(0x0a2a15, 1);
    fieldGfx.fillRect(0, L.y(0.6), L.w, L.h * 0.4);
    fieldGfx.fillStyle(0x0c3318, 0.5);
    fieldGfx.fillRect(0, L.y(0.6), L.w, 2);

    // Field markings (subtle)
    const markGfx = this.add.graphics();
    markGfx.lineStyle(1, 0xffffff, 0.08);
    markGfx.lineBetween(L.cx, L.y(0.65), L.cx, L.h);
    markGfx.strokeCircle(L.cx, L.y(0.82), L.unit(0.08));

    // Floating particles (star-like)
    for (let i = 0; i < 20; i++) {
      const px = Math.random() * L.w;
      const py = Math.random() * L.h * 0.55;
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
    const title = this.add.text(L.cx, L.y(0.14), 'PYRGO SOCCER', {
      fontSize: L.fontSize('title'),
      fontFamily: 'Arial Black, Arial',
      color: '#00ccff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 800,
      ease: 'Back.easeOut',
    });

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
    const subtitle = this.add.text(L.cx, L.y(0.21), 'Head Soccer Battle!', {
      fontSize: L.fontSize('subtitle'),
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
    const ballY = L.y(0.28);
    const ball = this.add.arc(L.cx, ballY, L.unit(0.018), 0, 360, false, 0xffffff);
    ball.setStrokeStyle(2, 0x333333);
    this.tweens.add({
      targets: ball,
      y: ballY - L.unit(0.02),
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // ── Buttons ─────────────────────────────────────
    const leftX = L.cx - L.unit(0.35);
    const rightX = L.cx + L.unit(0.35);
    const btnSize = L.button('large');

    // Left column (play modes)
    createButton(this, leftX, L.y(0.42), 'VS CPU', () => {
      transitionTo(this, 'CharSelect', { mode: 'cpu' });
    }, { width: btnSize.width, height: btnSize.height });

    createButton(this, leftX, L.y(0.50), 'LOCAL MATCH', () => {
      transitionTo(this, 'CharSelect', { mode: 'local' });
    }, { width: btnSize.width, height: btnSize.height });

    createButton(this, leftX, L.y(0.58), 'ONLINE MATCH', () => {
      transitionTo(this, 'CharSelect', { mode: 'online' });
    }, { width: btnSize.width, height: btnSize.height });

    // Right column (character + community + how to play)
    createButton(this, rightX, L.y(0.42), 'CREATE PLAYER', () => {
      transitionTo(this, 'CharacterCreator', { returnTo: 'MainMenu' });
    }, { width: btnSize.width, height: btnSize.height });

    createButton(this, rightX, L.y(0.50), 'COMMUNITY', () => {
      transitionTo(this, 'CommunityGallery');
    }, { width: btnSize.width, height: btnSize.height });

    createButton(this, rightX, L.y(0.58), 'HOW TO PLAY', () => {
      transitionTo(this, 'HowToPlay');
    }, { width: btnSize.width, height: btnSize.height });

    // ── Gear icon (Settings) — top right ────────────
    const gearText = this.add.text(L.x(0.96), L.y(0.04), '\u2699', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial', color: '#666688',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    gearText.on('pointerover', () => gearText.setColor('#00ccff'));
    gearText.on('pointerout', () => gearText.setColor('#666688'));
    gearText.on('pointerdown', () => {
      SoundManager.getInstance().menuClick();
      this.showSettings();
    });

    // ── Version/Credits ─────────────────────────────
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    this.add.text(L.cx, L.y(0.97), `v${version}  |  PYRGO GAMES`, {
      fontSize: L.fontSize('small'),
      fontFamily: 'Arial',
      color: '#444466',
    }).setOrigin(0.5, 1);

    // ── Menu music ──────────────────────────────────
    this.stopMenuMusic = SoundManager.getInstance().menuLoop();
    SoundManager.getInstance().sceneWhoosh();
  }

  private showSettings(): void {
    this.destroySettings();
    const L = this.L;

    const overlay = this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x000000, 0.85)
      .setDepth(50).setInteractive();

    const titleText = this.add.text(L.cx, L.y(0.15), 'SETTINGS', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(51);

    // Sound toggle
    const sm = SoundManager.getInstance();
    const soundBtn = this.add.text(L.cx, L.y(0.28), `Sound: ${sm.enabled ? 'ON' : 'OFF'}`, {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ffffff',
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
    const versionText = this.add.text(L.cx, L.y(0.35), `Version: ${version}`, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#888899',
    }).setOrigin(0.5).setDepth(51);

    // Reset Data button
    const settingsBtnSize = L.button('normal');
    const resetBtn = createButton(this, L.cx, L.y(0.44), 'RESET DATA', () => {
      this.showResetConfirm();
    }, { width: settingsBtnSize.width, height: settingsBtnSize.height, depth: 52, fillColor: 0x994444, strokeColor: 0xff4444 });

    // Credits button
    const creditsBtn = createButton(this, L.cx, L.y(0.53), 'CREDITS', () => {
      this.destroySettings();
      transitionTo(this, 'Credits');
    }, { depth: 52, width: settingsBtnSize.width, height: settingsBtnSize.height });

    // Close
    const closeBtn = createButton(this, L.cx, L.y(0.64), '\u2190 BACK', () => {
      this.destroySettings();
    }, { depth: 52, width: settingsBtnSize.width, height: settingsBtnSize.height });

    this.settingsElements = [overlay, titleText, soundBtn, versionText, resetBtn.container, creditsBtn.container, closeBtn.container];
  }

  private showResetConfirm(): void {
    const L = this.L;

    const confirmOverlay = this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x000000, 0.9)
      .setDepth(60).setInteractive();

    const confirmText = this.add.text(L.cx, L.y(0.33), 'Reset all data?\nThis cannot be undone.', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ff4444', align: 'center',
    }).setOrigin(0.5).setDepth(61);

    const confirmElements: Phaser.GameObjects.GameObject[] = [confirmOverlay, confirmText];

    const confirmBtnSize = L.button('normal');
    const yesBtn = createButton(this, L.cx - L.unit(0.15), L.y(0.45), 'YES, RESET', () => {
      localStorage.clear();
      confirmElements.forEach(e => e.destroy());
      yesBtn.container.destroy();
      noBtn.container.destroy();
      this.destroySettings();
      this.scene.restart();
    }, { width: confirmBtnSize.width, height: confirmBtnSize.height, depth: 62, fillColor: 0x994444, strokeColor: 0xff4444 });

    const noBtn = createButton(this, L.cx + L.unit(0.15), L.y(0.45), 'CANCEL', () => {
      confirmElements.forEach(e => e.destroy());
      yesBtn.container.destroy();
      noBtn.container.destroy();
    }, { width: confirmBtnSize.width, height: confirmBtnSize.height, depth: 62 });

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
