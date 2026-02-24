import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import type { InputState } from '@pyrgo/shared';

interface TouchButton {
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  pressed: boolean;
  baseColor: number;
  pressedColor: number;
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
    // Dual mode: both players share the screen — tighter layout
    const dpad  = clamp(60);   // d-pad buttons
    const kick  = clamp(70);   // kick button
    const jump  = clamp(96);   // jump width
    const jumpH = clamp(50);   // jump height
    const sup   = clamp(56);   // super button
    const supH  = 44;

    // === P1 side (left) ===
    this.createButton('p1_left',  px(0.06),  py(0.875), dpad, dpad, '◄', 0x444466, 0x6666aa);
    this.createButton('p1_right', px(0.15),  py(0.875), dpad, dpad, '►', 0x444466, 0x6666aa);
    this.createButton('p1_jump',  px(0.106), py(0.73),  jump, jumpH, 'JUMP', 0x2255aa, 0x4488dd);
    this.createButton('p1_kick',  px(0.275), py(0.855), kick, kick, 'KICK', 0xaa2222, 0xdd4444);
    this.createButton('p1_super', px(0.275), py(0.70),  sup,  supH, 'S', 0xaa8800, 0xddbb00);

    // === P2 side (right — mirrored) ===
    this.createButton('p2_left',  px(0.85),  py(0.875), dpad, dpad, '◄', 0x444466, 0x6666aa);
    this.createButton('p2_right', px(0.94),  py(0.875), dpad, dpad, '►', 0x444466, 0x6666aa);
    this.createButton('p2_jump',  px(0.894), py(0.73),  jump, jumpH, 'JUMP', 0x2255aa, 0x4488dd);
    this.createButton('p2_kick',  px(0.725), py(0.855), kick, kick, 'KICK', 0xaa2222, 0xdd4444);
    this.createButton('p2_super', px(0.725), py(0.70),  sup,  supH, 'S', 0xaa8800, 0xddbb00);
  }

  private createSingleControls(): void {
    // Single mode (online): more space, larger buttons
    const dpad  = clamp(70);   // d-pad buttons
    const kick  = clamp(90);   // kick button
    const jump  = clamp(110);  // jump width
    const jumpH = clamp(56);   // jump height
    const sup   = clamp(70);   // super button
    const supH  = 48;

    // Left side: D-pad
    this.createButton('p1_left',  px(0.065), py(0.875), dpad, dpad, '◄', 0x444466, 0x6666aa);
    this.createButton('p1_right', px(0.165), py(0.875), dpad, dpad, '►', 0x444466, 0x6666aa);
    this.createButton('p1_jump',  px(0.115), py(0.71),  jump, jumpH, 'JUMP', 0x2255aa, 0x4488dd);

    // Right side: actions
    this.createButton('p1_kick',  px(0.90),  py(0.855), kick, kick, 'KICK', 0xaa2222, 0xdd4444);
    this.createButton('p1_super', px(0.90),  py(0.67),  sup,  supH, 'SUPER', 0xaa8800, 0xddbb00);
  }

  private createButton(
    id: string, x: number, y: number, w: number, h: number,
    text: string, baseColor: number, pressedColor: number,
  ): void {
    const bg = this.scene.add.rectangle(x, y, w, h, baseColor, 0.6);
    bg.setStrokeStyle(2, 0xffffff, 0.3);
    const fontSize = text.length <= 2 ? '22px' : '13px';
    const label = this.scene.add.text(x, y, text, {
      fontSize, fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5);

    this.container.add(bg);
    this.container.add(label);

    this.buttons.set(id, { bg, label, pressed: false, baseColor, pressedColor });
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
      const rect = btn.bg.getBounds();
      if (rect.contains(pointer.worldX, pointer.worldY)) {
        this.pressButton(id, btn, isNewPress);
      }
    }
  }

  private pressButton(id: string, btn: TouchButton, isNewPress: boolean): void {
    // Visual feedback
    btn.bg.setFillStyle(btn.pressedColor, 0.8);
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
    // Reset visual state and continuous inputs
    for (const [id, btn] of this.buttons) {
      btn.bg.setFillStyle(btn.baseColor, 0.6);
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
