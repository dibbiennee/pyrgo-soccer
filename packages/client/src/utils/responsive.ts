import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

/**
 * Sets camera zoom so the 800x480 game area is always fully visible
 * and centered within the RESIZE-mode viewport.
 * On wider/narrower screens the extra space shows background color.
 */
export function setupResponsiveCamera(scene: Phaser.Scene): void {
  const resize = () => {
    const { width, height } = scene.scale;
    const zoom = Math.min(width / GAME_WIDTH, height / GAME_HEIGHT);
    scene.cameras.main.setZoom(zoom);
    scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  };
  resize();
  scene.scale.on('resize', resize);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', resize);
  });
}
