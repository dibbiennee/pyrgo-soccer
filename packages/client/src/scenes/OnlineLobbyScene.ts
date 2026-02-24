import Phaser from 'phaser';
import {
  resolveCharacter, defaultAppearanceForPreset,
  SUPER_MOVES,
} from '@pyrgo/shared';
import type { CharacterRef, LobbyPlayerInfo } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { SocketManager } from '../network/SocketManager';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton, type ButtonGroup } from '../ui/ButtonFactory';
import { LayoutManager } from '../utils/LayoutManager';

export class OnlineLobbyScene extends Phaser.Scene {
  private L!: LayoutManager;
  private socket!: SocketManager;
  private players: LobbyPlayerInfo[] = [];
  private myIndex = 1;
  private roomCode = '';
  private charRef: CharacterRef = { type: 'preset', id: 1 };

  private readyBtn?: ButtonGroup;
  private readyIndicators: Phaser.GameObjects.Text[] = [];
  private countdownText?: Phaser.GameObjects.Text;
  private imReady = false;

  constructor() {
    super('OnlineLobby');
  }

  init(data: {
    players?: LobbyPlayerInfo[];
    myIndex?: number;
    roomCode?: string;
    charRef?: CharacterRef;
  }): void {
    this.players = data.players ?? [];
    this.myIndex = data.myIndex ?? 1;
    this.roomCode = data.roomCode ?? '';
    this.charRef = data.charRef ?? { type: 'preset', id: 1 };
    this.imReady = false;
  }

  create(): void {
    fadeIn(this);
    const L = new LayoutManager(this);
    this.L = L;

    const sm = SoundManager.getInstance();
    sm.enabled = this.game.registry.get('soundOn') !== false;

    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x1a1a2e);

