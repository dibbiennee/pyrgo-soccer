import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Ball } from '../objects/Ball';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_Y,
  GOAL_WIDTH,
  GOAL_HEIGHT,
  GOAL_Y,
  GOAL_LEFT_X,
  GOAL_RIGHT_X,
  GOAL_POST_WIDTH,
  WALL_THICKNESS,
  PLAYER1_SPAWN_X,
  PLAYER2_SPAWN_X,
  PLAYER_SPAWN_Y,
  BALL_START_X,
  BALL_START_Y,
  BALL_BOUNCE_WALL,
  GOALS_TO_WIN,
  MATCH_DURATION_SECONDS,
  OVERTIME_DURATION_SECONDS,
  GOAL_FREEZE_DURATION_MS,
  COUNTDOWN_SECONDS,
  HEADER_FORCE_X,
  HEADER_FORCE_Y,
  BALL_RADIUS,
  PLAYER_HEAD_RADIUS,
  SUPER_MAX,
  DEF_BALL_SPEED_REDUCTION_PER_POINT,
  getCharacter,
  resolveCharacter,
} from '@pyrgo/shared';
import type { InputState, CharacterDef, CharacterRef, ScoreState } from '@pyrgo/shared';
import { TouchControls } from '../controls/TouchControls';
import { SoundManager } from '../audio/SoundManager';
import { MusicManager } from '../audio/MusicManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { setupGameCamera, getBaseZoom } from '../utils/responsive';
import { THEME } from '../ui/UITheme';

export class LocalGameScene extends Phaser.Scene {
  // Game objects
  protected player1!: Player;
  protected player2!: Player;
  protected ball!: Ball;

  // Field elements
  private ground!: Phaser.GameObjects.Rectangle;
  private ceiling!: Phaser.Physics.Arcade.Image;
  private goalLeftZone!: Phaser.GameObjects.Zone;
  private goalRightZone!: Phaser.GameObjects.Zone;
  private ironWallCollider1?: Phaser.Physics.Arcade.Collider;
  private ironWallCollider2?: Phaser.Physics.Arcade.Collider;
  private ironWallActive1 = false;
  private ironWallActive2 = false;

  // Score & timer
  private score: ScoreState = { player1: 0, player2: 0 };
  private timeRemaining = MATCH_DURATION_SECONDS;
  private overtime = false;
  private frozen = false;
  private matchOver = false;

  // UI
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private superMeter1!: Phaser.GameObjects.Graphics;
  private superMeter1Bg!: Phaser.GameObjects.Graphics;
  private superMeter2!: Phaser.GameObjects.Graphics;
  private superMeter2Bg!: Phaser.GameObjects.Graphics;
  private countdownText!: Phaser.GameObjects.Text;
  private overtimeText?: Phaser.GameObjects.Text;
  private superGlow1?: Phaser.Tweens.Tween;
  private superGlow2?: Phaser.Tweens.Tween;
  private lastScore: ScoreState = { player1: 0, player2: 0 };

  // Match stats
  public shotsP1 = 0;
  public shotsP2 = 0;
  public supersUsedP1 = 0;
  public supersUsedP2 = 0;

  // Controls
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private p1JumpPressed = false;
  private p2JumpPressed = false;
  private p1KickPressed = false;
  private p2KickPressed = false;
  private p1SuperPressed = false;
  private p2SuperPressed = false;

  // Timer
  private gameTimer = 0;
  private countdownValue = COUNTDOWN_SECONDS;
  private phase: 'countdown' | 'playing' | 'goalScored' | 'matchOver' = 'countdown';

  // Character selections
  private char1Id = 1;
  private char2Id = 2;
  private charRef1: CharacterRef = { type: 'preset', id: 1 };
  private charRef2: CharacterRef = { type: 'preset', id: 2 };

  // Touch controls
  protected touchControls?: TouchControls;

  // Sound
  private sound_mgr = SoundManager.getInstance();

  // fireCapriole sequence state
  private fcState: 'none' | 'freeze' | 'capriole' = 'none';
  private fcPlayer: Player | null = null;
  private fcStartMs = 0;
  private fcParticleTimer = 0;

  // Landing detection
  private p1WasInAir = false;
  private p2WasInAir = false;

  // Goal slow-mo
  private goalSlowMoActive = false;

  constructor(key = 'LocalGame') {
    super(key);
  }

  init(data: { char1?: number; char2?: number; charRef1?: CharacterRef; charRef2?: CharacterRef }): void {
    this.charRef1 = data.charRef1 ?? { type: 'preset', id: data.char1 ?? 1 };
    this.charRef2 = data.charRef2 ?? { type: 'preset', id: data.char2 ?? 2 };
    this.char1Id = this.charRef1.type === 'preset' ? this.charRef1.id : 0;
    this.char2Id = this.charRef2.type === 'preset' ? this.charRef2.id : 0;
    this.score = { player1: 0, player2: 0 };
    this.timeRemaining = MATCH_DURATION_SECONDS;
    this.overtime = false;
    this.frozen = false;
    this.matchOver = false;
    this.phase = 'countdown';
    this.countdownValue = COUNTDOWN_SECONDS;
    this.gameTimer = 0;
    this.ironWallCollider1 = undefined;
    this.ironWallCollider2 = undefined;
    this.ironWallActive1 = false;
    this.ironWallActive2 = false;
    this.shotsP1 = 0;
    this.shotsP2 = 0;
    this.supersUsedP1 = 0;
    this.supersUsedP2 = 0;
    this.lastScore = { player1: 0, player2: 0 };
    this.fcState = 'none';
    this.fcPlayer = null;
    this.fcStartMs = 0;
    this.fcParticleTimer = 0;
    this.p1WasInAir = false;
    this.p2WasInAir = false;
    this.goalSlowMoActive = false;
  }

  create(): void {
    setupGameCamera(this);
    fadeIn(this);
    this.sound_mgr.enabled = this.game.registry.get('soundOn') !== false;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.createField();
    this.createGoals();
    this.createPlayers();
    this.createBall();
    this.setupCollisions();
    this.setupControls();
    this.createHUD();
    this.createTouchControls();
    this.startCountdown();

    // Lower music volume during gameplay
    MusicManager.getInstance().setGameplayMode(true);
  }

  private createField(): void {
    // Dark night sky
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000008);

