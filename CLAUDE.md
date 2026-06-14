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

All active code lives inside `backend/` and `frontend/`. Earlier root-level copies of `src/`, `libs/`, `prisma/`, and the root `package.json` / `prisma.config.ts` have been removed; do not recreate them at the root.

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
| `src/index.js` | Express app setup, CORS config, route mounting + auth middleware mounting |
| `src/config/redis.js` | Redis client (used for session/caching) |
| `src/middleware/auth.js` | `authMiddleware` (verify accessToken cookie → `req.user`) + `requireRole(...roles)` (403 on mismatch) |
| `src/routes/auth.js` | Login, logout, refresh_token, `GET /auth/me` |
| `src/routes/members.js` | Employee CRUD, CSV import/export, `PATCH /:id/shift` |
| `src/routes/attendance.js` | ZKTeco sync, attendance queries, Excel report |
| `src/routes/performance.js` | Performance records, leaderboard |
| `src/routes/overtime.js` | Overtime batch request + lines, approve/reject, edit/delete, monthly Excel export |
| `src/routes/shifts.js` | Shift master CRUD + `GET /coverage` (Shifts × Departments matrix) |
| `src/routes/holidays.js` | National holiday calendar CRUD (`?year=YYYY`) |
| `src/lib/workingDays.js` | Single source for working-day logic: `isWorkingDay`, `countWorkingDays`, `getHolidaySet`, `classifyDay` (Mon–Fri, excludes Sat/Sun + holidays) |
| `libs/prisma.js` | Prisma client singleton |
| `prisma/schema.prisma` | DB schema (PostgreSQL) |

### Prisma notes

- Client output path is `src/generated/prisma` (non-default) — always import from `../../libs/prisma`, not from `@prisma/client`.
- After any schema change: `npx prisma generate`. There is no `migrate dev` setup; write raw SQL migrations manually under `prisma/migrations/`.
- `users.nik` is `Decimal` — compare against ZKTeco device IDs with `String(u.nik)`.
- Soft-delete: `users.deletedAt` — active employees have `deletedAt: null`.

### Tests

```bash
cd backend && npm test    # node --test --test-concurrency=1
```

- `node:test` + `supertest`. Files in `backend/tests/*.test.js`.
- **Runs serially** (`--test-concurrency=1`) on purpose: integration tests share one live DB and mutate real `users` rows (e.g. flipping `shift_id`). Parallel file execution caused cross-file races — do not remove the flag.
- Tests need the DB up and at least one non-deleted user. Each test restores rows it mutates in a `finally`.

### Auth flow

