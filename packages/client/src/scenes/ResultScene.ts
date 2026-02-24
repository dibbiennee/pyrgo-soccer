import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, resolveCharacter, defaultAppearanceForPreset } from '@pyrgo/shared';
import type { ScoreState, CharacterRef, Appearance } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { SoundManager } from '../audio/SoundManager';
import { SocketManager } from '../network/SocketManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton, type ButtonGroup } from '../ui/ButtonFactory';
import { setupResponsiveCamera, getViewEdges } from '../utils/responsive';

interface MatchStats {
  shotsP1: number;
  shotsP2: number;
  supersUsedP1: number;
  supersUsedP2: number;
}

export class ResultScene extends Phaser.Scene {
  private winner: number | null = null;
  private score: ScoreState = { player1: 0, player2: 0 };
  private charRef1: CharacterRef = { type: 'preset', id: 1 };
  private charRef2: CharacterRef = { type: 'preset', id: 2 };
  private gameMode: 'local' | 'cpu' | 'online' = 'local';
  private stats: MatchStats = { shotsP1: 0, shotsP2: 0, supersUsedP1: 0, supersUsedP2: 0 };
  private roomCode = '';
  private myIndex = 1;

  // Online rematch state
  private rematchBtn?: ButtonGroup;
  private rematchRequested = false;
  private opponentLeft = false;

  constructor() {
    super('Result');
  }

  init(data: {
    winner: number | null;
    score: ScoreState;
    charRef1?: CharacterRef;
    charRef2?: CharacterRef;
    char1?: number;
    char2?: number;
    mode?: string;
    stats?: MatchStats;
    roomCode?: string;
    myIndex?: number;
  }): void {
    this.winner = data.winner;
    this.score = data.score;
    this.charRef1 = data.charRef1 ?? { type: 'preset', id: data.char1 ?? 1 };
    this.charRef2 = data.charRef2 ?? { type: 'preset', id: data.char2 ?? 2 };
    this.gameMode = (data.mode as 'local' | 'cpu' | 'online') ?? 'local';
    this.stats = data.stats ?? { shotsP1: 0, shotsP2: 0, supersUsedP1: 0, supersUsedP2: 0 };
    this.roomCode = data.roomCode ?? '';
    this.myIndex = data.myIndex ?? 1;
    this.rematchRequested = false;
    this.opponentLeft = false;
  }

  create(): void {
    setupResponsiveCamera(this);
    fadeIn(this);
    const edges = getViewEdges(this);

    const sm = SoundManager.getInstance();
    const char1 = resolveCharacter(this.charRef1);
    const char2 = resolveCharacter(this.charRef2);
    const appearance1: Appearance = char1.appearance ?? defaultAppearanceForPreset(char1.id);
    const appearance2: Appearance = char2.appearance ?? defaultAppearanceForPreset(char2.id);

    // Background
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x0a0a1a);

    // ── "TEMPO SCADUTO" animated ────────────────────
    const tempoText = this.add.text(GAME_WIDTH / 2, edges.top + 10, 'TEMPO SCADUTO', {
      fontSize: '20px', fontFamily: 'Arial Black, Arial', color: '#aaaacc',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: tempoText,
      scale: 1,
      duration: 400,
      ease: 'Back.easeOut',
    });
    this.tweens.add({
      targets: tempoText,
      alpha: 0,
      delay: 1000,
      duration: 500,
    });

    // ── Result text ─────────────────────────────────
    let resultText: string;
    let resultColor: string;
    if (this.winner === null) {
      resultText = 'DRAW!';
      resultColor = '#aaaaaa';
    } else {
      const winnerChar = this.winner === 1 ? char1 : char2;
      resultText = `${winnerChar.name} WINS!`;
      resultColor = '#ffdd00';
    }

    const title = this.add.text(GAME_WIDTH / 2, 75, resultText, {
      fontSize: '42px',
      fontFamily: 'Arial Black, Arial',
      color: resultColor,
      stroke: '#000000',
      strokeThickness: 6,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: title,
      scale: 1,
      duration: 600,
      ease: 'Back.easeOut',
      delay: 200,
    });

