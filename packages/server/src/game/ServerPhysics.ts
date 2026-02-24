import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_Y,
  GRAVITY,
  BALL_MAX_SPEED,
  BALL_BOUNCE_GROUND,
  BALL_DRAG,
  BALL_RADIUS,
  PLAYER_BASE_SPEED,
  PLAYER_SPEED_PER_POINT,
  PLAYER_BODY_WIDTH,
  PLAYER_BODY_HEIGHT,
  PLAYER_HEAD_RADIUS,
  PLAYER_TOTAL_HEIGHT,
  JUMP_VELOCITY,
  DOUBLE_JUMP_VELOCITY,
  MAX_JUMPS,
  KICK_BASE_FORCE,
  KICK_POWER_PER_POINT,
  KICK_HITBOX_WIDTH,
  KICK_HITBOX_HEIGHT,
  KICK_DURATION_MS,
  GOAL_WIDTH,
  GOAL_HEIGHT,
  GOAL_Y,
  GOAL_LEFT_X,
  GOAL_RIGHT_X,
  HEADER_FORCE_X,
  HEADER_FORCE_Y,
  SUPER_CHARGE_KICK,
  SUPER_CHARGE_HEADER,
  SUPER_MAX,
  DEF_BALL_SPEED_REDUCTION_PER_POINT,
  SERVER_TICK_MS,
} from '@pyrgo/shared';
import type { InputState, PlayerState, BallState, CharacterDef } from '@pyrgo/shared';

export interface PhysicsEvent {
  type: 'kick' | 'header' | 'superActivated';
  playerIndex: number;
  superMoveId?: string;
}

export interface PhysicsPlayer {
  state: PlayerState;
  charDef: CharacterDef;
  moveSpeed: number;
  kickForce: number;
  kickTimer: number; // ms remaining
  superTimer: number; // ms remaining
  flameDashActive: boolean;
  thunderKickReady: boolean;
  ghostPhaseActive: boolean;
  ghostKickDelay: number; // ms remaining before ghost teleport kick
  ironWallActive: boolean;
  poisonShotActive: boolean;
  iceFieldActive: boolean;
}

export interface PhysicsState {
  players: [PhysicsPlayer, PhysicsPlayer];
  ball: BallState;
  goalScored: number | null; // player who scored, or null
  events: PhysicsEvent[];
}

export class ServerPhysics {
  static createPlayer(index: number, charDef: CharacterDef, spawnX: number): PhysicsPlayer {
    return {
      state: {
        id: index,
        x: spawnX,
        y: GROUND_Y - PLAYER_TOTAL_HEIGHT / 2,
        vx: 0,
        vy: 0,
        facingRight: index === 1,
        jumpsRemaining: MAX_JUMPS,
        isKicking: false,
        superMeter: 0,
        superActive: false,
        characterId: charDef.id,
      },
      charDef,
      moveSpeed: PLAYER_BASE_SPEED + charDef.stats.speed * PLAYER_SPEED_PER_POINT,
      kickForce: KICK_BASE_FORCE + charDef.stats.power * KICK_POWER_PER_POINT,
      kickTimer: 0,
      superTimer: 0,
      flameDashActive: false,
      thunderKickReady: false,
      ghostPhaseActive: false,
      ghostKickDelay: 0,
      ironWallActive: false,
      poisonShotActive: false,
      iceFieldActive: false,
    };
  }

  static tick(state: PhysicsState, inputs: [InputState, InputState], dt: number): void {
    const dtSec = dt / 1000;

    // Reset events each tick
    state.events = [];

    // Process each player
    for (let i = 0; i < 2; i++) {
      const player = state.players[i];
      const input = inputs[i];
      this.processPlayerInput(player, input, state, dtSec, dt);
    }

    // Update ball
    this.updateBall(state.ball, dtSec);

    // Ball-player collisions
    for (const player of state.players) {
      if (!player.ghostPhaseActive) {
        this.ballPlayerCollision(state.ball, player, state);
      }
    }

    // Iron wall-ball collisions
    for (const player of state.players) {
      this.checkIronWallCollision(state.ball, player);
    }

    // Check goals
    state.goalScored = this.checkGoal(state.ball);
  }

