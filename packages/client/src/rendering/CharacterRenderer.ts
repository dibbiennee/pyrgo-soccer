import Phaser from 'phaser';
import type { Appearance, FaceShape, HairStyle, EyeStyle, BeardStyle } from '@pyrgo/shared';
import { PLAYER_HEAD_RADIUS, PLAYER_BODY_WIDTH, PLAYER_BODY_HEIGHT } from '@pyrgo/shared';

export interface RenderOptions {
  scale?: number;
  facingRight?: boolean;
}

/**
 * Procedural character renderer using Phaser primitives.
 * Used both in-game (Player.ts) and in the creator preview.
 */
export class CharacterRenderer {

  /**
   * Renders a full-size character into a Phaser Container.
   * Returns all created GameObjects so the caller can add them to their own container.
   */
  static renderCharacter(
    scene: Phaser.Scene,
    appearance: Appearance,
    options: RenderOptions = {},
  ): Phaser.GameObjects.GameObject[] {
    const scale = options.scale ?? 1;
    const facingRight = options.facingRight ?? true;
    const objects: Phaser.GameObjects.GameObject[] = [];

    const headR = PLAYER_HEAD_RADIUS * scale;
    const bodyW = PLAYER_BODY_WIDTH * scale;
    const bodyH = PLAYER_BODY_HEIGHT * scale;
    const headY = -bodyH / 2 - headR;

    // ── Jersey (body) ──────────────────────────────
    const torso = scene.add.rectangle(0, 0, bodyW, bodyH, appearance.jerseyColor1);
    torso.setStrokeStyle(2 * scale, 0x000000);
    objects.push(torso);

    // Jersey stripe (accent color2)
    const stripe = scene.add.rectangle(0, 0, bodyW * 0.3, bodyH, appearance.jerseyColor2, 0.5);
    objects.push(stripe);

    // Jersey number
    if (appearance.jerseyNumber > 0 && appearance.jerseyNumber <= 99) {
      const num = scene.add.text(0, bodyH * 0.15, String(appearance.jerseyNumber), {
        fontSize: `${Math.round(10 * scale)}px`,
        fontFamily: 'Arial Black, Arial',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 1 * scale,
      }).setOrigin(0.5);
      objects.push(num);
    }

    // ── Head ───────────────────────────────────────
    const headObj = this.drawHead(scene, headR, headY, appearance.faceShape, appearance.skinTone, scale);
    objects.push(headObj);

    // ── Hair ───────────────────────────────────────
    const hairObjs = this.drawHair(scene, headR, headY, appearance.hairStyle, appearance.hairColor, scale);
    objects.push(...hairObjs);

    // ── Eyes ───────────────────────────────────────
    const eyeObjs = this.drawEyes(scene, headR, headY, appearance.eyeStyle, facingRight, scale);
    objects.push(...eyeObjs);

    // ── Beard ──────────────────────────────────────
    const beardObjs = this.drawBeard(scene, headR, headY, appearance.beard, appearance.hairColor, scale);
    objects.push(...beardObjs);

    return objects;
  }

