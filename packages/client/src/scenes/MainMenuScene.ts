import Phaser from 'phaser';
import { LayoutManager } from '../utils/LayoutManager';
import { SoundManager } from '../audio/SoundManager';
import { MusicManager } from '../audio/MusicManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton } from '../ui/ButtonFactory';
import { THEME, drawGradientBackground } from '../ui/UITheme';

declare const __APP_VERSION__: string;

export class MainMenuScene extends Phaser.Scene {
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
    drawGradientBackground(this);

    // Stylised field gradient (bottom half)
    const fieldGfx = this.add.graphics();
    fieldGfx.fillStyle(0x0e5a2e, 0.6);
    fieldGfx.fillRect(0, L.y(0.6), L.w, L.h * 0.4);
    fieldGfx.fillStyle(0x1a8a44, 0.3);
    fieldGfx.fillRect(0, L.y(0.6), L.w, 2);

    // Field markings (subtle)
    const markGfx = this.add.graphics();
    markGfx.lineStyle(1, 0xffffff, 0.08);
    markGfx.lineBetween(L.cx, L.y(0.65), L.cx, L.h);
    markGfx.strokeCircle(L.cx, L.y(0.82), L.unit(0.08));

    // Floating particles (star-like) — mix cyan (70%) + orange (30%)
    for (let i = 0; i < 20; i++) {
      const px = Math.random() * L.w;
      const py = Math.random() * L.h * 0.55;
      const size = 1 + Math.random() * 2;
      const color = Math.random() < 0.7 ? THEME.particleCyan : THEME.particleOrange;
      const p = this.add.arc(px, py, size, 0, 360, false, color, 0.15 + Math.random() * 0.3);
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
      color: THEME.primaryHex,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScale(0);
    title.setShadow(0, 0, '#ffd70080', 20);

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
      color: THEME.textSecondary,
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

    // ── Primary buttons (play modes) ────────────────
    const primaryW = Math.round(L.w * 0.28);
    const primaryH = Math.round(L.h * 0.10);
    const primaryGap = Math.round(L.w * 0.04);
    const primaryY = L.y(0.42);

    createButton(this, L.cx - primaryW / 2 - primaryGap / 2, primaryY, 'VS CPU', () => {
      transitionTo(this, 'CharSelect', { mode: 'cpu' });
    }, {
      width: primaryW, height: primaryH,
      fontSize: '18px',
      style: 'primary',
    });

    createButton(this, L.cx + primaryW / 2 + primaryGap / 2, primaryY, 'ONLINE MATCH', () => {
      transitionTo(this, 'CharSelect', { mode: 'online' });
    }, {
      width: primaryW, height: primaryH,
      fontSize: '18px',
      style: 'primary',
    });

    // ── Secondary buttons ─────────────────────────
    const secW = Math.round(L.w * 0.20);
    const secH = Math.round(L.h * 0.07);
    const secGap = Math.round(L.w * 0.03);
    const secY = L.y(0.58);

    createButton(this, L.cx - secW - secGap, secY, 'CREATE PLAYER', () => {
      transitionTo(this, 'CharacterCreator', { returnTo: 'MainMenu' });
    }, {
      width: secW, height: secH,
      fontSize: '13px',
      style: 'secondary',
    });

    createButton(this, L.cx, secY, 'COMMUNITY', () => {
      transitionTo(this, 'CommunityGallery');
    }, {
      width: secW, height: secH,
      fontSize: '13px',
      style: 'secondary',
    });

    createButton(this, L.cx + secW + secGap, secY, 'HOW TO PLAY', () => {
      transitionTo(this, 'HowToPlay');
    }, {
      width: secW, height: secH,
      fontSize: '13px',
      style: 'secondary',
    });

    // ── Gear icon (Settings) — top right ────────────
    const gearText = this.add.text(L.x(0.91), L.y(0.08), '\u2699', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    gearText.on('pointerover', () => gearText.setColor(THEME.primaryHex));
    gearText.on('pointerout', () => gearText.setColor(THEME.textSecondary));
    gearText.on('pointerdown', () => {
      SoundManager.getInstance().menuClick();
      this.showSettings();
    });

    // ── Version/Credits ─────────────────────────────
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    this.add.text(L.cx, L.y(0.78), `v${version}  |  PYRGO GAMES`, {
      fontSize: L.fontSize('small'),
      fontFamily: 'Arial',
      color: THEME.textSecondary,
    }).setOrigin(0.5, 1);

    // ── Menu music ──────────────────────────────────
    const music = MusicManager.getInstance();
    music.setGameplayMode(false);
    music.start();
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
      MusicManager.getInstance().onSoundToggle(sm.enabled);
      if (sm.enabled) sm.menuClick();
    });

