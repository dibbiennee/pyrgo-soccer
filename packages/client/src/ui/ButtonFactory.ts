import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';
import { THEME, BUTTON_STYLES, type ButtonStyleDef } from './UITheme';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fillColor?: number;
  strokeColor?: number;
  strokeThickness?: number;
  fontSize?: string;
  fontFamily?: string;
  textColor?: string;
  depth?: number;
  style?: 'primary' | 'secondary' | 'success' | 'danger' | 'ghost';
}

export interface ButtonGroup {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
  hitArea: Phaser.GameObjects.Rectangle;
  redraw: (overrideFill?: number) => void;
  disable: () => void;
}

const DEFAULTS = {
  width: 200,
  height: 42,
  fontSize: '16px',
  fontFamily: 'Arial',
  textColor: '#ffffff',
  radius: 12,
};

export function createButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  callback: () => void,
  options?: ButtonOptions,
): ButtonGroup {
  const w = options?.width ?? DEFAULTS.width;
  const h = options?.height ?? DEFAULTS.height;
  const fontSize = options?.fontSize ?? DEFAULTS.fontSize;
  const fontFamily = options?.fontFamily ?? DEFAULTS.fontFamily;
  const textColor = options?.textColor ?? DEFAULTS.textColor;
  const depth = options?.depth ?? 0;
  const radius = DEFAULTS.radius;

  // Resolve style
  const styleName = options?.style ?? 'secondary';
  const styleDef: ButtonStyleDef = BUTTON_STYLES[styleName] ?? BUTTON_STYLES.secondary;

  // Allow explicit color overrides to win over style
  const fillTop = options?.fillColor ?? styleDef.fillTop;
  const fillBottom = options?.fillColor ? lightenColor(options.fillColor, -0.1) : styleDef.fillBottom;
  const stroke = options?.strokeColor ?? styleDef.stroke;
  const glowColor = styleDef.glowColor;
  const hasShadow = styleName !== 'ghost';
  const hasGlow = styleName === 'primary' || styleName === 'success' || styleName === 'danger';

  const container = scene.add.container(x, y).setDepth(depth);

  const bg = scene.add.graphics();
  container.add(bg);

  let disabled = false;
  let currentFillTop = fillTop;
  let currentFillBottom = fillBottom;

  function draw(ft: number, fb: number, s: number): void {
    bg.clear();
    // Shadow
    if (hasShadow) {
      bg.fillStyle(THEME.shadowColor, 0.35);
      bg.fillRoundedRect(-w / 2 + 2, -h / 2 + 3, w, h, radius);
    }
    // Glow
    if (hasGlow && !disabled) {
      bg.fillStyle(glowColor, 0.1);
      bg.fillRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, radius + 1);
    }
    // Gradient fill
    bg.fillGradientStyle(ft, ft, fb, fb);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, radius);
    // Stroke
    bg.lineStyle(options?.strokeThickness ?? 2, s, 1);
    bg.strokeRoundedRect(-w / 2, -h / 2, w, h, radius);
  }

  draw(fillTop, fillBottom, stroke);

  // Invisible hit area for pointer events
  const hitArea = scene.add.rectangle(0, 0, w, h, 0x000000, 0);
  hitArea.setInteractive({ useHandCursor: true });
  container.add(hitArea);

  const label = scene.add.text(0, 0, text, {
    fontSize,
    fontFamily,
    color: textColor,
  }).setOrigin(0.5);
  container.add(label);

  const hoverTop = lightenColor(fillTop, 0.15);
  const hoverBottom = lightenColor(fillBottom, 0.15);

  hitArea.on('pointerover', () => {
    if (disabled) return;
    draw(hoverTop, hoverBottom, stroke);
    scene.tweens.add({
      targets: container,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 80,
      ease: 'Sine.easeOut',
    });
  });

  hitArea.on('pointerout', () => {
    if (disabled) return;
    draw(currentFillTop, currentFillBottom, stroke);
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 80,
      ease: 'Sine.easeOut',
    });
  });

  hitArea.on('pointerdown', () => {
    if (disabled) return;
    SoundManager.getInstance().menuClick();
    scene.tweens.add({
      targets: container,
      scaleX: 0.95,
      scaleY: 0.95,
      duration: 30,
      yoyo: true,
      onComplete: () => {
        callback();
      },
    });
  });

  function redraw(overrideFill?: number): void {
    if (overrideFill !== undefined) {
      currentFillTop = overrideFill;
      currentFillBottom = lightenColor(overrideFill, -0.1);
    } else {
      currentFillTop = fillTop;
      currentFillBottom = fillBottom;
    }
    draw(currentFillTop, currentFillBottom, stroke);
  }

  function disableBtn(): void {
    disabled = true;
    currentFillTop = 0x333355;
    currentFillBottom = 0x2a2a44;
    draw(currentFillTop, currentFillBottom, 0x444466);
    hitArea.removeInteractive();
  }

  return { container, bg, label, hitArea, redraw, disable: disableBtn };
}

function lightenColor(color: number, amount: number): number {
  let r = (color >> 16) & 0xff;
  let g = (color >> 8) & 0xff;
  let b = color & 0xff;
  if (amount >= 0) {
    r = Math.min(255, r + Math.round(255 * amount));
    g = Math.min(255, g + Math.round(255 * amount));
    b = Math.min(255, b + Math.round(255 * amount));
  } else {
    const factor = 1 + amount;
    r = Math.max(0, Math.round(r * factor));
    g = Math.max(0, Math.round(g * factor));
    b = Math.max(0, Math.round(b * factor));
  }
  return (r << 16) | (g << 8) | b;
}
