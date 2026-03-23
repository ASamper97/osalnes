# =============================================================================
# DTI Salnés — Web Dockerfile (Next.js standalone)
# =============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/web/package.json packages/web/

# Install dependencies
RUN npm ci --workspace=packages/shared --workspace=packages/web --include-workspace-root

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/web/ packages/web/

# Build shared, then web
RUN npm run build -w packages/shared

# Next.js standalone output mode
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w packages/web

# --- Stage 2: Production ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build
COPY --from=builder /app/packages/web/.next/standalone ./
COPY --from=builder /app/packages/web/.next/static ./packages/web/.next/static
COPY --from=builder /app/packages/web/public ./packages/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "packages/web/server.js"]
