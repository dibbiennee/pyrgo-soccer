import {
  SERVER_TICK_MS,
  BROADCAST_EVERY_N_TICKS,
  GOALS_TO_WIN,
  MATCH_DURATION_SECONDS,
  OVERTIME_DURATION_SECONDS,
  GOAL_FREEZE_DURATION_MS,
  COUNTDOWN_SECONDS,
  PLAYER1_SPAWN_X,
  PLAYER2_SPAWN_X,
  SUPER_CHARGE_GOAL,
  SUPER_MAX,
  GAME_WIDTH,
  GAME_HEIGHT,
  RECONNECT_TIMEOUT_MS,
} from '@pyrgo/shared';
import type { InputState, ScoreState, GamePhase } from '@pyrgo/shared';
import type { MatchStats } from '@pyrgo/shared';
import type { PlayerInfo } from '../lobby/LobbyManager.js';
import { ServerPhysics, type PhysicsPlayer, type PhysicsState } from './ServerPhysics.js';
import { logger } from '../logger.js';

type BroadcastFn = (event: string, data: any, socketIds: string[]) => void;
type BroadcastToSocketFn = (event: string, data: any, socketId: string) => void;

export class GameRoom {
  public roomCode: string;
  private players: PlayerInfo[] = [];
  private physicsState!: PhysicsState;
  private score: ScoreState = { player1: 0, player2: 0 };
  private timeRemaining = MATCH_DURATION_SECONDS;
  private overtime = false;
  private tick = 0;
  private ticksSinceGoal = 0;
  private frozen = false;
  private running = false;
  private intervalId?: ReturnType<typeof setInterval>;
  private timerIntervalId?: ReturnType<typeof setInterval>;
  private broadcast?: BroadcastFn;
  private broadcastToSocket?: BroadcastToSocketFn;
  private phase: 'waiting' | 'countdown' | 'playing' | 'goalScored' | 'matchOver' = 'waiting';
  private countdownTicks = 0;

  // Match stats
  private matchStats: MatchStats = { shotsP1: 0, shotsP2: 0, supersUsedP1: 0, supersUsedP2: 0 };

  // Input buffers
  private inputBuffer: Map<string, { seq: number; inputs: InputState }> = new Map();
  private lastProcessedInput: Map<string, number> = new Map();

  // Reconnection
  private reconnectTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private pausedForDisconnect = false;

  // Rematch
  private rematchRequested: Set<number> = new Set(); // playerIndex set

  constructor(roomCode: string) {
    this.roomCode = roomCode;
  }

  addPlayer(info: PlayerInfo): void {
    this.players.push(info);
  }

  hasPlayer(socketId: string): boolean {
    return this.players.some(p => p.socketId === socketId);
  }

  isFull(): boolean {
    return this.players.length >= 2;
  }

  getPlayers(): PlayerInfo[] {
    return this.players;
  }

  getSocketIds(): string[] {
    return this.players.map(p => p.socketId);
  }

  setInput(socketId: string, seq: number, inputs: InputState): void {
    this.inputBuffer.set(socketId, { seq, inputs });
  }

  setBroadcast(fn: BroadcastFn): void {
    this.broadcast = fn;
  }

  setBroadcastToSocket(fn: BroadcastToSocketFn): void {
    this.broadcastToSocket = fn;
  }

  getPhase(): string {
    return this.phase;
  }

  isRunning(): boolean {
    return this.running;
  }

