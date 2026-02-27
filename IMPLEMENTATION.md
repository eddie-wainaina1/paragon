# Nifty by Paragon — Implementation Reference

> This document is the canonical reference for the app's structure, file purposes, and key patterns. Use it as context instead of re-reading source files from scratch.

---

## Overview

**Nifty** is a multi-role educational tech platform for schools, teachers, and students to explore technology together. It supports multi-tenancy (multiple schools/organizations), role-based access control, a rich content library (text, video, audio, PDF), class management, and student enrollment.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, MUI v7, Vite, Zustand, TanStack Query v5 |
| Backend | FastAPI, Python 3.12, MongoEngine ODM, PyMongo/GridFS |
| Database | MongoDB 7 |
| Cache | Redis 7 |
| Auth | JWT (HS256) via python-jose, bcrypt via passlib |
| Email | SendGrid (production) / file-based tmp/ (dev) |
| Observability | OpenTelemetry (traces, metrics, logs) |
| Containers | Docker (multi-stage), Docker Compose |

---

## Repository Layout

```
paragon/
├── nifty/                  # React frontend
├── niftyb/                 # FastAPI backend
├── docker-compose.yml      # Full-stack dev/prod orchestration
├── Dockerfile              # Combined single-container build
├── nginx-combined.conf     # nginx config for the combined image
├── supervisord.conf        # supervisord: runs nginx + uvicorn together
├── nginx-combined.conf
├── .env.example            # Root env template (for docker-compose)
├── .dockerignore
├── Makefile
├── architecture.md         # Original architecture notes (superseded by this file)
└── techkids-academy.html   # Static HTML reference/mockup
```

---

## Role System

Roles are the central concept governing what each user can see and do.

| Role | Org type | Description |
|------|----------|-------------|
| `super_admin` | Internal (Nifty platform org) | Full platform access; manages all orgs, users, global content |
| `tutor` | Internal | Platform educator; creates global content |
| `finance` | Internal | Platform finance; no content/class management |
| `org_admin` | School | School administrator; manages org users, org content |
| `teacher` | School | Creates org content, manages classes |
| `student` | School | Views content, enrolls in classes |

**Role groups** (used in both backend `constants.py` and frontend `constants.ts`):

| Group | Members | Used for |
|-------|---------|---------|
| `internal` | super_admin, tutor, finance | Roles restricted to internal orgs |
| `creator` | super_admin, tutor, org_admin, teacher | Can create content |
| `manager` | super_admin, org_admin, teacher | Can manage classes |
| `admin` | super_admin, org_admin | Can manage users |
| `global_scope` | super_admin, tutor | Can create global-scope content/classes |

---

## Backend (`niftyb/`)

### Startup & Lifecycle (`app/main.py`)

- Creates the FastAPI app instance
- On startup: initializes OpenTelemetry, instruments PyMongo + Redis, connects to MongoDB, calls `_seed_platform()` to ensure the "nifty" internal org and default super_admin exist, then runs migrations
- On shutdown: disconnects MongoDB
- Mounts all routers under `/api/v1`
- Registers CORS middleware (origins from `CORS_ORIGINS` env var)
- Exposes `GET /health` for container health checks

### Configuration (`app/config.py`)

Pydantic `BaseSettings` class — reads from env vars or `.env` file.

| Setting | Default | Purpose |
|---------|---------|---------|
| `SECRET_KEY` | dev placeholder | JWT signing key |
| `MONGODB_URI` | `mongodb://localhost:27017/nifty` | MongoDB connection |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection |
| `JWT_ALGORITHM` | `HS256` | Token algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24h) | Token TTL |
| `CORS_ORIGINS` | localhost dev ports | Comma-separated allowed origins |
| `SUPERADMIN_EMAIL` | `admin@nifty.internal` | Seeded super admin email |
| `SUPERADMIN_PASSWORD` | `change-me-in-production` | Seeded super admin password |
| `SENDGRID_API_KEY` | placeholder | Email delivery |
| `SENDGRID_FROM_EMAIL` | `info@paragoneschool.com` | Sender address |
| `FRONTEND_URL` | `http://localhost:3000` | Used to build verification/reset links |
| `OTEL_EXPORTER` | `console` | `console` or `otlp` |
| `APP_ENV` | `development` | Controls email delivery (production → SendGrid) |

