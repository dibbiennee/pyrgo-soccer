FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY packages/server packages/server
COPY tsconfig.base.json .
RUN pnpm build:shared && pnpm build:server

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/packages/server/dist ./dist
COPY --from=builder /app/packages/server/package.json .
COPY --from=builder /app/node_modules ./node_modules
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