  // ═══════════════════════════════════════════════════
  // READY UP
  // ═══════════════════════════════════════════════════
  setPlayerReady(socketId: string): boolean {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player) return false;
    player.ready = true;
    return this.players.length === 2 && this.players.every(p => p.ready);
  }

  // ═══════════════════════════════════════════════════
  // START
  // ═══════════════════════════════════════════════════
  start(): void {
    if (this.players.length < 2) return;
    if (this.running) return;

    const p1 = this.players.find(p => p.playerIndex === 1)!;
    const p2 = this.players.find(p => p.playerIndex === 2)!;

    // Use resolvedChar from PlayerInfo
    const player1 = ServerPhysics.createPlayer(1, p1.resolvedChar, PLAYER1_SPAWN_X);
    const player2 = ServerPhysics.createPlayer(2, p2.resolvedChar, PLAYER2_SPAWN_X);

    this.physicsState = {
      players: [player1, player2],
      ball: {
        x: GAME_WIDTH / 2,
        y: GAME_HEIGHT / 3,
        vx: 0,
        vy: 0,
        poisoned: false,
        gravityIgnored: false,
      },
      goalScored: null,
      events: [],
      thunderGravityTimer: 0,
    };

    this.score = { player1: 0, player2: 0 };
    this.timeRemaining = MATCH_DURATION_SECONDS;
    this.overtime = false;
    this.tick = 0;
    this.frozen = false;
    this.running = true;
    this.phase = 'countdown';
    this.countdownTicks = COUNTDOWN_SECONDS * (1000 / SERVER_TICK_MS);
    this.matchStats = { shotsP1: 0, shotsP2: 0, supersUsedP1: 0, supersUsedP2: 0 };
    this.rematchRequested.clear();
    this.pausedForDisconnect = false;

    // Game loop at 60Hz
    this.intervalId = setInterval(() => this.gameTick(), SERVER_TICK_MS);

    // Timer countdown every second
    this.timerIntervalId = setInterval(() => {
      if (this.phase === 'playing' && !this.frozen && !this.pausedForDisconnect) {
        this.timeRemaining--;
        if (this.timeRemaining <= 0) {
          this.handleTimeUp();
        }
      }
    }, 1000);
  }

  // ═══════════════════════════════════════════════════
  // GAME TICK
  // ═══════════════════════════════════════════════════
  private gameTick(): void {
    if (!this.running) return;
    if (this.pausedForDisconnect) return;

    this.tick++;

    // Countdown phase
    if (this.phase === 'countdown') {
      this.countdownTicks--;
      if (this.countdownTicks <= 0) {
        this.phase = 'playing';
      }
      this.broadcastState();
      return;
    }

    if (this.phase !== 'playing') return;

    // Goal freeze
    if (this.frozen) {
      this.ticksSinceGoal++;
      if (this.ticksSinceGoal >= GOAL_FREEZE_DURATION_MS / SERVER_TICK_MS) {
        this.frozen = false;
        this.ticksSinceGoal = 0;
        this.resetPositions();
      }
      this.broadcastState();
      return;
    }

    // Get inputs
    const p1 = this.players.find(p => p.playerIndex === 1)!;
    const p2 = this.players.find(p => p.playerIndex === 2)!;

    const noInput: InputState = { left: false, right: false, jump: false, kick: false, super: false };
    const input1 = this.inputBuffer.get(p1.socketId)?.inputs ?? noInput;
    const input2 = this.inputBuffer.get(p2.socketId)?.inputs ?? noInput;

    // Track last processed input seq
    const seq1 = this.inputBuffer.get(p1.socketId)?.seq ?? 0;
    const seq2 = this.inputBuffer.get(p2.socketId)?.seq ?? 0;
    this.lastProcessedInput.set(p1.socketId, seq1);
    this.lastProcessedInput.set(p2.socketId, seq2);

    // Physics step
    this.physicsState.goalScored = null;
    ServerPhysics.tick(this.physicsState, [input1, input2], SERVER_TICK_MS);

    // Process physics events
    for (const evt of this.physicsState.events) {
      if (evt.type === 'kick') {
        if (evt.playerIndex === 1) this.matchStats.shotsP1++;
        else this.matchStats.shotsP2++;
      }
      if (evt.type === 'superActivated') {
        if (evt.playerIndex === 1) this.matchStats.supersUsedP1++;
        else this.matchStats.supersUsedP2++;
        // Emit SUPER_ACTIVATED to all clients
        this.broadcast?.('SUPER_ACTIVATED', {
          playerIndex: evt.playerIndex,
          superMoveId: evt.superMoveId,
        }, this.getSocketIds());
      }
    }

    // Check goal
    if (this.physicsState.goalScored !== null) {
      this.handleGoal(this.physicsState.goalScored);
    }

    // Broadcast at 20Hz
    if (this.tick % BROADCAST_EVERY_N_TICKS === 0) {
      this.broadcastState();
    }

    // Clear edge-triggered inputs
    for (const buf of this.inputBuffer.values()) {
      buf.inputs.jump = false;
      buf.inputs.kick = false;
      buf.inputs.super = false;
    }
  }

  // ═══════════════════════════════════════════════════
  // GOAL HANDLING
  // ═══════════════════════════════════════════════════
  private handleGoal(scoringPlayer: number): void {
    const points = this.physicsState.ball.poisoned ? 2 : 1;

    if (scoringPlayer === 1) {
      this.score.player1 += points;
      const p = this.physicsState.players[0];
      p.state.superMeter = Math.min(SUPER_MAX, p.state.superMeter + SUPER_CHARGE_GOAL);
    } else {
      this.score.player2 += points;
      const p = this.physicsState.players[1];
      p.state.superMeter = Math.min(SUPER_MAX, p.state.superMeter + SUPER_CHARGE_GOAL);
    }

    // Reset poison
    this.physicsState.ball.poisoned = false;
    this.physicsState.players[0].poisonShotActive = false;
    this.physicsState.players[1].poisonShotActive = false;

    this.frozen = true;
    this.ticksSinceGoal = 0;

    // Broadcast goal event
    this.broadcast?.('GOAL_SCORED', {
      scoringPlayer,
      newScore: { ...this.score },
      points,
    }, this.getSocketIds());

    // Check win
    if (this.score.player1 >= GOALS_TO_WIN || this.score.player2 >= GOALS_TO_WIN) {
      this.endMatch();
      return;
    }

    if (this.overtime) {
      this.endMatch();
    }
  }

  private handleTimeUp(): void {
    if (this.score.player1 !== this.score.player2) {
      this.endMatch();
    } else if (!this.overtime) {
      this.overtime = true;
      this.timeRemaining = OVERTIME_DURATION_SECONDS;
    } else {
      this.endMatch();
    }
  }

  private endMatch(): void {
    this.phase = 'matchOver';
    this.running = false;

    const winner = this.score.player1 > this.score.player2 ? 1
      : this.score.player2 > this.score.player1 ? 2
      : null;

    this.broadcast?.('MATCH_OVER', {
      winner,
      finalScore: { ...this.score },
      stats: { ...this.matchStats },
    }, this.getSocketIds());

    // Match completion logging
    const p1 = this.players.find(p => p.playerIndex === 1);
    const p2 = this.players.find(p => p.playerIndex === 2);
    const duration = MATCH_DURATION_SECONDS - this.timeRemaining;
    logger.info('match', `room=${this.roomCode} p1=${p1?.playerName ?? '?'} p2=${p2?.playerName ?? '?'} score=${this.score.player1}-${this.score.player2} duration=${duration}s`);

    this.stopTimers();
  }

  // ═══════════════════════════════════════════════════
  // POSITIONS
  // ═══════════════════════════════════════════════════
  private resetPositions(): void {
    ServerPhysics.resetPlayer(this.physicsState.players[0], PLAYER1_SPAWN_X);
    ServerPhysics.resetPlayer(this.physicsState.players[1], PLAYER2_SPAWN_X);
    ServerPhysics.resetBall(this.physicsState.ball, this.physicsState);
  }

  // ═══════════════════════════════════════════════════
  // BROADCAST (per-player lastProcessedInput)
  // ═══════════════════════════════════════════════════
  private broadcastState(): void {
    if (!this.broadcastToSocket && !this.broadcast) return;

    const countdownSeconds = this.phase === 'countdown'
      ? Math.ceil(this.countdownTicks / (1000 / SERVER_TICK_MS))
      : 0;

    const basePayload = {
      tick: this.tick,
      players: [this.physicsState.players[0].state, this.physicsState.players[1].state] as [typeof this.physicsState.players[0]['state'], typeof this.physicsState.players[1]['state']],
      ball: { ...this.physicsState.ball },
      score: { ...this.score },
      timeRemaining: this.timeRemaining,
      phase: this.phase as GamePhase,
      overtime: this.overtime,
      countdown: countdownSeconds,
    };

    // Per-player broadcast with individual lastProcessedInput
    if (this.broadcastToSocket) {
      for (const p of this.players) {
        const lastInput = this.lastProcessedInput.get(p.socketId) ?? 0;
        this.broadcastToSocket('STATE', {
          ...basePayload,
          lastProcessedInput: lastInput,
        }, p.socketId);
      }
    } else if (this.broadcast) {
      // Fallback: use P1's lastProcessedInput for both
      const p1Socket = this.players.find(p => p.playerIndex === 1)?.socketId ?? '';
      const lastInput = this.lastProcessedInput.get(p1Socket) ?? 0;
      this.broadcast('STATE', {
        ...basePayload,
        lastProcessedInput: lastInput,
      }, this.getSocketIds());
    }
  }

  // ═══════════════════════════════════════════════════
  // DISCONNECT / RECONNECT
  // ═══════════════════════════════════════════════════
  pauseForReconnect(socketId: string): void {
    const player = this.players.find(p => p.socketId === socketId);
    if (!player || !this.running) return;

    this.pausedForDisconnect = true;

    // Notify remaining player
    const remaining = this.players.find(p => p.socketId !== socketId);
    if (remaining) {
      this.broadcastToSocket?.('DISCONNECT_WARNING', {
        disconnectedPlayer: player.playerIndex,
        timeoutMs: RECONNECT_TIMEOUT_MS,
      }, remaining.socketId);
    }

    // Set reconnect timer
    const timer = setTimeout(() => {
      // Timeout: disconnected player loses
      this.reconnectTimers.delete(socketId);
      if (remaining && this.running) {
        // Remaining player wins by forfeit
        this.phase = 'matchOver';
        this.running = false;
        this.broadcastToSocket?.('MATCH_OVER', {
          winner: remaining.playerIndex,
          finalScore: { ...this.score },
          stats: { ...this.matchStats },
        }, remaining.socketId);
        this.stopTimers();
      }
    }, RECONNECT_TIMEOUT_MS);

    this.reconnectTimers.set(socketId, timer);
  }

  reconnectPlayer(oldSocketId: string, newSocketId: string): boolean {
    const player = this.players.find(p => p.socketId === oldSocketId);
    if (!player) return false;

    // Clear reconnect timer
    const timer = this.reconnectTimers.get(oldSocketId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(oldSocketId);
    }

    // Update socket ID
    player.socketId = newSocketId;

    // Update input buffer mapping
    const oldInput = this.inputBuffer.get(oldSocketId);
    if (oldInput) {
      this.inputBuffer.set(newSocketId, oldInput);
      this.inputBuffer.delete(oldSocketId);
    }
    const oldLastInput = this.lastProcessedInput.get(oldSocketId);
    if (oldLastInput !== undefined) {
      this.lastProcessedInput.set(newSocketId, oldLastInput);
      this.lastProcessedInput.delete(oldSocketId);
    }

    // Resume game
    this.pausedForDisconnect = false;

    // Notify both players
    this.broadcast?.('RECONNECTED', {
      playerIndex: player.playerIndex,
    }, this.getSocketIds());

    return true;
  }

  // ═══════════════════════════════════════════════════
  // REMATCH
  // ═══════════════════════════════════════════════════
  requestRematch(playerIndex: number): 'requested' | 'accepted' {
    this.rematchRequested.add(playerIndex);

    if (this.rematchRequested.size >= 2) {
      // Both want rematch
      this.broadcast?.('REMATCH_ACCEPTED', {}, this.getSocketIds());

      // Reset for new game
      this.players.forEach(p => { p.ready = false; });
      this.rematchRequested.clear();

      // Restart
      this.start();
      return 'accepted';
    }

    // Notify opponent
    const opponent = this.players.find(p => p.playerIndex !== playerIndex);
    if (opponent) {
      this.broadcastToSocket?.('REMATCH_REQUESTED', {
        playerIndex,
      }, opponent.socketId);
    }
    return 'requested';
  }

  // ═══════════════════════════════════════════════════
  // PLAYER REMOVAL
  // ═══════════════════════════════════════════════════
  removePlayer(socketId: string): void {
    const removedPlayer = this.players.find(p => p.socketId === socketId);
    this.players = this.players.filter(p => p.socketId !== socketId);

    if (this.players.length < 2 && this.running) {
      // Opponent disconnected — remaining player wins
      const remaining = this.players[0];
      if (remaining) {
        this.broadcast?.('MATCH_OVER', {
          winner: remaining.playerIndex,
          finalScore: { ...this.score },
          stats: { ...this.matchStats },
        }, [remaining.socketId]);
      }
      this.stop();
    } else if (removedPlayer && !this.running) {
      // In lobby, notify remaining
      const remaining = this.players[0];
      if (remaining) {
        this.broadcastToSocket?.('ROOM_PLAYER_LEFT', {
          playerIndex: removedPlayer.playerIndex,
          reason: 'voluntary' as const,
        }, remaining.socketId);
      }
    }
  }

  // ═══════════════════════════════════════════════════
  // STOP / CLEANUP
  // ═══════════════════════════════════════════════════
  private stopTimers(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.timerIntervalId) clearInterval(this.timerIntervalId);
    this.intervalId = undefined;
    this.timerIntervalId = undefined;
  }

  stop(): void {
    this.running = false;
    this.stopTimers();
    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }
}
