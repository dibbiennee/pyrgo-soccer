FROM node:20-alpine AS builder
WORKDIR /app
RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN pnpm install --frozen-lockfile

COPY packages/shared packages/shared
COPY packages/server packages/server
RUN pnpm --filter @pyrgo/shared build && pnpm --filter @pyrgo/server build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app .
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "packages/server/dist/server/src/index.js"]
