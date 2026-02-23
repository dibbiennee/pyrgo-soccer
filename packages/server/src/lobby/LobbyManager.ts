import { GameRoom } from '../game/GameRoom.js';
import { ROOM_EXPIRY_MS, SUPER_MOVES } from '@pyrgo/shared';
import type { CharacterRef, CharacterDef, CustomCharacterDef } from '@pyrgo/shared';
import { resolveCharacter } from '@pyrgo/shared';

export interface PlayerInfo {
  socketId: string;
  playerName: string;
  sessionId: string;
  charRef: CharacterRef;
  resolvedChar: CharacterDef;
  playerIndex: number; // 1 or 2
  ready: boolean;
}

export class LobbyManager {
  private rooms: Map<string, GameRoom> = new Map();
  private socketToRoom: Map<string, string> = new Map();
  private expiryTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  generateRoomCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I, O to avoid confusion
    let code: string;
    do {
      code = '';
      for (let i = 0; i < 4; i++) {
        code += chars[Math.floor(Math.random() * chars.length)];
      }
    } while (this.rooms.has(code));
    return code;
  }

  /** Validate custom character stats: total ≤ 15, each stat 2-8, valid super move */
  resolveAndValidateCharacter(charRef: CharacterRef): CharacterDef | null {
    try {
      if (charRef.type === 'custom') {
        const data = charRef.data;
        const { speed, power, defense } = data.stats;
        if (speed < 2 || speed > 8 || power < 2 || power > 8 || defense < 2 || defense > 8) return null;
        if (speed + power + defense > 15) return null;
        const validSupers = SUPER_MOVES.map(m => m.id);
        if (!validSupers.includes(data.superMove)) return null;
      }
      return resolveCharacter(charRef);
    } catch {
      return null;
    }
  }

  createRoom(socketId: string, playerName: string, charRef: CharacterRef, sessionId: string): { roomCode: string; room: GameRoom } | null {
    // Max 1 room per socket
    if (this.socketToRoom.has(socketId)) return null;

    const resolvedChar = this.resolveAndValidateCharacter(charRef);
    if (!resolvedChar) return null;

    const code = this.generateRoomCode();
    const room = new GameRoom(code);
    const player: PlayerInfo = {
      socketId,
      playerName,
      sessionId,
      charRef,
      resolvedChar,
      playerIndex: 1,
      ready: false,
    };
    room.addPlayer(player);
    this.rooms.set(code, room);
    this.socketToRoom.set(socketId, code);
    this.startExpiryTimer(code);
    return { roomCode: code, room };
  }

  joinRoom(roomCode: string, socketId: string, playerName: string, charRef: CharacterRef, sessionId: string): GameRoom | null {
    // Max 1 room per socket
    if (this.socketToRoom.has(socketId)) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;
    if (room.isFull()) return null;

    const resolvedChar = this.resolveAndValidateCharacter(charRef);
    if (!resolvedChar) return null;

    const player: PlayerInfo = {
      socketId,
      playerName,
      sessionId,
      charRef,
      resolvedChar,
      playerIndex: 2,
      ready: false,
    };
    room.addPlayer(player);
    this.socketToRoom.set(socketId, roomCode);
    this.clearExpiryTimer(roomCode);
    return room;
  }

  getRoom(roomCode: string): GameRoom | undefined {
    return this.rooms.get(roomCode);
  }

  getRoomBySocket(socketId: string): GameRoom | undefined {
    const code = this.socketToRoom.get(socketId);
    if (!code) return undefined;
    return this.rooms.get(code);
  }

  getRoomCodeBySocket(socketId: string): string | undefined {
    return this.socketToRoom.get(socketId);
  }

  /** Find room by sessionId (for reconnection) */
  findRoomBySessionId(sessionId: string): { room: GameRoom; roomCode: string } | undefined {
    for (const [code, room] of this.rooms.entries()) {
      const player = room.getPlayers().find(p => p.sessionId === sessionId);
      if (player) return { room, roomCode: code };
    }
    return undefined;
  }

  removeRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      // Clean up socket-to-room mappings
      for (const p of room.getPlayers()) {
        this.socketToRoom.delete(p.socketId);
      }
      room.stop();
      this.rooms.delete(roomCode);
      this.clearExpiryTimer(roomCode);
    }
  }

  removeSocketFromRoom(socketId: string): void {
    this.socketToRoom.delete(socketId);
  }

  updateSocketId(oldSocketId: string, newSocketId: string): void {
    const code = this.socketToRoom.get(oldSocketId);
    if (code) {
      this.socketToRoom.delete(oldSocketId);
      this.socketToRoom.set(newSocketId, code);
    }
  }

  private startExpiryTimer(roomCode: string): void {
    this.clearExpiryTimer(roomCode);
    const timer = setTimeout(() => {
      const room = this.rooms.get(roomCode);
      if (room && !room.isFull()) {
        console.log(`Room ${roomCode} expired (no one joined within ${ROOM_EXPIRY_MS / 1000}s)`);
        this.removeRoom(roomCode);
      }
    }, ROOM_EXPIRY_MS);
    this.expiryTimers.set(roomCode, timer);
  }

  private clearExpiryTimer(roomCode: string): void {
    const timer = this.expiryTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.expiryTimers.delete(roomCode);
    }
  }

  getRoomCount(): number {
    return this.rooms.size;
  }
}
