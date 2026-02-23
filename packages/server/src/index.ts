import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { LobbyManager } from './lobby/LobbyManager.js';
import { SocketHandler } from './network/SocketHandler.js';
import { CharacterStore } from './characters/CharacterStore.js';
import { createCharacterRoutes } from './characters/characterRoutes.js';
import { logger } from './logger.js';

const app = express();
const server = createServer(app);

// CORS origins from env (comma-separated) or defaults
const CORS_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
  : ['http://localhost:3000', 'http://localhost:5173'];

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // CSP handled by client meta tag
}));
app.use(cors({ origin: CORS_ORIGINS }));
app.use(rateLimit({ windowMs: 60_000, max: 100 }));
app.use(express.json({ limit: '10kb' }));

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

const lobby = new LobbyManager();
const socketHandler = new SocketHandler(io, lobby);

// Character API
const characterStore = new CharacterStore();
app.use('/characters', createCharacterRoutes(characterStore));

app.get('/', (_req, res) => {
  res.json({ status: 'Pyrgo Soccer Server running', rooms: lobby.getRoomCount() });
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

socketHandler.start();

const PORT = process.env.PORT ?? 3001;
server.listen(PORT, () => {
  logger.info('server', `Pyrgo Soccer server running on port ${PORT} (${process.env.NODE_ENV ?? 'development'})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('server', 'SIGTERM received — shutting down gracefully');
  io.emit('SERVER_SHUTDOWN', {});
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('server', 'SIGINT received — shutting down');
  io.emit('SERVER_SHUTDOWN', {});
  server.close(() => process.exit(0));
});
