import Phaser from 'phaser';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_Y,
  GOAL_WIDTH,
  GOAL_HEIGHT,
  GOAL_Y,
  GOAL_LEFT_X,
  GOAL_RIGHT_X,
  BALL_RADIUS,
  PLAYER1_SPAWN_X,
  PLAYER2_SPAWN_X,
  PLAYER_SPAWN_Y,
  PLAYER_BODY_WIDTH,
  PLAYER_TOTAL_HEIGHT,
  SUPER_MAX,
  INTERPOLATION_DELAY_MS,
  MAX_PING_WARNING_MS,
  resolveCharacter,
  defaultAppearanceForPreset,
  SUPER_MOVES,
} from '@pyrgo/shared';
import type {
  InputState, ScoreState, BallState, GamePhase,
  CharacterRef, CharacterDef, MatchStats,
  PlayerStateBroadcast,
} from '@pyrgo/shared';
import { SocketManager } from '../network/SocketManager';
import { TouchControls } from '../controls/TouchControls';
import { SoundManager } from '../audio/SoundManager';
import { MusicManager } from '../audio/MusicManager';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton, type ButtonGroup } from '../ui/ButtonFactory';
import { setupGameCamera, getBaseZoom } from '../utils/responsive';
import { THEME } from '../ui/UITheme';

interface ServerSnapshot {
  time: number;
  players: [PlayerStateBroadcast, PlayerStateBroadcast];
  ball: BallState;
}

export class OnlineGameScene extends Phaser.Scene {
  private socket!: SocketManager;
  private myPlayerIndex = 1;
  private charRef1: CharacterRef = { type: 'preset', id: 1 };
  private charRef2: CharacterRef = { type: 'preset', id: 2 };
  private char1!: CharacterDef;
  private char2!: CharacterDef;
  private roomCode = '';

  private score: ScoreState = { player1: 0, player2: 0 };
  private timeRemaining = 90;
  private matchOver = false;
  private serverPhase: GamePhase = 'countdown';
  private overtime = false;

  // ─── Both players: visual containers, interpolated from server ───
  private player1Container!: Phaser.GameObjects.Container;
  private player2Container!: Phaser.GameObjects.Container;
  private inputSeq = 0;

  // ─── Ball (visual only, interpolated) ────────────────
  private ballContainer!: Phaser.GameObjects.Container;
  private ballCircle!: Phaser.GameObjects.Arc;

  // ─── Interpolation buffer ───────────────────────────
  private snapshotBuffer: ServerSnapshot[] = [];

  // ─── HUD ─────────────────────────────────────────────
  private scoreText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private superMeter1!: Phaser.GameObjects.Graphics;
  private superMeter1Bg!: Phaser.GameObjects.Graphics;
  private superMeter2!: Phaser.GameObjects.Graphics;
  private superMeter2Bg!: Phaser.GameObjects.Graphics;
  private countdownText!: Phaser.GameObjects.Text;
  private pingIndicator!: Phaser.GameObjects.Text;
  private overtimeText?: Phaser.GameObjects.Text;
  // ─── Disconnect overlay ──────────────────────────────
  private disconnectOverlay?: Phaser.GameObjects.Rectangle;
  private disconnectText?: Phaser.GameObjects.Text;
  private disconnectCountdown = 0;
  private disconnectTimer?: ReturnType<typeof setInterval>;

  // ─── Input ───────────────────────────────────────────
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private jumpPressed = false;
  private kickPressed = false;
  private superPressed = false;

  // Touch controls
  private touchControls?: TouchControls;

  // Sound
  private sound_mgr = SoundManager.getInstance();

  // Server state for super meters
  private serverSuperMeter1 = 0;
  private serverSuperMeter2 = 0;

  // Goal slow-mo
  private goalSlowMoActive = false;