  private static processPlayerInput(player: PhysicsPlayer, input: InputState, state: PhysicsState, dtSec: number, dtMs: number): void {
    const s = player.state;
    // Fix #1: Flame Dash speed 2x → 1.5x (aligns with Player.ts)
    const speed = player.flameDashActive ? player.moveSpeed * 1.5 : player.moveSpeed;

    // Ice field effect
    const opponent = state.players[s.id === 1 ? 1 : 0];
    const iced = opponent.iceFieldActive;

    // Horizontal movement
    if (input.left) {
      s.vx = iced ? Math.max(s.vx - speed * 0.1, -speed) : -speed;
      s.facingRight = false;
    } else if (input.right) {
      s.vx = iced ? Math.min(s.vx + speed * 0.1, speed) : speed;
      s.facingRight = true;
    } else {
      if (iced) {
        // Fix #8: Ice slide 0.98 → 0.99 (closer to Phaser dragX=10 at 60fps)
        s.vx *= 0.99;
      } else {
        s.vx = 0;
      }
    }

    // Jump
    if (input.jump && s.jumpsRemaining > 0) {
      s.vy = s.jumpsRemaining === MAX_JUMPS ? JUMP_VELOCITY : DOUBLE_JUMP_VELOCITY;
      s.jumpsRemaining--;
    }

    // Kick
    if (input.kick && !s.isKicking) {
      s.isKicking = true;
      player.kickTimer = KICK_DURATION_MS;
    }

    // Update kick timer
    if (player.kickTimer > 0) {
      player.kickTimer -= dtMs;
      if (player.kickTimer <= 0) {
        s.isKicking = false;
      }
    }

    // Super activation
    if (input.super && s.superMeter >= SUPER_MAX && !s.superActive) {
      this.activateSuper(player, state);
    }

    // Update super timers
    if (player.superTimer > 0) {
      player.superTimer -= dtMs;
      if (player.superTimer <= 0) {
        // Fix #7: Ghost phase — start 500ms delay instead of immediate kick
        if (player.ghostPhaseActive) {
          player.ghostKickDelay = 500;
        }
        player.flameDashActive = false;
        player.ghostPhaseActive = false;
        player.ironWallActive = false;
        player.iceFieldActive = false;
        s.superActive = false;
      }
    }

    // Fix #7: Ghost kick delay countdown
    if (player.ghostKickDelay > 0) {
      player.ghostKickDelay -= dtMs;
      if (player.ghostKickDelay <= 0) {
        player.ghostKickDelay = 0;
        this.ghostTeleportKick(player, state.ball);
      }
    }

    // Gravity
    s.vy += GRAVITY * dtSec;

    // Position update
    s.x += s.vx * dtSec;
    s.y += s.vy * dtSec;

    // Ground collision
    const halfH = PLAYER_TOTAL_HEIGHT / 2;
    if (s.y + halfH >= GROUND_Y) {
      s.y = GROUND_Y - halfH;
      s.vy = 0;
      s.jumpsRemaining = MAX_JUMPS;
    }

    // Wall collision
    const halfW = PLAYER_BODY_WIDTH / 2;
    if (s.x - halfW < 0) { s.x = halfW; s.vx = 0; }
    if (s.x + halfW > GAME_WIDTH) { s.x = GAME_WIDTH - halfW; s.vx = 0; }

    // Ceiling
    if (s.y - halfH < 0) { s.y = halfH; s.vy = 0; }

    // Kick-ball check
    if (s.isKicking) {
      this.checkKickBall(player, state.ball, state);
    }
  }

  private static activateSuper(player: PhysicsPlayer, state: PhysicsState): void {
    const s = player.state;
    s.superMeter = 0;
    s.superActive = true;

    // Push event
    state.events.push({
      type: 'superActivated',
      playerIndex: s.id,
      superMoveId: player.charDef.superMove,
    });

    switch (player.charDef.superMove) {
      case 'flameDash':
        player.flameDashActive = true;
        player.superTimer = 2000;
        break;
      case 'thunderKick':
        player.thunderKickReady = true;
        break;
      case 'ghostPhase':
        player.ghostPhaseActive = true;
        player.superTimer = 2000;
        break;
      case 'ironWall':
        player.ironWallActive = true;
        player.superTimer = 3000;
        break;
      case 'poisonShot':
        player.poisonShotActive = true;
        break;
      case 'iceField':
        player.iceFieldActive = true;
        player.superTimer = 3000;
        break;
    }
  }