  /**
   * Renders a small preview (for card grid / selection).
   */
  static renderMiniPreview(
    scene: Phaser.Scene,
    appearance: Appearance,
    x: number,
    y: number,
    miniScale = 0.55,
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y);
    const objects = this.renderCharacter(scene, appearance, { scale: miniScale, facingRight: true });
    for (const obj of objects) {
      container.add(obj);
    }
    return container;
  }

  // ════════════════════════════════════════════════════════
  // HEAD
  // ════════════════════════════════════════════════════════
  private static drawHead(
    scene: Phaser.Scene, r: number, cy: number,
    shape: FaceShape, skinTone: number, scale: number,
  ): Phaser.GameObjects.Graphics {
    const gfx = scene.add.graphics();
    gfx.fillStyle(skinTone, 1);
    gfx.lineStyle(2 * scale, 0x000000, 1);

    switch (shape) {
      case 'round':
        gfx.fillCircle(0, cy, r);
        gfx.strokeCircle(0, cy, r);
        break;
      case 'square': {
        const s = r * 0.85;
        gfx.fillRoundedRect(-s, cy - s, s * 2, s * 2, 4 * scale);
        gfx.strokeRoundedRect(-s, cy - s, s * 2, s * 2, 4 * scale);
        break;
      }
      case 'oval':
        gfx.fillEllipse(0, cy, r * 1.8, r * 2.2);
        gfx.strokeEllipse(0, cy, r * 1.8, r * 2.2);
        break;
      case 'diamond': {
        const pts = [
          { x: 0, y: cy - r },
          { x: r * 0.9, y: cy },
          { x: 0, y: cy + r * 0.8 },
          { x: -r * 0.9, y: cy },
        ];
        gfx.fillPoints(pts as any, true);
        gfx.strokePoints(pts as any, true);
        break;
      }
      case 'triangle': {
        const pts = [
          { x: -r * 0.8, y: cy - r * 0.7 },
          { x: r * 0.8, y: cy - r * 0.7 },
          { x: 0, y: cy + r },
        ];
        gfx.fillPoints(pts as any, true);
        gfx.strokePoints(pts as any, true);
        break;
      }
    }
    return gfx;
  }

  // ════════════════════════════════════════════════════════
  // HAIR
  // ════════════════════════════════════════════════════════
  private static drawHair(
    scene: Phaser.Scene, r: number, cy: number,
    style: HairStyle, color: number, scale: number,
  ): Phaser.GameObjects.Graphics[] {
    if (style === 'none') return [];
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 1);

    switch (style) {
      case 'short':
        gfx.fillEllipse(0, cy - r * 0.6, r * 2, r * 0.8);
        break;
      case 'spiky':
        for (let i = -3; i <= 3; i++) {
          const sx = i * r * 0.28;
          const h = r * (0.5 + Math.random() * 0.3);
          gfx.fillTriangle(sx - 3 * scale, cy - r * 0.5, sx + 3 * scale, cy - r * 0.5, sx, cy - r * 0.5 - h);
        }
        break;
      case 'mohawk':
        gfx.fillRoundedRect(-3 * scale, cy - r * 1.6, 6 * scale, r * 1.2, 3 * scale);
        break;
      case 'long':
        gfx.fillEllipse(0, cy - r * 0.4, r * 2.4, r * 1.2);
        gfx.fillRect(-r * 1.1, cy, r * 0.4, r * 1.5);
        gfx.fillRect(r * 0.7, cy, r * 0.4, r * 1.5);
        break;
      case 'afro':
        gfx.fillCircle(0, cy - r * 0.3, r * 1.35);
        break;
      case 'buzz':
        gfx.fillEllipse(0, cy - r * 0.5, r * 1.9, r * 0.6);
        break;
      case 'side':
        gfx.fillEllipse(r * 0.6, cy - r * 0.5, r * 1.2, r * 0.8);
        break;
      case 'curly':
        for (let i = 0; i < 7; i++) {
          const angle = (i / 7) * Math.PI + Math.PI * 0.2;
          const cx = Math.cos(angle) * r * 0.8;
          const ccY = cy - r * 0.3 + Math.sin(angle) * r * 0.5;
          gfx.fillCircle(cx, ccY, r * 0.35);
        }
        break;
      case 'ponytail':
        gfx.fillEllipse(0, cy - r * 0.6, r * 2, r * 0.7);
        gfx.fillEllipse(-r * 0.9, cy + r * 0.4, r * 0.5, r * 1.2);
        break;
    }
    return [gfx];
  }

  // ════════════════════════════════════════════════════════
  // EYES
  // ════════════════════════════════════════════════════════
  private static drawEyes(
    scene: Phaser.Scene, r: number, cy: number,
    style: EyeStyle, facingRight: boolean, scale: number,
  ): Phaser.GameObjects.Graphics[] {
    const gfx = scene.add.graphics();
    const eyeOffsetX = r * 0.35;
    const eyeY = cy - 1 * scale;
    const eyeR = 3 * scale;
    const pupilR = 1.5 * scale;
    const pupilShift = facingRight ? 1.5 * scale : -1.5 * scale;

    switch (style) {
      case 'normal':
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(-eyeOffsetX, eyeY, eyeR);
        gfx.fillCircle(eyeOffsetX, eyeY, eyeR);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(-eyeOffsetX + pupilShift, eyeY, pupilR);
        gfx.fillCircle(eyeOffsetX + pupilShift, eyeY, pupilR);
        break;
      case 'angry':
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(-eyeOffsetX, eyeY, eyeR);
        gfx.fillCircle(eyeOffsetX, eyeY, eyeR);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(-eyeOffsetX + pupilShift, eyeY, pupilR);
        gfx.fillCircle(eyeOffsetX + pupilShift, eyeY, pupilR);
        // Angry brows
        gfx.lineStyle(2 * scale, 0x000000, 1);
        gfx.lineBetween(-eyeOffsetX - eyeR, eyeY - eyeR * 1.3, -eyeOffsetX + eyeR, eyeY - eyeR * 0.6);
        gfx.lineBetween(eyeOffsetX - eyeR, eyeY - eyeR * 0.6, eyeOffsetX + eyeR, eyeY - eyeR * 1.3);
        break;
      case 'happy':
        gfx.lineStyle(2 * scale, 0x000000, 1);
        gfx.beginPath();
        gfx.arc(-eyeOffsetX, eyeY + eyeR * 0.5, eyeR, Math.PI, 0, false);
        gfx.strokePath();
        gfx.beginPath();
        gfx.arc(eyeOffsetX, eyeY + eyeR * 0.5, eyeR, Math.PI, 0, false);
        gfx.strokePath();
        break;
      case 'cool':
        // Sunglasses
        gfx.fillStyle(0x111111, 1);
        gfx.fillRoundedRect(-eyeOffsetX - eyeR * 1.2, eyeY - eyeR, eyeR * 2.4, eyeR * 2, 2 * scale);
        gfx.fillRoundedRect(eyeOffsetX - eyeR * 1.2, eyeY - eyeR, eyeR * 2.4, eyeR * 2, 2 * scale);
        gfx.lineStyle(1.5 * scale, 0x333333, 1);
        gfx.lineBetween(-eyeOffsetX + eyeR * 1.2, eyeY, eyeOffsetX - eyeR * 1.2, eyeY);
        break;
      case 'sleepy':
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(-eyeOffsetX, eyeY, eyeR);
        gfx.fillCircle(eyeOffsetX, eyeY, eyeR);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(-eyeOffsetX, eyeY + pupilR * 0.5, pupilR * 0.8);
        gfx.fillCircle(eyeOffsetX, eyeY + pupilR * 0.5, pupilR * 0.8);
        // Heavy lids
        gfx.fillStyle(0x000000, 0.3);
        gfx.fillRect(-eyeOffsetX - eyeR, eyeY - eyeR, eyeR * 2, eyeR);
        gfx.fillRect(eyeOffsetX - eyeR, eyeY - eyeR, eyeR * 2, eyeR);
        break;
    }
    return [gfx];
  }

  // ════════════════════════════════════════════════════════
  // BEARD
  // ════════════════════════════════════════════════════════
  private static drawBeard(
    scene: Phaser.Scene, r: number, cy: number,
    style: BeardStyle, color: number, scale: number,
  ): Phaser.GameObjects.Graphics[] {
    if (style === 'none') return [];
    const gfx = scene.add.graphics();
    gfx.fillStyle(color, 0.8);

    switch (style) {
      case 'stubble':
        for (let i = 0; i < 12; i++) {
          const dx = (Math.random() - 0.5) * r * 1.2;
          const dy = cy + r * 0.3 + Math.random() * r * 0.5;
          gfx.fillCircle(dx, dy, 1 * scale);
        }
        break;
      case 'goatee':
        gfx.fillEllipse(0, cy + r * 0.7, r * 0.6, r * 0.5);
        break;
      case 'full':
        gfx.fillRoundedRect(-r * 0.7, cy + r * 0.2, r * 1.4, r * 0.8, 4 * scale);
        break;
      case 'mustache':
        gfx.fillEllipse(-r * 0.3, cy + r * 0.3, r * 0.5, r * 0.2);
        gfx.fillEllipse(r * 0.3, cy + r * 0.3, r * 0.5, r * 0.2);
        break;
    }
    return [gfx];
  }
}
