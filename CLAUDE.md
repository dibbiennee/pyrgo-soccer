# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
pnpm build                    # Build all: shared → client → server
pnpm build:shared             # Build shared types only
pnpm build:client             # Build client (runs prebuild icon gen + tsc + vite)
pnpm build:server             # Build server (tsc only)
pnpm dev                      # Run client + server in dev mode concurrently
pnpm dev:client               # Vite dev server on port 3000
pnpm dev:server               # tsx watch on server
pnpm start                    # Run production server (node dist/index.js)
```

No linter or test runner is configured. Build validation = `pnpm build` with zero TypeScript errors.

## Architecture

Monorepo with three pnpm workspace packages:

### `packages/shared` — Types & Constants
Single source of truth for all types (`game.ts`, `characters.ts`, `appearance.ts`, `protocol.ts`) and constants (`physics.ts`). Both client and server import from `@pyrgo/shared`. The shared package uses direct `.ts` source imports (not compiled output) via the `exports` field and Vite's alias.

### `packages/server` — Authoritative Game Server
Node.js + Express + Socket.io. **Server-authoritative physics** at 60Hz tick rate, broadcast to clients at 20Hz.

Key data flow:
- `index.ts` — Express app with helmet, CORS, rate limiting. Creates `LobbyManager` + `SocketHandler`.
- `SocketHandler` — All Socket.io event handlers. Manages sessions (sessionId↔socketId maps), per-IP connection limits, input rate limiting, lobby countdown.
- `LobbyManager` — Room creation/joining with 4-letter codes. Maps socket→room for O(1) lookup. Room expiry after 5 minutes.
- `GameRoom` — Full game lifecycle: countdown → playing → goalScored → matchOver. Owns physics loop (`setInterval` at 60Hz), input buffers with per-player `lastProcessedInput`, reconnection with pause/resume, rematch system.
- `ServerPhysics` — Pure deterministic physics: player movement, ball collisions, kick detection, super moves, goal detection. Takes `PhysicsState` + inputs, mutates in place. Emits events (kick, header, superActivated).

### `packages/client` — Phaser 3 Game Client
Phaser 3 with Socket.io-client. All rendering uses Phaser Graphics (no sprite assets). All audio is procedural via Web Audio API (`SoundManager`).

Scene flow:
- **Offline**: `Boot → MainMenu → CharSelect → LocalGame/CpuGame → Result`
- **Online**: `MainMenu → CharSelect(online) → OnlineHub → OnlineLobby → VsScreen → OnlineGame → Result`
- **Other**: `CharacterCreator`, `CommunityGallery`, `HowToPlay`, `Credits`

Key patterns:
- Scene transitions: `transitionTo(scene, key, data)` with fade-out, `fadeIn(scene)` on create
- UI buttons: `createButton(scene, x, y, text, callback, options)` from `ButtonFactory`
- `SocketManager` — Singleton, manages Socket.io connection, ping measurement, listener persistence across reconnects
- `CharacterApi` — REST client for server character CRUD, uses `VITE_SERVER_URL` env var
- `OnlineGameScene` — Client-side prediction with input sequence numbers, buffer-based interpolation using `INTERPOLATION_DELAY_MS`

## Key Concepts

**CharacterRef**: `{ type: 'preset', id: N }` or `{ type: 'custom', data: CustomCharacterDef }`. Use `resolveCharacter(ref)` and `resolveAppearance(ref)` from shared to unwrap.

**Protocol**: All client↔server message types defined in `shared/types/protocol.ts` (`ClientMessages` and `ServerMessages` interfaces). Events are string-based Socket.io events.

**Super Moves**: 6 types (flameDash, thunderKick, ghostPhase, ironWall, poisonShot, iceField). Charged by kicking/heading the ball. Activated via input, executed in `ServerPhysics`.

**Server Port**: Default 3001 (client Vite dev runs on 3000). Configurable via `PORT` env var. CORS origins via `CORS_ORIGIN` env var (comma-separated).

## PWA & Deploy

- Icons generated at build time via `packages/client/scripts/generate-icons.mjs` (sharp)
- Service worker via vite-plugin-pwa with Workbox
- Client deploy: `vercel.json` with SPA rewrites
- Server deploy: `packages/server/Dockerfile` (multi-stage Node 20 Alpine)
- `__APP_VERSION__` injected from client `package.json` via Vite `define`
