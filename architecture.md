# Nifty by Paragon — Architecture

## Overview
A multi-role educational tech platform for schools, teachers, and students to explore technology together.

- **Frontend**: `nifty/` — React 18 + TypeScript + MUI v5 + Vite + Zustand + React Query
- **Backend**: `niftyb/` — FastAPI + MongoEngine + GridFS + Redis + OpenTelemetry
- **Database**: MongoDB (MongoEngine ODM, GridFS for file storage)
- **Cache**: Redis
- **Observability**: OpenTelemetry (traces, metrics, logs)
- **Containers**: Docker (multi-stage builds) + docker-compose

---

## Docker

### Individual Dockerfiles
| File | What it builds | Exposes |
|------|---------------|---------|
| `nifty/Dockerfile` | Multi-stage: Node 20 builds React → nginx:1.27-alpine serves SPA + proxies `/api` to `$BACKEND_URL` | `80` |
| `niftyb/Dockerfile` | Multi-stage: builder installs deps → python:3.12-slim runtime, non-root user, uvicorn | `8000` |
| `Dockerfile` (root) | Combined: builds frontend + backend, runs both under **supervisord** — nginx (port 80) proxies `/api` to uvicorn (127.0.0.1:8000) | `80` |

### docker-compose (separate containers, shared network)
```
docker-compose up --build
```
| Service | Image/Build | Host port | Purpose |
|---------|-------------|-----------|---------|
| `mongodb` | `mongo:7` | 27017 | Primary database |
| `redis` | `redis:7-alpine` | 6379 | Cache + rate-limiting |
| `backend` | `./niftyb` | 8000 | FastAPI API server |
| `frontend` | `./nifty` | 3000 | React SPA via nginx |

All services share `nifty-net` bridge network. `frontend` depends on `backend` (healthy), `backend` depends on `mongodb` + `redis` (healthy).

**Named volumes**: `mongodb_data`, `mongodb_config`, `redis_data`

### Key files
- `nginx.conf.template` — nginx SPA config with `${BACKEND_URL}` envsubst
- `nginx-combined.conf` — nginx config for the combined single-container setup
- `supervisord.conf` — runs nginx + uvicorn together in the combined image
- `.env.example` → copy to `.env` before `docker-compose up`

### Progress
- [x] `nifty/Dockerfile` + `nifty/nginx.conf.template` + `nifty/.dockerignore`
- [x] `niftyb/Dockerfile` (updated: multi-stage, non-root) + `niftyb/.dockerignore`
- [x] `Dockerfile` (root, combined container)
- [x] `nginx-combined.conf` + `supervisord.conf`
- [x] `docker-compose.yml`
- [x] `.env.example` + `.dockerignore` (root)

---

## Roles
| Role | Description |
|------|-------------|
| `super_admin` | Platform-wide admin (Key org), manages all orgs and global content |
| `tutor` | Platform-level educator, creates global content |
| `finance` | Platform finance role (Key org) |
| `org_admin` | School administrator, manages org users and org content |
| `teacher` | Classroom teacher, creates org content and manages classes |
| `student` | Learner, views content, enrolled in classes |

---

## Backend (`niftyb/`)

### File Structure
```
niftyb/
├── app/
│   ├── main.py              - FastAPI app, CORS, OTEL middleware, router mounts
│   ├── config.py            - Pydantic Settings (env vars)
│   ├── db.py                - MongoEngine connection + GridFS setup
│   ├── cache.py             - Redis async client
│   ├── telemetry.py         - OpenTelemetry SDK setup (traces, metrics, logs)
│   ├── models/
│   │   ├── __init__.py
│   │   ├── organization.py  - Organization document
│   │   ├── user.py          - User document
│   │   ├── content.py       - Content document (text/video/audio + GridFS ref)
│   │   └── class_.py        - Class document
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── organization.py  - Pydantic in/out schemas
│   │   ├── user.py
│   │   ├── content.py
│   │   └── class_.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py          - POST /auth/login, /auth/register-org
│   │   ├── users.py         - CRUD /users
│   │   ├── organizations.py - CRUD /organizations
│   │   ├── content.py       - CRUD /content + file upload (GridFS)
│   │   └── classes.py       - CRUD /classes + student enrollment
│   └── utils/
│       ├── __init__.py
│       ├── security.py      - JWT encode/decode, bcrypt hashing
│       └── deps.py          - FastAPI dependency: get_current_user, role guards
├── requirements.txt
├── .env.example
└── Dockerfile
```

