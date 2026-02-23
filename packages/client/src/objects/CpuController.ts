import type { InputState } from '@pyrgo/shared';
import {
  GROUND_Y,
  BALL_RADIUS,
  PLAYER_HEAD_RADIUS,
  PLAYER_BODY_HEIGHT,
  GAME_WIDTH,
  SUPER_MAX,
} from '@pyrgo/shared';
import type { Player } from './Player';
import type { Ball } from './Ball';

export type CpuDifficulty = 'easy' | 'medium' | 'hard';

interface DifficultyParams {
  reactionDelay: number; // ms before reacting to ball change
  accuracy: number;      // 0-1, how precisely CPU targets ball
  kickRange: number;     // how close CPU needs to be to kick
  jumpThreshold: number; // ball-y below which CPU jumps
  superChance: number;   // probability of using super when available
}

const DIFFICULTY_PRESETS: Record<CpuDifficulty, DifficultyParams> = {
  easy: {
    reactionDelay: 400,
    accuracy: 0.6,
    kickRange: 55,
    jumpThreshold: -80,
    superChance: 0.3,
  },
  medium: {
    reactionDelay: 200,
    accuracy: 0.8,
    kickRange: 45,
    jumpThreshold: -60,
    superChance: 0.6,
  },
  hard: {
    reactionDelay: 80,
    accuracy: 0.95,
    kickRange: 38,
    jumpThreshold: -40,
    superChance: 0.9,
  },
};

export class CpuController {
  private params: DifficultyParams;
  private lastDecisionTime = 0;
  private cachedInput: InputState = { left: false, right: false, jump: false, kick: false, super: false };
  private targetX = GAME_WIDTH / 2;

  // The CPU is always player 2 (right side)
  private ownGoalX = GAME_WIDTH; // CPU defends right goal
  private opponentGoalX = 0;

  constructor(difficulty: CpuDifficulty = 'medium') {
    this.params = DIFFICULTY_PRESETS[difficulty];
  }

  getInput(cpuPlayer: Player, opponent: Player, ball: Ball, time: number): InputState {
    const input: InputState = { left: false, right: false, jump: false, kick: false, super: false };

    // Rate-limit decisions
    if (time - this.lastDecisionTime < this.params.reactionDelay) {
      // Return cached continuous inputs but reset edge triggers
      input.left = this.cachedInput.left;
      input.right = this.cachedInput.right;
      return input;
    }
    this.lastDecisionTime = time;

    const ballX = ball.x;
    const ballY = ball.y;
    const cpuX = cpuPlayer.x;
    const cpuY = cpuPlayer.y;
    const ballVx = ball.body?.velocity?.x ?? 0;

    // Add inaccuracy to target
    const noise = (1 - this.params.accuracy) * 60 * (Math.random() - 0.5);

    // Decision: pursue ball or defend goal
    const ballComingTowardGoal = ballVx > 50;
    const ballInCpuHalf = ballX > GAME_WIDTH / 2;
    const ballDangerous = ballComingTowardGoal || ballInCpuHalf;

    if (ballDangerous) {
      // Chase the ball
      this.targetX = ballX + noise;
    } else {
      // Hold defensive position
      this.targetX = GAME_WIDTH * 0.7 + noise;
    }

    // Horizontal movement
    const dx = this.targetX - cpuX;
    if (Math.abs(dx) > 15) {
      input.left = dx < 0;
      input.right = dx > 0;
    }

    // Jump: if ball is above CPU head level
    const headY = cpuY - PLAYER_BODY_HEIGHT / 2 - PLAYER_HEAD_RADIUS;
    if (ballY < headY + this.params.jumpThreshold && Math.abs(ballX - cpuX) < 100) {
      input.jump = true;
    }

    // Also jump if ball is coming high
    if (ballY < GROUND_Y - 150 && Math.abs(ballX - cpuX) < 80) {
      input.jump = true;
    }

    // Kick: if close enough to ball
    const distToBall = Math.sqrt((ballX - cpuX) ** 2 + (ballY - cpuY) ** 2);
    if (distToBall < this.params.kickRange + BALL_RADIUS + PLAYER_HEAD_RADIUS) {
      input.kick = true;
    }

    // Super: use when available with probability check
    if (cpuPlayer.superMeter >= SUPER_MAX && !cpuPlayer.superActive) {
      if (Math.random() < this.params.superChance) {
        input.super = true;
      }
    }

    this.cachedInput = { ...input };
    return input;
  }
}
