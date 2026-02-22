# ─────────────────────────────────────────────────────────────────────────────
#  Nifty by Paragon — Makefile
#
#  Usage:  make <target>
#  Run     make help   to see all available targets grouped by category.
# ─────────────────────────────────────────────────────────────────────────────

SHELL           := /bin/bash
.DEFAULT_GOAL   := help

# ── Directories ───────────────────────────────────────────────────────────────
FRONTEND_DIR    := nifty
BACKEND_DIR     := niftyb

# ── Docker ────────────────────────────────────────────────────────────────────
# Use Docker Compose v2 plugin (docker compose) when available, fall back to v1
COMPOSE         := $(shell docker compose version >/dev/null 2>&1 \
                        && echo "docker compose" \
                        || echo "docker-compose")

FRONTEND_IMAGE  := nifty-frontend
BACKEND_IMAGE   := nifty-backend
COMBINED_IMAGE  := nifty-combined

# ── Overridable runtime variables for make run-combined ───────────────────────
MONGODB_URI     ?= mongodb://localhost:27017/nifty
REDIS_URL       ?= redis://localhost:6379/0
SECRET_KEY      ?= dev-secret-key-change-in-production

# ── Terminal colours ──────────────────────────────────────────────────────────
CYAN  := \033[36m
BOLD  := \033[1m
RESET := \033[0m

# ─────────────────────────────────────────────────────────────────────────────
#  HELP  (default target)
#  Parses lines matching "target: ## description" and "##@ Section" headers
# ─────────────────────────────────────────────────────────────────────────────
.PHONY: help
help: ## Show this help message
	@awk 'BEGIN {FS = ":.*##"; \
	             printf "\n$(BOLD)Nifty by Paragon$(RESET)\n\nUsage:\n  make $(CYAN)<target>$(RESET)\n"} \
	     /^[a-zA-Z_0-9-]+:.*?##/ { printf "  $(CYAN)%-26s$(RESET) %s\n", $$1, $$2 } \
	     /^##@/ { printf "\n$(BOLD)%s$(RESET)\n", substr($$0, 5) }' \
	    $(MAKEFILE_LIST)


##@ Environment

.PHONY: env
env: ## Copy .env.example → .env (skips if .env already exists)
	@if [ -f .env ]; then \
	  echo ".env already exists — skipping"; \
	else \
	  cp .env.example .env; \
	  echo "Created .env — edit SECRET_KEY before running in production"; \
	fi

.PHONY: check
check: ## Verify required tools are installed (docker, node, python3)
	@echo "Checking prerequisites..."
	@command -v docker    >/dev/null 2>&1 && echo "  ✓ docker"    || echo "  ✗ docker    (required)"
	@command -v node      >/dev/null 2>&1 && echo "  ✓ node"      || echo "  ✗ node      (required for local dev)"
	@command -v python3   >/dev/null 2>&1 && echo "  ✓ python3"   || echo "  ✗ python3   (required for local dev)"
	@command -v mongosh   >/dev/null 2>&1 && echo "  ✓ mongosh"   || echo "  ~ mongosh   (optional — only for make shell-mongo locally)"


##@ Docker Compose  (all services: frontend · backend · mongodb · redis)

.PHONY: up
up: ## Build images (if needed) and start all services in detached mode
	$(COMPOSE) up -d --build

.PHONY: up-logs
up-logs: ## Build images (if needed) and start all services, follow logs
	$(COMPOSE) up --build

.PHONY: start
start: ## Start already-built services without rebuilding
	$(COMPOSE) up -d

.PHONY: stop
stop: ## Stop all running services (containers preserved)
	$(COMPOSE) stop

.PHONY: down
down: ## Stop and remove containers (named volumes are preserved)
	$(COMPOSE) down --remove-orphans

.PHONY: restart
restart: ## Restart all services
	$(COMPOSE) restart

.PHONY: build
build: ## Build all service images via docker-compose
	$(COMPOSE) build

.PHONY: rebuild
rebuild: ## Rebuild all service images from scratch (no layer cache)
	$(COMPOSE) build --no-cache

.PHONY: ps
ps: ## Show status of all containers
	$(COMPOSE) ps

.PHONY: logs
logs: ## Follow logs from all services (Ctrl-C to stop)
	$(COMPOSE) logs -f -t

.PHONY: logs-frontend
logs-frontend: ## Follow frontend container logs
	$(COMPOSE) logs -f -t frontend

.PHONY: logs-backend
logs-backend: ## Follow backend container logs
	$(COMPOSE) logs -f -t backend

.PHONY: logs-mongodb
logs-mongodb: ## Follow MongoDB container logs
	$(COMPOSE) logs -f -t mongodb

.PHONY: logs-redis
logs-redis: ## Follow Redis container logs
	$(COMPOSE) logs -f -t redis


##@ Individual Image Builds  (standalone, outside compose)

.PHONY: build-frontend
build-frontend: ## Build nifty/Dockerfile → $(FRONTEND_IMAGE)
	docker build -t $(FRONTEND_IMAGE) $(FRONTEND_DIR)/

.PHONY: build-backend
build-backend: ## Build niftyb/Dockerfile → $(BACKEND_IMAGE)
	docker build -t $(BACKEND_IMAGE) $(BACKEND_DIR)/

.PHONY: build-combined
build-combined: ## Build root Dockerfile (nginx + uvicorn + supervisord) → $(COMBINED_IMAGE)
	docker build -t $(COMBINED_IMAGE) .

.PHONY: run-frontend
run-frontend: ## Run the standalone frontend image on port 3000
	docker run --rm -p 3000:80 \
	  -e BACKEND_URL=$(MONGODB_URI) \
	  $(FRONTEND_IMAGE)

.PHONY: run-backend
run-backend: ## Run the standalone backend image on port 8000
	docker run --rm -p 8000:8000 \
	  -e MONGODB_URI=$(MONGODB_URI) \
	  -e REDIS_URL=$(REDIS_URL) \
	  -e SECRET_KEY=$(SECRET_KEY) \
	  $(BACKEND_IMAGE)

.PHONY: run-combined
run-combined: ## Run the combined image on port 80 (override MONGODB_URI, REDIS_URL, SECRET_KEY)
	docker run --rm -p 80:80 \
	  -e MONGODB_URI=$(MONGODB_URI) \
	  -e REDIS_URL=$(REDIS_URL) \
	  -e SECRET_KEY=$(SECRET_KEY) \
	  $(COMBINED_IMAGE)


##@ Local Development  (without Docker — runs on host directly)

.PHONY: install
install: install-frontend install-backend ## Install all dependencies (Node + Python)

.PHONY: install-frontend
install-frontend: ## npm install inside nifty/ (generates package-lock.json on first run)
	cd $(FRONTEND_DIR) && npm install

.PHONY: install-backend
install-backend: ## Create .venv and pip install inside niftyb/
	cd $(BACKEND_DIR) && python3 -m venv .venv && .venv/bin/pip install --upgrade pip -q && .venv/bin/pip install -r requirements.txt

.PHONY: dev
dev: ## Start frontend (Vite :5173) and backend (uvicorn :8000) in parallel
	$(MAKE) -j2 dev-frontend dev-backend

.PHONY: dev-frontend
dev-frontend: ## Start Vite dev server on port 5173
	cd $(FRONTEND_DIR) && npm run dev

.PHONY: dev-backend
dev-backend: ## Start FastAPI with --reload on port 8000 (uses niftyb/.venv)
	cd $(BACKEND_DIR) && .venv/bin/uvicorn app.main:app --reload --port 8000


##@ Code Quality

.PHONY: lint
lint: lint-frontend lint-backend ## Run all linters

.PHONY: lint-frontend
lint-frontend: ## ESLint on the frontend source
	cd $(FRONTEND_DIR) && npm run lint

.PHONY: lint-backend
lint-backend: ## ruff check on the backend source (falls back to flake8)
	@cd $(BACKEND_DIR) && \
	  (.venv/bin/ruff check app 2>/dev/null \
	   || .venv/bin/flake8 app \
	   || echo "Install ruff or flake8 into .venv first: make install-backend")

.PHONY: typecheck
typecheck: ## TypeScript type check (tsc --noEmit)
	cd $(FRONTEND_DIR) && npx tsc --noEmit


##@ Shell / Interactive Access  (containers must be running: make up)

.PHONY: shell-backend
shell-backend: ## bash inside the running backend container
	$(COMPOSE) exec backend /bin/bash

.PHONY: shell-frontend
shell-frontend: ## sh inside the running frontend container
	$(COMPOSE) exec frontend /bin/sh

.PHONY: shell-mongo
shell-mongo: ## mongosh session inside the MongoDB container
	$(COMPOSE) exec mongodb mongosh nifty

.PHONY: shell-redis
shell-redis: ## redis-cli session inside the Redis container
	$(COMPOSE) exec redis redis-cli


##@ Cleanup

.PHONY: clean
clean: ## Stop and remove containers (volumes and images preserved)
	$(COMPOSE) down --remove-orphans

.PHONY: clean-volumes
clean-volumes: ## ⚠ Remove containers AND named volumes (deletes all DB data)
	$(COMPOSE) down --volumes --remove-orphans

.PHONY: clean-images
clean-images: ## Remove locally built project images
	docker rmi -f $(FRONTEND_IMAGE) $(BACKEND_IMAGE) $(COMBINED_IMAGE) 2>/dev/null || true

.PHONY: clean-all
clean-all: clean-volumes clean-images ## ⚠ Full reset: containers + volumes + images
