FROM node:20-slim AS base

RUN apt-get update && apt-get install -y \
    openssl \
    ffmpeg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@8.15.4 --activate

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/core/package.json ./packages/core/

RUN pnpm install --frozen-lockfile

FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules

COPY . .

RUN cd apps/web && pnpm prisma:generate
RUN cd packages/core && pnpm build
RUN cd apps/web && pnpm build

RUN npm install -g esbuild@0.21.5

RUN cd apps/web && esbuild src/worker.ts \
  --bundle \
  --platform=node \
  --target=node20 \
  --outfile=dist/worker.js \
  --external:@prisma/client \
  --external:ffmpeg-static \
  --external:ffprobe-static \
  --external:pdfkit \
  --external:sharp \
  --external:@human-stamp/core

FROM base AS runner

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --home /home/nextjs nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static

COPY --from=builder /app/apps/web/src/worker.ts ./apps/web/src/worker.ts
COPY --from=builder /app/apps/web/src/lib ./apps/web/src/lib
COPY --from=builder /app/apps/web/src/start.js ./apps/web/src/start.js
COPY --from=builder /app/apps/web/tsconfig.json ./apps/web/tsconfig.json
COPY --from=builder /app/apps/web/prisma ./apps/web/prisma
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts

COPY --from=builder /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=builder /app/packages/core ./packages/core

RUN npm install -g prisma@5.9.0 tsx@4.7.0

RUN chown -R nextjs:nodejs ./apps/web /home/nextjs

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV HOME="/home/nextjs"

CMD ["node", "apps/web/src/start.js"]
