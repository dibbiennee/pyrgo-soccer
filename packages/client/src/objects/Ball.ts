import Phaser from 'phaser';
import {
  BALL_RADIUS,
  BALL_MAX_SPEED,
  BALL_BOUNCE_GROUND,
  BALL_BOUNCE_WALL,
  BALL_DRAG,
  BALL_START_X,
  BALL_START_Y,
} from '@pyrgo/shared';

export class Ball extends Phaser.GameObjects.Container {
  public body!: Phaser.Physics.Arcade.Body;
  public poisoned = false;
  public gravityIgnored = false;
  public superTrailColor: number | null = null;

  private circle: Phaser.GameObjects.Arc;
  private trail: Phaser.GameObjects.Arc[] = [];
  private trailTimer = 0;
  private afterimages: Phaser.GameObjects.Arc[] = [];
  private afterimageTimer = 0;
  private wasOnGround = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);

    // Draw ball
    this.circle = scene.add.arc(0, 0, BALL_RADIUS, 0, 360, false, 0xffffff);
    this.circle.setStrokeStyle(2, 0x333333);
    this.add(this.circle);

    // Pentagon pattern
    const inner = scene.add.arc(0, 0, BALL_RADIUS * 0.4, 0, 360, false, 0x333333);
    this.add(inner);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics
    this.body.setCircle(BALL_RADIUS, -BALL_RADIUS, -BALL_RADIUS);
    this.body.setBounce(BALL_BOUNCE_GROUND, BALL_BOUNCE_GROUND);
    this.body.setCollideWorldBounds(true);
    this.body.setDrag(BALL_DRAG, 0);
    this.body.setMaxVelocity(BALL_MAX_SPEED, BALL_MAX_SPEED);

    // Walls have different bounce - handled in scene collision callbacks
  }

  update(time: number, delta: number): void {
    // Gravity override for Titan super
    if (this.gravityIgnored) {
      this.body.setAllowGravity(false);
    } else {
      this.body.setAllowGravity(true);
    }

    // Clamp speed
    const vx = this.body.velocity.x;
    const vy = this.body.velocity.y;
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > BALL_MAX_SPEED) {
      const scale = BALL_MAX_SPEED / speed;
      this.body.setVelocity(vx * scale, vy * scale);
    }

    // Visual rotation based on horizontal velocity
    this.angle += vx * 0.01 * (delta / 16.67);

    // Ball trail
    this.trailTimer += delta;
    if (this.trailTimer > 30 && speed > 200) {
      this.trailTimer = 0;
      this.addTrailDot();
    }

    // Speed afterimages (motion blur) when speed > 500
    if (speed > 500) {
      this.afterimageTimer += delta;
      if (this.afterimageTimer > 50) {
        this.afterimageTimer = 0;
        this.addAfterimage();
      }
    }

    // Fade trail
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const dot = this.trail[i];
      dot.alpha -= 0.05;
      if (dot.alpha <= 0) {
        dot.destroy();
        this.trail.splice(i, 1);
      }
    }

    // Fade afterimages
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const img = this.afterimages[i];
      img.alpha -= 0.1;
      if (img.alpha <= 0) {
        img.destroy();
        this.afterimages.splice(i, 1);
      }
    }

    // Bounce dust on ground contact
    const onGround = this.body.blocked.down;
    if (onGround && !this.wasOnGround && Math.abs(vy) > 100) {
      this.emitBounceDust();
    }
    this.wasOnGround = onGround;

    // Poison visual
    if (this.poisoned) {
      this.circle.setFillStyle(0x44ff00);
    } else {
      this.circle.setFillStyle(0xffffff);
    }
  }

  private addTrailDot(): void {
    const trailColor = this.superTrailColor ?? (this.poisoned ? 0x44ff00 : 0xffffff);
    const dot = this.scene.add.arc(this.x, this.y, BALL_RADIUS * 0.6, 0, 360, false,
      trailColor, 0.4);
    dot.setDepth(-1);
    this.trail.push(dot);
    if (this.trail.length > 8) {
      const old = this.trail.shift();
      old?.destroy();
    }
  }

  private addAfterimage(): void {
    const color = this.superTrailColor ?? (this.poisoned ? 0x44ff00 : 0xffffff);
    const img = this.scene.add.arc(this.x, this.y, BALL_RADIUS, 0, 360, false, color, 0.25);
    img.setDepth(-1);
    this.afterimages.push(img);
    if (this.afterimages.length > 3) {
      const old = this.afterimages.shift();
      old?.destroy();
    }
  }

  private emitBounceDust(): void {
    for (let i = 0; i < 4; i++) {
      const dx = (Math.random() - 0.5) * 20;
      const dust = this.scene.add.arc(
        this.x + dx, this.y + BALL_RADIUS, 2, 0, 360, false, 0x8b7355, 0.5,
      );
      this.scene.tweens.add({
        targets: dust,
        y: this.y + BALL_RADIUS - 10 - Math.random() * 10,
        x: this.x + dx + (Math.random() - 0.5) * 15,
        alpha: 0,
        scale: 0.3,
        duration: 300 + Math.random() * 200,
        onComplete: () => dust.destroy(),
      });
    }
  }

  applyKick(directionX: number, directionY: number, force: number): void {
    this.body.setVelocity(directionX * force, directionY * force);
  }

  applyHeader(towardRight: boolean): void {
    const hx = towardRight ? 250 : -250;
    this.body.setVelocity(hx, -300);
  }

  resetPosition(): void {
    this.setPosition(BALL_START_X, BALL_START_Y);
    this.body.setVelocity(0, 0);
    this.poisoned = false;
    this.gravityIgnored = false;
    this.superTrailColor = null;
  }

  clearTrail(): void {
    this.trail.forEach(d => d.destroy());
    this.trail = [];
    this.afterimages.forEach(d => d.destroy());
    this.afterimages = [];
  }

  destroy(fromScene?: boolean): void {
    this.clearTrail();
    super.destroy(fromScene);
  }
}
