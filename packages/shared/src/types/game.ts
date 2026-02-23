export interface Vec2 {
  x: number;
  y: number;
}

export interface PlayerState {
  id: number;            // 1 or 2
  x: number;
  y: number;
  vx: number;
  vy: number;
  facingRight: boolean;
  jumpsRemaining: number;
  isKicking: boolean;
  superMeter: number;    // 0-100
  superActive: boolean;
  characterId: number;
}

export interface BallState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  poisoned: boolean;      // Viper super
  gravityIgnored: boolean; // Titan super
}

export interface ScoreState {
  player1: number;
  player2: number;
}

export interface GameState {
  tick: number;
  players: [PlayerState, PlayerState];
  ball: BallState;
  score: ScoreState;
  timeRemaining: number;  // seconds
  phase: GamePhase;
  countdown: number;      // countdown timer (3,2,1,0)
  overtime: boolean;
}

export type GamePhase =
  | 'countdown'
  | 'playing'
  | 'goalScored'
  | 'overtime'
  | 'matchOver';

export interface InputState {
  left: boolean;
  right: boolean;
  jump: boolean;
  kick: boolean;
  super: boolean;
}

export interface MatchResult {
  winner: number | null; // 1, 2, or null for draw
  score: ScoreState;
}
