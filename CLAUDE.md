# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Layout

```
hr-gas/
├── backend/          Express 5 API (CommonJS, Node 20)
├── frontend/         Next.js 16 app (App Router, React 19)
├── docker-compose.yml
└── README.md         Setup instructions and API reference
```

The old root-level `src/`, `libs/`, `prisma/` directories are **dead code** left from a previous structure — all active code is inside `backend/` and `frontend/`.

---

## Backend

### Run

```bash
cd backend
cp .env.example .env   # fill in values
npm install
npx prisma generate    # generates client into src/generated/prisma/
PORT=3041 node src/index.js
# or with nodemon for dev:
PORT=3041 npx nodemon src/index.js
```

### Key files

| File | Purpose |
|------|---------|
| `src/index.js` | Express app setup, CORS config, route mounting |
| `src/config/redis.js` | Redis client (used for session/caching) |
| `src/routes/auth.js` | Login, logout, refresh_token |
| `src/routes/members.js` | Employee CRUD, CSV import/export |
| `src/routes/attendance.js` | ZKTeco sync, attendance queries, Excel report |
| `src/routes/performance.js` | Performance records, leaderboard |
| `libs/prisma.js` | Prisma client singleton |
| `prisma/schema.prisma` | DB schema (PostgreSQL) |

### Prisma notes

- Client output path is `src/generated/prisma` (non-default) — always import from `../../libs/prisma`, not from `@prisma/client`.
- After any schema change: `npx prisma generate`. There is no `migrate dev` setup; write raw SQL migrations manually under `prisma/migrations/`.
- `users.nik` is `Decimal` — compare against ZKTeco device IDs with `String(u.nik)`.
- Soft-delete: `users.deletedAt` — active employees have `deletedAt: null`.

### Auth flow

JWT in httpOnly cookies. `accessToken` expires in 20 min; `refreshToken` in 7 days. The `/auth/refresh_token` route issues a new access token. Redis is connected at startup but not yet used for token invalidation — it is required to start (server won't boot without Redis).

### CORS

Allowed origins are hardcoded in `src/index.js`. Add new origins there if the frontend runs on a different port/host.

---

## Frontend

### Run

```bash
cd frontend
cp .env.example .env.local   # fill in values
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

### Key env var

`NEXT_PUBLIC_API_BASE_URL_PRODUCTION` — points to the backend. Used in `src/lib/urlEndPoint.js` which all pages import.

### Architecture

- **App Router** (`src/app/`). All pages are client components (`"use client"`).
- **Layout** (`src/app/layout.js`): server component that decodes the `accessToken` cookie with `jwt.decode` (no verification — just to get `user` for the sidebar). If cookie is absent, renders children without the sidebar (login/display routes).
- **Middleware** (`src/middleware.js`): redirects unauthenticated users to `/login`. `/display` is bypassed (no auth required for TV screens).
- **`fetchWithAuth`** (`src/lib/fetchWithAuth.js`): wrapper around `fetch` that auto-refreshes the access token on 401 and queues concurrent requests during refresh.

### Page → API mapping

| Page | API endpoints used |
|------|--------------------|
| `/dashboard` | `GET /members`, `GET /api/attendance`, `GET /api/performance` |
| `/employee` | `GET /members`, `POST /members`, `PUT /members/:id`, `PATCH /members/delete/:id`, `GET /members/export`, `POST /members/import` |
| `/attendance` | `GET /api/attendance`, `POST /api/attendance/sync`, `GET /api/attendance/device/info`, `GET /api/attendance/report/excel` |
| `/employee/performance` | `GET /api/performance/leaderboard`, `GET /api/performance`, `POST /api/performance/post`, `DELETE /api/performance/delete/:id` |
| `/display` | `GET /api/performance/leaderboard` (unauthenticated) |

### Shared components

- `Drawer.jsx` — slide-in panel from right, ESC-closeable, backdrop click closes
- `StatChip.jsx` — label + large value chip used on Attendance and Dashboard
- Forms: `components/forms/EmployeeForm.jsx`, `PerformanceForm.jsx`

### Styling

- Tailwind CSS v4 + DaisyUI v5 with custom `gas-dark` theme defined in `globals.css`.
- Color palette (use these, not arbitrary values):
  - Background: `#0b0d14`
  - Cards: `#10131c`
  - Accent blue: `#5b8df8`
  - Primary button: `#3b6fd4`
  - Hover on inputs/rows: `#161c2b` / `#151a26`
  - Muted text: `#4a5568` / `#6b7a99`
- No emojis anywhere in the UI. Corporate tone throughout.
- Inline styles are intentional (avoids Tailwind purge issues with dynamic color values).

### Charts and animation

- `recharts` — AreaChart on Dashboard, BarChart on Attendance.
- `framer-motion` — used only on `/display` (TV route) for card entrance animations.

---

## Combined Score Formula

Used in `/api/performance/leaderboard` and `/display`:

```
combined_score = round((attendance_rate × 0.6 + performance_rating × 0.4) × 100)

attendance_rate    = days_present / working_days_in_month   (Mon–Sat, excludes Sunday)
performance_rating = best→1.0 | good→0.75 | average→0.50 | worst→0.25
```

---

## Docker

```bash
cp backend/.env.example backend/.env    # set JWT_SECRET, JWT_REFRESH, passwords
docker compose up -d --build
# After first boot, run the attendance migration:
docker exec -i hr-postgres psql -U postgres -d hr \
  < backend/prisma/migrations/20260605_add_attendance/migration.sql
```

---

## ZKTeco Device

- IP `192.128.69.33`, port `4370` (configurable via `ZK_IP` / `ZK_PORT` env vars).
- Device stores employee IDs as numbers that must match `users.nik` exactly.
- The `node-zklib` package communicates over TCP; device must be on the same network as the backend.
