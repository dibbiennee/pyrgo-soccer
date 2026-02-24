import Phaser from 'phaser';
import { resolveCharacter, defaultAppearanceForPreset } from '@pyrgo/shared';
import type { CharacterRef, LobbyPlayerInfo } from '@pyrgo/shared';
import { CharacterRenderer } from '../rendering/CharacterRenderer';
import { SocketManager } from '../network/SocketManager';
import { SoundManager } from '../audio/SoundManager';
import { transitionTo, fadeIn } from '../utils/SceneTransition';
import { createButton, type ButtonGroup } from '../ui/ButtonFactory';
import { LayoutManager } from '../utils/LayoutManager';

export class OnlineHubScene extends Phaser.Scene {
  private L!: LayoutManager;
  private socket!: SocketManager;
  private charRef: CharacterRef = { type: 'preset', id: 1 };
  private inputChars: string[] = [];
  private roomCodeText?: Phaser.GameObjects.Text;
  private statusText?: Phaser.GameObjects.Text;
  private roomCodeDisplay?: Phaser.GameObjects.Text;
  private waitingText?: Phaser.GameObjects.Text;
  private copyBtn?: ButtonGroup;
  private cancelBtn?: ButtonGroup;
  private joinBtn?: ButtonGroup;
  private state: 'idle' | 'creating' | 'waiting' | 'joining' = 'idle';

  constructor() {
    super('OnlineHub');
  }

  init(data: { charRef?: CharacterRef }): void {
    this.charRef = data.charRef ?? { type: 'preset', id: 1 };
    this.inputChars = [];
    this.state = 'idle';
  }

