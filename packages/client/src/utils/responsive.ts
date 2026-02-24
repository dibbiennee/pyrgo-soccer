import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

/** Design resolution for the Phaser canvas */
export const CANVAS_W = 1280;
export const CANVAS_H = 720;

/**
 * Sets up camera zoom for game scenes (LocalGame, CpuGame, OnlineGame).
 * Scales the 800×480 physics world to fill the 1280×720 canvas.
 * zoom = min(1280/800, 720/480) = 1.5
 */
export function setupGameCamera(scene: Phaser.Scene): void {
  const zoom = Math.min(CANVAS_W / GAME_WIDTH, CANVAS_H / GAME_HEIGHT);
  scene.cameras.main.setZoom(zoom);
  scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
