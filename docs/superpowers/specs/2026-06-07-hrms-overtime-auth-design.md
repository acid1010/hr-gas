# HRMS Module 1 — Auth Foundation + Overtime

**Date:** 2026-06-07
**Status:** Approved design, pending implementation plan

## Context

`hr-gas` is an existing HR app (Express 5 backend, Next.js 16 frontend, PostgreSQL, Redis, ZKTeco biometric attendance). The goal is to grow it into a full HRMS for a large (500+ worker) Indonesian manufacturing company, built incrementally.

**Roadmap (agreed order):** Overtime → Shift scheduling → Leave management → Contracts/compliance.

This spec covers **Module 1: Overtime**, plus the **auth foundation** it depends on. An approval workflow is meaningless without backend authorization, so auth is built first within this module.

### Constraints established during brainstorming

- **Company:** Large, 500+ workers, multi-shift, multiple lines.
- **Payroll:** Existing external system, not being replaced. Integration is **file export (Excel)** for now; API push is a later concern.
- **Roles:** Only **Admin** (HR, full access) and **Supervisor** (acts for their team). **Workers do not have accounts** — supervisors submit on their behalf.
- **Approval flow:** 2-step. Supervisor submits an overtime batch → Admin (HR) approves or rejects.
- **Overtime scope:** Track + approve hours now. Legal money calculation (Kepmenaker 102/2004 multipliers) is deferred until the Shift module provides reliable day-type data. A `multiplier` column is reserved now, left NULL.

### Current-state findings (verified against code)