  create(): void {
    fadeIn(this);
    const L = new LayoutManager(this);
    this.L = L;

    const sm = SoundManager.getInstance();
    sm.enabled = this.game.registry.get('soundOn') !== false;

    this.add.rectangle(L.cx, L.cy, L.w, L.h, 0x1a1a2e);

    this.add.text(L.cx, L.y(0.04), 'ONLINE MATCH', {
      fontSize: L.fontSize('heading'), fontFamily: 'Arial Black, Arial', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    // Mini character preview
    const char = resolveCharacter(this.charRef);
    const appearance = char.appearance ?? defaultAppearanceForPreset(char.id);
    CharacterRenderer.renderMiniPreview(this, appearance, L.cx, L.y(0.14), L.unit(0.002));
    this.add.text(L.cx, L.y(0.19), char.name, {
      fontSize: L.fontSize('small'), fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5);

    // Status text
    this.statusText = this.add.text(L.cx, L.y(0.23), '', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ffaa00',
    }).setOrigin(0.5);

    // --- CREATE ROOM section ---
    const leftX = L.x(0.25);
    const btnNormal = L.button('normal');
    createButton(this, leftX, L.y(0.32), 'CREA STANZA', () => this.doCreateRoom(), {
      width: btnNormal.width, height: btnNormal.height, fillColor: 0x00aa44, strokeColor: 0x00ff66,
    });

    // Room code display (shown after creation)
    this.roomCodeDisplay = this.add.text(leftX, L.y(0.42), '', {
      fontSize: L.unit(0.14) + 'px', fontFamily: 'Courier New, monospace', color: '#00ccff',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setVisible(false);

    // Copy button
    const btnSmall = L.button('small');
    this.copyBtn = createButton(this, leftX, L.y(0.52), 'COPIA CODICE', () => this.copyRoomCode(), {
      width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('small'), fillColor: 0x225588, strokeColor: 0x44aaff,
    });
    this.copyBtn.container.setVisible(false);

    // Waiting text
    this.waitingText = this.add.text(leftX, L.y(0.60), 'Waiting for opponent...', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#aaaacc',
    }).setOrigin(0.5).setVisible(false);
    this.tweens.add({
      targets: this.waitingText,
      alpha: { from: 0.4, to: 1 },
      duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Cancel button
    this.cancelBtn = createButton(this, leftX, L.y(0.68), 'CANCEL', () => {
      this.socket.emit('ROOM_LEAVE', {});
      this.socket.disconnect();
      this.state = 'idle';
      this.roomCodeDisplay?.setVisible(false);
      this.copyBtn?.container.setVisible(false);
      this.waitingText?.setVisible(false);
      this.cancelBtn?.container.setVisible(false);
      this.statusText?.setText('').setColor('#ffaa00');
    }, { width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('small'), fillColor: 0x994444, strokeColor: 0xff4444 });
    this.cancelBtn.container.setVisible(false);

    // --- JOIN ROOM section ---
    const rightX = L.x(0.75);
    this.add.text(rightX, L.y(0.30), 'Enter Room Code:', {
      fontSize: L.fontSize('body'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);

    this.roomCodeText = this.add.text(rightX, L.y(0.36), '____', {
      fontSize: L.unit(0.09) + 'px', fontFamily: 'Courier New, monospace', color: '#00ccff',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);

    // Virtual keyboard
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const cols = 9;
    const keySize = L.unit(0.065);
    const keyGap = keySize * 1.2;
    const kbStartX = rightX - (cols - 1) * keyGap / 2;
    const kbStartY = L.y(0.44);
    for (let i = 0; i < letters.length; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = kbStartX + col * keyGap;
      const y = kbStartY + row * keyGap;
      this.createKeyButton(x, y, letters[i], keySize);
    }

    // DEL button
    const kbBottomY = kbStartY + Math.ceil(letters.length / cols) * keyGap;
    createButton(this, rightX - L.unit(0.08), kbBottomY, 'DEL', () => {
      this.inputChars.pop();
      this.updateRoomCodeInput();
    }, { width: btnSmall.width * 0.7, height: btnSmall.height, fontSize: L.fontSize('small') });

    // JOIN button
    this.joinBtn = createButton(this, rightX + L.unit(0.08), kbBottomY, 'JOIN', () => {
      if (this.inputChars.length === 4) {
        this.doJoinRoom(this.inputChars.join(''));
      }
    }, { width: btnSmall.width * 0.8, height: btnSmall.height, fontSize: L.fontSize('small'), fillColor: 0x00aa44, strokeColor: 0x00ff66 });

    // Divider line
    const divider = this.add.graphics();
    divider.lineStyle(1, 0x444466, 0.5);
    divider.lineBetween(L.cx, L.y(0.27), L.cx, L.y(0.72));

    // Back button
    createButton(this, L.x(0.08), L.y(0.78), '\u2190 BACK', () => {
      this.cleanup();
      transitionTo(this, 'CharSelect', { mode: 'online' });
    }, { width: btnSmall.width, height: btnSmall.height, fontSize: L.fontSize('small'), strokeColor: 0x666666 });

    // Keyboard input
    if (this.input.keyboard) {
      this.input.keyboard.on('keydown', (event: KeyboardEvent) => {
        const key = event.key.toUpperCase();
        if (key.length === 1 && key >= 'A' && key <= 'Z' && this.inputChars.length < 4) {
          this.inputChars.push(key);
          this.updateRoomCodeInput();
        } else if (key === 'BACKSPACE') {
          this.inputChars.pop();
          this.updateRoomCodeInput();
        } else if (key === 'ENTER' && this.inputChars.length === 4) {
          this.doJoinRoom(this.inputChars.join(''));
        }
      });
    }

    // Socket
    this.socket = SocketManager.getInstance();
    this.setupSocketListeners();
  }

  private setupSocketListeners(): void {
    this.socket.on('ROOM_CREATED', (data: { roomCode: string }) => {
      this.state = 'waiting';
      this.roomCodeDisplay?.setText(data.roomCode).setVisible(true);
      this.copyBtn?.container.setVisible(true);
      this.waitingText?.setVisible(true);
      this.cancelBtn?.container.setVisible(true);
      this.statusText?.setText('Room created!').setColor('#00ff66');
    });

    this.socket.on('ROOM_JOINED', (data: { players: LobbyPlayerInfo[]; yourIndex: number }) => {
      SoundManager.getInstance().notificationPing();
      this.cleanup();
      transitionTo(this, 'OnlineLobby', {
        players: data.players,
        myIndex: data.yourIndex,
        roomCode: this.roomCodeDisplay?.text || this.inputChars.join(''),
        charRef: this.charRef,
      });
    });

    this.socket.on('ERROR', (data: { code?: string; message: string }) => {
      this.statusText?.setText(data.message).setColor('#ff4444');
      this.time.delayedCall(3000, () => {
        this.statusText?.setText('').setColor('#ffaa00');
      });
    });
  }

  private doCreateRoom(): void {
    if (this.state !== 'idle') return;
    if (!navigator.onLine) {
      this.statusText?.setText('Connection required for multiplayer').setColor('#ff4444');
      return;
    }
    this.state = 'creating';
    this.statusText?.setText('Creating room...').setColor('#ffaa00');
    this.socket.connect();

    this.time.delayedCall(300, () => {
      this.socket.emit('CREATE_ROOM', {
        charRef: this.charRef,
        playerName: 'Player',
      });
    });
  }

  private doJoinRoom(code: string): void {
    if (this.state === 'waiting') return;
    if (!navigator.onLine) {
      this.statusText?.setText('Connection required for multiplayer').setColor('#ff4444');
      return;
    }
    this.state = 'joining';
    this.statusText?.setText(`Joining ${code}...`).setColor('#ffaa00');
    this.socket.connect();

    this.time.delayedCall(300, () => {
      this.socket.emit('JOIN_ROOM', {
        roomCode: code,
        charRef: this.charRef,
        playerName: 'Player',
      });
    });
  }

  private copyRoomCode(): void {
    const code = this.roomCodeDisplay?.text;
    if (code && navigator.clipboard) {
      navigator.clipboard.writeText(code).then(() => {
        this.statusText?.setText('Code copied!').setColor('#00ff66');
        this.time.delayedCall(2000, () => {
          this.statusText?.setText('').setColor('#ffaa00');
        });
      });
    }
  }

  private updateRoomCodeInput(): void {
    const display = this.inputChars.join('').padEnd(4, '_');
    this.roomCodeText?.setText(display);
  }

  private createKeyButton(x: number, y: number, letter: string, keySize: number): void {
    const bg = this.add.rectangle(x, y, keySize, keySize, 0x2a2a4e);
    bg.setStrokeStyle(1, 0x444466);
    bg.setInteractive({ useHandCursor: true });

    this.add.text(x, y, letter, {
      fontSize: this.L.fontSize('body'), fontFamily: 'Arial', color: '#ffffff',
    }).setOrigin(0.5);

    bg.on('pointerdown', () => {
      if (this.inputChars.length < 4) {
        this.inputChars.push(letter);
        this.updateRoomCodeInput();
      }
    });
  }

  private cleanup(): void {
    this.socket.off('ROOM_CREATED');
    this.socket.off('ROOM_JOINED');
    this.socket.off('ERROR');
  }

  shutdown(): void {
    this.cleanup();
    this.time.removeAllEvents();
    this.tweens.killAll();
    this.input.keyboard?.removeAllListeners();
  }
}
