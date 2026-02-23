FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace config + all relevant package.json files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/

# Install dependencies
RUN corepack enable && pnpm install --frozen-lockfile

# Copy source code
COPY packages/shared packages/shared
COPY packages/server packages/server

# Build shared first, then server
RUN pnpm --filter @pyrgo/shared build && pnpm --filter @pyrgo/server build

# ── Production stage ──
FROM node:20-alpine
WORKDIR /app

# Preserve monorepo structure for workspace resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/node_modules ./node_modules

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "packages/server/dist/server/src/index.js"]