- **No backend auth exists.** JWT is issued at login but **no route verifies it**. `/members`, `/api/attendance`, `/api/performance` are fully open to anyone who knows the URL. The access token already carries `{id, username, roleuser, depart, section, access}` — everything middleware needs, just unused.
- **`overtime.js` and `permission.js` are empty 0-byte files.** Only four routes are real: auth, members, attendance, performance.
- **Existing overtime tables are broken:** `overtime_permit` / `overtime` / `overtime_detail` use `Date` type for start/end times (can't store hours), have no status/approver fields, and split responsibility across three tables in an unclear way. They will be dropped and replaced.
- **Auth refresh is doubly broken:** frontend calls `POST /auth/refresh` (no body); backend route is `/auth/refresh_token` reading `req.body.refreshToken`. Path mismatch (404) and token-source mismatch (token is in an httpOnly cookie, never in the body). Refresh has never worked.
- **`cookie-parser` is not installed.** No test framework is configured (`npm test` is a stub).

## Part A — Auth Foundation

### New file: `backend/src/middleware/auth.js`

- `authMiddleware(req, res, next)` — reads the `accessToken` cookie, verifies with `JWT_SECRET`, attaches `req.user = {id, username, roleuser, depart, section, access}`. Returns 401 if missing or invalid.
- `requireRole(...roles)` — guard that checks `req.user.roleuser` against an allowed set. Returns 403 otherwise.

### Mounting (`src/index.js`)

- Apply `authMiddleware` to `/members`, `/api/attendance`, `/api/performance`, and the new `/api/overtime`.
- `/auth/*` stays open (login/refresh must be reachable without a valid access token).

### Auth fixes

- Install `cookie-parser`; mount `app.use(cookieParser())`.
- `refresh_token` route: read `req.cookies.refreshToken` instead of `req.body.refreshToken`. Set the new access token as an httpOnly cookie (currently it only returns JSON).
- Align the frontend refresh call in `fetchWithAuth.js`: path `/auth/refresh` → `/auth/refresh_token`.

### Role values

Before coding the role guards, **read the actual `users.role` values in the database** — do not assume the literal strings `'admin'` / `'supervisor'`. Map guards to whatever real values exist (e.g. role may be stored capitalized, in Indonesian, or in the `access` field rather than `role`). This is an implementation-time verification step.

## Part B — Overtime Data Model

Drop `overtime_permit`, `overtime`, `overtime_detail`. Replace with two tables.

```
overtime_request (header — one per submitted batch)
  id            uuid pk   default gen_random_uuid()
  submitted_by  uuid  → users.id        (the supervisor)
  departement   varchar
  date          date                    (the overtime date)
  shift         int   nullable
  status        varchar default 'pending'   -- 'pending' | 'approved' | 'rejected'
  approved_by   uuid  nullable → users.id   (the admin who actioned it)
  approved_at   timestamp nullable
  reject_reason varchar nullable
  created_at    timestamp default now()
  updated_at    timestamp default now()

overtime_line (one row per worker within a batch)
  id            uuid pk   default gen_random_uuid()
  request_id    uuid  → overtime_request.id   ON DELETE CASCADE
  user_id       uuid  → users.id
  start_time    timestamp                  (real datetime, not Date)
  end_time      timestamp
  hours         decimal                    (computed end−start, stored server-side)
  reason        varchar nullable
  multiplier    decimal nullable           (NULL now; filled when Shift module lands)
```

- Written as a **raw SQL migration** under `backend/prisma/migrations/` (no `migrate dev` setup per CLAUDE.md), followed by `npx prisma generate`.
- Update `schema.prisma` to match (remove old models, add new, update `users` relations).
- FK column naming follows existing convention (`departement` spelling kept for consistency with `users`).

## Part C — Overtime API (`/api/overtime`)

All routes behind `authMiddleware`.

| Method | Path | Role | Purpose |
|--------|------|------|---------|
| POST | `/api/overtime` | Supervisor, Admin | Create request + lines (batch). Status = pending. Server computes `hours` per line from start/end. |
| GET | `/api/overtime` | both | List requests. Supervisor sees only own `submitted_by`; Admin sees all. Filters: date, status, dept. |
| GET | `/api/overtime/:id` | both | One request + its lines. Ownership check for supervisor; admin sees any. |
| PATCH | `/api/overtime/:id/approve` | **Admin only** | status → approved; set `approved_by`, `approved_at`. |
| PATCH | `/api/overtime/:id/reject` | **Admin only** | status → rejected; set `reject_reason`. |
| PUT | `/api/overtime/:id` | Supervisor (own), Admin | Edit lines. Only while status = pending; otherwise 409. |
| DELETE | `/api/overtime/:id` | Supervisor (own), Admin | Delete. Only while pending. |
| GET | `/api/overtime/export/excel` | Admin | Monthly XLSX for payroll: NIK, name, dept, date, hours, multiplier (blank). |

- **Hours calc:** `(end_time − start_time)` expressed in decimal hours, computed and stored server-side on create/update. No legal multiplier applied yet.
- New route file `backend/src/routes/overtime.js` (replacing the empty stub), mounted at `/api/overtime` in `index.js`.

## Part D — Overtime Frontend

Replace the `/overtime` placeholder page.

- **Supervisor view:** "New Overtime" button opens a drawer form (date, shift, multi-row worker entry with start/end/reason). Lists own requests with status badges (pending/approved/rejected).
- **Admin view:** all requests, a pending queue, approve/reject actions (reject opens a reason modal). Excel export button.
- Role is read from the JWT already decoded in `layout.js`.
- Reuse `Drawer.jsx`, `StatChip.jsx`, the `gas-dark` palette, and `fetchWithAuth`.
- No emojis; corporate tone; inline styles for dynamic colors — per CLAUDE.md.

## Testing

- **Backend:** No framework exists — add one (standard choice: Jest or node:test) as part of this work.
  - Auth middleware: valid token, invalid token, missing token, role guard 403.
  - Overtime: CRUD, supervisor ownership scoping (cannot see/edit others' requests), hours computation, approve/reject state transitions, edit/delete blocked when not pending.
- **Manual:** supervisor submit → admin approve → Excel export round-trip.

## Out of scope (later modules)

- Legal overtime multiplier calculation (depends on Shift module day-type data).
- Worker self-service accounts.
- Direct payroll API push (file export only for now).
- Shift scheduling, leave management, contracts/compliance.
