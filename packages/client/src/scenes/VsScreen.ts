import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  resolveCharacter, SUPER_MOVES,
  defaultAppearanceForPreset,
} from '@pyrgo/shared';
import type { CharacterRef, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { setupResponsiveCamera } from '../utils/responsive';

export class VsScreen extends Phaser.Scene {
  private charRef1: CharacterRef = { type: 'preset', id: 1 };
  private charRef2: CharacterRef = { type: 'preset', id: 2 };
  private targetScene = 'LocalGame';
  private extraData: Record<string, unknown> = {};

  constructor() {
    super('VsScreen');
  }

  init(data: {
    charRef1?: CharacterRef;
    charRef2?: CharacterRef;
    targetScene?: string;
    [key: string]: unknown;
  }): void {
    this.charRef1 = data.charRef1 ?? { type: 'preset', id: 1 };
    this.charRef2 = data.charRef2 ?? { type: 'preset', id: 2 };
    this.targetScene = data.targetScene ?? 'LocalGame';
    // Pass through any extra data (e.g., difficulty for CPU)
    const { charRef1: _a, charRef2: _b, targetScene: _c, ...rest } = data;
    this.extraData = rest;
  }

  create(): void {
    setupResponsiveCamera(this);
    fadeIn(this, 200);

    const sm = SoundManager.getInstance();
    const char1 = resolveCharacter(this.charRef1);
    const char2 = resolveCharacter(this.charRef2);
    const appearance1: Appearance = char1.appearance ?? defaultAppearanceForPreset(char1.id);
    const appearance2: Appearance = char2.appearance ?? defaultAppearanceForPreset(char2.id);

    // ── Dramatic background ─────────────────────────
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // Diagonal split line
    const splitGfx = this.add.graphics();
    splitGfx.fillStyle(0x00ccff, 0.15);
    splitGfx.fillTriangle(0, 0, GAME_WIDTH / 2 + 30, 0, 0, GAME_HEIGHT);
    splitGfx.fillStyle(0xff4444, 0.15);
    splitGfx.fillTriangle(GAME_WIDTH, 0, GAME_WIDTH / 2 - 30, GAME_HEIGHT, GAME_WIDTH, GAME_HEIGHT);

    // ── P1 character (slides from left) ─────────────
    const p1Container = CharacterRenderer.renderMiniPreview(this, appearance1, -200, GAME_HEIGHT / 2 - 40, 2.0);
    p1Container.setAlpha(0);

    // P1 name
    const p1Name = this.add.text(-200, GAME_HEIGHT / 2 + 60, char1.name, {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    // ── P2 character (slides from right) ────────────
    const p2Container = CharacterRenderer.renderMiniPreview(this, appearance2, GAME_WIDTH + 200, GAME_HEIGHT / 2 - 40, 2.0);
    p2Container.setAlpha(0);

    // P2 name
    const p2Name = this.add.text(GAME_WIDTH + 200, GAME_HEIGHT / 2 + 60, char2.name, {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#ff4444',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    // ── VS text ─────────────────────────────────────
    const vsText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20, 'VS', {
      fontSize: '72px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setAlpha(0);

    // ── Super move names ────────────────────────────
    const super1 = SUPER_MOVES.find(m => m.id === char1.superMove);
    const super2 = SUPER_MOVES.find(m => m.id === char2.superMove);

    const superText1 = this.add.text(GAME_WIDTH * 0.25, GAME_HEIGHT / 2 + 90, super1?.displayName ?? '', {
      fontSize: '11px', fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    const superText2 = this.add.text(GAME_WIDTH * 0.75, GAME_HEIGHT / 2 + 90, super2?.displayName ?? '', {
      fontSize: '11px', fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    // ── Countdown text ──────────────────────────────
    const countText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 60, '', {
      fontSize: '48px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);

    // ── Flash overlay ───────────────────────────────
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0)
      .setDepth(20);

    // ═══════════════════════════════════════════════════
    // TIMELINE
    // ═══════════════════════════════════════════════════

    // t=0.2s: P1 slide in
    this.time.delayedCall(200, () => {
      p1Container.setAlpha(1);
      p1Name.setAlpha(1);
      this.tweens.add({
        targets: [p1Container, p1Name],
        x: GAME_WIDTH * 0.25,
        duration: 500,
        ease: 'Back.easeOut',
      });
    });

    // t=0.4s: P2 slide in
    this.time.delayedCall(400, () => {
      p2Container.setAlpha(1);
      p2Name.setAlpha(1);
      this.tweens.add({
        targets: [p2Container, p2Name],
        x: GAME_WIDTH * 0.75,
        duration: 500,
        ease: 'Back.easeOut',
      });
    });

    // t=0.8s: VS appears + dramatic hit + flash
    this.time.delayedCall(800, () => {
      vsText.setAlpha(1);
      this.tweens.add({
        targets: vsText,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
      sm.vsDramaticHit();

      // White flash
      flash.setAlpha(0.6);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
      });
    });

    // t=1.2s: Stats + super names
    this.time.delayedCall(1200, () => {
      superText1.setAlpha(1);
      superText2.setAlpha(1);
    });

    // t=2.0s: Countdown "3"
    this.time.delayedCall(2000, () => {
      countText.setText('3');
      sm.countdownBeep();
      this.tweens.add({
        targets: countText,
        scale: { from: 1.5, to: 1 },
        duration: 300,
      });
    });

    // t=2.5s: "2"
    this.time.delayedCall(2500, () => {
      countText.setText('2');
      sm.countdownBeep();
      this.tweens.add({
        targets: countText,
        scale: { from: 1.5, to: 1 },
        duration: 300,
      });
    });

    // t=3.0s: "1"
    this.time.delayedCall(3000, () => {
      countText.setText('1');
      sm.countdownBeep();
      this.tweens.add({
        targets: countText,
        scale: { from: 1.5, to: 1 },
        duration: 300,
      });
    });

    // t=3.3s: "FIGHT!" + flash
    this.time.delayedCall(3300, () => {
      countText.setText('FIGHT!');
      countText.setColor('#ffdd00');
      countText.setFontSize(56);
      sm.countdown(); // high beep
      this.tweens.add({
        targets: countText,
        scale: { from: 0.5, to: 1.3 },
        duration: 200,
      });
      flash.setAlpha(0.5);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 200,
      });
    });

    // t=3.5s: Transition to target scene
    this.time.delayedCall(3500, () => {
      transitionTo(this, this.targetScene, {
        charRef1: this.charRef1,
        charRef2: this.charRef2,
        ...this.extraData,
      }, { duration: 200 });
    });
  }

  shutdown(): void {
    this.time.removeAllEvents();
    this.tweens.killAll();
  }
}