### Database (`app/db.py`)

Manages two parallel connections:

1. **MongoEngine** (`mongoengine.connect`) — used by the ODM `Document` models for all CRUD
2. **Raw PyMongo** (`MongoClient`) — used exclusively for GridFS file storage

Exposes three GridFS helpers used by the content router:
- `gridfs_put(data, filename, content_type)` → ObjectId
- `gridfs_get(file_id)` → GridOut
- `gridfs_delete(file_id)` → void (silently ignores missing)

### Cache (`app/cache.py`)

Lazy-initialised async Redis client (`redis.asyncio`). All functions silently log and continue on Redis errors (cache is non-critical).

| Function | Purpose |
|----------|---------|
| `cache_get(key)` | Deserialise JSON from Redis, returns None on miss |
| `cache_set(key, value, ttl=300)` | Serialise to JSON with TTL |
| `cache_delete(key)` | Delete a single key |
| `cache_delete_pattern(pattern)` | Delete all keys matching a glob pattern |

**Cache key conventions:**

| Key | TTL | Invalidated by |
|-----|-----|----------------|
| `content:list:{role}:{org_id}:{type}:{scope}` | 300s | Any content write |
| `content:{id}` | 300s | Content update/delete or first view |
| `orgs:list:all` | 600s | Org create/update/delete |
| `users:list:{org_id}` | 300s | User create/update/delete |
| `users:list:all` | 300s | Any user write (super_admin list) |

### Telemetry (`app/telemetry.py`)

OpenTelemetry SDK setup. Instruments:
- FastAPI (HTTP request spans — auto)
- PyMongo / Redis (auto)
- Custom business spans (auth.login, content.create, etc.) via `get_tracer(__name__)`

**Console mode** uses two custom compact exporters instead of the verbose SDK defaults:
- `OneLineSpanExporter` — prints `[trace] METHOD /path → status (Xms)` per span
- `OneLineMetricExporter` — prints `[metric] name value unit` per data point

Production: OTLP HTTP exporter (`OTEL_EXPORTER_OTLP_ENDPOINT`) — standard SDK exporters used.

### Constants (`app/constants.py`)

Single source of truth for all domain enumerations shared across models, schemas, and routers.

- **`Constant`** — Base class with `values()`, `to_dict()`, `pattern()` class methods
- **`Role`** — All role values + role group lists (`creator`, `admin`, `manager`, `global_scope`, `internal`)
- **`ContentType`** — `text`, `video`, `audio`, `pdf`
- **`ContentScope`** — `global`, `org`
- **`ClassScope`** — `global`, `org`
- **`ContentEmoji`** — Emoji per content type
- **`OrgType`** — `platform`, `school`

---

### Models (`app/models/`)

All models extend MongoEngine `Document`. Each has a `to_dict()` serialisation method and class-level query helpers.

#### `organization.py` — `Organization`

Collection: `organizations` | Indexes: `slug`

| Field | Type | Notes |
|-------|------|-------|
| `name` | str | Display name |
| `slug` | str | Unique URL-safe identifier; auto-generated from name |
| `type` | str | `platform` or `school` |
| `internal` | bool | True for the Nifty platform org; internal orgs can hold internal roles |
| `created_at` | datetime | Auto-set UTC |

Key methods: `get_by_id`, `slug_exists`, `list_all`

#### `user.py` — `User`

Collection: `users` | Indexes: `email`, `org`