JWT in httpOnly cookies. `accessToken` expires in 20 min; `refreshToken` in 7 days. The `/auth/refresh_token` route issues a new access token. `GET /auth/me` returns the decoded user. Redis is connected at startup but not yet used for token invalidation — it is required to start (server won't boot without Redis).

**Middleware** (`src/middleware/auth.js`): `authMiddleware` verifies the `accessToken` cookie and attaches `req.user` (401 on failure). `requireRole(...roles)` gates a route by `req.user.roleuser` (403 on mismatch). Mounted in `index.js` on `/members`, `/api/attendance`, `/api/overtime`, `/api/shifts`, `/api/holidays`. The performance leaderboard (`GET /api/performance/leaderboard`) is public — skip-middleware shim in `index.js`.

**JWT payload:** the role claim is `roleuser` (NOT `role`). The `id` claim is the user UUID.

**Roles:** only two — `admin` (HR, full access) and `supervisor` (acts for their team; submits, sees own). Workers have no accounts.

### CORS

Allowed origins are hardcoded in `src/index.js`. Add new origins there if the frontend runs on a different port/host.

---

## Frontend

### Run

```bash
cd frontend
cp .env.example .env.local   # fill in values
npm install
npm run dev      # http://localhost:3040
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
| `/dashboard` | `GET /members`, `GET /api/attendance`, `GET /api/performance`, `GET /api/performance/leaderboard` |
| `/employee` | `GET /members`, `POST /members`, `PUT /members/:id`, `PATCH /members/delete/:id`, `PATCH /members/:id/shift`, `GET /members/export`, `POST /members/import` |
| `/attendance` | `GET /api/attendance`, `POST /api/attendance/sync`, `GET /api/attendance/device/info`, `GET /api/attendance/report/excel` |
| `/employee/performance` | `GET /api/performance/leaderboard`, `GET /api/performance`, `POST /api/performance/post`, `DELETE /api/performance/delete/:id` |
| `/overtime` | `GET/POST /api/overtime`, `GET /api/overtime/:id`, `PUT/DELETE /api/overtime/:id`, `PATCH /api/overtime/:id/approve`, `PATCH /api/overtime/:id/reject`, `GET /api/overtime/export/excel` |
| `/shifts` | `GET/POST/PUT/DELETE /api/shifts`, `GET /api/shifts/coverage`, `GET/POST/DELETE /api/holidays` |
| `/display` | `GET /api/performance/leaderboard` (unauthenticated) |

### Shared components

- `Drawer.jsx` — slide-in panel from right, ESC-closeable, backdrop click closes
- `StatChip.jsx` — label + large value chip used on Attendance and Dashboard
- Forms: `components/forms/EmployeeForm.jsx`, `PerformanceForm.jsx`

### Theme & language

- Two themes: `gas-light` (default) and `gas-dark`, toggled at runtime. **Default is light, default language is Indonesian (`id`)** — set in `src/app/components/AppProviders.jsx` (useState seeds + localStorage fallbacks) and `src/app/layout.js` (html `data-theme`). A saved `localStorage` pref overrides the default.
- Do not read colors as fixed hex in pages. Pull the palette from `useAppSettings()` → `p` (e.g. `p.pageBg`, `p.cardBg`, `p.text`, `p.primary`), which switches with the active theme. `src/lib/useAppSettings.js` is the palette source.
- `t(path)` from `useAppSettings()` resolves bilingual strings via `src/lib/i18n.js` — add new keys to both `id` and `en` blocks.

### Styling

- Tailwind CSS v4 + DaisyUI v5 with custom `gas-dark` / `gas-light` themes defined in `globals.css`.
- Accent blue `#5b8df8`, primary button `#3b6fd4` are theme-constant. All other colors come from the `p` palette — do not hardcode background/text hex.
- No emojis anywhere in the UI. Corporate tone throughout.
- Inline styles are intentional (dynamic theme-driven color values; avoids Tailwind purge issues).
- Layout: sidebar is `fixed w-64`; the content `<main>` is block-level with `ml-64` (NOT `flex-1` — that caused horizontal overflow past 100vw).

### Charts and animation

- `recharts` — AreaChart on Dashboard, BarChart on Attendance.
- `framer-motion` — used only on `/display` (TV route) for card entrance animations.

---

## Combined Score Formula

Used in `/api/performance/leaderboard` and `/display`:

```
combined_score = round((attendance_rate × 0.6 + performance_rating × 0.4) × 100)

attendance_rate    = days_present / working_days_in_month   (Mon–Fri, excludes Sat/Sun + holidays)
performance_rating = best→1.0 | good→0.75 | average→0.50 | worst→0.25
```

---

## HRMS Modules

This app is growing from a basic HR tool into an HRMS for a 500+ worker Indonesian manufacturing company. Built incrementally; each module gets its own spec → plan → build cycle under `docs/superpowers/`.

**Roadmap order:** Overtime → Shift → Leave → Contracts.

| Module | Status | Scope |
|--------|--------|-------|
| Auth foundation | shipped | `authMiddleware`, `requireRole`, `/auth/me` |
| Overtime | shipped | batch submit (supervisor) → admin approve/reject, edit/delete (pending only), monthly Excel export for payroll, day-type label (workday/rest_day/holiday) |
| Shift master + calendar | shipped | shift CRUD, worker `shift_id`, holiday calendar, coverage matrix (Shifts × Departments) |
| Leave | not started | annual/sick/permit, balance tracking, approval flow |
| Contracts | not started | PKWT expiry, BPJS, document mgmt |

**Conventions established across modules (follow these):**

- **Approval flow:** two-step. Supervisor submits a batch (`status: "pending"`), admin approves/rejects. Reject requires a reason. Only `pending` records are editable/deletable; owner or admin.
- **Role scoping in list endpoints:** admin sees all; supervisor sees only own (`submitted_by: req.user.id`). Guard via `requireRole("admin", "supervisor")` + an `isAdmin(req)` check.
- **Payroll is external.** We export clean Excel (`xlsx`) per month; payroll prices it. Do not compute pay/multipliers in-app beyond labels.
- **Working days = Mon–Fri**, minus national holidays. Always go through `src/lib/workingDays.js`; never re-hardcode day loops.
- **Day-type is computed on read** (`classifyDay`), never stored — avoids staleness when holidays change.
- **Migrations are raw SQL** under `prisma/migrations/<date>_<name>/migration.sql`, applied manually (no `migrate dev`). After schema edits, `npx prisma generate`.
- New batch-style modules (Leave) should mirror the overtime `request` + `line` shape and its route layout (list/detail/approve/reject/edit/delete/export).

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