    // Song picker
    const musicMgr = MusicManager.getInstance();
    const songLabel = this.add.text(L.cx, L.y(0.35), musicMgr.getCurrentName(), {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5).setDepth(51);

    const prevSong = this.add.text(L.cx - 140, L.y(0.35), '<', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
    prevSong.on('pointerdown', () => {
      sm.menuClick();
      musicMgr.switchTo(musicMgr.getCurrentIndex() - 1);
      songLabel.setText(musicMgr.getCurrentName());
    });

    const nextSong = this.add.text(L.cx + 140, L.y(0.35), '>', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
    }).setOrigin(0.5).setDepth(51).setInteractive({ useHandCursor: true });
    nextSong.on('pointerdown', () => {
      sm.menuClick();
      musicMgr.switchTo(musicMgr.getCurrentIndex() + 1);
      songLabel.setText(musicMgr.getCurrentName());
    });

    // Version display
    const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.0';
    const versionText = this.add.text(L.cx, L.y(0.42), `Version: ${version}`, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: THEME.textSecondary,
    }).setOrigin(0.5).setDepth(51);

    // Reset Data button
    const settingsBtnSize = L.button('normal');
    const resetBtn = createButton(this, L.cx, L.y(0.51), 'RESET DATA', () => {
      this.showResetConfirm();
    }, { width: settingsBtnSize.width, height: settingsBtnSize.height, depth: 52, style: 'danger' });

    // Credits button
    const creditsBtn = createButton(this, L.cx, L.y(0.60), 'CREDITS', () => {
      this.destroySettings();
      transitionTo(this, 'Credits');
    }, { depth: 52, width: settingsBtnSize.width, height: settingsBtnSize.height, style: 'secondary' });

    // Close
    const closeBtn = createButton(this, L.cx, L.y(0.71), '\u2190 BACK', () => {
      this.destroySettings();
    }, { depth: 52, width: settingsBtnSize.width, height: settingsBtnSize.height, style: 'ghost' });

    this.settingsElements = [overlay, titleText, soundBtn, songLabel, prevSong, nextSong, versionText, resetBtn.container, creditsBtn.container, closeBtn.container];
  }

  private showResetConfirm(): void {
    const L = this.L;

    const confirmOverlay = this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x000000, 0.9)
      .setDepth(60).setInteractive();

    const confirmText = this.add.text(L.cx, L.y(0.33), 'Reset all data?\nThis cannot be undone.', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: THEME.dangerHex, align: 'center',
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
    }, { width: confirmBtnSize.width, height: confirmBtnSize.height, depth: 62, style: 'danger' });

    const noBtn = createButton(this, L.cx + L.unit(0.15), L.y(0.45), 'CANCEL', () => {
      confirmElements.forEach(e => e.destroy());
      yesBtn.container.destroy();
      noBtn.container.destroy();
    }, { width: confirmBtnSize.width, height: confirmBtnSize.height, depth: 62, style: 'secondary' });

    confirmElements.push(yesBtn.container, noBtn.container);
  }

  private destroySettings(): void {
    this.settingsElements.forEach(e => e.destroy());
    this.settingsElements = [];
  }

  shutdown(): void {
    this.tweens.killAll();
  }
}
