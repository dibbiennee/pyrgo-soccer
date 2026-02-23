import type { Server, Socket } from 'socket.io';
import type { LobbyManager } from '../lobby/LobbyManager.js';
import { INPUT_RATE_LIMIT, LOBBY_COUNTDOWN_SECONDS } from '@pyrgo/shared';
import type { CharacterRef, LobbyPlayerInfo } from '@pyrgo/shared';
import { randomUUID } from 'crypto';
import { logger } from '../logger.js';

const MAX_CONNECTIONS_PER_IP = 5;

export class SocketHandler {
  private io: Server;
  private lobby: LobbyManager;
  private inputRateTracker: Map<string, { count: number; resetTime: number }> = new Map();
  /** Map sessionId → socketId for reconnection */
  private sessionToSocket: Map<string, string> = new Map();
  /** Map socketId → sessionId */
  private socketToSession: Map<string, string> = new Map();
  /** Track connections per IP */
  private connectionsPerIp: Map<string, number> = new Map();

  constructor(io: Server, lobby: LobbyManager) {
    this.io = io;
    this.lobby = lobby;
  }

  start(): void {
    this.io.on('connection', (socket: Socket) => {
      // Per-IP connection limiting
      const ip = socket.handshake.address;
      const currentCount = this.connectionsPerIp.get(ip) ?? 0;
      if (currentCount >= MAX_CONNECTIONS_PER_IP) {
        logger.warn('socket', `Connection rejected from ${ip} — max connections exceeded`);
        socket.emit('ERROR', { code: 'TOO_MANY_CONNECTIONS', message: 'Too many connections' });
        socket.disconnect(true);
        return;
      }
      this.connectionsPerIp.set(ip, currentCount + 1);

      logger.info('socket', `Player connected: ${socket.id}`);

      // Assign a unique session ID
      const sessionId = randomUUID();
      this.sessionToSocket.set(sessionId, socket.id);
      this.socketToSession.set(socket.id, sessionId);
      socket.emit('SESSION_ASSIGNED', { sessionId });

      // ─── CREATE_ROOM ───────────────────────────────
      socket.on('CREATE_ROOM', (data: { charRef?: CharacterRef; characterId?: number; playerName: string }) => {
        // Build charRef from either new or legacy format
        const charRef: CharacterRef = data.charRef ?? { type: 'preset', id: data.characterId ?? 1 };
        const sid = this.socketToSession.get(socket.id) ?? sessionId;

        const result = this.lobby.createRoom(socket.id, data.playerName, charRef, sid);
        if (!result) {
          socket.emit('ERROR', { code: 'ALREADY_IN_ROOM', message: 'Already in a room' });
          return;
        }

        const { roomCode, room } = result;
        socket.join(roomCode);

        // Setup broadcast functions
        room.setBroadcast((event, payload, socketIds) => {
          for (const sid of socketIds) {
            this.io.to(sid).emit(event, payload);
          }
        });
        room.setBroadcastToSocket((event, payload, socketId) => {
          this.io.to(socketId).emit(event, payload);
        });

        socket.emit('ROOM_CREATED', { roomCode });
        logger.info('socket', `Room ${roomCode} created by ${socket.id}`);
      });

      // ─── JOIN_ROOM (+ backward compat JOIN_LOBBY) ──
      const handleJoin = (data: {
        roomCode: string;
        charRef?: CharacterRef;
        characterId?: number;
        playerName: string;
      }) => {
        const charRef: CharacterRef = data.charRef ?? { type: 'preset', id: data.characterId ?? 1 };
        const sid = this.socketToSession.get(socket.id) ?? sessionId;

        const room = this.lobby.joinRoom(data.roomCode, socket.id, data.playerName, charRef, sid);

        if (!room) {
          // Determine specific error
          const existingRoom = this.lobby.getRoom(data.roomCode);
          if (!existingRoom) {
            socket.emit('ERROR', { code: 'ROOM_NOT_FOUND', message: 'Room not found' });
          } else if (existingRoom.isFull()) {
            socket.emit('ERROR', { code: 'ROOM_FULL', message: 'Room is full' });
          } else if (this.lobby.getRoomBySocket(socket.id)) {
            socket.emit('ERROR', { code: 'ALREADY_IN_ROOM', message: 'Already in a room' });
          } else {
            socket.emit('ERROR', { code: 'INVALID_CHARACTER', message: 'Invalid character' });
          }
          return;
        }

        socket.join(data.roomCode);

        // Build lobby player info for both players
        const players: LobbyPlayerInfo[] = room.getPlayers().map(p => ({
          playerIndex: p.playerIndex,
          playerName: p.playerName,
          charRef: p.charRef,
          ready: p.ready,
        }));

        // Notify joining player with their index
        const joiner = room.getPlayers().find(p => p.socketId === socket.id)!;
        socket.emit('ROOM_JOINED', { players, yourIndex: joiner.playerIndex });

        // Notify existing player about the new joiner
        const existing = room.getPlayers().find(p => p.socketId !== socket.id);
        if (existing) {
          this.io.to(existing.socketId).emit('ROOM_JOINED', { players, yourIndex: existing.playerIndex });
        }

        logger.info('socket', `Player ${socket.id} joined room ${data.roomCode}`);
      };

      socket.on('JOIN_ROOM', handleJoin);
      socket.on('JOIN_LOBBY', handleJoin); // backward compat

      // ─── PLAYER_READY ──────────────────────────────
      socket.on('PLAYER_READY', () => {
        const room = this.lobby.getRoomBySocket(socket.id);
        if (!room) return;

        const player = room.getPlayers().find(p => p.socketId === socket.id);
        if (!player) return;

        const allReady = room.setPlayerReady(socket.id);

        // Notify all players about ready state
        room.getSocketIds().forEach(sid => {
          this.io.to(sid).emit('ROOM_PLAYER_READY', { playerIndex: player.playerIndex });
        });

        if (allReady) {
          this.startLobbyCountdown(room);
        }
      });

      // ─── INPUT ─────────────────────────────────────
      socket.on('INPUT', (data: { seq: number; inputs: any }) => {
        // Rate limiting
        if (!this.checkInputRate(socket.id)) return;

        const room = this.lobby.getRoomBySocket(socket.id);
        if (room) {
          room.setInput(socket.id, data.seq, data.inputs);
        }
      });

      // ─── ROOM_LEAVE ────────────────────────────────
      socket.on('ROOM_LEAVE', () => {
        this.handlePlayerLeave(socket, 'voluntary');
      });

      // ─── REMATCH_REQUEST ───────────────────────────
      socket.on('REMATCH_REQUEST', () => {
        const room = this.lobby.getRoomBySocket(socket.id);
        if (!room) return;
        const player = room.getPlayers().find(p => p.socketId === socket.id);
        if (!player) return;
        room.requestRematch(player.playerIndex);
      });

      // ─── PING / PONG ──────────────────────────────
      socket.on('PING', (data: { clientTime: number }) => {
        socket.emit('PONG', {
          clientTime: data.clientTime,
          serverTime: Date.now(),
        });
      });

      // ─── RECONNECT ────────────────────────────────
      socket.on('RECONNECT', (data: { sessionId: string }) => {
        const found = this.lobby.findRoomBySessionId(data.sessionId);
        if (!found) {
          socket.emit('ERROR', { code: 'ROOM_NOT_FOUND', message: 'No room found for reconnection' });
          return;
        }

        const { room, roomCode } = found;
        const player = room.getPlayers().find(p => p.sessionId === data.sessionId);
        if (!player) {
          socket.emit('ERROR', { code: 'ROOM_NOT_FOUND', message: 'Player not found in room' });
          return;
        }

        const oldSocketId = player.socketId;

        // Update session tracking
        this.sessionToSocket.set(data.sessionId, socket.id);
        this.socketToSession.set(socket.id, data.sessionId);
        // Clean old socket mapping
        this.socketToSession.delete(oldSocketId);

        // Update lobby and room mappings
        this.lobby.updateSocketId(oldSocketId, socket.id);
        room.reconnectPlayer(oldSocketId, socket.id);

        socket.join(roomCode);

        // Send ROOM_JOINED to reconnected player so they can resync
        const players: LobbyPlayerInfo[] = room.getPlayers().map(p => ({
          playerIndex: p.playerIndex,
          playerName: p.playerName,
          charRef: p.charRef,
          ready: p.ready,
        }));
        socket.emit('ROOM_JOINED', { players, yourIndex: player.playerIndex });

        logger.info('socket', `Player reconnected: ${socket.id} (was ${oldSocketId}) to room ${roomCode}`);
      });

      // ─── DISCONNECT ────────────────────────────────
      socket.on('disconnect', () => {
        logger.info('socket', `Player disconnected: ${socket.id}`);

        // Decrement IP connection count
        const connIp = socket.handshake.address;
        const cnt = this.connectionsPerIp.get(connIp) ?? 1;
        if (cnt <= 1) this.connectionsPerIp.delete(connIp);
        else this.connectionsPerIp.set(connIp, cnt - 1);

        // Clean up session tracking (but keep sessionToSocket for reconnection)
        this.socketToSession.delete(socket.id);

        const room = this.lobby.getRoomBySocket(socket.id);
        if (room) {
          if (room.isRunning()) {
            // In-game: pause for reconnect
            room.pauseForReconnect(socket.id);
          } else if (room.getPhase() === 'matchOver') {
            // Post-match: clean up
            room.removePlayer(socket.id);
            this.lobby.removeSocketFromRoom(socket.id);
            if (room.getPlayers().length === 0) {
              this.lobby.removeRoom(room.roomCode);
            }
          } else {
            // In lobby: remove and notify
            const player = room.getPlayers().find(p => p.socketId === socket.id);
            room.removePlayer(socket.id);
            this.lobby.removeSocketFromRoom(socket.id);

            // Notify remaining player
            if (player) {
              const remaining = room.getPlayers()[0];
              if (remaining) {
                this.io.to(remaining.socketId).emit('ROOM_PLAYER_LEFT', {
                  playerIndex: player.playerIndex,
                  reason: 'disconnect',
                });
              }
            }

            if (room.getPlayers().length === 0) {
              this.lobby.removeRoom(room.roomCode);
            }
          }
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════
  // LOBBY COUNTDOWN (3, 2, 1, 0)
  // ═══════════════════════════════════════════════════
  private startLobbyCountdown(room: ReturnType<LobbyManager['getRoom']>): void {
    if (!room) return;

    let seconds = LOBBY_COUNTDOWN_SECONDS;
    const socketIds = room.getSocketIds();

    const countdownInterval = setInterval(() => {
      socketIds.forEach(sid => {
        this.io.to(sid).emit('ROOM_COUNTDOWN', { seconds });
      });

      if (seconds <= 0) {
        clearInterval(countdownInterval);
        room.start();
        logger.info('socket', `Game started in room ${room.roomCode}`);
      }
      seconds--;
    }, 1000);
  }

  // ═══════════════════════════════════════════════════
  // INPUT RATE LIMITING
  // ═══════════════════════════════════════════════════
  private checkInputRate(socketId: string): boolean {
    const now = Date.now();
    let tracker = this.inputRateTracker.get(socketId);

    if (!tracker || now >= tracker.resetTime) {
      tracker = { count: 0, resetTime: now + 1000 };
      this.inputRateTracker.set(socketId, tracker);
    }

    tracker.count++;
    return tracker.count <= INPUT_RATE_LIMIT;
  }

  // ═══════════════════════════════════════════════════
  // HELPER: PLAYER LEAVE
  // ═══════════════════════════════════════════════════
  private handlePlayerLeave(socket: Socket, reason: 'voluntary' | 'disconnect'): void {
    const room = this.lobby.getRoomBySocket(socket.id);
    if (!room) return;

    const player = room.getPlayers().find(p => p.socketId === socket.id);
    room.removePlayer(socket.id);
    this.lobby.removeSocketFromRoom(socket.id);
    socket.leave(room.roomCode);

    if (player) {
      const remaining = room.getPlayers()[0];
      if (remaining) {
        this.io.to(remaining.socketId).emit('ROOM_PLAYER_LEFT', {
          playerIndex: player.playerIndex,
          reason,
        });
      }
    }

    if (room.getPlayers().length === 0) {
      this.lobby.removeRoom(room.roomCode);
    }
  }
}
