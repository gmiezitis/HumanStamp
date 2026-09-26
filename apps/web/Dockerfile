FROM node:20-slim AS builder

RUN apt-get update && apt-get install -y \
    openssl \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

COPY .npmrc ./
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/

RUN pnpm install --frozen-lockfile --shamefully-hoist

COPY . .

RUN cd apps/web && pnpm prisma:generate
RUN cd packages/core && pnpm build  
RUN cd apps/web && pnpm build

FROM node:20-slim AS runtime

RUN apt-get update && apt-get install -y \
    openssl \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

COPY --from=builder --chown=nextjs:nodejs /app ./

RUN npm install -g prisma@5.9.0

RUN chown -R nextjs:nodejs /app /home/nextjs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV HOME="/home/nextjs"

CMD ["node", "apps/web/src/start.js"]