    // Title
    this.add.text(L.cx, L.y(0.06), 'MATCH LOBBY', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Room code
    this.add.text(L.cx, L.y(0.10), `Room: ${this.roomCode}`, {
      fontSize: L.fontSize('small'), fontFamily: 'Courier New, monospace', color: '#666688',
    }).setOrigin(0.5);

    // --- Player displays ---
    const p1X = L.x(0.25);
    const p2X = L.x(0.75);
    const charY = L.y(0.38);

    for (let idx = 0; idx < 2; idx++) {
      const playerInfo = this.players.find(p => p.playerIndex === idx + 1);
      const px = idx === 0 ? p1X : p2X;
      const color = idx === 0 ? '#00ccff' : '#ff4444';

      if (playerInfo) {
        const char = resolveCharacter(playerInfo.charRef);
        const appearance = char.appearance ?? defaultAppearanceForPreset(char.id);

        CharacterRenderer.renderMiniPreview(this, appearance, px, charY, L.unit(0.004));

        this.add.text(px, charY + L.unit(0.10), char.name, {
          fontSize: L.fontSize('body'), fontFamily: 'Arial Black, Arial', color,
          stroke: '#000000', strokeThickness: 3,
        }).setOrigin(0.5);

        this.add.text(px, charY + L.unit(0.14), playerInfo.playerName, {
          fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#aaaacc',
        }).setOrigin(0.5);

        // Stats bars
        const statsY = charY + L.unit(0.17);
        const bar = (val: number) => '\u2588'.repeat(val) + '\u2591'.repeat(10 - val);
        this.add.text(px, statsY, `SPD ${bar(char.stats.speed)}`, {
          fontSize: L.fontSize('tiny'), fontFamily: 'Courier New, monospace', color: '#aaaaaa',
        }).setOrigin(0.5);
        this.add.text(px, statsY + L.unit(0.025), `PWR ${bar(char.stats.power)}`, {
          fontSize: L.fontSize('tiny'), fontFamily: 'Courier New, monospace', color: '#aaaaaa',
        }).setOrigin(0.5);
        this.add.text(px, statsY + L.unit(0.05), `DEF ${bar(char.stats.defense)}`, {
          fontSize: L.fontSize('tiny'), fontFamily: 'Courier New, monospace', color: '#aaaaaa',
        }).setOrigin(0.5);

        // Super move info
        const superInfo = SUPER_MOVES.find(m => m.id === char.superMove);
        if (superInfo) {
          this.add.text(px, statsY + L.unit(0.08), `Super: ${superInfo.displayName}`, {
            fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#ffaa00',
          }).setOrigin(0.5);
        }

        // Ready indicator
        const readyText = this.add.text(px, charY - L.unit(0.14), '', {
          fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#00ff66',
        }).setOrigin(0.5);
        this.readyIndicators[idx] = readyText;

        if (playerInfo.ready) {
          readyText.setText('\u2713 READY');
        }
      } else {
        this.add.text(px, charY, '?', {
          fontSize: L.fontSize('title'), fontFamily: 'Arial', color: '#444466',
        }).setOrigin(0.5);
        this.add.text(px, charY + L.unit(0.08), 'Waiting...', {
          fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#666688',
        }).setOrigin(0.5);
      }
    }

    // VS text
    this.add.text(L.cx, charY, 'VS', {
      fontSize: L.fontSize('title'), fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0.5);

    // --- READY button ---
    const btnLarge = L.button('large');
    this.readyBtn = createButton(this, L.cx, L.y(0.72), 'PRONTO', () => {
      if (this.imReady) return;
      this.imReady = true;
      sm.menuClick();
      this.socket.emit('PLAYER_READY', {});
      this.readyBtn!.label.setText('WAITING...');
      this.readyBtn!.bg.setFillStyle(0x444466);
    }, { width: btnLarge.width, height: btnLarge.height, fillColor: 0x00aa44, strokeColor: 0x00ff66 });

    // Leave button
    const btnSmall = L.button('small');
    createButton(this, L.x(0.08), L.y(0.78), '\u2190 LEAVE', () => {
      this.socket.emit('ROOM_LEAVE', {});
      this.cleanup();
      transitionTo(this, 'OnlineHub', { charRef: this.charRef });
    }, { width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('small'), strokeColor: 0x666666 });

    // Countdown text (hidden initially)
    this.countdownText = this.add.text(L.cx, L.cy, '', {
      fontSize: L.unit(0.18) + 'px', fontFamily: 'Arial Black, Arial', color: '#ffffff',
      stroke: '#000000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(100).setVisible(false);

    // Socket setup
    this.socket = SocketManager.getInstance();
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('ROOM_PLAYER_READY', (data: { playerIndex: number }) => {
      SoundManager.getInstance().notificationPing();
      const idx = data.playerIndex - 1;
      if (this.readyIndicators[idx]) {
        this.readyIndicators[idx].setText('\u2713 READY');
      }
    });

    this.socket.on('ROOM_COUNTDOWN', (data: { seconds: number }) => {
      if (data.seconds > 0) {
        this.countdownText?.setText(String(data.seconds)).setVisible(true);
        SoundManager.getInstance().countdownBeep();
        this.tweens.add({
          targets: this.countdownText,
          scale: { from: 1.5, to: 1 },
          duration: 300,
        });
      } else {
        this.countdownText?.setText('GO!').setColor('#ffdd00');
        SoundManager.getInstance().countdown();
        this.tweens.add({
          targets: this.countdownText,
          scale: { from: 1, to: 1.5 },
          alpha: { from: 1, to: 0 },
          duration: 500,
        });

        const p1Info = this.players.find(p => p.playerIndex === 1);
        const p2Info = this.players.find(p => p.playerIndex === 2);
        const charRef1 = p1Info?.charRef ?? { type: 'preset' as const, id: 1 };
        const charRef2 = p2Info?.charRef ?? { type: 'preset' as const, id: 2 };

        this.time.delayedCall(500, () => {
          this.cleanup();
          transitionTo(this, 'VsScreen', {
            charRef1,
            charRef2,
            targetScene: 'OnlineGame',
            myIndex: this.myIndex,
            roomCode: this.roomCode,
          });
        });
      }
    });

    this.socket.on('ROOM_PLAYER_LEFT', (_data: { playerIndex: number; reason: string }) => {
      this.cleanup();
      transitionTo(this, 'OnlineHub', { charRef: this.charRef });
    });

    this.socket.on('ROOM_PLAYER_JOINED', (data: { player: LobbyPlayerInfo }) => {
      SoundManager.getInstance().notificationPing();
      this.players.push(data.player);
      this.cleanup();
      this.scene.restart({
        players: this.players,
        myIndex: this.myIndex,
        roomCode: this.roomCode,
        charRef: this.charRef,
      });
    });
  }

  private cleanup(): void {
    this.socket.off('ROOM_PLAYER_READY');
    this.socket.off('ROOM_COUNTDOWN');
    this.socket.off('ROOM_PLAYER_LEFT');
    this.socket.off('ROOM_PLAYER_JOINED');
  }

  shutdown(): void {
    this.cleanup();
    this.time.removeAllEvents();
    this.tweens.killAll();
  }
}