| Field | Type | Notes |
|-------|------|-------|
| `name` | str | Full name |
| `email` | str | Unique, used for login |
| `password_hash` | str | bcrypt hash |
| `role` | str | One of the six roles |
| `org` | ref → Organization | Required; determines org scope |
| `avatar` | str | 1-2 char initials |
| `verified` | bool | Must be True to login; set via email link |
| `created_at` | datetime | Auto-set UTC |

Key methods: `get_by_id`, `get_by_email`, `email_exists`, `list_all`, `list_by_org`, `delete_by_org`

#### `content.py` — `Content`

Collection: `content` | Indexes: `org`, `author`, `scope`, `type`

| Field | Type | Notes |
|-------|------|-------|
| `title` | str | |
| `type` | str | `text`, `video`, `audio`, `pdf` |
| `scope` | str | `global` (visible to all) or `org` (visible to own org) |
| `org` | ref → Organization | |
| `author` | ref → User | |
| `subject` | str | Subject/topic tag |
| `body` | str | Text content or URL for embedded media |
| `file_id` | ObjectId | GridFS reference for the original uploaded file |
| `file_name` | str | Original filename |
| `file_content_type` | str | MIME type |
| `hls_ready` | bool | True once HLS transcoding is complete (video and audio) |
| `hls_files` | dict | GridFS OID map for HLS files e.g. `{"master.m3u8": "<oid>", "720p_000.ts": "<oid>"}` |
| `views` | int | View counter |
| `locked` | bool | Locked content cannot be modified by non-admins |
| `emoji` | str | Custom emoji override |
| `created_at` / `updated_at` | datetime | |

Key methods: `get_by_id`, `list_visible_to(user)`, `increment_views`, `delete_by_org`

#### `class_.py` — `Class`

Collection: `classes` | Indexes: `org`, `teacher`

| Field | Type | Notes |
|-------|------|-------|
| `name` | str | |
| `grade` | str | Grade level label |
| `scope` | str | `global` or `org` |
| `teacher` | ref → User | |
| `org` | ref → Organization | |
| `students` | list[ref → User] | Enrolled students |
| `unlocked_content` | list[ref → Content] | Content assigned to this class |
| `created_at` | datetime | |

Key methods: `get_by_id`, `list_for_user(user)`, `list_available_for_student(student)`, `get_enrolled_ids(student)`

---

### Schemas (`app/schemas/`)

Pydantic v2 models for request/response validation. One file per domain:

- `user.py` — `LoginRequest`, `RegisterOrgRequest`, `UserCreate`, `UserUpdate`, `UserOut`, `TokenResponse`, `ForgotPasswordRequest`, `ResetPasswordRequest`
- `organization.py` — `OrgCreate`, `OrgUpdate`, `OrgOut`
- `content.py` — `ContentCreate`, `ContentUpdate`, `ContentOut`
- `class_.py` — `ClassCreate`, `ClassUpdate`, `ClassOut`, `ClassDetailOut` (includes student/content ID lists), `AddStudentRequest`, `AddContentRequest`

---

### Routers (`app/routers/`)

All routers mount under `/api/v1`.

#### `auth.py` — `/api/v1/auth`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | public | Email + password → JWT + UserOut |
| POST | `/register-org` | public | Creates org + org_admin, sends verification email, returns JWT |
| GET | `/verify-email?token=` | public | Consumes one-time JWT, sets `verified=True`, redirects to frontend |
| POST | `/forgot-password` | public | Sends reset email (always 200, prevents enumeration) |
| POST | `/reset-password` | public | Consumes reset JWT, sets new password |
| POST | `/impersonate/{user_id}` | super_admin | Issues a token scoped to another user (cannot impersonate another super_admin) |

#### `users.py` — `/api/v1/users`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/me` | any | Current user profile |
| PUT | `/me` | any | Update own name/email/password |
| GET | `/` | admin | List users (org-scoped for org_admin, all for super_admin) |
| POST | `/` | admin | Create user + send welcome email |
| PUT | `/{user_id}` | admin | Update user (org_admin cannot cross orgs or set internal roles) |
| DELETE | `/{user_id}` | admin | Delete user (cannot self-delete) |

