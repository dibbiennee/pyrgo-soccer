import { GAME_WIDTH, GAME_HEIGHT } from '@pyrgo/shared';

export interface ViewEdges {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Returns the visible world-space edges for the current viewport.
 * With FILL zoom, some edges of the 800×480 world may be cropped.
 * Use this to position elements that must stay within the visible area.
 */
export function getViewEdges(scene: Phaser.Scene): ViewEdges {
  const { width, height } = scene.scale;
  const zoom = Math.max(width / GAME_WIDTH, height / GAME_HEIGHT);
  const visibleW = width / zoom;
  const visibleH = height / zoom;
  return {
    left: (GAME_WIDTH - visibleW) / 2,
    right: (GAME_WIDTH + visibleW) / 2,
    top: (GAME_HEIGHT - visibleH) / 2,
    bottom: (GAME_HEIGHT + visibleH) / 2,
  };
}

/**
 * FILL zoom: the 800×480 world fills the entire viewport with no black bars.
 * Some edges may be cropped on screens with different aspect ratios.
 */
export function setupResponsiveCamera(scene: Phaser.Scene): void {
  const resize = () => {
    const { width, height } = scene.scale;
    const zoom = Math.max(width / GAME_WIDTH, height / GAME_HEIGHT);
    scene.cameras.main.setZoom(zoom);
    scene.cameras.main.centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
  };
  resize();
  scene.scale.on('resize', resize);
  scene.events.once('shutdown', () => {
    scene.scale.off('resize', resize);
  });
}
