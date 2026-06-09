# HR System

Internal HR management system for PT. Global Anugerah Setia.

The active application is split into two apps:

| App | Stack | Default Port |
| --- | --- | --- |
| Frontend | Next.js 16, React 19 | `3040` |
| Backend | Express 5, Prisma, Node 20 | `3041` |

Supporting services:

| Service | Purpose |
| --- | --- |
| PostgreSQL | Main database |
| Redis | Backend startup dependency and session/cache support |

## Quick Start With Docker

Docker is the recommended setup for running the full system.

### 1. Create Root Environment File

Create `.env` in the project root:

```bash
cp .env.example .env
```

If `.env.example` is not present, create `.env` manually:

```env
POSTGRES_PASSWORD=changeme
REDIS_PASSWORD=changeme
JWT_SECRET=change-this-to-a-random-secret
JWT_REFRESH=change-this-to-another-random-secret
API_URL=http://localhost:3041
ZK_IP=192.128.69.33
ZK_PORT=4370
```

For production or LAN access, set `API_URL` to the backend URL that the browser can reach, for example:

```env
API_URL=http://192.168.1.50:3041
```

### 2. Build And Start

```bash
docker compose up -d --build
```

Check containers:

```bash
docker compose ps
```

Expected containers:

| Container | Purpose |
| --- | --- |
| `hr-postgres` | PostgreSQL |
| `hr-redis` | Redis |
| `hr-backend` | Express API |
| `hr-frontend` | Next.js app |

### 3. Apply Database Migrations

Run migrations after the first database startup:

```bash
docker exec -i hr-postgres psql -U postgres -d hr < backend/prisma/migrations/20260605_add_attendance/migration.sql
docker exec -i hr-postgres psql -U postgres -d hr < backend/prisma/migrations/20260607_overtime_module/migration.sql
docker exec -i hr-postgres psql -U postgres -d hr < backend/prisma/migrations/20260608_shift_calendar/migration.sql
```

Warning: `20260607_overtime_module` drops old legacy overtime tables before creating the newer overtime request tables. Review it first if the database already contains real overtime data.

### 4. Open The App

Frontend:

```text
http://localhost:3040/login
```

Public display screen, no login required:

```text
http://localhost:3040/display
```

Backend API:

```text
http://localhost:3041
```

`GET /auth/me` returns `401 Unauthorized` when no login cookie is present; that is normal.

## Default Login

Fresh Docker databases are seeded from `init.sql`.

| Field | Value |
| --- | --- |
| Username | `mdata` |
| Password | `gasjaya` |

If your database volume existed before the seed was added, create an admin user manually or reset the database volume.

## Daily Docker Commands

Start existing containers:

```bash
docker compose up -d
```

Stop containers:

```bash
docker compose down
```

Rebuild after code or environment changes:

```bash
docker compose up -d --build
```

View logs:

```bash
docker logs hr-backend
docker logs hr-frontend
```

Follow backend and frontend logs:

```bash
docker compose logs -f backend frontend
```

Reset all Docker data, including the database:

```bash
docker compose down -v
docker compose up -d --build
```

After a reset, apply migrations again.

## Manual Development Setup

Use manual setup only when developing without Docker.

### Backend

Start PostgreSQL and Redis locally, then:

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
PORT=3041 node src/index.js
```

Backend `.env` example:

```env
DATABASE_URL="postgresql://postgres:changeme@localhost:5432/hr?sslmode=disable"
PORT=3041
JWT_SECRET="change-this-to-a-random-secret"
JWT_REFRESH="change-this-to-another-random-secret"
REDIS_URL="redis://:changeme@127.0.0.1:6379"
ZK_IP=192.128.69.33
ZK_PORT=4370
```

Run backend tests:

```bash
cd backend
npm test
```

### Frontend

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

Frontend `.env.local` example:

```env
NEXT_PUBLIC_API_BASE_URL_PRODUCTION=http://localhost:3041
JWT_SECRET="change-this-to-a-random-secret"
```

Build frontend:

```bash
cd frontend
npm run build
```

Lint frontend:

```bash
cd frontend
npm run lint
```

## Important Notes

Active code lives in `backend/` and `frontend/`.

Prisma client output is generated into `backend/src/generated/prisma`. Import Prisma through `backend/libs/prisma.js`, not directly from `@prisma/client`.

Schema changes use raw SQL migrations under `backend/prisma/migrations/`. After schema changes, run:

```bash
cd backend
npx prisma generate
```

The `/display` route is intended for TV screens and is accessible without authentication. It uses the public backend endpoint `GET /api/performance/leaderboard`.

## Troubleshooting

### Frontend Calls The Wrong Backend URL

`NEXT_PUBLIC_*` values are baked into the frontend image at build time. Update `API_URL` in `.env`, then rebuild the frontend:

```bash
docker compose build frontend
docker compose up -d frontend
```

### Missing `public.holiday` Table

Apply the shift calendar migration:

```bash
docker exec -i hr-postgres psql -U postgres -d hr < backend/prisma/migrations/20260608_shift_calendar/migration.sql
```

If other module tables are missing, apply all migrations in order from the Docker setup section.

### Redis Connection Fails

Check that `hr-redis` is running:

```bash
docker compose ps redis
docker logs hr-redis
```

Make sure `REDIS_PASSWORD` in root `.env` matches the backend connection string used by Docker Compose.

### Public Display Logo Does Not Load

Make sure the frontend image is rebuilt from the latest code:

```bash
docker compose build frontend
docker compose up -d frontend
```

The logo file should be available at:

```text
http://localhost:3040/logo.png
```

## Production Checklist

Generate strong secrets:

```bash
openssl rand -hex 32
```

Set strong values for:

```env
JWT_SECRET=...
JWT_REFRESH=...
POSTGRES_PASSWORD=...
REDIS_PASSWORD=...
```

Set `API_URL` to a backend URL reachable by user browsers. Do not use `localhost` for production clients unless the browser runs on the same machine as the backend.