#### `organizations.py` — `/api/v1/organizations`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | any | super_admin → all orgs; others → own org only |
| POST | `/` | super_admin | Create org; optionally creates + invites an org_admin |
| PUT | `/{org_id}` | super_admin | Update org name/type/internal flag |
| DELETE | `/{org_id}` | super_admin | Delete org + cascade-delete its users and content (blocks internal orgs) |

#### `content.py` — `/api/v1/content`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | any | List content visible to user (filters: type, scope); Redis cached |
| POST | `/` | creator | Create content item |
| GET | `/{id}` | any | Get content + increment view count; Redis cached |
| PUT | `/{id}` | author or admin | Update content fields |
| DELETE | `/{id}` | author or admin | Delete content + GridFS file |
| POST | `/{id}/upload` | creator (author) | Upload file to GridFS (replaces existing); validates MIME vs content type; triggers HLS transcoding in background for `video` and `audio` types |
| GET | `/{id}/hls/{filename}` | any (Bearer) | Serve an HLS manifest or segment file (`.m3u8` / `.ts`) from GridFS |
| GET | `/{id}/file-token` | any | Issue a 30-min file-access JWT scoped to this content item (used by PDF viewer) |
| GET | `/{id}/file` | any (Bearer or `?token=`) | Stream the raw GridFS file with HTTP Range support |

**MIME rules for uploads:**
- `video` → `video/*`
- `audio` → `audio/*`
- `pdf` → `application/pdf`
- `text` → no restriction

**HLS flow (video + audio):** Upload sets `hls_ready=False`. Background task transcodes and stores segments in GridFS, then sets `hls_ready=True`. Frontend polls `hls_ready` via the content detail query and shows a "processing" spinner until ready. Video and audio are both served exclusively via HLS — the raw file endpoint is not used for playback. File tokens are only issued for PDF.

#### `classes.py` — `/api/v1/classes`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | any | List classes visible to user |
| GET | `/available` | student | Classes in own org not yet enrolled in |
| POST | `/` | manager | Create class |
| GET | `/{id}` | any | Class detail (includes student/content ID lists) |
| PUT | `/{id}` | manager (teacher/admin) | Update name/grade |
| DELETE | `/{id}` | manager (teacher/admin) | Delete class |
| POST | `/{id}/students` | manager | Enroll a student |
| DELETE | `/{id}/students/{uid}` | manager | Remove a student |
| POST | `/{id}/subscribe` | student | Self-subscribe to a class |
| DELETE | `/{id}/subscribe` | student | Self-unsubscribe |
| GET | `/{id}/content` | teacher/admin/enrolled student | List class content |
| POST | `/{id}/content` | manager (teacher/admin) | Add content item to class |
| DELETE | `/{id}/content/{cid}` | manager (teacher/admin) | Remove content from class |

---

### Utils (`app/utils/`)

#### `transcoding.py`

Background HLS transcoding via `ffmpeg-python`. Runs in a thread-pool executor (`loop.run_in_executor`) to avoid blocking the event loop.

**Video** (`transcode_to_hls`): produces two quality levels stored in GridFS:
- `720p.m3u8` + segments (2800k video, 128k audio)
- `360p.m3u8` + segments (800k video, 96k audio)
- `master.m3u8` — adaptive bitrate master playlist

**Audio** (`transcode_audio_to_hls`): produces a single quality HLS stream:
- `audio.m3u8` + segments (128k AAC)

On completion, sets `content.hls_ready = True` and `content.hls_files = {filename: gridfs_oid}`.

#### `security.py`

- `hash_password(plain)` → bcrypt hash
- `verify_password(plain, hashed)` → bool
- `create_access_token(data, expires_delta?)` → JWT string (default 24h)
- `create_verification_token(user_id)` → JWT with `purpose: email_verify` (1h TTL)
- `create_password_reset_token(user_id)` → JWT with `purpose: password_reset` (1h TTL)
- `decode_token(token)` → payload dict (raises `JWTError` on invalid/expired)