### API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/login | public | Email + password → JWT |
| POST | /auth/register-org | public | Register org + org_admin user |
| GET | /users/me | any | Current user profile |
| GET | /users | admin+ | List users (org-scoped or global) |
| POST | /users | org_admin+ | Create user |
| PUT | /users/{id} | admin+ | Update user |
| DELETE | /users/{id} | admin+ | Delete user |
| GET | /organizations | super_admin | List all orgs |
| POST | /organizations | super_admin | Create org |
| PUT | /organizations/{id} | super_admin | Update org |
| DELETE | /organizations/{id} | super_admin | Delete org |
| GET | /content | any | List content (role+scope filtered) |
| POST | /content | creator | Create content |
| GET | /content/{id} | any | Get content + increment view |
| PUT | /content/{id} | author/admin | Update content |
| DELETE | /content/{id} | author/admin | Delete content |
| POST | /content/{id}/upload | creator | Upload file to GridFS |
| GET | /classes | teacher+ | List classes |
| POST | /classes | teacher+ | Create class |
| GET | /classes/{id} | teacher+ | Get class details |
| PUT | /classes/{id} | teacher/admin | Update class |
| DELETE | /classes/{id} | teacher/admin | Delete class |
| POST | /classes/{id}/students | teacher/admin | Add student |
| DELETE | /classes/{id}/students/{uid} | teacher/admin | Remove student |

### Redis Caching Strategy
- Content list queries: key `content:list:{role}:{org_id}` TTL 300s
- Single content items: key `content:{id}` TTL 300s
- Organization list: key `orgs:list` TTL 600s
- User profile: key `user:{id}` TTL 300s
- Cache invalidated on write operations

### OpenTelemetry
- FastAPI auto-instrumentation (HTTP request spans)
- MongoEngine/PyMongo auto-instrumentation
- Redis auto-instrumentation
- Custom business-logic spans (auth, content view)
- Console exporter (dev) / OTLP exporter (prod, via OTEL_EXPORTER_OTLP_ENDPOINT)

---

## Frontend (`nifty/`)

### File Structure
```
nifty/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx              - Router setup
    ├── theme.ts             - MUI theme (orange/warm palette, Fredoka font)
    ├── types/
    │   └── index.ts         - Shared TypeScript interfaces
    ├── api/
    │   ├── client.ts        - Axios instance with JWT interceptor
    │   ├── auth.ts          - login, registerOrg
    │   ├── users.ts         - CRUD users
    │   ├── organizations.ts - CRUD orgs
    │   ├── content.ts       - CRUD content
    │   └── classes.ts       - CRUD classes
    ├── store/
    │   └── authStore.ts     - Zustand: currentUser, token, login/logout
    ├── components/
    │   ├── Layout/
    │   │   ├── AppLayout.tsx   - Sidebar + main content shell
    │   │   ├── Sidebar.tsx     - Role-based nav items
    │   │   └── Topbar.tsx      - Logo, user info, notifications
    │   ├── Auth/
    │   │   └── AuthModal.tsx   - Login + Register tabs in MUI Dialog
    │   ├── Content/
    │   │   └── ContentCard.tsx - Reusable content card component
    │   └── common/
    │       └── SnackbarProvider.tsx
    └── pages/
        ├── Landing.tsx       - Hero, role chips, sign-in/register buttons
        ├── Dashboard.tsx     - Stats cards + recent content
        ├── ContentLibrary.tsx- Browse + filter content
        ├── CreateContent.tsx - Content creation form (with file upload)
        ├── MyContent.tsx     - Author's content table
        ├── Classes.tsx       - Class management
        ├── Users.tsx         - User management table + add form
        ├── Organizations.tsx - Org management (super_admin)
        └── Profile.tsx       - User profile + settings
```

### State Management
- **Auth state**: Zustand (`useAuthStore`) — persisted to localStorage
- **Server state**: TanStack Query (React Query v5) — queries + mutations with cache

---

## Progress Tracker

### Backend
- [x] requirements.txt
- [x] .env.example
- [x] app/config.py
- [x] app/db.py
- [x] app/cache.py
- [x] app/telemetry.py
- [x] app/models/organization.py
- [x] app/models/user.py
- [x] app/models/content.py
- [x] app/models/class_.py
- [x] app/schemas/organization.py
- [x] app/schemas/user.py
- [x] app/schemas/content.py
- [x] app/schemas/class_.py
- [x] app/utils/security.py
- [x] app/utils/deps.py
- [x] app/routers/auth.py
- [x] app/routers/users.py
- [x] app/routers/organizations.py
- [x] app/routers/content.py
- [x] app/routers/classes.py
- [x] app/main.py
- [x] Dockerfile

### Frontend
- [x] package.json / tsconfig.json / vite.config.ts
- [x] src/main.tsx + src/App.tsx
- [x] src/theme.ts
- [x] src/types/index.ts
- [x] src/api/client.ts + api modules
- [x] src/store/authStore.ts
- [x] src/components/Auth/AuthModal.tsx
- [x] src/components/Layout/AppLayout.tsx
- [x] src/components/Layout/Sidebar.tsx
- [x] src/components/Layout/Topbar.tsx
- [x] src/components/Content/ContentCard.tsx
- [x] src/pages/Landing.tsx
- [x] src/pages/Dashboard.tsx
- [x] src/pages/ContentLibrary.tsx
- [x] src/pages/CreateContent.tsx
- [x] src/pages/MyContent.tsx
- [x] src/pages/Classes.tsx
- [x] src/pages/Users.tsx
- [x] src/pages/Organizations.tsx
- [x] src/pages/Profile.tsx