  // Pause
  private paused = false;
  private pauseElements: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('OnlineGame');
  }

  init(data: {
    charRef1?: CharacterRef;
    charRef2?: CharacterRef;
    myIndex?: number;
    roomCode?: string;
  }): void {
    this.charRef1 = data.charRef1 ?? { type: 'preset', id: 1 };
    this.charRef2 = data.charRef2 ?? { type: 'preset', id: 2 };
    this.myPlayerIndex = data.myIndex ?? 1;
    this.roomCode = data.roomCode ?? '';
    this.socket = SocketManager.getInstance();
    this.score = { player1: 0, player2: 0 };
    this.timeRemaining = 90;
    this.matchOver = false;
    this.inputSeq = 0;
    this.snapshotBuffer = [];
    this.serverPhase = 'countdown';
    this.overtime = false;
    this.disconnectCountdown = 0;
    this.paused = false;
    this.pauseElements = [];
    this.goalSlowMoActive = false;

    this.char1 = resolveCharacter(this.charRef1);
    this.char2 = resolveCharacter(this.charRef2);
  }

  create(): void {
    setupGameCamera(this);
    fadeIn(this);
    this.sound_mgr.enabled = this.game.registry.get('soundOn') !== false;
    MusicManager.getInstance().setGameplayMode(true);

    this.createField();
    this.createGoals();
    this.createPlayers();
    this.createBallVisual();
    this.setupControls();
    this.createHUD();
    this.setupOnlineTouchControls();
    this.setupNetworkListeners();
  }

  // ═══════════════════════════════════════════════════
  // FIELD RENDERING
  // ═══════════════════════════════════════════════════
  private createField(): void {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000008);

    // Stars
    const starGfx = this.add.graphics();
    for (let i = 0; i < 60; i++) {
      const sx = Math.random() * GAME_WIDTH;
      const sy = Math.random() * (GROUND_Y - 100);
      starGfx.fillStyle(0xffffff, 0.3 + Math.random() * 0.7);
      starGfx.fillCircle(sx, sy, 0.5 + Math.random() * 1.2);
    }

    // Tribune silhouettes
    const tribuneGfx = this.add.graphics();
    tribuneGfx.fillStyle(0x111122, 1);
    tribuneGfx.fillRect(0, GROUND_Y - 80, 120, 80);
    tribuneGfx.fillRect(0, GROUND_Y - 100, 80, 20);
    tribuneGfx.fillRect(GAME_WIDTH - 120, GROUND_Y - 80, 120, 80);
    tribuneGfx.fillRect(GAME_WIDTH - 80, GROUND_Y - 100, 80, 20);
    tribuneGfx.fillStyle(0x0a0a18, 1);
    tribuneGfx.fillRect(150, GROUND_Y - 60, GAME_WIDTH - 300, 20);

    // Crowd dots
    const crowdGfx = this.add.graphics();
    const colors = [0xff4444, 0x4488ff, 0xffdd00, 0xffffff, 0x44ff44];
    for (let i = 0; i < 80; i++) {
      let cx: number, cy: number;
      if (i < 25) { cx = Math.random() * 110 + 5; cy = GROUND_Y - 20 - Math.random() * 55; }
      else if (i < 50) { cx = GAME_WIDTH - 110 + Math.random() * 105; cy = GROUND_Y - 20 - Math.random() * 55; }
      else { cx = 160 + Math.random() * (GAME_WIDTH - 320); cy = GROUND_Y - 45 - Math.random() * 12; }
      crowdGfx.fillStyle(colors[Math.floor(Math.random() * colors.length)], 0.4 + Math.random() * 0.3);
      crowdGfx.fillCircle(cx, cy, 2);
    }

    // Floodlights
    const lightGfx = this.add.graphics();
    lightGfx.fillStyle(0x333344, 1);
    lightGfx.fillRect(35, GROUND_Y - 140, 6, 100);
    lightGfx.fillStyle(0xffffcc, 0.9);
    lightGfx.fillRect(30, GROUND_Y - 145, 16, 8);
    lightGfx.fillStyle(0xffffcc, 0.03);
    lightGfx.fillTriangle(38, GROUND_Y - 140, 200, GROUND_Y, -50, GROUND_Y);
    lightGfx.fillStyle(0x333344, 1);
    lightGfx.fillRect(GAME_WIDTH - 41, GROUND_Y - 140, 6, 100);
    lightGfx.fillStyle(0xffffcc, 0.9);
    lightGfx.fillRect(GAME_WIDTH - 46, GROUND_Y - 145, 16, 8);
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

    // Field markings (more visible)
    const markings = this.add.graphics();
    markings.lineStyle(2, 0xffffff, 0.4);
    markings.lineBetween(GAME_WIDTH / 2, GROUND_Y - 200, GAME_WIDTH / 2, GROUND_Y);
    markings.strokeCircle(GAME_WIDTH / 2, GROUND_Y - 60, 50);
    markings.fillStyle(0xffffff, 0.4);
    markings.fillCircle(GAME_WIDTH / 2, GROUND_Y - 60, 3);
    markings.strokeRect(GOAL_LEFT_X, GROUND_Y - 100, 80, 100);
    markings.strokeRect(GAME_WIDTH - 80, GROUND_Y - 100, 80, 100);
    markings.fillCircle(GOAL_LEFT_X + 65, GROUND_Y - 50, 2);
    markings.fillCircle(GAME_WIDTH - 65, GROUND_Y - 50, 2);
  }

  private createGoals(): void {
    const netGfx = this.add.graphics();
    netGfx.lineStyle(1, 0xffffff, 0.12);
    const netSpacing = 10;
    for (let ny = GOAL_Y; ny <= GROUND_Y; ny += netSpacing) {
      netGfx.lineBetween(GOAL_LEFT_X, ny, GOAL_LEFT_X + GOAL_WIDTH, ny);
    }
    for (let nx = GOAL_LEFT_X; nx <= GOAL_LEFT_X + GOAL_WIDTH; nx += netSpacing) {
      netGfx.lineBetween(nx, GOAL_Y, nx, GROUND_Y);
    }
    for (let ny = GOAL_Y; ny <= GROUND_Y; ny += netSpacing) {
      netGfx.lineBetween(GOAL_RIGHT_X, ny, GOAL_RIGHT_X + GOAL_WIDTH, ny);
    }
    for (let nx = GOAL_RIGHT_X; nx <= GOAL_RIGHT_X + GOAL_WIDTH; nx += netSpacing) {
      netGfx.lineBetween(nx, GOAL_Y, nx, GROUND_Y);
    }

    const lgGraphics = this.add.graphics();
    lgGraphics.fillStyle(0xffffff, 0.08);
    lgGraphics.fillRect(GOAL_LEFT_X, GOAL_Y, GOAL_WIDTH, GOAL_HEIGHT);
    lgGraphics.lineStyle(4, 0xffffff, 0.9);
    lgGraphics.lineBetween(GOAL_LEFT_X, GOAL_Y, GOAL_LEFT_X + GOAL_WIDTH, GOAL_Y);
    lgGraphics.lineBetween(GOAL_LEFT_X + GOAL_WIDTH, GOAL_Y, GOAL_LEFT_X + GOAL_WIDTH, GROUND_Y);

    const rgGraphics = this.add.graphics();
    rgGraphics.fillStyle(0xffffff, 0.08);
    rgGraphics.fillRect(GOAL_RIGHT_X, GOAL_Y, GOAL_WIDTH, GOAL_HEIGHT);
    rgGraphics.lineStyle(4, 0xffffff, 0.9);
    rgGraphics.lineBetween(GOAL_RIGHT_X, GOAL_Y, GOAL_RIGHT_X + GOAL_WIDTH, GOAL_Y);
    rgGraphics.lineBetween(GOAL_RIGHT_X, GOAL_Y, GOAL_RIGHT_X, GROUND_Y);
  }

  // ═══════════════════════════════════════════════════
  // PLAYER CREATION — both are pure visual containers
  // ═══════════════════════════════════════════════════
  private createPlayers(): void {
    const appearance1 = this.char1.appearance ?? defaultAppearanceForPreset(this.char1.id);
    const appearance2 = this.char2.appearance ?? defaultAppearanceForPreset(this.char2.id);

    // Player 1 container
    this.player1Container = this.add.container(PLAYER1_SPAWN_X, PLAYER_SPAWN_Y);
    const char1Objs = CharacterRenderer.renderCharacter(this, appearance1, {
      scale: 1,
      facingRight: true,
    });
    char1Objs.forEach(obj => this.player1Container.add(obj));
    this.player1Container.setDepth(5);

    // Player 2 container
    this.player2Container = this.add.container(PLAYER2_SPAWN_X, PLAYER_SPAWN_Y);
    const char2Objs = CharacterRenderer.renderCharacter(this, appearance2, {
      scale: 1,
      facingRight: false,
    });
    char2Objs.forEach(obj => this.player2Container.add(obj));
    this.player2Container.setDepth(5);
  }

  private createBallVisual(): void {
    this.ballContainer = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 3);
    this.ballCircle = this.add.arc(0, 0, BALL_RADIUS, 0, 360, false, 0xffffff);
    this.ballCircle.setStrokeStyle(1.5, 0x444444);
    this.ballContainer.add(this.ballCircle);
    this.ballContainer.setDepth(6);
  }

  // ═══════════════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════════════
  private setupControls(): void {
    if (!this.input.keyboard) return;
    this.keys = {
      left: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      jump: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      kick: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      super: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      arrowLeft: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      arrowRight: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      arrowUp: this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
    };
  }

  private setupOnlineTouchControls(): void {
    this.touchControls = new TouchControls({ scene: this, mode: 'single' });
  }

  // ═══════════════════════════════════════════════════
  // HUD
  // ═══════════════════════════════════════════════════
  private createHUD(): void {
    const hudTop = 35;
    const meterY = hudTop + 34;
    const meterRadius = 3;

    // HUD panel background
    const hudPanel = this.add.graphics().setDepth(9);
    hudPanel.fillStyle(THEME.hudBg, 0.65);
    hudPanel.fillRoundedRect(GAME_WIDTH / 2 - 130, hudTop - 6, 260, 52, 10);

    this.scoreText = this.add.text(GAME_WIDTH / 2, hudTop, '0 - 0', {
      fontSize: '32px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5, 0).setDepth(10);

    this.timerText = this.add.text(GAME_WIDTH / 2, hudTop + 36, '1:30', {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(10);

    // Super meter backgrounds (rounded)
    this.superMeter1Bg = this.add.graphics().setDepth(10);
    this.superMeter1Bg.fillStyle(THEME.statBarEmpty, 0.7);
    this.superMeter1Bg.fillRoundedRect(GAME_WIDTH / 2 - 200, meterY - 4, 100, 8, meterRadius);

    this.superMeter1 = this.add.graphics().setDepth(10);

    this.superMeter2Bg = this.add.graphics().setDepth(10);
    this.superMeter2Bg.fillStyle(THEME.statBarEmpty, 0.7);
    this.superMeter2Bg.fillRoundedRect(GAME_WIDTH / 2 + 100, meterY - 4, 100, 8, meterRadius);

    this.superMeter2 = this.add.graphics().setDepth(10);

    this.countdownText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 40, '', {
      fontSize: '64px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setDepth(100);

    // Ping indicator (top right)
    this.pingIndicator = this.add.text(GAME_WIDTH - 10, hudTop, '', {
      fontSize: '10px', fontFamily: 'Courier New, monospace', color: '#00ff66',
    }).setOrigin(1, 0).setDepth(10);

    // Player names
    this.add.text(GAME_WIDTH / 2 - 100, hudTop, this.char1.name, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(10);

    this.add.text(GAME_WIDTH / 2 + 100, hudTop, this.char2.name, {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 0).setDepth(10);

    // Pause button (top-left)
    const pauseBtn = this.add.text(30, hudTop + 4, '\u23F8', {
      fontSize: '28px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);
    pauseBtn.on('pointerdown', () => {
      if (!this.paused) this.togglePause();
    });
  }

  // ═══════════════════════════════════════════════════
  // PAUSE MENU (settings overlay — server keeps running)
  // ═══════════════════════════════════════════════════
  private togglePause(): void {
    if (this.paused) {
      this.resumeFromPause();
    } else {
      this.showPauseMenu();
    }
  }

  private showPauseMenu(): void {
    this.paused = true;
    const D = 300;
    const cx = GAME_WIDTH / 2;
    const sm = SoundManager.getInstance();
    const musicMgr = MusicManager.getInstance();

    const overlay = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.8)
      .setDepth(D).setInteractive();

    const title = this.add.text(cx, 70, 'PAUSA', {
      fontSize: '36px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(D + 1);

    // SFX toggle
    const sfxBtn = this.add.text(cx, 130, `Effetti: ${sm.enabled ? 'ON' : 'OFF'}`, {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D + 1).setInteractive({ useHandCursor: true });
    sfxBtn.on('pointerdown', () => {
      sm.enabled = !sm.enabled;
      this.game.registry.set('soundOn', sm.enabled);
      sfxBtn.setText(`Effetti: ${sm.enabled ? 'ON' : 'OFF'}`);
      if (sm.enabled) sm.menuClick();
    });

    // Music toggle
    const musicBtn = this.add.text(cx, 170, `Musica: ${musicMgr.isMusicEnabled() ? 'ON' : 'OFF'}`, {
      fontSize: '18px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D + 1).setInteractive({ useHandCursor: true });
    musicBtn.on('pointerdown', () => {
      const on = !musicMgr.isMusicEnabled();
      musicMgr.setMusicEnabled(on);
      musicBtn.setText(`Musica: ${on ? 'ON' : 'OFF'}`);
      if (sm.enabled) sm.menuClick();
    });

    // Song picker
    const songLabel = this.add.text(cx, 215, musicMgr.getCurrentName(), {
      fontSize: '14px', fontFamily: 'Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D + 1);

    const prevSong = this.add.text(cx - 110, 215, '<', {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D + 1).setInteractive({ useHandCursor: true });
    prevSong.on('pointerdown', () => {
      if (sm.enabled) sm.menuClick();
      musicMgr.switchTo(musicMgr.getCurrentIndex() - 1);
      songLabel.setText(musicMgr.getCurrentName());
    });

    const nextSong = this.add.text(cx + 110, 215, '>', {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: THEME.primaryHex,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D + 1).setInteractive({ useHandCursor: true });
    nextSong.on('pointerdown', () => {
      if (sm.enabled) sm.menuClick();
      musicMgr.switchTo(musicMgr.getCurrentIndex() + 1);
      songLabel.setText(musicMgr.getCurrentName());
    });

    // Resume
    const resumeBtn = this.add.text(cx, 290, '\u25B6  RIPRENDI', {
      fontSize: '22px', fontFamily: 'Arial Black, Arial', color: THEME.successHex,
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(D + 1).setInteractive({ useHandCursor: true });
    resumeBtn.on('pointerdown', () => {
      if (sm.enabled) sm.menuClick();
      this.resumeFromPause();
    });

    // Exit (with warning)
    const exitBtn = this.add.text(cx, 345, 'ABBANDONA', {
      fontSize: '20px', fontFamily: 'Arial', color: THEME.dangerHex,
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(D + 1).setInteractive({ useHandCursor: true });
    exitBtn.on('pointerdown', () => {
      if (sm.enabled) sm.menuClick();
      this.resumeFromPause();
      this.socket.emit('ROOM_LEAVE', {});
      this.cleanupAll();
      transitionTo(this, 'MainMenu');
    });

    this.pauseElements = [overlay, title, sfxBtn, musicBtn, songLabel, prevSong, nextSong, resumeBtn, exitBtn];
  }

  private resumeFromPause(): void {
    this.pauseElements.forEach(e => e.destroy());
    this.pauseElements = [];
    this.paused = false;
  }

  // ═══════════════════════════════════════════════════
  // NETWORK LISTENERS
  // ═══════════════════════════════════════════════════
  private setupNetworkListeners(): void {
    this.socket.on('STATE', (data: {
      tick: number;
      players: [PlayerStateBroadcast, PlayerStateBroadcast];
      ball: BallState;
      score: ScoreState;
      timeRemaining: number;
      phase: GamePhase;
      overtime: boolean;
      countdown: number;
      lastProcessedInput: number;
    }) => {
      // Store snapshot for interpolation
      this.snapshotBuffer.push({
        time: Date.now(),
        players: data.players,
        ball: data.ball,
      });
      // Keep only last 10 snapshots
      if (this.snapshotBuffer.length > 10) {
        this.snapshotBuffer.shift();
      }

      // Update game state
      this.score = data.score;
      this.timeRemaining = data.timeRemaining;
      this.serverPhase = data.phase;
      this.overtime = data.overtime;

      // Sync super meters from server (authoritative)
      this.serverSuperMeter1 = data.players[0].superMeter;
      this.serverSuperMeter2 = data.players[1].superMeter;

      // Countdown display
      if (data.phase === 'countdown' && data.countdown > 0) {
        this.countdownText.setText(String(data.countdown)).setVisible(true);
      } else if (data.phase === 'playing') {
        this.countdownText.setVisible(false);
      }

      // Overtime display
      if (data.overtime && !this.overtimeText) {
        this.overtimeText = this.add.text(GAME_WIDTH / 2, 59, 'OVERTIME', {
          fontSize: '14px', fontFamily: 'Arial Black, Arial', color: '#ffdd00',
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5).setDepth(10);
        this.tweens.add({
          targets: this.overtimeText,
          alpha: { from: 0.5, to: 1 },
          duration: 500,
          yoyo: true,
          repeat: -1,
        });
      }

      // Ball poison visual
      if (data.ball.poisoned) {
        this.ballCircle.setFillStyle(0x88ff00);
      } else {
        this.ballCircle.setFillStyle(0xffffff);
      }
    });

    this.socket.on('GOAL_SCORED', (data: { scoringPlayer: number; newScore: ScoreState; points: number }) => {
      this.score = data.newScore;
      const goalScorer = data.scoringPlayer === 1 ? this.char1 : this.char2;
      if (goalScorer.id === 1) {
        MusicManager.getInstance().playEffect('/sfx/cotoletta.mp3', 0.5);
      } else {
        this.sound_mgr.goal();
      }

      // Strong shake (5px / 300ms)
      this.cameras.main.shake(300, 5 / 1000);

      // White flash 50ms
      const whiteFlash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0xffffff, 0.7)
        .setDepth(149);
      this.tweens.add({ targets: whiteFlash, alpha: 0, duration: 50, onComplete: () => whiteFlash.destroy() });

      // Goal slow-mo (0.5s) — tweens only since physics is server-side
      this.goalSlowMoActive = true;
      this.tweens.timeScale = 0.3;
      const goalSlowStart = performance.now();
      const checkSlowEnd = () => {
        if (performance.now() - goalSlowStart >= 500) {
          if (this.goalSlowMoActive) {
            this.tweens.timeScale = 1;
            this.goalSlowMoActive = false;
          }
        } else {
          requestAnimationFrame(checkSlowEnd);
        }
      };
      requestAnimationFrame(checkSlowEnd);

      // Team-colored text
      const scorer = data.scoringPlayer === 1 ? this.char1 : this.char2;
      const scorerColor = scorer.color;
      const rgb = Phaser.Display.Color.IntegerToRGB(scorerColor);
      const goalLabel = data.points > 1 ? 'GOOOL! x2' : 'GOOOL!';
      const goalText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, goalLabel, {
        fontSize: '52px', fontFamily: 'Arial Black, Arial',
        color: `rgb(${rgb.r},${rgb.g},${rgb.b})`,
        stroke: '#000000', strokeThickness: 8,
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: goalText,
        scale: { from: 0.5, to: 1.5 },
        alpha: { from: 1, to: 0 },
        duration: 1500,
        onComplete: () => goalText.destroy(),
      });

      // Score bounce with team color flash
      this.tweens.add({
        targets: this.scoreText,
        scale: { from: 1.3, to: 1 },
        duration: 300,
        ease: 'Back.easeOut',
      });
      const hexColor = `#${scorerColor.toString(16).padStart(6, '0')}`;
      this.scoreText.setColor(hexColor);
      this.time.delayedCall(600, () => this.scoreText.setColor('#ffffff'));

      // Team-colored particle explosion at goal
      const goalX = data.scoringPlayer === 1 ? GOAL_RIGHT_X : GOAL_LEFT_X + GOAL_WIDTH;
      const goalCY = GOAL_Y + GOAL_HEIGHT / 2;
      for (let i = 0; i < 15; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 60;
        const gp = this.add.arc(goalX, goalCY, 3, 0, 360, false, scorerColor, 0.9).setDepth(99);
        this.tweens.add({
          targets: gp, x: goalX + Math.cos(angle) * speed, y: goalCY + Math.sin(angle) * speed,
          alpha: 0, scale: 0, duration: 400, onComplete: () => gp.destroy(),
        });
      }

      // Confetti
      for (let i = 0; i < 25; i++) {
        const cx = GAME_WIDTH / 2 + (Math.random() - 0.5) * 200;
        const p = this.add.arc(cx, GAME_HEIGHT / 2, 2 + Math.random() * 3, 0, 360, false,
          [0xffdd00, 0xff4400, 0x00ccff, 0xffffff, scorerColor][Math.floor(Math.random() * 5)]).setDepth(99);
        this.tweens.add({
          targets: p,
          y: GAME_HEIGHT + 20,
          x: cx + (Math.random() - 0.5) * 100,
          alpha: 0,
          duration: 1500 + Math.random() * 1000,
          onComplete: () => p.destroy(),
        });
      }
    });

    this.socket.on('SUPER_ACTIVATED', (data: { playerIndex: number; superMoveId: string }) => {
      this.sound_mgr.super();
      MusicManager.getInstance().duckForSuper();

      const superInfo = SUPER_MOVES.find(m => m.id === data.superMoveId);
      const superName = superInfo?.displayName ?? data.superMoveId;
      const color = superInfo ? `#${superInfo.color.toString(16).padStart(6, '0')}` : '#ffaa00';

      const text = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2 - 80, `${superName}!`, {
        fontSize: '28px', fontFamily: 'Arial Black, Arial', color,
        stroke: '#000000', strokeThickness: 5,
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: text,
        scale: { from: 0.5, to: 1.2 },
        alpha: { from: 1, to: 0 },
        y: GAME_HEIGHT / 2 - 120,
        duration: 1200,
        onComplete: () => text.destroy(),
      });

      // Flash
      const flash = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT,
        superInfo?.color ?? 0xffaa00, 0.3).setDepth(99);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy(),
      });

      // fireCapriole special effects: rotation, camera zoom, fire particles, SFX
      if (data.superMoveId === 'fireCapriole') {
        const container = data.playerIndex === 1 ? this.player1Container : this.player2Container;
        MusicManager.getInstance().playEffect('/sfx/super_ami.mp3');

        // Camera zoom 1.1x (relative to base zoom)
        this.cameras.main.zoomTo(getBaseZoom(this) * 1.1, 300);

        // 360° rotation on container
        this.tweens.add({
          targets: container,
          angle: 360,
          duration: 1500,
          ease: 'Linear',
          onComplete: () => container.setAngle(0),
        });

        // Fire particles
        const particleInterval = setInterval(() => {
          for (let i = 0; i < 3; i++) {
            const angle = Math.random() * Math.PI * 2;
            const fp = this.add.arc(container.x, container.y, 3, 0, 360, false, 0xff4400, 0.8).setDepth(10);
            this.tweens.add({
              targets: fp,
              x: container.x + Math.cos(angle) * 35,
              y: container.y + Math.sin(angle) * 35,
              alpha: 0,
              duration: 200,
              onComplete: () => fp.destroy(),
            });
          }
        }, 100);

        // End effects after 1800ms
        setTimeout(() => {
          clearInterval(particleInterval);
          this.cameras.main.zoomTo(getBaseZoom(this), 500);

          // Fire impact particles
          for (let i = 0; i < 15; i++) {
            const a = Math.random() * Math.PI * 2;
            const s = 30 + Math.random() * 60;
            const ip = this.add.arc(this.ballContainer.x, this.ballContainer.y, 3, 0, 360, false,
              Math.random() < 0.5 ? 0xff4400 : 0xffaa00, 0.9).setDepth(10);
            this.tweens.add({
              targets: ip,
              x: this.ballContainer.x + Math.cos(a) * s,
              y: this.ballContainer.y + Math.sin(a) * s,
              alpha: 0,
              scale: 0,
              duration: 400,
              onComplete: () => ip.destroy(),
            });
          }
          MusicManager.getInstance().unduckAfterSuper();
        }, 1800);
      } else if (data.superMoveId === 'terremoto') {
        // Terremoto special effects: earthquake shake, earth particles, SFX
        const container = data.playerIndex === 1 ? this.player1Container : this.player2Container;
        MusicManager.getInstance().playEffect('/sfx/giorgito.mp3', 0.5);

        // Strong camera shake (earthquake)
        this.cameras.main.shake(500, 8 / 1000);

        // Earth/dust particles at player's feet
        for (let i = 0; i < 20; i++) {
          const px = container.x + (Math.random() - 0.5) * 80;
          const py = GROUND_Y - 5;
          const dust = this.add.arc(px, py, 2 + Math.random() * 3, 0, 360, false,
            Math.random() < 0.5 ? 0x8b7355 : 0xdaa520, 0.8).setDepth(10);
          this.tweens.add({
            targets: dust,
            y: py - 20 - Math.random() * 40,
            x: px + (Math.random() - 0.5) * 30,
            alpha: 0,
            scale: 0.3,
            duration: 400 + Math.random() * 300,
            onComplete: () => dust.destroy(),
          });
        }

        // Stun visual on opponent — flash alpha
        const opponentContainer = data.playerIndex === 1 ? this.player2Container : this.player1Container;
        const flashInterval = setInterval(() => {
          opponentContainer.setAlpha(opponentContainer.alpha < 1 ? 1 : 0.3);
        }, 100);
        setTimeout(() => {
          clearInterval(flashInterval);
          opponentContainer.setAlpha(1);
        }, 800);

        // Unduck after 1s
        setTimeout(() => MusicManager.getInstance().unduckAfterSuper(), 1000);
      } else {
        // Other supers: unduck after estimated duration
        const dur = data.superMoveId === 'flameDash' ? 2000 :
                    data.superMoveId === 'ghostPhase' ? 2500 :
                    data.superMoveId === 'ironWall' || data.superMoveId === 'iceField' ? 3000 : 1500;
        setTimeout(() => MusicManager.getInstance().unduckAfterSuper(), dur);
      }
    });

    this.socket.on('DISCONNECT_WARNING', (data: { disconnectedPlayer: number; timeoutMs: number }) => {
      this.sound_mgr.warningBuzz();
      this.showDisconnectOverlay(data.timeoutMs);
    });

    this.socket.on('RECONNECTED', (_data: { playerIndex: number }) => {
      this.hideDisconnectOverlay();
    });

    this.socket.on('MATCH_OVER', (data: { winner: number | null; finalScore: ScoreState; stats: MatchStats }) => {
      this.matchOver = true;
      this.sound_mgr.whistle();
      this.time.delayedCall(1500, () => {
        this.cleanupAll();
        transitionTo(this, 'Result', {
          winner: data.winner,
          score: data.finalScore,
          charRef1: this.charRef1,
          charRef2: this.charRef2,
          mode: 'online',
          stats: data.stats,
          roomCode: this.roomCode,
          myIndex: this.myPlayerIndex,
        });
      });
    });
  }

  // ═══════════════════════════════════════════════════
  // DISCONNECT OVERLAY
  // ═══════════════════════════════════════════════════
  private showDisconnectOverlay(timeoutMs: number): void {
    if (this.disconnectOverlay) return;

    this.disconnectOverlay = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7
    ).setDepth(150).setInteractive();

    this.disconnectCountdown = Math.ceil(timeoutMs / 1000);
    this.disconnectText = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2,
      `Avversario disconnesso\nReconnecting... ${this.disconnectCountdown}s`, {
        fontSize: '20px', fontFamily: 'Arial', color: THEME.secondaryHex, align: 'center',
      }).setOrigin(0.5).setDepth(151);

    this.disconnectTimer = setInterval(() => {
      this.disconnectCountdown--;
      if (this.disconnectCountdown <= 0) {
        this.hideDisconnectOverlay();
      } else {
        this.disconnectText?.setText(
          `Avversario disconnesso\nReconnecting... ${this.disconnectCountdown}s`
        );
      }
    }, 1000);
  }

  private hideDisconnectOverlay(): void {
    if (this.disconnectTimer) {
      clearInterval(this.disconnectTimer);
      this.disconnectTimer = undefined;
    }
    this.disconnectOverlay?.destroy();
    this.disconnectOverlay = undefined;
    this.disconnectText?.destroy();
    this.disconnectText = undefined;
  }

  // ═══════════════════════════════════════════════════
  // UPDATE LOOP
  // ═══════════════════════════════════════════════════
  update(_time: number, _delta: number): void {
    if (this.matchOver) return;

    // Get local input and send to server
    const input = this.getLocalInput();
    this.inputSeq++;
    this.socket.emit('INPUT', { seq: this.inputSeq, inputs: input });

    // Interpolate both players from server state
    this.interpolatePlayer(this.player1Container, 0);
    this.interpolatePlayer(this.player2Container, 1);

    // Interpolate ball
    this.interpolateBall();

    // Update HUD
    this.updateHUD();
  }

  private interpolatePlayer(container: Phaser.GameObjects.Container, playerIdx: number): void {
    if (this.snapshotBuffer.length < 2) {
      // Not enough snapshots yet — use latest if available
      if (this.snapshotBuffer.length > 0) {
        const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
        const state = latest.players[playerIdx];
        container.setPosition(state.x, state.y);
      }
      return;
    }

    const renderTime = Date.now() - INTERPOLATION_DELAY_MS;

    // Find two snapshots to interpolate between
    let before: ServerSnapshot | null = null;
    let after: ServerSnapshot | null = null;

    for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
      if (this.snapshotBuffer[i].time <= renderTime && this.snapshotBuffer[i + 1].time >= renderTime) {
        before = this.snapshotBuffer[i];
        after = this.snapshotBuffer[i + 1];
        break;
      }
    }

    if (before && after) {
      const range = after.time - before.time;
      const t = range > 0 ? (renderTime - before.time) / range : 0;
      const clampedT = Math.max(0, Math.min(1, t));

      const bState = before.players[playerIdx];
      const aState = after.players[playerIdx];

      const x = bState.x + (aState.x - bState.x) * clampedT;
      const y = bState.y + (aState.y - bState.y) * clampedT;

      container.setPosition(x, y);
    } else {
      // Use latest snapshot
      const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
      const state = latest.players[playerIdx];
      container.setPosition(state.x, state.y);
    }
  }

  private lastBallVx = 0;

  private interpolateBall(): void {
    if (this.snapshotBuffer.length < 2) {
      if (this.snapshotBuffer.length > 0) {
        const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
        this.ballContainer.setPosition(latest.ball.x, latest.ball.y);
      }
      return;
    }

    const renderTime = Date.now() - INTERPOLATION_DELAY_MS;

    let before: ServerSnapshot | null = null;
    let after: ServerSnapshot | null = null;

    for (let i = 0; i < this.snapshotBuffer.length - 1; i++) {
      if (this.snapshotBuffer[i].time <= renderTime && this.snapshotBuffer[i + 1].time >= renderTime) {
        before = this.snapshotBuffer[i];
        after = this.snapshotBuffer[i + 1];
        break;
      }
    }

    if (before && after) {
      const range = after.time - before.time;
      const t = range > 0 ? (renderTime - before.time) / range : 0;
      const clampedT = Math.max(0, Math.min(1, t));

      const x = before.ball.x + (after.ball.x - before.ball.x) * clampedT;
      const y = before.ball.y + (after.ball.y - before.ball.y) * clampedT;

      this.ballContainer.setPosition(x, y);

      // Visual rotation based on estimated vx
      const vx = range > 0 ? (after.ball.x - before.ball.x) / (range / 1000) : 0;
      this.ballContainer.angle += vx * 0.01;
      this.lastBallVx = vx;
    } else {
      const latest = this.snapshotBuffer[this.snapshotBuffer.length - 1];
      this.ballContainer.setPosition(latest.ball.x, latest.ball.y);
    }
  }

  // ═══════════════════════════════════════════════════
  // HUD UPDATE
  // ═══════════════════════════════════════════════════
  private updateHUD(): void {
    this.scoreText.setText(`${this.score.player1} - ${this.score.player2}`);

    const mins = Math.floor(Math.max(0, this.timeRemaining) / 60);
    const secs = Math.max(0, this.timeRemaining) % 60;
    this.timerText.setText(`${mins}:${secs.toString().padStart(2, '0')}`);

    // Timer: orange <30s, red+pulse <10s
    if (this.timeRemaining <= 10 && this.timeRemaining > 0) {
      this.timerText.setColor('#ff4444');
      this.timerText.setScale(1 + Math.sin(Date.now() / 200) * 0.1);
    } else if (this.timeRemaining <= 30 && this.timeRemaining > 10) {
      this.timerText.setColor('#ff8800');
      this.timerText.setScale(1);
    } else {
      this.timerText.setColor('#ffffff');
      this.timerText.setScale(1);
    }

    // Super meters from server (rounded rect redraw)
    const meterRadius = 3;
    const meterHeight = 8;
    const hudTopM = 35;
    const meterYPos = hudTopM + 34;
    const p1Fill = (this.serverSuperMeter1 / SUPER_MAX) * 100;
    const p2Fill = (this.serverSuperMeter2 / SUPER_MAX) * 100;
    const p1Full = this.serverSuperMeter1 >= SUPER_MAX;
    const p2Full = this.serverSuperMeter2 >= SUPER_MAX;

    this.superMeter1.clear();
    if (p1Fill > 0) {
      if (p1Full) {
        this.superMeter1.fillGradientStyle(0x00ff00, 0x00ff00, 0x00cc00, 0x00cc00);
      } else {
        this.superMeter1.fillGradientStyle(THEME.statBarFillStart, THEME.statBarFillStart, THEME.statBarFillEnd, THEME.statBarFillEnd);
      }
      this.superMeter1.fillRoundedRect(GAME_WIDTH / 2 - 100 - p1Fill, meterYPos - meterHeight / 2, p1Fill, meterHeight, meterRadius);
    }

    this.superMeter2.clear();
    if (p2Fill > 0) {
      if (p2Full) {
        this.superMeter2.fillGradientStyle(0x00ff00, 0x00ff00, 0x00cc00, 0x00cc00);
      } else {
        this.superMeter2.fillGradientStyle(THEME.statBarFillStart, THEME.statBarFillStart, THEME.statBarFillEnd, THEME.statBarFillEnd);
      }
      this.superMeter2.fillRoundedRect(GAME_WIDTH / 2 + 100, meterYPos - meterHeight / 2, p2Fill, meterHeight, meterRadius);
    }

    // Ping indicator
    const ping = this.socket.ping;
    const pingColor = ping < 50 ? '#00ff66' : ping < MAX_PING_WARNING_MS ? '#ffaa00' : '#ff4444';
    this.pingIndicator.setText(`${ping}ms`).setColor(pingColor);
  }

  // ═══════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════
  private getLocalInput(): InputState {
    const input: InputState = {
      left: this.keys?.left?.isDown || this.keys?.arrowLeft?.isDown || false,
      right: this.keys?.right?.isDown || this.keys?.arrowRight?.isDown || false,
      jump: false,
      kick: false,
      super: false,
    };

    const jumpDown = this.keys?.jump?.isDown || this.keys?.arrowUp?.isDown || false;
    if (jumpDown && !this.jumpPressed) input.jump = true;
    this.jumpPressed = jumpDown;

    const kickDown = this.keys?.kick?.isDown || false;
    if (kickDown && !this.kickPressed) input.kick = true;
    this.kickPressed = kickDown;

    const superDown = this.keys?.super?.isDown || false;
    if (superDown && !this.superPressed) input.super = true;
    this.superPressed = superDown;

    // Merge touch
    if (this.touchControls?.active) {
      input.left = input.left || this.touchControls.p1Input.left;
      input.right = input.right || this.touchControls.p1Input.right;
      input.jump = input.jump || this.touchControls.p1Input.jump;
      input.kick = input.kick || this.touchControls.p1Input.kick;
      input.super = input.super || this.touchControls.p1Input.super;
      this.touchControls.resetEdgeTriggers();
    }

    return input;
  }

  // ═══════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════
  private cleanupAll(): void {
    this.socket.off('STATE');
    this.socket.off('GOAL_SCORED');
    this.socket.off('MATCH_OVER');
    this.socket.off('SUPER_ACTIVATED');
    this.socket.off('DISCONNECT_WARNING');
    this.socket.off('RECONNECTED');
    this.hideDisconnectOverlay();
  }

  shutdown(): void {
    this.cleanupAll();
    this.resumeFromPause();
    this.time.removeAllEvents();
    this.tweens.timeScale = 1;
    this.tweens.killAll();
    this.touchControls?.destroy();
    this.touchControls = undefined;
    this.goalSlowMoActive = false;
    MusicManager.getInstance().setGameplayMode(false);
  }
}
