import { io, Socket } from 'socket.io-client';
import { HEARTBEAT_INTERVAL_MS } from '@pyrgo/shared';

type EventCallback = (data: any) => void;

export type ConnectionState = 'disconnected' | 'connecting' | 'connected';

const SERVER_URL: string =
  (import.meta as any).env?.VITE_SERVER_URL ??
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:3001'
    : typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

export class SocketManager {
  private static instance: SocketManager;
  private socket: Socket | null = null;
  private listeners: Map<string, EventCallback[]> = new Map();
  private _connectionState: ConnectionState = 'disconnected';
  private _ping = 0;
  private pingInterval?: ReturnType<typeof setInterval>;
  private pingSamples: number[] = [];
  private _sessionId: string | null = null;

  static getInstance(): SocketManager {
    if (!SocketManager.instance) {
      SocketManager.instance = new SocketManager();
    }
    return SocketManager.instance;
  }

  connect(url?: string): void {
    if (this.socket?.connected) return;

    const serverUrl = url ?? SERVER_URL;

    this._connectionState = 'connecting';

    this.socket = io(serverUrl, {
      transports: ['websocket'],
      autoConnect: true,
      reconnection: false, // We manage reconnection ourselves
    });

    this.socket.on('connect', () => {
      this._connectionState = 'connected';
      console.log('Connected to server');
      this.startPingMeasurement();
    });

    this.socket.on('disconnect', () => {
      this._connectionState = 'disconnected';
      console.log('Disconnected from server');
      this.stopPingMeasurement();
    });

    // Handle SESSION_ASSIGNED from server
    this.socket.on('SESSION_ASSIGNED', (data: { sessionId: string }) => {
      this._sessionId = data.sessionId;
      console.log('Session assigned:', data.sessionId);
    });

    // Handle PONG for ping measurement
    this.socket.on('PONG', (data: { clientTime: number; serverTime: number }) => {
      const rtt = Date.now() - data.clientTime;
      this.pingSamples.push(rtt);
      if (this.pingSamples.length > 5) this.pingSamples.shift();
      this._ping = Math.round(this.pingSamples.reduce((a, b) => a + b, 0) / this.pingSamples.length);
    });

    // Re-register all listeners
    this.listeners.forEach((callbacks, event) => {
      callbacks.forEach(cb => {
        this.socket?.on(event, cb);
      });
    });
  }

  disconnect(): void {
    this.stopPingMeasurement();
    this.socket?.disconnect();
    this.socket = null;
    this._connectionState = 'disconnected';
    this._ping = 0;
    this.pingSamples = [];
    // Keep sessionId for potential reconnection
  }

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: EventCallback): void {
    if (callback) {
      const cbs = this.listeners.get(event);
      if (cbs) {
        const idx = cbs.indexOf(callback);
        if (idx >= 0) cbs.splice(idx, 1);
      }
      this.socket?.off(event, callback);
    } else {
      this.listeners.delete(event);
      this.socket?.off(event);
    }
  }

  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  get connected(): boolean {
    return this.socket?.connected ?? false;
  }

  get id(): string | undefined {
    return this.socket?.id;
  }

  get ping(): number {
    return this._ping;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get sessionId(): string | null {
    return this._sessionId;
  }

  private startPingMeasurement(): void {
    this.stopPingMeasurement();
    this.pingInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('PING', { clientTime: Date.now() });
      }
    }, HEARTBEAT_INTERVAL_MS);
    // Immediate first ping
    if (this.socket?.connected) {
      this.socket.emit('PING', { clientTime: Date.now() });
    }
  }

  private stopPingMeasurement(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = undefined;
    }
  }
}
