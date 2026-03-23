# =============================================================================
# DTI Salnés — CMS Dockerfile (Vite build + nginx)
# =============================================================================

# --- Stage 1: Build ---
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace files
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/cms/package.json packages/cms/

# Install dependencies
RUN npm ci --workspace=packages/shared --workspace=packages/cms --include-workspace-root

# Vite env variables must be set at build time
ARG VITE_API_URL=http://localhost:3001/api/v1
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY

# Copy source
COPY packages/shared/ packages/shared/
COPY packages/cms/ packages/cms/

# Build shared, then CMS
RUN npm run build -w packages/shared && npm run build -w packages/cms

# --- Stage 2: Serve static with nginx ---
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# SPA routing config
COPY --from=builder /app/packages/cms/dist/ /usr/share/nginx/html/

RUN cat > /etc/nginx/conf.d/cms.conf <<'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff2?)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