  private static checkKickBall(player: PhysicsPlayer, ball: BallState, state: PhysicsState): void {
    const s = player.state;
    const kickX = s.facingRight
      ? s.x + PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2
      : s.x - (PLAYER_BODY_WIDTH / 2 + KICK_HITBOX_WIDTH / 2);
    const kickY = s.y;

    // AABB-circle test
    const rectLeft = kickX - KICK_HITBOX_WIDTH / 2;
    const rectRight = kickX + KICK_HITBOX_WIDTH / 2;
    const rectTop = kickY - KICK_HITBOX_HEIGHT / 2;
    const rectBottom = kickY + KICK_HITBOX_HEIGHT / 2;

    const closestX = Math.max(rectLeft, Math.min(ball.x, rectRight));
    const closestY = Math.max(rectTop, Math.min(ball.y, rectBottom));
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;

    if (dx * dx + dy * dy < BALL_RADIUS * BALL_RADIUS) {
      let force = player.kickForce;
      // Fix #2: Flame Dash kick force 2x → 1.5x (aligns with Player.ts)
      if (player.flameDashActive) force *= 1.5;
      if (player.thunderKickReady) {
        force *= 3;
        ball.gravityIgnored = true;
        player.thunderKickReady = false;
        s.superActive = false;
      }

      if (player.poisonShotActive) {
        ball.poisoned = true;
      }

      const dirX = s.facingRight ? 1 : -1;
      ball.vx = dirX * force;
      ball.vy = -0.3 * force;

      // Charge super
      s.superMeter = Math.min(SUPER_MAX, s.superMeter + SUPER_CHARGE_KICK);

      // Push kick event
      state.events.push({ type: 'kick', playerIndex: s.id });
    }
  }

  private static updateBall(ball: BallState, dtSec: number): void {
    // Gravity
    if (!ball.gravityIgnored) {
      ball.vy += GRAVITY * dtSec;
    }

    // Drag
    if (Math.abs(ball.vx) > 0) {
      const dragForce = BALL_DRAG * dtSec;
      if (ball.vx > 0) {
        ball.vx = Math.max(0, ball.vx - dragForce);
      } else {
        ball.vx = Math.min(0, ball.vx + dragForce);
      }
    }

    // Position update
    ball.x += ball.vx * dtSec;
    ball.y += ball.vy * dtSec;

    // Ground bounce
    if (ball.y + BALL_RADIUS >= GROUND_Y) {
      ball.y = GROUND_Y - BALL_RADIUS;
      ball.vy *= -BALL_BOUNCE_GROUND;
    }

    // Fix #4: Ceiling bounce — use BALL_BOUNCE_GROUND (0.7) like Phaser symmetric bounce
    if (ball.y - BALL_RADIUS < 0) {
      ball.y = BALL_RADIUS;
      ball.vy = Math.abs(ball.vy) * BALL_BOUNCE_GROUND;
    }

    // Fix #4: Wall bounce — use BALL_BOUNCE_GROUND (0.7) like Phaser symmetric bounce
    if (ball.x - BALL_RADIUS < 0) {
      ball.x = BALL_RADIUS;
      ball.vx = Math.abs(ball.vx) * BALL_BOUNCE_GROUND;
    }
    if (ball.x + BALL_RADIUS > GAME_WIDTH) {
      ball.x = GAME_WIDTH - BALL_RADIUS;
      ball.vx = -Math.abs(ball.vx) * BALL_BOUNCE_GROUND;
    }

    // Speed clamp
    const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
    if (speed > BALL_MAX_SPEED) {
      const scale = BALL_MAX_SPEED / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }
  }

