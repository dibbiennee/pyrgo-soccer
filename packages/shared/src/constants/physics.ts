// Source of truth for all physics constants
export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 480;

// Field boundaries
export const GROUND_Y = 440;
export const CEILING_Y = 0;
export const WALL_LEFT = 0;
export const WALL_RIGHT = 800;
export const WALL_THICKNESS = 10;

// Goal dimensions
export const GOAL_WIDTH = 50;
export const GOAL_HEIGHT = 120;
export const GOAL_Y = GROUND_Y - GOAL_HEIGHT;
export const GOAL_LEFT_X = 0;
export const GOAL_RIGHT_X = GAME_WIDTH - GOAL_WIDTH;
export const GOAL_POST_WIDTH = 8;

// Player physics
export const GRAVITY = 1200;
export const PLAYER_BASE_SPEED = 250;
export const PLAYER_SPEED_PER_POINT = 10;
export const JUMP_VELOCITY = -550;
export const DOUBLE_JUMP_VELOCITY = -450;
export const MAX_JUMPS = 2;

// Player dimensions
export const PLAYER_HEAD_RADIUS = 18;
export const PLAYER_BODY_WIDTH = 28;
export const PLAYER_BODY_HEIGHT = 32;
export const PLAYER_TOTAL_HEIGHT = PLAYER_HEAD_RADIUS * 2 + PLAYER_BODY_HEIGHT;

// Kick
export const KICK_BASE_FORCE = 500;
export const KICK_POWER_PER_POINT = 20;
export const KICK_HITBOX_WIDTH = 30;
export const KICK_HITBOX_HEIGHT = 36;
export const KICK_DURATION_MS = 100;

// Ball physics
export const BALL_RADIUS = 12;
export const BALL_GRAVITY = 1200;
export const BALL_MAX_SPEED = 800;
export const BALL_BOUNCE_GROUND = 0.7;
export const BALL_BOUNCE_WALL = 0.85;
export const BALL_BOUNCE_PLAYER = 0.6;
export const BALL_DRAG = 20;
export const BALL_START_X = GAME_WIDTH / 2;
export const BALL_START_Y = GAME_HEIGHT / 3;

// Defense - ball speed reduction per DEF point on body contact
export const DEF_BALL_SPEED_REDUCTION_PER_POINT = 0.04;

// Header (head bounce)
export const HEADER_FORCE_X = 250;
export const HEADER_FORCE_Y = -300;

// Match rules
export const GOALS_TO_WIN = 5;
export const MATCH_DURATION_SECONDS = 90;
export const OVERTIME_DURATION_SECONDS = 30;
export const GOAL_FREEZE_DURATION_MS = 1500;
export const COUNTDOWN_SECONDS = 3;

// Super meter
export const SUPER_CHARGE_KICK = 10;
export const SUPER_CHARGE_HEADER = 15;
export const SUPER_CHARGE_GOAL = 30;
export const SUPER_MAX = 100;

// Spawn positions
export const PLAYER1_SPAWN_X = 150;
export const PLAYER2_SPAWN_X = GAME_WIDTH - 150;
export const PLAYER_SPAWN_Y = GROUND_Y - PLAYER_TOTAL_HEIGHT / 2;

// Server tick rates
export const SERVER_TICK_RATE = 60;
export const SERVER_BROADCAST_RATE = 20;
export const SERVER_TICK_MS = 1000 / SERVER_TICK_RATE;
export const BROADCAST_EVERY_N_TICKS = SERVER_TICK_RATE / SERVER_BROADCAST_RATE;

// Network / multiplayer constants
export const RECONNECT_TIMEOUT_MS = 15000;
export const HEARTBEAT_INTERVAL_MS = 5000;
export const ROOM_EXPIRY_MS = 300000; // 5 minutes
export const INPUT_RATE_LIMIT = 65; // max inputs per second per socket
export const MAX_PING_WARNING_MS = 200;
export const LOBBY_COUNTDOWN_SECONDS = 3;
export const INTERPOLATION_DELAY_MS = 100;