#### `deps.py`

FastAPI dependency injection:

- `get_current_user` — extracts Bearer token, decodes JWT, looks up User
- `CurrentUser` — `Annotated[User, Depends(get_current_user)]` — standard auth dependency
- `get_stream_user` — accepts Bearer header **or** `?token=` query param (for `<video>`/`<audio>` src URLs)
- `StreamUser` — `Annotated[User, Depends(get_stream_user)]`
- `require_roles(*roles)` — factory returning a dependency that raises 403 if user's role is not in the list

---

### Email (`app/email/`)

#### `client.py`

- Initialises the SendGrid client (lazy, returns None if key not set)
- Sets up a Jinja2 `Environment` pointing at `app/email/templates/`

#### `service.py`

- `send_welcome_email(user, verification_url)` — welcome + verify email for self-registered org_admin
- `send_invite_email(user, temp_password, verification_url)` — invite email when super_admin creates a new org with an admin email
- `send_reset_password_email(user, reset_url)` — password reset email

**Dev behaviour:** When `APP_ENV != production`, emails are written as HTML files to `niftyb/tmp/` instead of being sent via SendGrid.

#### `templates/`

Jinja2 HTML templates:
- `base.html` — Base layout with Nifty branding
- `welcome.html` — Welcome + email verification link
- `invite.html` — Org admin invite with temporary password
- `reset_password.html` — Password reset link

---

### Migrations (`app/migrations/`)

Simple migration runner. Migrations are registered in `app/migrations/__init__.py` and executed at startup.

- `0001_set_existing_users_verified.py` — Back-fills `verified=True` on all existing users (idempotent; added when email verification was introduced)

---

## Frontend (`nifty/`)

### Entry Point (`src/main.tsx`)

Wraps the app in:
- `BrowserRouter` (React Router v7)
- MUI `ThemeProvider` with the custom theme
- `QueryClientProvider` (TanStack Query)
- Zustand store (no wrapper needed; used via hooks)

### Router (`src/App.tsx`)

```
/                        → Landing (or redirect to /app/dashboard if authenticated)
/reset-password          → ResetPassword
/app                     → AppLayout (authenticated shell)
  /app/dashboard         → Dashboard
  /app/content           → ContentLibrary
  /app/content/create    → CreateContent
  /app/my-content        → MyContent
  /app/classes           → Classes
  /app/classes/:id       → ClassDetail
  /app/users             → Users
  /app/organizations     → Organizations
  /app/profile           → Profile
*                        → redirect to /
```

`AuthRedirect` component: renders Landing but watches `isAuthenticated()` — if true, immediately navigates to `/app/dashboard`.

### Theme (`src/theme.ts`)

MUI theme with an orange/warm palette (`primary: #F97316`, `secondary: #EA580C`). Uses the **Fredoka One** display font (loaded via Google Fonts in `index.html`). Supports light and dark modes — dark mode is controlled by `themeStore` and toggled from the Topbar.

### Constants (`src/constants.ts`)

Frontend mirror of the backend constants. Provides:
- `Role` / `RoleConst` — role values + role groups + `to_dict()` for labels
- `RoleStyle` — MUI colour mappings per role for avatar gradients and chips
- `ContentEmoji` / `ContentEmojiConst` — emoji per content type
- `ContentType` / `ContentTypeConst`
- `ContentTypeOptions` — array for content type selector UI
- `ContentTypeStyle` — chip colours per content type
- `ContentFileAccept` — `accept` attributes for file upload inputs
- `ContentFilters` — filter button config for Content Library

### Types (`src/types/index.ts`)

TypeScript interfaces for all domain objects:
`Organization`, `User`, `Content`, `Class`, `TokenResponse`, `LoginRequest`, `RegisterOrgRequest`, `UserCreate`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `ContentCreate`, `ClassCreate`

