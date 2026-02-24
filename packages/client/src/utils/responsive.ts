import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

/**
 * Computes the base camera zoom for game scenes.
 * Scales the 800×480 physics world to fill the design resolution.
 */
export function getBaseZoom(scene: Phaser.Scene): number {
  const sw = scene.scale.width;
  const sh = scene.scale.height;
  return Math.min(sw / GAME_WIDTH, sh / GAME_HEIGHT);
}

/**
 * Sets up camera zoom for game scenes (LocalGame, CpuGame, OnlineGame).
 * Called once in create() — no resize listener needed with FIT mode.
 */
export function setupGameCamera(scene: Phaser.Scene): void {
  const zoom = getBaseZoom(scene);
  scene.cameras.main.setZoom(zoom);
  scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
