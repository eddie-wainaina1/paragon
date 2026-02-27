# ════════════════════════════════════════════════════════════════════════════
#  Nifty by Paragon — Combined Container
#  Runs the React frontend (nginx) and FastAPI backend (uvicorn) together
#  under supervisord so everything is reachable on a single port (80).
#
#  Topology inside the container:
#    port 80  ─► nginx ─► /api/*  ─► uvicorn (127.0.0.1:8000)
#                       ─► /*     ─► /usr/share/nginx/html  (React SPA)
# ════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build React frontend ────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

COPY nifty/package.json nifty/package-lock.json* ./
# npm ci requires a committed lock file; fall back to npm install when absent
RUN if [ -f package-lock.json ]; then npm ci --silent; else npm install --silent; fi

ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=${VITE_API_URL}

COPY nifty/ .
RUN npm run build          # → /frontend/dist


# ── Stage 2: Install Python dependencies ─────────────────────────────────────
FROM python:3.12-slim AS backend-builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY niftyb/requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 3: Final runtime image ─────────────────────────────────────────────
FROM python:3.12-slim AS runner

# ── System packages: nginx + supervisor ──────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
        nginx \
        supervisor \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# ── Python packages ───────────────────────────────────────────────────────────
COPY --from=backend-builder /install /usr/local

# ── FastAPI backend ───────────────────────────────────────────────────────────
WORKDIR /app/backend
COPY niftyb/ .

# ── React SPA (built static assets) ──────────────────────────────────────────
COPY --from=frontend-builder /frontend/dist /usr/share/nginx/html

# ── nginx config ─────────────────────────────────────────────────────────────
COPY nginx-combined.conf /etc/nginx/conf.d/default.conf
# Remove the default nginx site that ships with the package
RUN rm -f /etc/nginx/sites-enabled/default

# ── supervisord config ────────────────────────────────────────────────────────
COPY supervisord.conf /etc/supervisor/conf.d/nifty.conf

# ── Environment defaults (override at runtime) ────────────────────────────────
ENV MONGODB_URI=mongodb://localhost:27017/nifty \
    REDIS_URL=redis://localhost:6379/0 \
    SECRET_KEY=change-me-in-production \
    APP_ENV=production \
    DEBUG=false

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost/health || exit 1

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/nifty.conf"]
