import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';
import { THEME } from './UITheme';

export type ToastType = 'info' | 'success' | 'error';

const COLORS: Record<ToastType, { bg: number; text: string; stroke: number }> = {
  info: { bg: THEME.cardBg, text: '#ffffff', stroke: THEME.primary },
  success: { bg: 0x0a4a2e, text: '#88ff88', stroke: THEME.success },
  error: { bg: 0x4a1a1a, text: '#ff8888', stroke: THEME.danger },
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
  const w = 300;
  const h = 36;
  const radius = 10;

  const gfx = scene.add.graphics().setDepth(500);
  gfx.y = y;
  // Shadow
  gfx.fillStyle(THEME.shadowColor, 0.3);
  gfx.fillRoundedRect(GAME_WIDTH / 2 - w / 2 + 2, -h / 2 + 3, w, h, radius);
  // Fill
  gfx.fillStyle(style.bg, 0.95);
  gfx.fillRoundedRect(GAME_WIDTH / 2 - w / 2, -h / 2, w, h, radius);
  // Stroke
  gfx.lineStyle(2, style.stroke, 1);
  gfx.strokeRoundedRect(GAME_WIDTH / 2 - w / 2, -h / 2, w, h, radius);

  const text = scene.add.text(GAME_WIDTH / 2, y, message, {
    fontSize: '14px',
    fontFamily: 'Arial',
    color: style.text,
  }).setOrigin(0.5).setDepth(501);

  // Slide up
  scene.tweens.add({
    targets: [gfx, text],
    y: targetY,
    duration: 250,
    ease: 'Back.easeOut',
  });

  // Fade out after delay
  scene.time.delayedCall(1500, () => {
    scene.tweens.add({
      targets: [gfx, text],
      alpha: 0,
      y: targetY - 20,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        gfx.destroy();
        text.destroy();
      },
    });
  });
}
