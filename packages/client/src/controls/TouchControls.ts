import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import type { InputState } from '@pyrgo/shared';
import { THEME } from '../ui/UITheme';

interface TouchButton {
  gfx: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  pressed: boolean;
  baseColor: number;
  pressedColor: number;
  rect: { x: number; y: number; w: number; h: number };
}

export interface TouchControlsConfig {
  scene: Phaser.Scene;
  /** 'dual' for local (P1 left, P2 right), 'single' for online (left = move, right = actions) */
  mode: 'dual' | 'single';
}

/* ── Layout helpers ────────────────────────────────────────────── */
const W = GAME_WIDTH;   // 800
const H = GAME_HEIGHT;  // 480

/** Proportional x (0-1 → 0-W) */
const px = (pct: number) => Math.round(W * pct);
/** Proportional y (0-1 → 0-H) */
const py = (pct: number) => Math.round(H * pct);

/** Minimum touch target in game-space pixels (≈44pt on most phones) */
const MIN_BTN = 56;

/** Clamp a dimension to at least MIN_BTN */
const clamp = (v: number) => Math.max(v, MIN_BTN);

const BTN_RADIUS = 10;

export class TouchControls {
  private scene: Phaser.Scene;
  private mode: 'dual' | 'single';
  private buttons: Map<string, TouchButton> = new Map();
  private container: Phaser.GameObjects.Container;

  public p1Input: InputState = { left: false, right: false, jump: false, kick: false, super: false };
  public p2Input: InputState = { left: false, right: false, jump: false, kick: false, super: false };
  public active = false;

  constructor(config: TouchControlsConfig) {
    this.scene = config.scene;
    this.mode = config.mode;
    this.container = this.scene.add.container(0, 0).setDepth(200);

    if (!this.scene.sys.game.device.input.touch) return;
    this.active = true;

    if (this.mode === 'dual') {
      this.createDualControls();
    } else {
      this.createSingleControls();
    }

    this.setupPointerEvents();
  }

  private createDualControls(): void {
    const dpad  = clamp(60);
    const kick  = clamp(70);
    const jump  = clamp(96);
    const jumpH = clamp(50);
    const sup   = clamp(56);
    const supH  = 44;

    // === P1 side (left) ===
    this.createButton('p1_left',  px(0.06),  py(0.875), dpad, dpad, '◄', THEME.touchDpad, THEME.touchDpadPressed);
    this.createButton('p1_right', px(0.15),  py(0.875), dpad, dpad, '►', THEME.touchDpad, THEME.touchDpadPressed);
    this.createButton('p1_jump',  px(0.106), py(0.73),  jump, jumpH, 'JUMP', THEME.touchJump, THEME.touchJumpPressed);
    this.createButton('p1_kick',  px(0.275), py(0.855), kick, kick, 'KICK', THEME.touchKick, THEME.touchKickPressed);
    this.createButton('p1_super', px(0.275), py(0.70),  sup,  supH, 'S', THEME.touchSuper, THEME.touchSuperPressed);

    // === P2 side (right — mirrored) ===
    this.createButton('p2_left',  px(0.85),  py(0.875), dpad, dpad, '◄', THEME.touchDpad, THEME.touchDpadPressed);
    this.createButton('p2_right', px(0.94),  py(0.875), dpad, dpad, '►', THEME.touchDpad, THEME.touchDpadPressed);
    this.createButton('p2_jump',  px(0.894), py(0.73),  jump, jumpH, 'JUMP', THEME.touchJump, THEME.touchJumpPressed);
    this.createButton('p2_kick',  px(0.725), py(0.855), kick, kick, 'KICK', THEME.touchKick, THEME.touchKickPressed);
    this.createButton('p2_super', px(0.725), py(0.70),  sup,  supH, 'S', THEME.touchSuper, THEME.touchSuperPressed);
  }

