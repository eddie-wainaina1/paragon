# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Install deps first (layer-cached until package.json changes)
COPY package.json package-lock.json* ./
# npm ci requires a committed lock file; fall back to npm install when absent
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

# Build-time env: VITE variables are baked in at build time
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

COPY . .
RUN npm run build          # outputs to /app/dist


# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy SPA + proxy nginx template; nginx entrypoint processes *.template files
# with envsubst automatically (see https://hub.docker.com/_/nginx#using-environment-variables-in-nginx-configuration)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Runtime variables — override at container start without rebuilding
ENV BACKEND_URL=http://backend:8000 \
    MAX_BODY_SIZE=0

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost/index.html || exit 1