    // Stars
    const starGfx = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * GAME_WIDTH;
      const sy = Math.random() * (GROUND_Y - 100);
      const brightness = 0.3 + Math.random() * 0.7;
      starGfx.fillStyle(0xffffff, brightness);
      starGfx.fillCircle(sx, sy, 0.5 + Math.random() * 1.2);
    }

    // Tribune silhouettes (crowd)
    const tribuneGfx = this.add.graphics();
    tribuneGfx.fillStyle(0x111122, 1);
    // Left tribune
    tribuneGfx.fillRect(0, GROUND_Y - 80, 120, 80);
    tribuneGfx.fillRect(0, GROUND_Y - 100, 80, 20);
    // Right tribune
    tribuneGfx.fillRect(GAME_WIDTH - 120, GROUND_Y - 80, 120, 80);
    tribuneGfx.fillRect(GAME_WIDTH - 80, GROUND_Y - 100, 80, 20);
    // Center tribune (back)
    tribuneGfx.fillStyle(0x0a0a18, 1);
    tribuneGfx.fillRect(150, GROUND_Y - 60, GAME_WIDTH - 300, 20);

    // Crowd dots on tribunes
    const crowdGfx = this.add.graphics();
    for (let i = 0; i < 80; i++) {
      let cx: number, cy: number;
      if (i < 25) {
        cx = Math.random() * 110 + 5;
        cy = GROUND_Y - 20 - Math.random() * 55;
      } else if (i < 50) {
        cx = GAME_WIDTH - 110 + Math.random() * 105;
        cy = GROUND_Y - 20 - Math.random() * 55;
      } else {
        cx = 160 + Math.random() * (GAME_WIDTH - 320);
        cy = GROUND_Y - 45 - Math.random() * 12;
      }
      const colors = [0xff4444, 0x4488ff, 0xffdd00, 0xffffff, 0x44ff44];
      crowdGfx.fillStyle(colors[Math.floor(Math.random() * colors.length)], 0.4 + Math.random() * 0.3);
      crowdGfx.fillCircle(cx, cy, 2);
    }

    // Stadium floodlights
    const lightGfx = this.add.graphics();
    // Left light post
    lightGfx.fillStyle(0x333344, 1);
    lightGfx.fillRect(35, GROUND_Y - 140, 6, 100);
    lightGfx.fillStyle(0xffffcc, 0.9);
    lightGfx.fillRect(30, GROUND_Y - 145, 16, 8);
    // Light cone
    lightGfx.fillStyle(0xffffcc, 0.03);
    lightGfx.fillTriangle(38, GROUND_Y - 140, 200, GROUND_Y, -50, GROUND_Y);
    // Right light post
    lightGfx.fillStyle(0x333344, 1);
    lightGfx.fillRect(GAME_WIDTH - 41, GROUND_Y - 140, 6, 100);
    lightGfx.fillStyle(0xffffcc, 0.9);
    lightGfx.fillRect(GAME_WIDTH - 46, GROUND_Y - 145, 16, 8);
    // Light cone
    lightGfx.fillStyle(0xffffcc, 0.03);
    lightGfx.fillTriangle(GAME_WIDTH - 38, GROUND_Y - 140, GAME_WIDTH + 50, GROUND_Y, GAME_WIDTH - 200, GROUND_Y);

    // Striped grass (3 tones)
    const grassGfx = this.add.graphics();
    const stripeWidth = 60;
    const grassTones = [0x1a6b33, 0x155a2a, 0x186330];
    for (let sx = 0; sx < GAME_WIDTH; sx += stripeWidth) {
      const toneIdx = Math.floor(sx / stripeWidth) % 3;
      grassGfx.fillStyle(grassTones[toneIdx], 1);
      grassGfx.fillRect(sx, GROUND_Y, stripeWidth, 40);
    }

    // Ground (static body)
    this.ground = this.add.rectangle(GAME_WIDTH / 2, GROUND_Y + WALL_THICKNESS / 2, GAME_WIDTH, WALL_THICKNESS, 0x1a6b33);
    this.physics.add.existing(this.ground, true);

    // Ceiling
    const ceilRect = this.add.rectangle(GAME_WIDTH / 2, -WALL_THICKNESS / 2, GAME_WIDTH, WALL_THICKNESS, 0x000000, 0);
    this.physics.add.existing(ceilRect, true);
    this.ceiling = ceilRect as unknown as Phaser.Physics.Arcade.Image;

    // Left wall
    const leftWall = this.add.rectangle(-WALL_THICKNESS / 2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, 0x000000, 0);
    this.physics.add.existing(leftWall, true);

    // Right wall
    const rightWall = this.add.rectangle(GAME_WIDTH + WALL_THICKNESS / 2, GAME_HEIGHT / 2, WALL_THICKNESS, GAME_HEIGHT, 0x000000, 0);
    this.physics.add.existing(rightWall, true);

    // Field markings (more visible)
    const markings = this.add.graphics();
    markings.lineStyle(2, 0xffffff, 0.4);
    // Center line
    markings.lineBetween(GAME_WIDTH / 2, GROUND_Y - 200, GAME_WIDTH / 2, GROUND_Y);
    // Center circle
    markings.strokeCircle(GAME_WIDTH / 2, GROUND_Y - 60, 50);
    // Center dot
    markings.fillStyle(0xffffff, 0.4);
    markings.fillCircle(GAME_WIDTH / 2, GROUND_Y - 60, 3);
    // Left penalty area
    markings.strokeRect(GOAL_LEFT_X, GROUND_Y - 100, 80, 100);
    // Right penalty area
    markings.strokeRect(GAME_WIDTH - 80, GROUND_Y - 100, 80, 100);
    // Penalty spots
    markings.fillCircle(GOAL_LEFT_X + 65, GROUND_Y - 50, 2);
    markings.fillCircle(GAME_WIDTH - 65, GROUND_Y - 50, 2);
  }

  private createGoals(): void {
    // Goal nets (grid pattern)
    const netGfx = this.add.graphics();
    netGfx.lineStyle(1, 0xffffff, 0.12);
    const netSpacing = 10;

    // Left goal net
    for (let ny = GOAL_Y; ny <= GROUND_Y; ny += netSpacing) {
      netGfx.lineBetween(GOAL_LEFT_X, ny, GOAL_LEFT_X + GOAL_WIDTH, ny);
    }
    for (let nx = GOAL_LEFT_X; nx <= GOAL_LEFT_X + GOAL_WIDTH; nx += netSpacing) {
      netGfx.lineBetween(nx, GOAL_Y, nx, GROUND_Y);
    }

    // Right goal net
    for (let ny = GOAL_Y; ny <= GROUND_Y; ny += netSpacing) {
      netGfx.lineBetween(GOAL_RIGHT_X, ny, GOAL_RIGHT_X + GOAL_WIDTH, ny);
    }
    for (let nx = GOAL_RIGHT_X; nx <= GOAL_RIGHT_X + GOAL_WIDTH; nx += netSpacing) {
      netGfx.lineBetween(nx, GOAL_Y, nx, GROUND_Y);
    }

    // Left goal frame
    const lgGraphics = this.add.graphics();
    lgGraphics.fillStyle(0xffffff, 0.08);
    lgGraphics.fillRect(GOAL_LEFT_X, GOAL_Y, GOAL_WIDTH, GOAL_HEIGHT);
    lgGraphics.lineStyle(4, 0xffffff, 0.9);
    lgGraphics.lineBetween(GOAL_LEFT_X, GOAL_Y, GOAL_LEFT_X + GOAL_WIDTH, GOAL_Y);
    lgGraphics.lineBetween(GOAL_LEFT_X + GOAL_WIDTH, GOAL_Y, GOAL_LEFT_X + GOAL_WIDTH, GROUND_Y);

    // Right goal frame
    const rgGraphics = this.add.graphics();
    rgGraphics.fillStyle(0xffffff, 0.08);
    rgGraphics.fillRect(GOAL_RIGHT_X, GOAL_Y, GOAL_WIDTH, GOAL_HEIGHT);
    rgGraphics.lineStyle(4, 0xffffff, 0.9);
    rgGraphics.lineBetween(GOAL_RIGHT_X, GOAL_Y, GOAL_RIGHT_X + GOAL_WIDTH, GOAL_Y);
    rgGraphics.lineBetween(GOAL_RIGHT_X, GOAL_Y, GOAL_RIGHT_X, GROUND_Y);

    // Goal zones (overlap detection)
    this.goalLeftZone = this.add.zone(GOAL_LEFT_X + GOAL_WIDTH / 2, GOAL_Y + GOAL_HEIGHT / 2, GOAL_WIDTH - 10, GOAL_HEIGHT - 5);
    this.physics.add.existing(this.goalLeftZone, true);

    this.goalRightZone = this.add.zone(GOAL_RIGHT_X + GOAL_WIDTH / 2, GOAL_Y + GOAL_HEIGHT / 2, GOAL_WIDTH - 10, GOAL_HEIGHT - 5);
    this.physics.add.existing(this.goalRightZone, true);

    // Goal top crossbar physics
    const leftCrossbar = this.add.rectangle(GOAL_LEFT_X + GOAL_WIDTH / 2, GOAL_Y - GOAL_POST_WIDTH / 2, GOAL_WIDTH, GOAL_POST_WIDTH, 0xffffff, 0);
    this.physics.add.existing(leftCrossbar, true);

    const rightCrossbar = this.add.rectangle(GOAL_RIGHT_X + GOAL_WIDTH / 2, GOAL_Y - GOAL_POST_WIDTH / 2, GOAL_WIDTH, GOAL_POST_WIDTH, 0xffffff, 0);
    this.physics.add.existing(rightCrossbar, true);

    // Goal posts (vertical)
    const leftPost = this.add.rectangle(GOAL_LEFT_X + GOAL_WIDTH + GOAL_POST_WIDTH / 2, GOAL_Y + GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, 0xffffff, 0);
    this.physics.add.existing(leftPost, true);

    const rightPost = this.add.rectangle(GOAL_RIGHT_X - GOAL_POST_WIDTH / 2, GOAL_Y + GOAL_HEIGHT / 2, GOAL_POST_WIDTH, GOAL_HEIGHT, 0xffffff, 0);
    this.physics.add.existing(rightPost, true);
  }

  private createPlayers(): void {
    const char1 = resolveCharacter(this.charRef1);
    const char2 = resolveCharacter(this.charRef2);

    this.player1 = new Player(this, PLAYER1_SPAWN_X, PLAYER_SPAWN_Y, 1, char1);
    this.player2 = new Player(this, PLAYER2_SPAWN_X, PLAYER_SPAWN_Y, 2, char2);

    // Collide players with ground
    this.physics.add.collider(this.player1, this.ground);
    this.physics.add.collider(this.player2, this.ground);

    // Players collide with each other (unless ghost phase)
    this.physics.add.collider(this.player1, this.player2, undefined, () => {
      return !this.player1.ghostPhaseActive && !this.player2.ghostPhaseActive;
    });
  }

  private createBall(): void {
    this.ball = new Ball(this, BALL_START_X, BALL_START_Y);
    this.physics.add.collider(this.ball, this.ground);
  }

  private setupCollisions(): void {
    // Ball-player body collision (bounce off body)
    this.physics.add.collider(this.ball, this.player1, () => this.onBallHitPlayer(this.player1), () => !this.player1.ghostPhaseActive);
    this.physics.add.collider(this.ball, this.player2, () => this.onBallHitPlayer(this.player2), () => !this.player2.ghostPhaseActive);

    // Ball-goal overlap (use process callback to prevent multi-trigger)
    this.physics.add.overlap(this.ball, this.goalLeftZone, () => this.onGoalScored(2), () => !this.frozen);
    this.physics.add.overlap(this.ball, this.goalRightZone, () => this.onGoalScored(1), () => !this.frozen);

    // Ghost phase teleport kick
    this.player1.on('ghostPhaseEnd', () => this.ghostTeleportKick(this.player1));
    this.player2.on('ghostPhaseEnd', () => this.ghostTeleportKick(this.player2));

    // Super activation sound + FX + audio ducking
    this.player1.on('superActivated', () => {
      this.sound_mgr.super();
      this.supersUsedP1++;
      this.showSuperActivationFX(this.player1);
      MusicManager.getInstance().duckForSuper();
    });
    this.player2.on('superActivated', () => {
      this.sound_mgr.super();
      this.supersUsedP2++;
      this.showSuperActivationFX(this.player2);
      MusicManager.getInstance().duckForSuper();
    });

    // fireCapriole full sequence handler
    this.player1.on('fireCaprioleStart', () => this.startFireCapriole(this.player1));
    this.player2.on('fireCaprioleStart', () => this.startFireCapriole(this.player2));

    // Unduck music when non-fireCapriole supers end
    const onSuperEnd = (p: Player) => {
      if (p.characterDef.superMove !== 'fireCapriole') {
        MusicManager.getInstance().unduckAfterSuper();
      }
    };
    // flameDash/ghostPhase/ironWall/iceField have timers — unduck handled in their end callbacks
    // For simplicity, set a delayed unduck for non-fireCapriole supers
    this.player1.on('superActivated', () => {
      if (this.player1.characterDef.superMove !== 'fireCapriole' &&
          this.player1.characterDef.superMove !== 'thunderKick' &&
          this.player1.characterDef.superMove !== 'poisonShot') {
        const dur = this.player1.characterDef.superMove === 'flameDash' ? 2000 :
                    this.player1.characterDef.superMove === 'ghostPhase' ? 2500 : 3000;
        this.time.delayedCall(dur, () => MusicManager.getInstance().unduckAfterSuper());
      }
    });
    this.player2.on('superActivated', () => {
      if (this.player2.characterDef.superMove !== 'fireCapriole' &&
          this.player2.characterDef.superMove !== 'thunderKick' &&
          this.player2.characterDef.superMove !== 'poisonShot') {
        const dur = this.player2.characterDef.superMove === 'flameDash' ? 2000 :
                    this.player2.characterDef.superMove === 'ghostPhase' ? 2500 : 3000;
        this.time.delayedCall(dur, () => MusicManager.getInstance().unduckAfterSuper());
      }
    });
  }

  private onBallHitPlayer(player: Player): void {
    if (this.frozen) return;

    const ballBody = this.ball.body;
    const headBounds = player.getHeadWorldBounds();

    // Check if ball hit the head
    const dx = this.ball.x - headBounds.x;
    const dy = this.ball.y - headBounds.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < headBounds.radius + BALL_RADIUS + 5) {
      // Header — bounce ball toward opponent goal
      const towardRight = player.playerIndex === 1;
      this.ball.applyHeader(towardRight);
      player.chargeSuperFromHeader();
      this.sound_mgr.bounce();
      this.screenShake(2);
    } else {
      // Body hit — DEF stat reduces ball speed
      const reduction = 1 - player.characterDef.stats.defense * DEF_BALL_SPEED_REDUCTION_PER_POINT;
      const vx = this.ball.body.velocity.x * reduction;
      const vy = this.ball.body.velocity.y * reduction;
      this.ball.body.setVelocity(vx, vy);
    }
  }

  private ghostTeleportKick(player: Player): void {
    if (this.frozen || this.phase !== 'playing') return;

    // 0.5s delay before teleport (visual indicator + counterplay window)
    player.emitSuperParticles(0xaa44ff);
    this.time.delayedCall(500, () => {
      if (this.frozen || this.phase !== 'playing') return;

      // Teleport player to ball position
      const offsetX = player.facingRight ? -30 : 30;
      player.setPosition(this.ball.x + offsetX, this.ball.y);
      player.body.setVelocity(0, 0);

      // Kick at 1.2x force (nerfed from 1.5x)
      const dirX = player.facingRight ? 1 : -1;
      const force = player.getEffectiveKickForce() * 1.2;
      this.ball.applyKick(dirX, -0.3, force);
      player.chargeSuperFromKick();
      this.screenShake(4);
      this.hitFreeze(50);
    });
  }

  private setupControls(): void {
    if (!this.input.keyboard) return;

    this.keys = {
      // Player 1: WASD + Space + Q
      p1Left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      p1Right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      p1Jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      p1Kick: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      p1Super: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      // Player 2: Arrows + Enter + RShift
      p2Left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      p2Right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      p2Jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      p2Kick: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER),
      p2Super: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
    };
  }

  private getP1Input(): InputState {
    const kb: InputState = {
      left: this.keys.p1Left?.isDown ?? false,
      right: this.keys.p1Right?.isDown ?? false,
      jump: false,
      kick: false,
      super: false,
    };

    // Edge-triggered jump
    if (this.keys.p1Jump?.isDown && !this.p1JumpPressed) {
      kb.jump = true;
    }
    this.p1JumpPressed = this.keys.p1Jump?.isDown ?? false;

    // Edge-triggered kick
    if (this.keys.p1Kick?.isDown && !this.p1KickPressed) {
      kb.kick = true;
    }
    this.p1KickPressed = this.keys.p1Kick?.isDown ?? false;

    // Edge-triggered super
    if (this.keys.p1Super?.isDown && !this.p1SuperPressed) {
      kb.super = true;
    }
    this.p1SuperPressed = this.keys.p1Super?.isDown ?? false;

    // Merge with touch
    if (this.touchControls?.active) {
      kb.left = kb.left || this.touchControls.p1Input.left;
      kb.right = kb.right || this.touchControls.p1Input.right;
      kb.jump = kb.jump || this.touchControls.p1Input.jump;
      kb.kick = kb.kick || this.touchControls.p1Input.kick;
      kb.super = kb.super || this.touchControls.p1Input.super;
    }

    return kb;
  }

  protected getP2Input(): InputState {
    const kb: InputState = {
      left: this.keys.p2Left?.isDown ?? false,
      right: this.keys.p2Right?.isDown ?? false,
      jump: false,
      kick: false,
      super: false,
    };

    if (this.keys.p2Jump?.isDown && !this.p2JumpPressed) {
      kb.jump = true;
    }
    this.p2JumpPressed = this.keys.p2Jump?.isDown ?? false;

    if (this.keys.p2Kick?.isDown && !this.p2KickPressed) {
      kb.kick = true;
    }
    this.p2KickPressed = this.keys.p2Kick?.isDown ?? false;

    if (this.keys.p2Super?.isDown && !this.p2SuperPressed) {
      kb.super = true;
    }
    this.p2SuperPressed = this.keys.p2Super?.isDown ?? false;

    if (this.touchControls?.active) {
      kb.left = kb.left || this.touchControls.p2Input.left;
      kb.right = kb.right || this.touchControls.p2Input.right;
      kb.jump = kb.jump || this.touchControls.p2Input.jump;
      kb.kick = kb.kick || this.touchControls.p2Input.kick;
      kb.super = kb.super || this.touchControls.p2Input.super;
    }

    return kb;
  }

  private createHUD(): void {
    const hudTop = 35;
    const meterY = hudTop + 34;

    // HUD panel background
    const hudPanel = this.add.graphics();
    hudPanel.fillStyle(THEME.hudBg, 0.65);
    hudPanel.fillRoundedRect(GAME_WIDTH / 2 - 130, hudTop - 6, 260, 52, 10);

    // Score
    this.scoreText = this.add.text(GAME_WIDTH / 2, hudTop, '0 - 0', {
      fontSize: '32px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);

    // Timer
    this.timerText = this.add.text(GAME_WIDTH / 2, hudTop + 36, '1:30', {
      fontSize: '18px',
      fontFamily: 'Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Super meter backgrounds (rounded rects)
    const meterWidth = 100;
    const meterHeight = 8;
    const meterRadius = 3;

    this.superMeter1Bg = this.add.graphics();
    this.superMeter1Bg.fillStyle(THEME.statBarEmpty, 0.7);
    this.superMeter1Bg.fillRoundedRect(GAME_WIDTH / 2 - 100 - meterWidth, meterY - meterHeight / 2, meterWidth, meterHeight, meterRadius);

    this.superMeter1 = this.add.graphics();

    this.superMeter2Bg = this.add.graphics();
    this.superMeter2Bg.fillStyle(THEME.statBarEmpty, 0.7);
    this.superMeter2Bg.fillRoundedRect(GAME_WIDTH / 2 + 100, meterY - meterHeight / 2, meterWidth, meterHeight, meterRadius);

    this.superMeter2 = this.add.graphics();

    // Player names
    this.add.text(GAME_WIDTH / 2 - 100, hudTop, this.player1.characterDef.name, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0);

    this.add.text(GAME_WIDTH / 2 + 100, hudTop, this.player2.characterDef.name, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0);

    // Countdown text
    this.countdownText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', {
      fontSize: '64px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(100);
  }

  protected createTouchControls(): void {
    this.touchControls = new TouchControls({ scene: this, mode: 'dual' });
  }

  private startCountdown(): void {
    this.phase = 'countdown';
    this.countdownValue = COUNTDOWN_SECONDS;
    this.countdownText.setText(String(this.countdownValue));
    this.countdownText.setVisible(true);

    this.time.addEvent({
      delay: 1000,
      repeat: COUNTDOWN_SECONDS,
      callback: () => {
        this.countdownValue--;
        if (this.countdownValue > 0) {
          this.sound_mgr.countdown();
          this.countdownText.setText(String(this.countdownValue));
          this.tweens.add({
            targets: this.countdownText,
            scale: { from: 1.5, to: 1 },
            duration: 300,
          });
        } else if (this.countdownValue === 0) {
          this.sound_mgr.whistle();
          this.countdownText.setText('GO!');
          this.tweens.add({
            targets: this.countdownText,
            scale: { from: 1.5, to: 1 },
            alpha: { from: 1, to: 0 },
            duration: 500,
            onComplete: () => {
              this.countdownText.setVisible(false);
              this.countdownText.setAlpha(1);
            },
          });
          this.phase = 'playing';
        }
      },
    });
  }

  update(time: number, delta: number): void {
    if (this.matchOver) return;

    // Update ball trail / rotation / afterimages
    this.ball.update(time, delta);

    // fireCapriole sequence (uses real time, unaffected by timeScale)
    if (this.fcState !== 'none') {
      this.updateFireCapriole(delta);
    }

    // Ice field effect
    this.handleIceField();

    if (this.phase === 'playing' || this.phase === 'countdown') {
      // Timer
      if (this.phase === 'playing') {
        this.gameTimer += delta;
        if (this.gameTimer >= 1000) {
          this.gameTimer -= 1000;
          this.timeRemaining--;
          if (this.timeRemaining <= 0) {
            this.checkMatchEnd();
          }
        }
      }

      // Input handling (block during frozen/goal state)
      if (this.phase === 'playing' && !this.frozen && !this.matchOver) {
        const p1Input = this.getP1Input();
        const p2Input = this.getP2Input();

        // Block input for player in fireCapriole
        if (this.fcState !== 'none' && this.fcPlayer === this.player1) {
          this.player2.handleInput(p2Input);
        } else if (this.fcState !== 'none' && this.fcPlayer === this.player2) {
          this.player1.handleInput(p1Input);
        } else {
          this.player1.handleInput(p1Input);
          this.player2.handleInput(p2Input);
        }
        this.touchControls?.resetEdgeTriggers();

        // Check kicks hitting ball
        this.checkKickBall(this.player1);
        this.checkKickBall(this.player2);

        // Iron wall collision with ball
        this.checkIronWalls();
      }

      // Movement effects (tilt + landing)
      this.handleMovementEffects();

      // Update HUD
      this.updateHUD();
    }
  }

  private handleIceField(): void {
    const p1Ice = this.player1.iceFieldActive;
    const p2Ice = this.player2.iceFieldActive;

    if (p1Ice) {
      // Player 2 slides
      this.player2.body.setDragX(10);
    } else if (p2Ice) {
      // Player 1 slides
      this.player1.body.setDragX(10);
    } else {
      this.player1.body.setDragX(0);
      this.player2.body.setDragX(0);
    }
  }

  private checkKickBall(player: Player): void {
    if (!player.isKicking) return;

    const kick = player.getKickWorldPosition();
    const bx = this.ball.x;
    const by = this.ball.y;

    // AABB vs circle
    const closestX = Math.max(kick.x, Math.min(bx, kick.x + kick.width));
    const closestY = Math.max(kick.y, Math.min(by, kick.y + kick.height));
    const dx = bx - closestX;
    const dy = by - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < BALL_RADIUS) {
      const force = player.getEffectiveKickForce();
      const dirX = player.facingRight ? 1 : -1;
      const dirY = -0.3; // Slightly upward

      this.ball.applyKick(dirX, dirY, force);
      this.sound_mgr.kick();

      // Track shots
      if (player.playerIndex === 1) this.shotsP1++;
      else this.shotsP2++;

      // Charge super
      player.chargeSuperFromKick();

      // Super trail color
      if (player.superActive) {
        const superColors: Record<string, number> = {
          flameDash: 0xff4400, thunderKick: 0xffee00, ghostPhase: 0xaa44ff,
          ironWall: 0x00ccff, poisonShot: 0x88ff00, iceField: 0x88ddff,
          fireCapriole: 0xff4400,
        };
        this.ball.superTrailColor = superColors[player.characterDef.superMove] ?? null;
        this.time.delayedCall(800, () => { this.ball.superTrailColor = null; });
      }

      // Thunder kick consumes on use
      if (player.thunderKickReady) {
        this.ball.gravityIgnored = true;
        this.ball.superTrailColor = 0xffee00;
        this.time.delayedCall(500, () => {
          this.ball.gravityIgnored = false;
          this.ball.superTrailColor = null;
        });
        player.consumeThunderKick();
      }

      // Poison shot
      if (player.poisonShotActive) {
        this.ball.poisoned = true;
      }

      // Screen shake on every kick (2px / 100ms)
      this.cameras.main.shake(100, 2 / 1000);

      // 5-8 white impact particles at kick point
      const numParticles = 5 + Math.floor(Math.random() * 4);
      const kickPx = player.facingRight ? player.x + 20 : player.x - 20;
      const kickPy = player.y;
      for (let i = 0; i < numParticles; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 50;
        const kp = this.add.arc(kickPx, kickPy, 2, 0, 360, false, 0xffffff, 0.8).setDepth(10);
        this.tweens.add({
          targets: kp,
          x: kickPx + Math.cos(angle) * speed,
          y: kickPy + Math.sin(angle) * speed,
          alpha: 0,
          duration: 200 + Math.random() * 100,
          onComplete: () => kp.destroy(),
        });
      }

      // Hit freeze
      this.hitFreeze(30);
    }
  }

  private checkIronWalls(): void {
    // Player 1 iron wall
    if (this.player1.ironWall && !this.ironWallActive1) {
      this.ironWallActive1 = true;
      this.ironWallCollider1 = this.physics.add.collider(this.ball, this.player1.ironWall);
    } else if (!this.player1.ironWall && this.ironWallActive1) {
      this.ironWallActive1 = false;
      this.ironWallCollider1?.destroy();
      this.ironWallCollider1 = undefined;
    }

    // Player 2 iron wall
    if (this.player2.ironWall && !this.ironWallActive2) {
      this.ironWallActive2 = true;
      this.ironWallCollider2 = this.physics.add.collider(this.ball, this.player2.ironWall);
    } else if (!this.player2.ironWall && this.ironWallActive2) {
      this.ironWallActive2 = false;
      this.ironWallCollider2?.destroy();
      this.ironWallCollider2 = undefined;
    }
  }

  private onGoalScored(scoringPlayer: number): void {
    if (this.frozen || this.phase !== 'playing') return;
    this.frozen = true;

    const points = this.ball.poisoned ? 2 : 1;
    if (scoringPlayer === 1) {
      this.score.player1 += points;
      this.player1.chargeSuperFromGoal();
    } else {
      this.score.player2 += points;
      this.player2.chargeSuperFromGoal();
    }

    // Reset poison — only consume for the player who activated it
    this.ball.poisoned = false;
    if (this.player1.poisonShotActive) this.player1.consumePoisonShot();
    if (this.player2.poisonShotActive) this.player2.consumePoisonShot();

    // Goal effects
    this.sound_mgr.goal();
    this.showGoalEffect(scoringPlayer);

    // Check for win
    if (this.score.player1 >= GOALS_TO_WIN || this.score.player2 >= GOALS_TO_WIN) {
      this.endMatch();
      return;
    }

    // Golden goal in overtime
    if (this.overtime) {
      this.endMatch();
      return;
    }

    // Freeze then reset
    this.time.delayedCall(GOAL_FREEZE_DURATION_MS, () => {
      this.resetPositions();
      this.frozen = false;
    });
  }

  private showGoalEffect(scoringPlayer: number): void {
    const scorer = scoringPlayer === 1 ? this.player1 : this.player2;
    const scorerColor = scorer.characterDef.color;

    // Strong screen shake (5px / 300ms)
    this.cameras.main.shake(300, 5 / 1000);

    // White flash 50ms
    const whiteFlash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.7)
      .setDepth(149);
    this.tweens.add({
      targets: whiteFlash,
      alpha: 0,
      duration: 50,
      onComplete: () => whiteFlash.destroy(),
    });

    // Goal slow-mo (0.5s)
    this.goalSlowMoActive = true;
    this.physics.world.timeScale = 0.3;
    this.tweens.timeScale = 0.3;
    const goalSlowStart = performance.now();
    const checkSlowEnd = () => {
      if (performance.now() - goalSlowStart >= 500) {
        if (this.goalSlowMoActive) {
          this.physics.world.timeScale = 1;
          this.tweens.timeScale = 1;
          this.goalSlowMoActive = false;
        }
      } else {
        requestAnimationFrame(checkSlowEnd);
      }
    };
    requestAnimationFrame(checkSlowEnd);

    // "GOOOL!" text with scorer's color
    const rgb = Phaser.Display.Color.IntegerToRGB(scorerColor);
    const goalText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'GOOOL!', {
      fontSize: '56px',
      fontFamily: 'Arial Black, Arial',
      color: `rgb(${rgb.r},${rgb.g},${rgb.b})`,
      stroke: '#000000',
      strokeThickness: 8,
    }).setOrigin(0.5).setDepth(100).setScale(0.3);

    this.tweens.add({
      targets: goalText,
      scale: 1.5,
      alpha: { from: 1, to: 0 },
      duration: 1500,
      ease: 'Cubic.easeOut',
      onComplete: () => goalText.destroy(),
    });

    // Team-colored particle explosion at goal (20 particles)
    const goalX = scoringPlayer === 1 ? GOAL_RIGHT_X : GOAL_LEFT_X + GOAL_WIDTH;
    const goalCY = GOAL_Y + GOAL_HEIGHT / 2;
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const gp = this.add.arc(goalX, goalCY, 3 + Math.random() * 3, 0, 360, false, scorerColor, 0.9);
      gp.setDepth(99);
      this.tweens.add({
        targets: gp,
        x: goalX + Math.cos(angle) * speed,
        y: goalCY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 400 + Math.random() * 300,
        onComplete: () => gp.destroy(),
      });
    }

    // 40 confetti particles (full screen spread with gravity arc)
    for (let i = 0; i < 40; i++) {
      const startX = Math.random() * GAME_WIDTH;
      const p = this.add.arc(startX, -10, 2 + Math.random() * 4, 0, 360, false,
        [0xffdd00, 0xff4400, 0x00ccff, 0xffffff, 0x44ff44, scorerColor][Math.floor(Math.random() * 6)]);
      p.setDepth(99);
      this.tweens.add({
        targets: p,
        x: startX + (Math.random() - 0.5) * 150,
        y: GAME_HEIGHT + 20,
        alpha: { from: 1, to: 0.3 },
        duration: 1200 + Math.random() * 800,
        delay: Math.random() * 300,
        ease: 'Sine.easeIn',
        onComplete: () => p.destroy(),
      });
    }

    // Scorer mini jump + colored particles
    this.tweens.add({
      targets: scorer,
      y: scorer.y - 20,
      duration: 200,
      yoyo: true,
      ease: 'Sine.easeOut',
    });
    for (let i = 0; i < 12; i++) {
      const angle = Math.random() * Math.PI * 2;
      const sp = this.add.arc(scorer.x, scorer.y, 3, 0, 360, false, scorerColor, 0.8);
      sp.setDepth(98);
      this.tweens.add({
        targets: sp,
        x: scorer.x + Math.cos(angle) * 50,
        y: scorer.y + Math.sin(angle) * 50,
        alpha: 0,
        duration: 500,
        onComplete: () => sp.destroy(),
      });
    }

    // Score text color flash with team color
    const hexColor = `#${scorerColor.toString(16).padStart(6, '0')}`;
    this.scoreText.setColor(hexColor);
    this.time.delayedCall(600, () => this.scoreText.setColor('#ffffff'));
  }

  private resetPositions(): void {
    this.player1.resetPosition(PLAYER1_SPAWN_X, PLAYER_SPAWN_Y);
    this.player2.resetPosition(PLAYER2_SPAWN_X, PLAYER_SPAWN_Y);
    this.ball.resetPosition();
    this.ball.clearTrail();
  }

  private checkMatchEnd(): void {
    if (this.score.player1 !== this.score.player2) {
      this.endMatch();
    } else if (!this.overtime) {
      // Start overtime
      this.overtime = true;
      this.timeRemaining = OVERTIME_DURATION_SECONDS;
      this.showAnnouncement('OVERTIME!');
    } else {
      // Draw
      this.endMatch();
    }
  }

  private endMatch(): void {
    this.matchOver = true;
    this.phase = 'matchOver';

    const winner = this.score.player1 > this.score.player2 ? 1
      : this.score.player2 > this.score.player1 ? 2
      : null;

    this.time.delayedCall(1500, () => {
      transitionTo(this, 'Result', {
        winner,
        score: { ...this.score },
        charRef1: this.charRef1,
        charRef2: this.charRef2,
        mode: 'cpu',
        stats: {
          shotsP1: this.shotsP1,
          shotsP2: this.shotsP2,
          supersUsedP1: this.supersUsedP1,
          supersUsedP2: this.supersUsedP2,
        },
      });
    });
  }

  private showAnnouncement(text: string): void {
    const ann = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, text, {
      fontSize: '36px',
      fontFamily: 'Arial Black, Arial',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: ann,
      scale: { from: 0.8, to: 1.3 },
      alpha: { from: 1, to: 0 },
      duration: 1200,
      onComplete: () => ann.destroy(),
    });
  }

  private updateHUD(): void {
    this.scoreText.setText(`${this.score.player1} - ${this.score.player2}`);

    // Score bounce on change
    if (this.score.player1 !== this.lastScore.player1 || this.score.player2 !== this.lastScore.player2) {
      this.lastScore = { ...this.score };
      this.tweens.add({
        targets: this.scoreText,
        scale: { from: 1.3, to: 1 },
        duration: 300,
        ease: 'Back.easeOut',
      });
    }

    const mins = Math.floor(Math.max(0, this.timeRemaining) / 60);
    const secs = Math.max(0, this.timeRemaining) % 60;
    this.timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`);

    // Timer: orange when <30s, red + pulse when <10s
    if (this.timeRemaining <= 10 && this.timeRemaining > 0 && !this.overtime) {
      this.timerText.setColor('#ff4444');
      this.timerText.setScale(1 + Math.sin(this.time.now / 200) * 0.1);
    } else if (this.timeRemaining <= 30 && this.timeRemaining > 10 && !this.overtime) {
      this.timerText.setColor('#ff8800');
      this.timerText.setScale(1);
    } else if (this.overtime) {
      this.timerText.setColor('#ff4444');
      // Show OVERTIME indicator
      if (!this.overtimeText) {
        this.overtimeText = this.add.text(GAME_WIDTH / 2, 59, 'OVERTIME', {
          fontSize: '12px', fontFamily: 'Arial Black, Arial', color: '#ff4444',
          stroke: '#000000', strokeThickness: 2,
        }).setOrigin(0.5);
        this.tweens.add({
          targets: this.overtimeText,
          alpha: { from: 0.5, to: 1 },
          duration: 500,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else {
      this.timerText.setColor('#ffffff');
      this.timerText.setScale(1);
    }

    // Super meters (rounded rect redraw)
    const meterWidth = 100;
    const meterHeight = 8;
    const meterRadius = 3;
    const hudTop = 35;
    const meterY = hudTop + 34;
    const p1Fill = (this.player1.superMeter / SUPER_MAX) * meterWidth;
    const p2Fill = (this.player2.superMeter / SUPER_MAX) * meterWidth;
    const p1Full = this.player1.superMeter >= SUPER_MAX;
    const p2Full = this.player2.superMeter >= SUPER_MAX;

    this.superMeter1.clear();
    if (p1Fill > 0) {
      if (p1Full) {
        this.superMeter1.fillGradientStyle(0x00ff00, 0x00ff00, 0x00cc00, 0x00cc00);
      } else {
        this.superMeter1.fillGradientStyle(THEME.statBarFillStart, THEME.statBarFillStart, THEME.statBarFillEnd, THEME.statBarFillEnd);
      }
      this.superMeter1.fillRoundedRect(GAME_WIDTH / 2 - 100 - p1Fill, meterY - meterHeight / 2, p1Fill, meterHeight, meterRadius);
    }

    this.superMeter2.clear();
    if (p2Fill > 0) {
      if (p2Full) {
        this.superMeter2.fillGradientStyle(0x00ff00, 0x00ff00, 0x00cc00, 0x00cc00);
      } else {
        this.superMeter2.fillGradientStyle(THEME.statBarFillStart, THEME.statBarFillStart, THEME.statBarFillEnd, THEME.statBarFillEnd);
      }
      this.superMeter2.fillRoundedRect(GAME_WIDTH / 2 + 100, meterY - meterHeight / 2, p2Fill, meterHeight, meterRadius);
    }

    // Shimmer/glow when full — fast pulsing alpha
    if (p1Full && !this.superGlow1) {
      this.superGlow1 = this.tweens.add({
        targets: this.superMeter1,
        alpha: { from: 0.4, to: 1 },
        duration: 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!p1Full && this.superGlow1) {
      this.superGlow1.stop();
      this.superGlow1 = undefined;
      this.superMeter1.setAlpha(1);
    }

    if (p2Full && !this.superGlow2) {
      this.superGlow2 = this.tweens.add({
        targets: this.superMeter2,
        alpha: { from: 0.4, to: 1 },
        duration: 250,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else if (!p2Full && this.superGlow2) {
      this.superGlow2.stop();
      this.superGlow2 = undefined;
      this.superMeter2.setAlpha(1);
    }
  }

  private screenShake(intensity: number): void {
    this.cameras.main.shake(100, intensity / 1000);
  }

  private hitFreeze(ms: number): void {
    this.physics.pause();
    this.time.delayedCall(ms, () => {
      if (!this.matchOver) this.physics.resume();
    });
  }

  private showSuperActivationFX(player: Player): void {
    // Full-screen color flash
    const superInfo = player.characterDef.superMove;
    const colors: Record<string, number> = {
      flameDash: 0xff4400, thunderKick: 0xffee00, ghostPhase: 0xaa44ff,
      ironWall: 0x00ccff, poisonShot: 0x88ff00, iceField: 0x88ddff,
      fireCapriole: 0xff4400,
    };
    const color = colors[superInfo] ?? 0xffffff;

    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, color, 0.6)
      .setDepth(150);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    // Super move name near player
    const superMove = player.characterDef.superDescription?.split(' \u2014 ')[0] ?? '';
    if (superMove) {
      const nameText = this.add.text(player.x, player.y - 50, superMove, {
        fontSize: '14px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
        stroke: '#000000', strokeThickness: 3,
      }).setOrigin(0.5).setDepth(151).setScale(0);

      this.tweens.add({
        targets: nameText,
        scale: 1,
        y: player.y - 70,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: nameText,
            alpha: 0,
            duration: 300,
            delay: 300,
            onComplete: () => nameText.destroy(),
          });
        },
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // FIRE CAPRIOLE — "A MI" sequence
  // ═══════════════════════════════════════════════════
  private startFireCapriole(player: Player): void {
    if (this.fcState !== 'none') return;
    this.fcState = 'freeze';
    this.fcPlayer = player;
    this.fcStartMs = performance.now();
    this.fcParticleTimer = 0;

    // Freeze physics for 200ms
    this.physics.pause();

    // Orange screen flash
    const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xff6600, 0.6)
      .setDepth(150);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 200,
      onComplete: () => flash.destroy(),
    });

    // Play SFX
    MusicManager.getInstance().playEffect('/sfx/super_ami.mp3');
  }

  private updateFireCapriole(delta: number): void {
    if (!this.fcPlayer) return;
    const elapsed = performance.now() - this.fcStartMs;
    const player = this.fcPlayer;

    if (this.fcState === 'freeze') {
      if (elapsed >= 200) {
        // Transition to capriole phase
        this.fcState = 'capriole';
        this.physics.resume();

        // Slow-mo 0.3x
        this.physics.world.timeScale = 0.3;
        this.tweens.timeScale = 0.3;

        // Camera zoom 1.1x (relative to base zoom)
        this.cameras.main.zoomTo(getBaseZoom(this) * 1.1, 300);

        // Auto-jump at 2x velocity
        player.body.setVelocityY(-1100); // JUMP_VELOCITY * 2

        // 360° rotation tween (duration adjusted for time scale: 480ms at 0.3x ≈ 1600ms perceived)
        this.tweens.add({
          targets: player,
          angle: 360,
          duration: 480,
          ease: 'Linear',
        });
      }
    } else if (this.fcState === 'capriole') {
      // Attract ball toward player
      const dx = player.x - this.ball.x;
      const dy = player.y - this.ball.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > BALL_RADIUS + 5) {
        const attractStr = Math.max(500, dist * 5);
        this.ball.body.setVelocity(
          (dx / dist) * attractStr,
          (dy / dist) * attractStr,
        );
      }

      // Fire particles around player
      this.fcParticleTimer += delta;
      if (this.fcParticleTimer > 60) {
        this.fcParticleTimer = 0;
        for (let i = 0; i < 3; i++) {
          const angle = Math.random() * Math.PI * 2;
          const fp = this.add.arc(player.x, player.y, 3, 0, 360, false, 0xff4400, 0.8).setDepth(10);
          this.tweens.add({
            targets: fp,
            x: player.x + Math.cos(angle) * 35,
            y: player.y + Math.sin(angle) * 35,
            alpha: 0,
            duration: 150,
            onComplete: () => fp.destroy(),
          });
        }
      }

      // End capriole at 1800ms total (200 freeze + 1600 capriole)
      if (elapsed >= 1800) {
        this.endFireCapriole();
      }
    }
  }

  private endFireCapriole(): void {
    const player = this.fcPlayer!;

    // Fire ball at 3x toward goal
    const force = player.kickForce * 3;
    const toGoalDir = player.playerIndex === 1 ? 1 : -1;
    this.ball.body.setVelocity(toGoalDir * force, -0.3 * force);

    // Fire trail on ball
    this.ball.superTrailColor = 0xff4400;

    // Charge super + track shot
    player.chargeSuperFromKick();
    this.sound_mgr.kick();
    if (player.playerIndex === 1) this.shotsP1++;
    else this.shotsP2++;

    // Impact shake
    this.cameras.main.shake(200, 5 / 1000);

    // Reset player angle
    player.setAngle(0);

    // Reset state
    this.fcState = 'none';
    this.fcPlayer = null;
    player.fireCaprioleActive = false;
    player.superActive = false;

    // Restore game speed
    this.physics.world.timeScale = 1;
    this.tweens.timeScale = 1;

    // Camera back to base zoom
    this.cameras.main.zoomTo(getBaseZoom(this), 500);

    // Unduck music
    MusicManager.getInstance().unduckAfterSuper();

    // Clear fire trail after 2s
    this.time.delayedCall(2000, () => {
      this.ball.superTrailColor = null;
    });

    // Fire particle explosion on ball impact (emit once at kick point)
    const bx = this.ball.x;
    const by = this.ball.y;
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 60;
      const ip = this.add.arc(bx, by, 3, 0, 360, false,
        Math.random() < 0.5 ? 0xff4400 : 0xffaa00, 0.9).setDepth(10);
      this.tweens.add({
        targets: ip,
        x: bx + Math.cos(angle) * speed,
        y: by + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 400 + Math.random() * 200,
        onComplete: () => ip.destroy(),
      });
    }
  }

  // ═══════════════════════════════════════════════════
  // MOVEMENT EFFECTS — tilt, squash/stretch, dust
  // ═══════════════════════════════════════════════════
  private handleMovementEffects(): void {
    this.handlePlayerMovement(this.player1);
    this.handlePlayerMovement(this.player2);

    // Landing detection
    const p1OnGround = this.player1.body.blocked.down || this.player1.body.touching.down;
    if (p1OnGround && this.p1WasInAir) {
      this.onPlayerLanding(this.player1);
    }
    this.p1WasInAir = !p1OnGround;

    const p2OnGround = this.player2.body.blocked.down || this.player2.body.touching.down;
    if (p2OnGround && this.p2WasInAir) {
      this.onPlayerLanding(this.player2);
    }
    this.p2WasInAir = !p2OnGround;
  }

  private handlePlayerMovement(player: Player): void {
    // Skip tilt during fireCapriole (angle controlled by rotation tween)
    if (player.fireCaprioleActive) return;

    // Running tilt 3-5°
    const vx = player.body.velocity.x;
    if (vx > 10) {
      player.setAngle(4);
    } else if (vx < -10) {
      player.setAngle(-4);
    } else {
      player.setAngle(0);
    }
  }

  private onPlayerLanding(player: Player): void {
    // Squash on landing (scaleY 0.85 for 100ms)
    this.tweens.add({
      targets: player,
      scaleY: 0.85,
      duration: 50,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    // Dust particles
    for (let i = 0; i < 3; i++) {
      const dx = (Math.random() - 0.5) * 20;
      const dust = this.add.arc(player.x + dx, GROUND_Y, 2, 0, 360, false, 0x8b7355, 0.4);
      this.tweens.add({
        targets: dust,
        y: GROUND_Y - 8 - Math.random() * 8,
        x: player.x + dx + (Math.random() - 0.5) * 15,
        alpha: 0,
        scale: 0.3,
        duration: 250,
        onComplete: () => dust.destroy(),
      });
    }
  }

  shutdown(): void {
    // Restore music volume
    MusicManager.getInstance().setGameplayMode(false);

    // Restore time scale
    if (this.physics.world) {
      this.physics.world.timeScale = 1;
    }
    this.tweens.timeScale = 1;

    // Reset fireCapriole state
    this.fcState = 'none';
    this.fcPlayer = null;

    // Clean up all timers
    this.time.removeAllEvents();

    // Clean up all tweens
    this.tweens.killAll();

    // Remove player event listeners
    this.player1?.removeAllListeners();
    this.player2?.removeAllListeners();

    // Destroy players and ball
    this.player1?.destroy();
    this.player2?.destroy();
    this.ball?.destroy();

    // Destroy touch controls
    this.touchControls?.destroy();
    this.touchControls = undefined;

    // Resume physics if paused
    if (this.physics.world?.isPaused) {
      this.physics.resume();
    }
  }
}
