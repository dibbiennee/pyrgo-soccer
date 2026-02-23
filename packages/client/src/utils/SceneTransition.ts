import Phaser from 'phaser';

let transitioning = false;

/**
 * Fade-out then start a new scene with optional data.
 * Guard flag prevents double-clicks during transition.
 */
export function transitionTo(
  scene: Phaser.Scene,
  target: string,
  data?: Record<string, unknown>,
  options?: { duration?: number },
): void {
  if (transitioning) return;
  transitioning = true;

  const duration = options?.duration ?? 300;
  scene.cameras.main.fadeOut(duration, 0, 0, 0);
  scene.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
    transitioning = false;
    scene.scene.start(target, data);
  });
}

/**
 * Call in create() of every scene for a smooth fade-in.
 */
export function fadeIn(scene: Phaser.Scene, duration = 300): void {
  scene.cameras.main.fadeIn(duration, 0, 0, 0);
}