---

### State Management

#### Auth Store (`src/store/authStore.ts`)

Zustand store, persisted to `localStorage` as `nifty-auth`.

| State/Action | Purpose |
|-------------|---------|
| `user` | Current user object |
| `token` | JWT access token |
| `originalUser` / `originalToken` | Saved session when super_admin is impersonating |
| `setAuth(user, token)` | Login |
| `clearAuth()` | Logout |
| `isAuthenticated()` | Boolean check |
| `impersonate(user, token)` | Saves current session, switches to impersonated user |
| `stopImpersonating()` | Restores original super_admin session |
| `isImpersonating()` | True when `originalToken` is set |

#### Theme Store (`src/store/themeStore.ts`)

Zustand store for dark/light mode preference, persisted to `localStorage`.

---

### API Layer (`src/api/`)

#### `client.ts` — Axios instance

- `baseURL` defaults to `VITE_API_URL` env var or `/api/v1`
- Request interceptor: reads JWT from `localStorage['nifty-auth']` (Zustand persist format), attaches as `Authorization: Bearer <token>`
- Response interceptor: on 401, clears localStorage and redirects to `/`

#### `auth.ts`

- `login(email, password)` → `TokenResponse`
- `registerOrg(data)` → `TokenResponse`
- `forgotPassword(email)` → void
- `resetPassword(token, newPassword)` → void

#### `users.ts`

- `getMe()` → `User`
- `updateMe(data)` → `User`
- `listUsers()` → `User[]`
- `createUser(data)` → `User`
- `updateUser(id, data)` → `User`
- `deleteUser(id)` → void

#### `organizations.ts`

- `listOrgs()` → `Organization[]`
- `createOrg(data)` → `Organization`
- `updateOrg(id, data)` → `Organization`
- `deleteOrg(id)` → void

#### `content.ts`

- `list(params?)` → `Content[]`
- `get(id)` → `Content`
- `create(data)` → `Content`
- `update(id, data)` → `Content`
- `delete(id)` → void
- `uploadFile(id, file)` → `Content`
- `getFileToken(id)` → string (30-min file-access JWT; used for PDF streaming)
- `getFileUrl(id)` → string (URL to `/content/{id}/file` with token query param; kept for direct file access if needed)

#### `classes.ts`

- `list()` → `Class[]`
- `listAvailable()` → `Class[]`
- `get(id)` → `Class`
- `create(data)` → `Class`
- `update(id, data)` → `Class`
- `delete(id)` → void
- `addStudent(classId, userId)` → `Class`
- `removeStudent(classId, userId)` → `Class`
- `subscribe(classId)` → `Class`
- `unsubscribe(classId)` → void
- `getContent(classId)` → `Content[]`
- `addContent(classId, contentId)` → `Class`
- `removeContent(classId, contentId)` → `Class`

---

### Layout Components (`src/components/Layout/`)

#### `AppLayout.tsx`

Authenticated shell. Renders `Sidebar` on the left, `Topbar` at the top, and `<Outlet />` (React Router nested routes) in the main area. Wraps everything in the MUI `ThemeProvider` with the current theme mode.

#### `Sidebar.tsx`

Role-aware navigation. Calls `getNavSections(role)` which builds nav sections:
- **General** (all roles): Dashboard, Content Library
- **Content** (creator roles): Create Content, My Content
- **Classes** (manager roles): Classes
- **Management** (admin roles): Users; super_admin also sees Organizations
- **Account** (all): Settings/Profile

Active route highlighted with orange gradient background.

#### `Topbar.tsx`

- Shows Nifty logo/brand
- Dark/light mode toggle
- User avatar + name + role chip
- Impersonation banner (shown when super_admin is impersonating; includes "Stop Impersonating" button)
- Logout button

---

### Auth Component (`src/components/Auth/`)

#### `AuthModal.tsx`

MUI `Dialog` with two tabs: **Login** and **Register**.

