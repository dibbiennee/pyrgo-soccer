import type { InputState, ScoreState, PlayerState, BallState, GamePhase } from './game.js';
import type { CharacterRef, CharacterDef } from './characters.js';
import type { Appearance } from './appearance.js';

// ═══════════════════════════════════════════════════════════
// Lobby Player Info
// ═══════════════════════════════════════════════════════════
export interface LobbyPlayerInfo {
  playerIndex: number; // 1 or 2
  playerName: string;
  charRef: CharacterRef;
  ready: boolean;
}

// ═══════════════════════════════════════════════════════════
// Match Stats
// ═══════════════════════════════════════════════════════════
export interface MatchStats {
  shotsP1: number;
  shotsP2: number;
  supersUsedP1: number;
  supersUsedP2: number;
}

// ═══════════════════════════════════════════════════════════
// Error Codes
// ═══════════════════════════════════════════════════════════
export type ErrorCode =
  | 'ROOM_NOT_FOUND'
  | 'ROOM_FULL'
  | 'ALREADY_IN_ROOM'
  | 'INVALID_CHARACTER'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

// ═══════════════════════════════════════════════════════════
// Player State Broadcast (sent to clients)
// ═══════════════════════════════════════════════════════════
export interface PlayerStateBroadcast {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingRight: boolean;
  jumpsRemaining: number;
  isKicking: boolean;
  superMeter: number;
  superActive: boolean;
  characterId: number;
}

// ═══════════════════════════════════════════════════════════
// Client → Server Messages
// ═══════════════════════════════════════════════════════════
export interface ClientMessages {
  CREATE_ROOM: {
    charRef: CharacterRef;
    playerName: string;
  };
  JOIN_ROOM: {
    roomCode: string;
    charRef: CharacterRef;
    playerName: string;
  };
  /** @deprecated Use JOIN_ROOM instead */
  JOIN_LOBBY: {
    roomCode: string;
    characterId: number;
    playerName: string;
  };
  ROOM_LEAVE: Record<string, never>;
  PLAYER_READY: Record<string, never>;
  INPUT: {
    seq: number;
    inputs: InputState;
  };
  REMATCH_REQUEST: Record<string, never>;
  PING: {
    clientTime: number;
  };
  RECONNECT: {
    sessionId: string;
  };
}

// ═══════════════════════════════════════════════════════════
// Server → Client Messages
// ═══════════════════════════════════════════════════════════
export interface ServerMessages {
  SESSION_ASSIGNED: {
    sessionId: string;
  };
  ROOM_CREATED: {
    roomCode: string;
  };
  ROOM_JOINED: {
    players: LobbyPlayerInfo[];
    yourIndex: number;
  };
  ROOM_PLAYER_JOINED: {
    player: LobbyPlayerInfo;
  };
  ROOM_PLAYER_LEFT: {
    playerIndex: number;
    reason: 'voluntary' | 'disconnect';
  };
  ROOM_PLAYER_READY: {
    playerIndex: number;
  };
  ROOM_COUNTDOWN: {
    seconds: number;
  };
  STATE: {
    tick: number;
    players: [PlayerStateBroadcast, PlayerStateBroadcast];
    ball: BallState;
    score: ScoreState;
    timeRemaining: number;
    phase: GamePhase;
    overtime: boolean;
    countdown: number;
    lastProcessedInput: number;
  };
  GOAL_SCORED: {
    scoringPlayer: number;
    newScore: ScoreState;
    points: number;
  };
  SUPER_ACTIVATED: {
    playerIndex: number;
    superMoveId: string;
  };
  MATCH_OVER: {
    winner: number | null;
    finalScore: ScoreState;
    stats: MatchStats;
  };
  REMATCH_REQUESTED: {
    playerIndex: number;
  };
  REMATCH_ACCEPTED: Record<string, never>;
  PONG: {
    clientTime: number;
    serverTime: number;
  };
  DISCONNECT_WARNING: {
    disconnectedPlayer: number;
    timeoutMs: number;
  };
  RECONNECTED: {
    playerIndex: number;
  };
  ERROR: {
    code: ErrorCode;
    message: string;
  };
}
