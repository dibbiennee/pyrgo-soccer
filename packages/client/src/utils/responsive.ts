import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

/**
 * Sets up camera zoom for game scenes (LocalGame, CpuGame, OnlineGame).
 * Scales the 800×480 physics world to fill the design resolution.
 * Called once in create() — no resize listener needed with FIT mode.
 */
export function setupGameCamera(scene: Phaser.Scene): void {
  const sw = scene.scale.width;
  const sh = scene.scale.height;
  const zoom = Math.min(sw / GAME_WIDTH, sh / GAME_HEIGHT);
  scene.cameras.main.setZoom(zoom);
  scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
}