    // ── Score ────────────────────────────────────────
    const scoreDisplay = this.add.text(GAME_WIDTH / 2, 120, `${this.score.player1} - ${this.score.player2}`, {
      fontSize: '36px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setScale(0);

    this.tweens.add({
      targets: scoreDisplay,
      scale: 1,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 500,
    });

    // ── Character display ───────────────────────────
    const p1X = GAME_WIDTH * 0.25;
    const p2X = GAME_WIDTH * 0.75;
    const charY = 210;

    if (this.winner === null) {
      const c1 = CharacterRenderer.renderMiniPreview(this, appearance1, p1X, charY, 1.5);
      const c2 = CharacterRenderer.renderMiniPreview(this, appearance2, p2X, charY, 1.5);
      c1.setAlpha(0);
      c2.setAlpha(0);
      this.tweens.add({ targets: c1, alpha: 1, duration: 500, delay: 600 });
      this.tweens.add({ targets: c2, alpha: 1, duration: 500, delay: 600 });
    } else {
      const winnerAppearance = this.winner === 1 ? appearance1 : appearance2;
      const loserAppearance = this.winner === 1 ? appearance2 : appearance1;
      const winnerX = this.winner === 1 ? p1X : p2X;
      const loserX = this.winner === 1 ? p2X : p1X;

      const winnerContainer = CharacterRenderer.renderMiniPreview(this, winnerAppearance, winnerX, charY - 10, 2.0);
      winnerContainer.setAlpha(0);

      const glow = this.add.arc(winnerX, charY - 10, 50, 0, 360, false, 0xffdd00, 0.2).setDepth(-1);
      this.tweens.add({
        targets: glow,
        alpha: { from: 0.1, to: 0.3 },
        scale: { from: 0.9, to: 1.1 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.tweens.add({
        targets: winnerContainer,
        alpha: 1,
        duration: 500,
        delay: 600,
      });

      this.tweens.add({
        targets: winnerContainer,
        y: charY - 20,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: 800,
      });

      const loserContainer = CharacterRenderer.renderMiniPreview(this, loserAppearance, loserX, charY + 20, 1.2);
      loserContainer.setAlpha(0);
      this.tweens.add({
        targets: loserContainer,
        alpha: 0.5,
        duration: 500,
        delay: 700,
      });
    }

    // Character names
    this.add.text(p1X, charY + 70, char1.name, {
      fontSize: '14px', fontFamily: 'Arial', color: '#88aacc',
    }).setOrigin(0.5);
    this.add.text(p2X, charY + 70, char2.name, {
      fontSize: '14px', fontFamily: 'Arial', color: '#88aacc',
    }).setOrigin(0.5);

    // ── Match stats ─────────────────────────────────
    const statsY = 310;
    this.add.text(GAME_WIDTH / 2, statsY, 'MATCH STATS', {
      fontSize: '12px', fontFamily: 'Arial Black, Arial', color: '#00ccff',
    }).setOrigin(0.5);

    const statRows = [
      { label: 'Shots', p1: this.stats.shotsP1, p2: this.stats.shotsP2 },
      { label: 'Supers', p1: this.stats.supersUsedP1, p2: this.stats.supersUsedP2 },
    ];

    statRows.forEach((row, i) => {
      const y = statsY + 20 + i * 18;
      this.add.text(GAME_WIDTH / 2 - 70, y, String(row.p1), {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
      }).setOrigin(1, 0.5);
      this.add.text(GAME_WIDTH / 2, y, row.label, {
        fontSize: '11px', fontFamily: 'Arial', color: '#888899',
      }).setOrigin(0.5);
      this.add.text(GAME_WIDTH / 2 + 70, y, String(row.p2), {
        fontSize: '12px', fontFamily: 'Arial', color: '#ffffff',
      }).setOrigin(0, 0.5);
    });

    // ── Celebration particles ────────────────────────
    if (this.winner) {
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * GAME_WIDTH;
        const p = this.add.arc(x, -10, 3 + Math.random() * 3, 0, 360, false,
          [0xffdd00, 0xff4400, 0x00ccff, 0xffffff][Math.floor(Math.random() * 4)]);
        this.tweens.add({
          targets: p,
          y: GAME_HEIGHT + 20,
          x: x + (Math.random() - 0.5) * 100,
          alpha: 0.5,
          duration: 2000 + Math.random() * 2000,
          delay: Math.random() * 1000,
          onComplete: () => p.destroy(),
        });
      }
    }

    // ── Buttons ───────────────────────────────────────
    const btnY = 400;

    if (this.gameMode === 'online') {
      // Online: RIVINCITA, MENU (no CAMBIA PG)
      this.rematchBtn = createButton(this, GAME_WIDTH / 2 - 100, btnY, 'RIVINCITA', () => {
        this.requestOnlineRematch();
      }, { width: 140, height: 38, fillColor: 0x00aa44, strokeColor: 0x00ff66 });

      createButton(this, GAME_WIDTH / 2 + 100, btnY, 'MENU', () => {
        const socket = SocketManager.getInstance();
        socket.emit('ROOM_LEAVE', {});
        this.cleanupOnlineListeners();
        transitionTo(this, 'MainMenu');
      }, { width: 140, height: 38, fillColor: 0x444466, strokeColor: 0x666688 });

      // Setup online listeners
      this.setupOnlineListeners();
    } else {
      // Local/CPU: RIVINCITA, CAMBIA PG, MENU
      createButton(this, GAME_WIDTH / 2 - 150, btnY, 'RIVINCITA', () => {
        transitionTo(this, 'VsScreen', {
          charRef1: this.charRef1,
          charRef2: this.charRef2,
          targetScene: this.gameMode === 'cpu' ? 'CpuGame' : 'LocalGame',
        });
      }, { width: 140, height: 38, fillColor: 0x00aa44, strokeColor: 0x00ff66 });

      createButton(this, GAME_WIDTH / 2, btnY, 'CAMBIA PG', () => {
        transitionTo(this, 'CharSelect', { mode: this.gameMode });
      }, { width: 140, height: 38 });

      createButton(this, GAME_WIDTH / 2 + 150, btnY, 'MENU', () => {
        transitionTo(this, 'MainMenu');
      }, { width: 140, height: 38, fillColor: 0x444466, strokeColor: 0x666688 });
    }

    // ── Sound ───────────────────────────────────────
    if (this.winner) {
      sm.victoryJingle();
    } else {
      sm.defeatSound();
    }
  }

  // ═══════════════════════════════════════════════════
  // ONLINE REMATCH
  // ═══════════════════════════════════════════════════
  private setupOnlineListeners(): void {
    const socket = SocketManager.getInstance();

    socket.on('REMATCH_REQUESTED', (_data: { playerIndex: number }) => {
      SoundManager.getInstance().notificationPing();
      // Show toast
      const toast = this.add.text(GAME_WIDTH / 2, 370, 'L\'avversario vuole la rivincita!', {
        fontSize: '13px', fontFamily: 'Arial', color: '#ffaa00',
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({
        targets: toast,
        alpha: 0,
        delay: 3000,
        duration: 500,
        onComplete: () => toast.destroy(),
      });
    });

    socket.on('REMATCH_ACCEPTED', () => {
      this.cleanupOnlineListeners();
      transitionTo(this, 'VsScreen', {
        charRef1: this.charRef1,
        charRef2: this.charRef2,
        targetScene: 'OnlineGame',
        myIndex: this.myIndex,
        roomCode: this.roomCode,
      });
    });

    socket.on('ROOM_PLAYER_LEFT', (_data: { playerIndex: number; reason: string }) => {
      this.opponentLeft = true;
      if (this.rematchBtn) {
        this.rematchBtn.label.setText('OPPONENT LEFT');
        this.rematchBtn.bg.setFillStyle(0x444466);
        this.rematchBtn.bg.removeInteractive();
      }
    });
  }

  private requestOnlineRematch(): void {
    if (this.rematchRequested || this.opponentLeft) return;
    this.rematchRequested = true;

    const socket = SocketManager.getInstance();
    socket.emit('REMATCH_REQUEST', {});

    if (this.rematchBtn) {
      this.rematchBtn.label.setText('WAITING...');
      this.rematchBtn.bg.setFillStyle(0x444466);
    }
  }

  private cleanupOnlineListeners(): void {
    const socket = SocketManager.getInstance();
    socket.off('REMATCH_REQUESTED');
    socket.off('REMATCH_ACCEPTED');
    socket.off('ROOM_PLAYER_LEFT');
  }

  shutdown(): void {
    this.cleanupOnlineListeners();
    this.tweens.killAll();
  }
}
