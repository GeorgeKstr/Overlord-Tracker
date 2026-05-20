FROM node:20-alpine AS base
RUN apk add --no-cache openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile --shamefully-hoist

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm db:generate
RUN pnpm --filter @platform/api build

FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/database/prisma ./prisma

ENV NODE_ENV=production
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push --schema=prisma/schema.prisma && node dist/main"]
