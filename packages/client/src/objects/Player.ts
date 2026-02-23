import Phaser from 'phaser';
import {
  PLAYER_HEAD_RADIUS,
  PLAYER_BODY_WIDTH,
  PLAYER_BODY_HEIGHT,
  PLAYER_BASE_SPEED,
  PLAYER_SPEED_PER_POINT,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  MAX_JUMPS,
  KICK_BASE_FORCE,
  KICK_POWER_PER_POINT,
  KICK_HITBOX_WIDTH,
  KICK_HITBOX_HEIGHT,
  KICK_DURATION_MS,
  GROUND_Y,
  SUPER_MAX,
  SUPER_CHARGE_KICK,
  SUPER_CHARGE_HEADER,
  SUPER_CHARGE_GOAL,
  defaultAppearanceForPreset,
} from '@pyrgo/shared';
import type { CharacterDef, InputState, SuperMoveId, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';

export class Player extends Phaser.GameObjects.Container {
  public body!: Phaser.Physics.Arcade.Body;

  public playerIndex: number; // 1 or 2
  public facingRight: boolean;
  public jumpsRemaining = MAX_JUMPS;
  public isKicking = false;
  public superMeter = 0;
  public superActive = false;
  public characterDef: CharacterDef;

  private kickHitbox: Phaser.GameObjects.Rectangle;
  private kickTimer?: Phaser.Time.TimerEvent;

  // Super move state
  public superTimer?: Phaser.Time.TimerEvent;
  public flameDashActive = false;
  public thunderKickReady = false;
  public ghostPhaseActive = false;
  public ironWall?: Phaser.GameObjects.Rectangle;
  public poisonShotActive = false;
  public iceFieldActive = false;

  // Computed stats
  public moveSpeed: number;
  public kickForce: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    playerIndex: number,
    characterDef: CharacterDef,
  ) {
    super(scene, x, y);
    this.playerIndex = playerIndex;
    this.characterDef = characterDef;
    this.facingRight = playerIndex === 1;

    // Compute stats
    this.moveSpeed = PLAYER_BASE_SPEED + characterDef.stats.speed * PLAYER_SPEED_PER_POINT;
    this.kickForce = KICK_BASE_FORCE + characterDef.stats.power * KICK_POWER_PER_POINT;

    // Draw character using CharacterRenderer
    const appearance: Appearance = characterDef.appearance ?? defaultAppearanceForPreset(characterDef.id);
    const parts = CharacterRenderer.renderCharacter(scene, appearance, { facingRight: this.facingRight });
    for (const part of parts) {
      this.add(part);
    }

    // Kick hitbox (invisible, used for overlap)
    this.kickHitbox = scene.add.rectangle(
      this.facingRight ? PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2 : -(PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2),
      0,
      KICK_HITBOX_WIDTH,
      KICK_HITBOX_HEIGHT,
      0xff0000,
      0,
    );
    this.add(this.kickHitbox);

    // Add to scene and enable physics
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Configure physics body
    this.body.setSize(PLAYER_BODY_WIDTH, PLAYER_HEAD_RADIUS * 2 + PLAYER_BODY_HEIGHT);
    this.body.setOffset(-PLAYER_BODY_WIDTH / 2, -(PLAYER_HEAD_RADIUS * 2 + PLAYER_BODY_HEIGHT) / 2);
    this.body.setCollideWorldBounds(true);
    this.body.setBounce(0, 0);
    this.body.setMaxVelocity(600, 800);

    // Defense stat: ball speed reduction applied in scene on body contact
  }

  handleInput(input: InputState): void {
    // Horizontal movement
    if (input.left) {
      this.body.setVelocityX(-this.getEffectiveSpeed());
      this.setFacing(false);
    } else if (input.right) {
      this.body.setVelocityX(this.getEffectiveSpeed());
      this.setFacing(true);
    } else {
      this.body.setVelocityX(0);
    }

    // Jump
    if (input.jump && this.jumpsRemaining > 0) {
      const jumpVel = this.jumpsRemaining === MAX_JUMPS ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY;
      this.body.setVelocityY(jumpVel);
      this.jumpsRemaining--;
    }

    // Kick
    if (input.kick && !this.isKicking) {
      this.performKick();
    }

    // Super
    if (input.super && this.superMeter >= SUPER_MAX && !this.superActive) {
      this.activateSuper();
    }

    // Reset jumps on ground
    if (this.body.blocked.down || this.body.touching.down) {
      this.jumpsRemaining = MAX_JUMPS;
    }
  }

  private getEffectiveSpeed(): number {
    if (this.flameDashActive) return this.moveSpeed * 1.5;
    return this.moveSpeed;
  }

  private setFacing(right: boolean): void {
    if (this.facingRight === right) return;
    this.facingRight = right;
    // Move kick hitbox
    this.kickHitbox.x = right
      ? PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2
      : -(PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2);
  }

  performKick(): void {
    this.isKicking = true;

    // Visual kick animation - quick arm swing
    const arm = this.scene.add.rectangle(
      this.facingRight ? PLAYER_BODY_WIDTH / 2 + 10 : -(PLAYER_BODY_WIDTH / 2 + 10),
      5,
      16,
      6,
      this.characterDef.color,
    );
    this.add(arm);

    this.kickTimer = this.scene.time.delayedCall(KICK_DURATION_MS, () => {
      this.isKicking = false;
      arm.destroy();
    });
  }

  getKickWorldPosition(): { x: number; y: number; width: number; height: number } {
    const kickX = this.facingRight
      ? this.x + PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2
      : this.x - (PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2);
    return {
      x: kickX - KICK_HITBOX_WIDTH / 2,
      y: this.y - KICK_HITBOX_HEIGHT / 2,
      width: KICK_HITBOX_WIDTH,
      height: KICK_HITBOX_HEIGHT,
    };
  }

  getEffectiveKickForce(): number {
    let force = this.kickForce;
    if (this.flameDashActive) force *= 1.5;
    if (this.thunderKickReady) force *= 3;
    return force;
  }

  chargeSuperFromKick(): void {
    this.addSuperCharge(SUPER_CHARGE_KICK);
  }

  chargeSuperFromHeader(): void {
    this.addSuperCharge(SUPER_CHARGE_HEADER);
  }

  chargeSuperFromGoal(): void {
    this.addSuperCharge(SUPER_CHARGE_GOAL);
  }

  private addSuperCharge(amount: number): void {
    this.superMeter = Math.min(SUPER_MAX, this.superMeter + amount);
  }

  activateSuper(): void {
    this.superMeter = 0;
    this.superActive = true;
    this.emit('superActivated');

    switch (this.characterDef.superMove) {
      case 'flameDash':
        this.flameDashActive = true;
        this.emitSuperParticles(0xff4400);
        this.superTimer = this.scene.time.delayedCall(2000, () => {
          this.flameDashActive = false;
          this.superActive = false;
        });
        break;

      case 'thunderKick':
        this.thunderKickReady = true;
        this.emitSuperParticles(0xffee00);
        // Stays until next kick
        break;

      case 'ghostPhase':
        this.ghostPhaseActive = true;
        this.setAlpha(0.4);
        this.emitSuperParticles(0xaa44ff);
        this.superTimer = this.scene.time.delayedCall(2000, () => {
          this.ghostPhaseActive = false;
          this.superActive = false;
          this.setAlpha(1);
          this.emit('ghostPhaseEnd');
        });
        break;

      case 'ironWall': {
        const wallX = this.playerIndex === 1 ? 60 : 740;
        this.ironWall = this.scene.add.rectangle(wallX, GROUND_Y - 60, 12, 120, 0x00ccff, 0.7);
        this.scene.physics.add.existing(this.ironWall, true);
        this.emitSuperParticles(0x00ccff);
        this.superTimer = this.scene.time.delayedCall(3000, () => {
          this.ironWall?.destroy();
          this.ironWall = undefined;
          this.superActive = false;
        });
        break;
      }

      case 'poisonShot':
        this.poisonShotActive = true;
        this.emitSuperParticles(0x88ff00);
        // Active until next goal
        break;

      case 'iceField':
        this.iceFieldActive = true;
        this.emitSuperParticles(0x88ddff);
        this.superTimer = this.scene.time.delayedCall(3000, () => {
          this.iceFieldActive = false;
          this.superActive = false;
        });
        break;
    }
  }

  consumeThunderKick(): void {
    this.thunderKickReady = false;
    this.superActive = false;
  }

  consumePoisonShot(): void {
    this.poisonShotActive = false;
    this.superActive = false;
  }

  public emitSuperParticles(color: number): void {
    // Create simple particle effect
    const particles = this.scene.add.particles(this.x, this.y, undefined, {
      speed: { min: 50, max: 150 },
      scale: { start: 0.5, end: 0 },
      lifespan: 600,
      quantity: 15,
      emitting: false,
    });

    // Use colored circles as particles
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 50 + Math.random() * 100;
      const particle = this.scene.add.arc(
        this.x, this.y,
        3 + Math.random() * 3,
        0, 360, false, color, 0.8,
      );
      this.scene.tweens.add({
        targets: particle,
        x: this.x + Math.cos(angle) * speed,
        y: this.y + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 500 + Math.random() * 300,
        onComplete: () => particle.destroy(),
      });
    }
    particles.destroy();
  }

  getHeadWorldY(): number {
    return this.y - PLAYER_BODY_HEIGHT / 2 - PLAYER_HEAD_RADIUS;
  }

  getHeadWorldBounds(): { x: number; y: number; radius: number } {
    return {
      x: this.x,
      y: this.getHeadWorldY(),
      radius: PLAYER_HEAD_RADIUS,
    };
  }

  resetPosition(x: number, y: number): void {
    this.setPosition(x, y);
    this.body.setVelocity(0, 0);
    this.jumpsRemaining = MAX_JUMPS;
    this.isKicking = false;
  }

  destroy(fromScene?: boolean): void {
    this.kickTimer?.destroy();
    this.superTimer?.destroy();
    this.ironWall?.destroy();
    super.destroy(fromScene);
  }
}
