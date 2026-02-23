import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager';

export interface ButtonOptions {
  width?: number;
  height?: number;
  fillColor?: number;
  strokeColor?: number;
  fontSize?: string;
  fontFamily?: string;
  textColor?: string;
  depth?: number;
}

export interface ButtonGroup {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

const DEFAULTS = {
  width: 200,
  height: 42,
  fillColor: 0x2a2a4e,
  strokeColor: 0x00ccff,
  fontSize: '16px',
  fontFamily: 'Arial',
  textColor: '#ffffff',
};

/**
 * Creates a consistent button across all scenes with hover/press animations and sound.
 */
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
  const fill = options?.fillColor ?? DEFAULTS.fillColor;
  const stroke = options?.strokeColor ?? DEFAULTS.strokeColor;
  const fontSize = options?.fontSize ?? DEFAULTS.fontSize;
  const fontFamily = options?.fontFamily ?? DEFAULTS.fontFamily;
  const textColor = options?.textColor ?? DEFAULTS.textColor;
  const depth = options?.depth ?? 0;

  const container = scene.add.container(x, y).setDepth(depth);

  const bg = scene.add.rectangle(0, 0, w, h, fill, 0.9);
  bg.setStrokeStyle(2, stroke);
  bg.setInteractive({ useHandCursor: true });
  container.add(bg);

  const label = scene.add.text(0, 0, text, {
    fontSize,
    fontFamily,
    color: textColor,
  }).setOrigin(0.5);
  container.add(label);

  // Lighter fill on hover
  const hoverColor = lightenColor(fill, 0.2);

  bg.on('pointerover', () => {
    bg.setFillStyle(hoverColor, 1);
    scene.tweens.add({
      targets: container,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 80,
      ease: 'Sine.easeOut',
    });
  });

  bg.on('pointerout', () => {
    bg.setFillStyle(fill, 0.9);
    scene.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 80,
      ease: 'Sine.easeOut',
    });
  });

  bg.on('pointerdown', () => {
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

  return { container, bg, label };
}

function lightenColor(color: number, amount: number): number {
  const r = Math.min(255, ((color >> 16) & 0xff) + Math.round(255 * amount));
  const g = Math.min(255, ((color >> 8) & 0xff) + Math.round(255 * amount));
  const b = Math.min(255, (color & 0xff) + Math.round(255 * amount));
  return (r << 16) | (g << 8) | b;
}
