# =============================================================================
# DTI Salnés — API Dockerfile (multi-stage)
# =============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Install all dependencies (workspace aware)
RUN npm ci --workspace=packages/shared --workspace=packages/api --include-workspace-root

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

# Build shared first, then API
RUN npm run build -w packages/shared && npm run build -w packages/api

# --- Stage 2: Production ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy workspace config
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/

# Install production deps only
RUN npm ci --workspace=packages/shared --workspace=packages/api --include-workspace-root --omit=dev

# Copy compiled output
COPY --from=builder /app/packages/shared/dist/ packages/shared/dist/
COPY --from=builder /app/packages/api/dist/ packages/api/dist/

EXPOSE 3001

CMD ["node", "packages/api/dist/server.js"]