- **Login tab**: email + password form; calls `login()`, stores result in `authStore`; handles email not verified error with a friendly message
- **Register tab**: org name, first/last name, email, password form; calls `registerOrg()`, stores result
- Shown from the Landing page when user clicks "Sign In" or "Register"

---

### Content Components (`src/components/Content/`)

#### `ContentCard.tsx`

Reusable card for displaying a content item in grid/list views. Shows emoji, title, type chip, subject, author, org, view count, scope badge (global).

#### `ContentViewDialog.tsx`

Full-screen MUI `Dialog` for viewing content:
- `video` → `HlsVideoPlayer` (when `hls_ready`); "processing" spinner while transcoding
- `audio` → `HlsAudioPlayer` (when `hls_ready`); "processing" spinner while transcoding
- `pdf` → `PdfViewer` component (fetches a 30-min file-access token via `/file-token` first)
- `text` → renders body as plain text

File-access tokens are only fetched for PDF. Video and audio both use HLS served via `Authorization: Bearer` header.

#### `HlsVideoPlayer.tsx`

Uses `hls.js` attached to a `<video>` element. Loads `/content/{id}/hls/master.m3u8` with `Authorization: Bearer` injected via `xhrSetup`. Adaptive bitrate (720p / 360p). Disables PiP and right-click context menu.

#### `HlsAudioPlayer.tsx`

Uses `hls.js` attached to an `<audio>` element. Loads `/content/{id}/hls/audio.m3u8` with `Authorization: Bearer` injected via `xhrSetup`. Disables right-click context menu. Both HLS players prevent the browser's native download affordances.

#### `PdfViewer.tsx`

Wraps `react-pdf` to render PDF files from a URL. Handles page navigation (prev/next), loading state, and errors.

---

### Pages (`src/pages/`)

#### `Landing.tsx`

Public home page. Shows the Nifty brand, a tagline, role chips explaining the platform, and "Sign In" / "Register School" buttons that open `AuthModal`. Handles `?verified=true` and `?verified=already` query params to show verification success messages.

#### `Dashboard.tsx`

Post-login home. Shows summary stats cards (content count, class count, user count — role-dependent), and a recent content grid. Uses React Query to fetch data.

#### `ContentLibrary.tsx`

Browse all content visible to the current user. Features:
- Filter bar by content type and scope (global)
- Search by title
- Grid of `ContentCard` components
- Click opens `ContentViewDialog`

#### `CreateContent.tsx`

Multi-step form for creating content:
1. Select type (text/video/audio/pdf)
2. Fill title, subject, scope, body/URL
3. For file types (video/audio/pdf): upload file via `uploadFile()`

Uses React Query mutations.

#### `MyContent.tsx`

Table view of content created by the current user. Supports inline delete. Links to edit (redirects to create form pre-filled — or a dedicated edit view).

#### `Classes.tsx`

Class management page. Behaviour varies by role:
- **manager roles**: see own classes, create new class button
- **students**: see enrolled classes + available classes to subscribe to

Lists classes as cards with student count, content count, grade, teacher.

#### `ClassDetail.tsx`

Detail view for a single class (`/app/classes/:id`):
- **Content table**: lists `unlocked_content` for the class; managers can add/remove content via a dialog picker
- **Students table** (managers only): lists enrolled student IDs; managers can remove students
- Self-subscribe/unsubscribe not shown here (handled in Classes list)

#### `Users.tsx`

User management table. Admin-only page.
- `org_admin`: sees only own org's users; can create users in own org
- `super_admin`: sees all users across all orgs; can impersonate users (calls `impersonate` endpoint + stores result in authStore)
- Supports create, update (role/name/email), delete

#### `Organizations.tsx`

Organization management. `super_admin` only. Table of all orgs with create, update, delete. Create form accepts optional admin email to auto-create and invite an org_admin.

#### `Profile.tsx`

User's own profile settings. Allows updating name, email, and password. Uses `PUT /users/me`.

