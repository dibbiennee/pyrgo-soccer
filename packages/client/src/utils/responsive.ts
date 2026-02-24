import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

/**
 * Sets up camera zoom for game scenes (LocalGame, CpuGame, OnlineGame).
 * Dynamically scales the 800×480 physics world to fill the current screen.
 * Also listens for resize events to re-zoom.
 */
export function setupGameCamera(scene: Phaser.Scene): void {
  const apply = () => {
    const sw = scene.scale.width;
    const sh = scene.scale.height;
    const zoom = Math.min(sw / GAME_WIDTH, sh / GAME_HEIGHT);
    scene.cameras.main.setZoom(zoom);
    scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  };
  apply();
  scene.scale.on('resize', apply);
}
