import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

export type ToastType = 'info' | 'success' | 'error';

const COLORS: Record<ToastType, { bg: number; text: string; stroke: number }> = {
  info: { bg: 0x2a2a4e, text: '#ffffff', stroke: 0x00ccff },
  success: { bg: 0x1a4a2e, text: '#88ff88', stroke: 0x00ff66 },
  error: { bg: 0x4a1a1a, text: '#ff8888', stroke: 0xff4444 },
};

/**
 * Shows a toast notification that slides up from the bottom and fades out.
 */
export function showToast(
  scene: Phaser.Scene,
  message: string,
  type: ToastType = 'info',
): void {
  const style = COLORS[type];
  const y = GAME_HEIGHT + 20;
  const targetY = GAME_HEIGHT - 40;

  const bg = scene.add.rectangle(GAME_WIDTH / 2, y, 300, 36, style.bg, 0.95)
    .setStrokeStyle(2, style.stroke)
    .setDepth(500);

  const text = scene.add.text(GAME_WIDTH / 2, y, message, {
    fontSize: '14px',
    fontFamily: 'Arial',
    color: style.text,
  }).setOrigin(0.5).setDepth(501);

  // Slide up
  scene.tweens.add({
    targets: [bg, text],
    y: targetY,
    duration: 250,
    ease: 'Back.easeOut',
  });

  // Fade out after delay
  scene.time.delayedCall(1500, () => {
    scene.tweens.add({
      targets: [bg, text],
      alpha: 0,
      y: targetY - 20,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        bg.destroy();
        text.destroy();
      },
    });
  });
}