  private createSingleControls(): void {
    const dpad  = clamp(70);
    const kick  = clamp(90);
    const jump  = clamp(110);
    const jumpH = clamp(56);
    const sup   = clamp(70);
    const supH  = 48;

    // Left side: D-pad
    this.createButton('p1_left',  px(0.065), py(0.875), dpad, dpad, '◄', THEME.touchDpad, THEME.touchDpadPressed);
    this.createButton('p1_right', px(0.165), py(0.875), dpad, dpad, '►', THEME.touchDpad, THEME.touchDpadPressed);
    this.createButton('p1_jump',  px(0.115), py(0.71),  jump, jumpH, 'JUMP', THEME.touchJump, THEME.touchJumpPressed);

    // Right side: actions
    this.createButton('p1_kick',  px(0.90),  py(0.855), kick, kick, 'KICK', THEME.touchKick, THEME.touchKickPressed);
    this.createButton('p1_super', px(0.90),  py(0.67),  sup,  supH, 'SUPER', THEME.touchSuper, THEME.touchSuperPressed);
  }

  private createButton(
    id: string, x: number, y: number, w: number, h: number,
    text: string, baseColor: number, pressedColor: number,
  ): void {
    const gfx = this.scene.add.graphics();
    this.drawNormal(gfx, x, y, w, h, baseColor);

    const fontSize = text.length <= 2 ? '22px' : '13px';
    const label = this.scene.add.text(x, y, text, {
      fontSize, fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.container.add(gfx);
    this.container.add(label);

    this.buttons.set(id, {
      gfx, label, pressed: false, baseColor, pressedColor,
      rect: { x: x - w / 2, y: y - h / 2, w, h },
    });
  }

  private drawNormal(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
    gfx.clear();
    gfx.fillStyle(color, 0.55);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, BTN_RADIUS);
    gfx.lineStyle(2, 0xffffff, 0.2);
    gfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, BTN_RADIUS);
  }

  private drawPressed(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, color: number): void {
    gfx.clear();
    // Glow ring
    gfx.fillStyle(color, 0.2);
    gfx.fillRoundedRect(x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, BTN_RADIUS + 2);
    // Pressed fill
    gfx.fillStyle(color, 0.75);
    gfx.fillRoundedRect(x - w / 2, y - h / 2, w, h, BTN_RADIUS);
    gfx.lineStyle(2, 0xffffff, 0.35);
    gfx.strokeRoundedRect(x - w / 2, y - h / 2, w, h, BTN_RADIUS);
  }

  private setupPointerEvents(): void {
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.processPointer(pointer, true);
    });
    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) this.processPointer(pointer, false);
    });
    this.scene.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      this.releaseAll(pointer);
    });
  }

  private processPointer(pointer: Phaser.Input.Pointer, isNewPress: boolean): void {
    for (const [id, btn] of this.buttons) {
      const r = btn.rect;
      if (
        pointer.worldX >= r.x && pointer.worldX <= r.x + r.w &&
        pointer.worldY >= r.y && pointer.worldY <= r.y + r.h
      ) {
        this.pressButton(id, btn, isNewPress);
      }
    }
  }

  private pressButton(id: string, btn: TouchButton, isNewPress: boolean): void {
    if (!btn.pressed) {
      const r = btn.rect;
      this.drawPressed(btn.gfx, r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, btn.pressedColor);
    }
    btn.pressed = true;

    const target = id.startsWith('p2_') ? this.p2Input : this.p1Input;

    if (id.endsWith('_left')) {
      target.left = true;
      target.right = false;
    } else if (id.endsWith('_right')) {
      target.right = true;
      target.left = false;
    } else if (id.endsWith('_jump') && isNewPress) {
      target.jump = true;
    } else if (id.endsWith('_kick') && isNewPress) {
      target.kick = true;
    } else if (id.endsWith('_super') && isNewPress) {
      target.super = true;
    }
  }

  private releaseAll(_pointer: Phaser.Input.Pointer): void {
    for (const [_id, btn] of this.buttons) {
      if (btn.pressed) {
        const r = btn.rect;
        this.drawNormal(btn.gfx, r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, btn.baseColor);
      }
      btn.pressed = false;
    }
    this.p1Input.left = false;
    this.p1Input.right = false;
    this.p2Input.left = false;
    this.p2Input.right = false;
  }

  /** Call after reading edge-triggered inputs each frame */
  resetEdgeTriggers(): void {
    this.p1Input.jump = false;
    this.p1Input.kick = false;
    this.p1Input.super = false;
    this.p2Input.jump = false;
    this.p2Input.kick = false;
    this.p2Input.super = false;
  }

  destroy(): void {
    this.container.destroy();
    this.buttons.clear();
  }
}
