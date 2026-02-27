# Nifty by Paragon

A multi-role educational tech platform for schools, teachers, and students. Schools register as organizations, admins manage users and classes, teachers create content, and students explore it.

**Stack:** React 19 + MUI · FastAPI + MongoEngine · MongoDB · Redis · Docker

---

## Prerequisites

- Docker + Docker Compose
- Node 20+ and Python 3.12+ (for local dev without Docker)

---

## Quick Start (Docker)

```bash
cp .env.example .env          # edit SECRET_KEY and passwords before first run
docker-compose up --build
```

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

Default super admin credentials (set in `.env`):
- Email: `admin@nifty.internal`
- Password: `change-me-in-production`

---

## Local Development (without Docker)

### Backend

```bash
cd niftyb
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # edit as needed
uvicorn app.main:app --reload --port 8000
```

Requires MongoDB (`localhost:27017`) and Redis (`localhost:6379`) running locally.

### Frontend

```bash
cd nifty
npm install
cp .env.example .env          # set VITE_API_URL=http://localhost:8000/api/v1
npm run dev
```

Frontend runs on http://localhost:3000.

---

## Environment Variables

Copy `.env.example` to `.env` at the repo root (used by `docker-compose`) and in `niftyb/` (used for local backend dev).

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | JWT signing key — use a long random string in production |
| `APP_ENV` | No | `development` (default) or `production`; production enables SendGrid |
| `SUPERADMIN_EMAIL` | No | Email for the seeded super admin (default: `admin@nifty.internal`) |
| `SUPERADMIN_PASSWORD` | Yes | Password for the seeded super admin |
| `MONGODB_URI` | No | MongoDB connection string (default: `mongodb://localhost:27017/nifty`) |
| `REDIS_URL` | No | Redis connection string (default: `redis://localhost:6379/0`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |
| `SENDGRID_API_KEY` | Production | SendGrid API key for email delivery |
| `SENDGRID_FROM_EMAIL` | Production | Sender email address |
| `FRONTEND_URL` | Production | Public frontend URL — used in email links |
| `OTEL_EXPORTER` | No | `console` (default) or `otlp` for OpenTelemetry |

In development, emails are saved as HTML files to `niftyb/tmp/` instead of being sent.

---

## User Roles

| Role | Description |
|------|-------------|
| `super_admin` | Full platform access; manages all organizations |
| `tutor` | Platform educator; creates global content |
| `finance` | Platform finance role |
| `org_admin` | School admin; manages org users and content |
| `teacher` | Creates content; manages classes |
| `student` | Views content; enrolls in classes |

---

## Project Structure

See [IMPLEMENTATION.md](IMPLEMENTATION.md) for a full breakdown of every file, API endpoint, data model, caching strategy, and key patterns.

```
paragon/
├── nifty/        # React frontend (Vite + MUI)
├── niftyb/       # FastAPI backend
├── docker-compose.yml
├── .env.example
├── IMPLEMENTATION.md   # Full technical reference
└── README.md
```