  private static ballPlayerCollision(ball: BallState, player: PhysicsPlayer, state: PhysicsState): void {
    const s = player.state;

    // Head collision
    const headX = s.x;
    const headY = s.y - PLAYER_BODY_HEIGHT / 2 - PLAYER_HEAD_RADIUS;
    const dx = ball.x - headX;
    const dy = ball.y - headY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minDist = BALL_RADIUS + PLAYER_HEAD_RADIUS;

    if (dist < minDist && dist > 0) {
      // Bounce off head toward opponent's goal
      const towardRight = s.id === 1;
      ball.vx = towardRight ? HEADER_FORCE_X : -HEADER_FORCE_X;
      ball.vy = HEADER_FORCE_Y;

      // Separate
      const overlap = minDist - dist;
      ball.x += (dx / dist) * overlap;
      ball.y += (dy / dist) * overlap;

      s.superMeter = Math.min(SUPER_MAX, s.superMeter + SUPER_CHARGE_HEADER);

      // Push header event
      state.events.push({ type: 'header', playerIndex: s.id });
    }

    // Body collision (AABB vs circle)
    const bodyLeft = s.x - PLAYER_BODY_WIDTH / 2;
    const bodyRight = s.x + PLAYER_BODY_WIDTH / 2;
    const bodyTop = s.y - PLAYER_BODY_HEIGHT / 2;
    const bodyBottom = s.y + PLAYER_BODY_HEIGHT / 2;

    const closestX = Math.max(bodyLeft, Math.min(ball.x, bodyRight));
    const closestY = Math.max(bodyTop, Math.min(ball.y, bodyBottom));
    const bdx = ball.x - closestX;
    const bdy = ball.y - closestY;
    const bdist = Math.sqrt(bdx * bdx + bdy * bdy);

    if (bdist < BALL_RADIUS && bdist > 0) {
      // Push ball away
      const nx = bdx / bdist;
      const ny = bdy / bdist;
      ball.x = closestX + nx * BALL_RADIUS;
      ball.y = closestY + ny * BALL_RADIUS;

      // Fix #5: Reflect velocity — removed 0.6 dampen (Phaser reflects without extra dampen)
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;

      // DEF stat reduces ball speed on body contact
      const reduction = 1 - player.charDef.stats.defense * DEF_BALL_SPEED_REDUCTION_PER_POINT;
      ball.vx *= reduction;
      ball.vy *= reduction;
    }
  }

  // Fix #9: Iron Wall collision — ball bounces off the wall rectangle
  private static checkIronWallCollision(ball: BallState, player: PhysicsPlayer): void {
    if (!player.ironWallActive) return;

    // Wall position matches local: Player.ts ironWall activation
    const wallX = player.state.id === 1 ? 60 : 740;
    const wallCenterY = GROUND_Y - 60;
    const wallW = 12;
    const wallH = 120;

    const left = wallX - wallW / 2;
    const right = wallX + wallW / 2;
    const top = wallCenterY - wallH / 2;
    const bottom = wallCenterY + wallH / 2;

    // AABB-circle collision
    const closestX = Math.max(left, Math.min(ball.x, right));
    const closestY = Math.max(top, Math.min(ball.y, bottom));
    const dx = ball.x - closestX;
    const dy = ball.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < BALL_RADIUS && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      // Separate
      ball.x = closestX + nx * BALL_RADIUS;
      ball.y = closestY + ny * BALL_RADIUS;
      // Reflect
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx -= 2 * dot * nx;
      ball.vy -= 2 * dot * ny;
    }
  }

  // Fix #6: Ghost teleport kick force 1.5x → 1.2x (aligns with LocalGameScene)
  private static ghostTeleportKick(player: PhysicsPlayer, ball: BallState): void {
    const s = player.state;
    const offsetX = s.facingRight ? -30 : 30;
    s.x = ball.x + offsetX;
    s.y = ball.y;
    s.vx = 0;
    s.vy = 0;

    const dirX = s.facingRight ? 1 : -1;
    const force = player.kickForce * 1.2;
    ball.vx = dirX * force;
    ball.vy = -0.3 * force;

    s.superMeter = Math.min(SUPER_MAX, s.superMeter + SUPER_CHARGE_KICK);
  }

  static checkGoal(ball: BallState): number | null {
    // Left goal (Player 2 scores)
    if (ball.x - BALL_RADIUS <= GOAL_LEFT_X + GOAL_WIDTH &&
        ball.y >= GOAL_Y && ball.y <= GROUND_Y) {
      return 2;
    }
    // Right goal (Player 1 scores)
    if (ball.x + BALL_RADIUS >= GOAL_RIGHT_X &&
        ball.y >= GOAL_Y && ball.y <= GROUND_Y) {
      return 1;
    }
    return null;
  }

  static resetBall(ball: BallState): void {
    ball.x = GAME_WIDTH / 2;
    ball.y = GAME_HEIGHT / 3;
    ball.vx = 0;
    ball.vy = 0;
    ball.poisoned = false;
    ball.gravityIgnored = false;
  }

  static resetPlayer(player: PhysicsPlayer, spawnX: number): void {
    player.state.x = spawnX;
    player.state.y = GROUND_Y - PLAYER_TOTAL_HEIGHT / 2;
    player.state.vx = 0;
    player.state.vy = 0;
    player.state.jumpsRemaining = MAX_JUMPS;
    player.state.isKicking = false;
    player.ghostKickDelay = 0;
  }
}