#### `ResetPassword.tsx`

Standalone page (no auth required) at `/reset-password?token=`. Reads the `token` query param and presents a new password form. Calls `resetPassword(token, newPassword)`.

---

## Docker Setup

### Separate containers (recommended for development)

```
docker-compose up --build
```

| Service | Port | Notes |
|---------|------|-------|
| `mongodb` | 27017 | Persistent `mongodb_data` volume |
| `redis` | 6379 | 256mb max, LRU eviction, AOF persistence |
| `backend` | 8000 | FastAPI via uvicorn |
| `frontend` | 3000 | React SPA via nginx; `/api` proxied to backend:8000 |

All on `nifty-net` bridge. `frontend` waits for `backend` health, `backend` waits for `mongodb` + `redis` health.

### Combined single container (for simple deployments)

```
docker build -t nifty .
docker run -p 80:80 nifty
```

Built by the root `Dockerfile`. Uses `supervisord.conf` to run both nginx (port 80) and uvicorn (127.0.0.1:8000). `nginx-combined.conf` proxies `/api` to uvicorn.

### Env vars

Copy `.env.example` to `.env` before running:
```
cp .env.example .env
```

Mandatory changes for production:
- `SECRET_KEY` — at least 32 random chars
- `SUPERADMIN_PASSWORD` — strong password
- `SENDGRID_API_KEY` — for live email
- `CORS_ORIGINS` — production domain(s)
- `APP_ENV=production` — enables SendGrid email sending
- `FRONTEND_URL` — production domain (used in email links)

---

## Key Patterns & Conventions

### Role enforcement (backend)

Use `require_roles(*roles)` for endpoint-level enforcement:
```python
current_user: User = Depends(require_roles(*Role.admin))
```

For more nuanced checks within handlers (e.g., org_admin cannot touch another org):
```python
if current_user.role == Role.org_admin and str(user.org.id) != str(current_user.org.id):
    raise HTTPException(403, ...)
```

### Content visibility

`Content.list_visible_to(user)`:
- `super_admin` → all content
- everyone else → `scope=global` OR `org=user.org`

### Cache invalidation

Always invalidate on writes:
- Targeted `cache_delete(f"content:{id}")` for single-item updates
- Pattern `cache_delete_pattern("content:list:*")` on any content write that affects list queries

### File streaming

The `/content/{id}/file` endpoint supports HTTP Range requests. Authentication accepts either a Bearer header or `?token=` query param — the latter allows browser media elements to set `src` directly (used only for PDF now; video and audio use HLS instead).

The `/content/{id}/hls/{filename}` endpoint serves HLS manifests and segments. It requires `Authorization: Bearer` only — no `?token=` support — because `hls.js` injects headers via `xhrSetup` for all segment requests.

### Email verification flow

1. User registers (self or via admin) → `verified=False`
2. Welcome/invite email sent with one-time JWT link (`purpose: email_verify`, 1h TTL)
3. User clicks link → `GET /auth/verify-email?token=` → sets `verified=True` → redirects to frontend
4. Login blocked with 403 until verified

### Password reset flow

1. User submits email → `POST /auth/forgot-password` (always 200)
2. If email exists: reset JWT sent (`purpose: password_reset`, 1h TTL)
3. User clicks link → `/reset-password?token=` frontend page
4. User submits new password → `POST /auth/reset-password` → password updated

### Impersonation

1. `super_admin` clicks impersonate on any non-super_admin user
2. `POST /auth/impersonate/{user_id}` returns a new JWT with `imp: {admin_id}` claim
3. Frontend stores original session in `originalUser`/`originalToken`, switches to new token
4. All API calls now execute as the impersonated user
5. Topbar shows impersonation banner; "Stop Impersonating" restores original session

### Migrations

`app/migrations/__init__.py` maintains a list of migration modules. `run_migrations()` is called at startup after DB connection. Migrations should be idempotent.
