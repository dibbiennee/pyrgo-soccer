import Phaser from 'phaser';
import {
  resolveCharacter, SUPER_MOVES,
  defaultAppearanceForPreset,
} from '@pyrgo/shared';
import type { CharacterRef, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { LayoutManager } from '../utils/LayoutManager';

export class VsScreen extends Phaser.Scene {
  private charRef1: CharacterRef = { type: 'preset', id: 1 };
  private charRef2: CharacterRef = { type: 'preset', id: 2 };
  private targetScene = 'CpuGame';
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
    this.targetScene = data.targetScene ?? 'CpuGame';
    const { charRef1: _a, charRef2: _b, targetScene: _c, ...rest } = data;
    this.extraData = rest;
  }

  create(): void {
    fadeIn(this, 200);
    const L = new LayoutManager(this);

    const sm = SoundManager.getInstance();
    const char1 = resolveCharacter(this.charRef1);
    const char2 = resolveCharacter(this.charRef2);
    const appearance1: Appearance = char1.appearance ?? defaultAppearanceForPreset(char1.id);
    const appearance2: Appearance = char2.appearance ?? defaultAppearanceForPreset(char2.id);

    // ── Dramatic background ─────────────────────────
    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x0a0a1a);

    // Diagonal split line
    const splitGfx = this.add.graphics();
    splitGfx.fillStyle(0x00ccff, 0.15);
    splitGfx.fillTriangle(0, 0, L.cx + L.unit(0.06), 0, 0, L.h);
    splitGfx.fillStyle(0xff4444, 0.15);
    splitGfx.fillTriangle(L.w, 0, L.cx - L.unit(0.06), L.h, L.w, L.h);

    // ── P1 character (slides from left) ─────────────
    const charScale = L.unit(0.005);
    const charY = L.cy - L.unit(0.06);
    const nameOffsetY = L.cy + L.unit(0.15);

    const p1Container = CharacterRenderer.renderMiniPreview(this, appearance1, -L.unit(0.3), charY, charScale);
    p1Container.setAlpha(0);

    const p1Name = this.add.text(-L.unit(0.3), nameOffsetY, char1.name, {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    // ── P2 character (slides from right) ────────────
    const p2Container = CharacterRenderer.renderMiniPreview(this, appearance2, L.w + L.unit(0.3), charY, charScale);
    p2Container.setAlpha(0);

    const p2Name = this.add.text(L.w + L.unit(0.3), nameOffsetY, char2.name, {
      fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color: '#ff4444',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setAlpha(0);

    // ── VS text ─────────────────────────────────────
    const vsText = this.add.text(L.cx, L.cy - L.unit(0.04), 'VS', {
      fontSize: L.unit(0.18) + 'px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setScale(0).setAlpha(0);

    // ── Super move names ────────────────────────────
    const super1 = SUPER_MOVES.find(m => m.id === char1.superMove);
    const super2 = SUPER_MOVES.find(m => m.id === char2.superMove);

    const superTextY = L.cy + L.unit(0.22);
    const superText1 = this.add.text(L.x(0.25), superTextY, super1?.displayName ?? '', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    const superText2 = this.add.text(L.x(0.75), superTextY, super2?.displayName ?? '', {
      fontSize: L.fontSize('tiny'), fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setAlpha(0);

    // ── Countdown text ──────────────────────────────
    const countText = this.add.text(L.cx, L.y(0.88), '', {
      fontSize: L.fontSize('title'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(10);

    // ── Flash overlay ───────────────────────────────
    const flash = this.add.rectangle(L.cx, L.cy, L.w, L.h, 0xffffff, 0)
      .setDepth(20);

    // ═══════════════════════════════════════════════════
    // TIMELINE
    // ═══════════════════════════════════════════════════

    this.time.delayedCall(200, () => {
      p1Container.setAlpha(1);
      p1Name.setAlpha(1);
      this.tweens.add({
        targets: [p1Container, p1Name],
        x: L.x(0.25),
        duration: 500,
        ease: 'Back.easeOut',
      });
    });

    this.time.delayedCall(400, () => {
      p2Container.setAlpha(1);
      p2Name.setAlpha(1);
      this.tweens.add({
        targets: [p2Container, p2Name],
        x: L.x(0.75),
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
      countText.setFontSize(L.fontSizeN('title') * 1.2);
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
