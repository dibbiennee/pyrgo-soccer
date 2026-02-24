import Phaser from 'phaser';
import {
  resolveCharacter, SUPER_MOVES,
  defaultAppearanceForPreset,
} from '@pyrgo/shared';
import type { CharacterRef, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { CANVAS_W, CANVAS_H } from '../utils/responsive';

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
    const { charRef1: _a, charRef2: _b, targetScene: _c, ...rest } = data;
    this.extraData = rest;
  }

  create(): void {
    fadeIn(this, 200);
    const W = CANVAS_W;
    const H = CANVAS_H;
    const cx = W / 2;

    const sm = SoundManager.getInstance();
    const char1 = resolveCharacter(this.charRef1);
    const char2 = resolveCharacter(this.charRef2);
    const appearance1: Appearance = char1.appearance ?? defaultAppearanceForPreset(char1.id);
    const appearance2: Appearance = char2.appearance ?? defaultAppearanceForPreset(char2.id);

    // ── Dramatic background ─────────────────────────
    this.add.rectangle(cx, H / 2, W, H, 0x0a0a1a);

    // Diagonal split line
    const splitGfx = this.add.graphics();
    splitGfx.fillStyle(0x00ccff, 0.15);
    splitGfx.fillTriangle(0, 0, cx + 50, 0, 0, H);
    splitGfx.fillStyle(0xff4444, 0.15);
    splitGfx.fillTriangle(W, 0, cx - 50, H, W, H);

    // ── P1 character (slides from left) ─────────────
    const p1Container = CharacterRenderer.renderMiniPreview(this, appearance1, -200, H / 2 - 50, 2.5);
    p1Container.setAlpha(0);

    const p1Name = this.add.text(-200, H / 2 + 80, char1.name, {
      fontSize: '24px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    // ── P2 character (slides from right) ────────────
    const p2Container = CharacterRenderer.renderMiniPreview(this, appearance2, W + 200, H / 2 - 50, 2.5);
    p2Container.setAlpha(0);

    const p2Name = this.add.text(W + 200, H / 2 + 80, char2.name, {
      fontSize: '24px', fontFamily: 'Arial Black, Arial', color: '#ff4444',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    // ── VS text ─────────────────────────────────────
    const vsText = this.add.text(cx, H / 2 - 20, 'VS', {
      fontSize: '80px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setAlpha(0);

    // ── Super move names ────────────────────────────
    const super1 = SUPER_MOVES.find(m => m.id === char1.superMove);
    const super2 = SUPER_MOVES.find(m => m.id === char2.superMove);

    const superText1 = this.add.text(W * 0.25, H / 2 + 120, super1?.displayName ?? '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    const superText2 = this.add.text(W * 0.75, H / 2 + 120, super2?.displayName ?? '', {
      fontSize: '14px', fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    // ── Countdown text ──────────────────────────────
    const countText = this.add.text(cx, H - 80, '', {
      fontSize: '52px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);

    // ── Flash overlay ───────────────────────────────
    const flash = this.add.rectangle(cx, H / 2, W, H, 0xffffff, 0)
      .setDepth(20);

    // ═══════════════════════════════════════════════════
    // TIMELINE
    // ═══════════════════════════════════════════════════

    this.time.delayedCall(200, () => {
      p1Container.setAlpha(1);
      p1Name.setAlpha(1);
      this.tweens.add({
        targets: [p1Container, p1Name],
        x: W * 0.25,
        duration: 500,
        ease: 'Back.easeOut',
      });
    });

    this.time.delayedCall(400, () => {
      p2Container.setAlpha(1);
      p2Name.setAlpha(1);
      this.tweens.add({
        targets: [p2Container, p2Name],
        x: W * 0.75,
        duration: 500,
        ease: 'Back.easeOut',
      });
    });

    this.time.delayedCall(800, () => {
      vsText.setAlpha(1);
      this.tweens.add({
        targets: vsText,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
      });
      sm.vsDramaticHit();
      flash.setAlpha(0.6);
      this.tweens.add({ targets: flash, alpha: 0, duration: 300 });
    });

    this.time.delayedCall(1200, () => {
      superText1.setAlpha(1);
      superText2.setAlpha(1);
    });

    this.time.delayedCall(2000, () => {
      countText.setText('3');
      sm.countdownBeep();
      this.tweens.add({ targets: countText, scale: { from: 1.5, to: 1 }, duration: 300 });
    });

    this.time.delayedCall(2500, () => {
      countText.setText('2');
      sm.countdownBeep();
      this.tweens.add({ targets: countText, scale: { from: 1.5, to: 1 }, duration: 300 });
    });

    this.time.delayedCall(3000, () => {
      countText.setText('1');
      sm.countdownBeep();
      this.tweens.add({ targets: countText, scale: { from: 1.5, to: 1 }, duration: 300 });
    });

    this.time.delayedCall(3300, () => {
      countText.setText('FIGHT!');
      countText.setColor('#ffdd00');
      countText.setFontSize(60);
      sm.countdown();
      this.tweens.add({ targets: countText, scale: { from: 0.5, to: 1.3 }, duration: 200 });
      flash.setAlpha(0.5);
      this.tweens.add({ targets: flash, alpha: 0, duration: 200 });
    });

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
