# HRMS Module B1 — Shift Master + Working Calendar

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan

## Context

Second module in the HRMS roadmap (Overtime → **Shift** → Leave → Contracts). Module 1 (auth + overtime) shipped to `main`.

The full Shift effort is decomposed into three sub-modules, each its own spec → plan → build cycle:
- **B1 (this spec):** Shift master data + working calendar. Foundation.
- **B2 (later):** Attendance interpretation — match ZKTeco punches to scheduled shift, flag late/absent, classify rest-day vs workday. Feeds the deferred overtime `multiplier`.
- **B3 (later):** Roster planning calendar UI.

### Constraints established during brainstorming

- 500+ workers, multi-shift factory. Workers have no app accounts (supervisors act for them) — per Module 1.
- **Fixed company-wide shifts** (Shift 1/2/3 + off), same times for everyone. A worker is assigned one shift; rarely changes. No rotating patterns in B1.
- **Working week is Mon–Fri.** Saturday and Sunday are rest days. National holidays are the only other non-working days, stored in a holiday table.
- Single source of truth for working days, retrofitted into the two existing consumers.

### Current-state findings (verified against code)

- Working days are hardcoded **identically in two places**, both counting Mon–Sat (exclude Sunday only):
  - `backend/src/routes/performance.js:56` — `if (cur.getDay() !== 0) workingDays++` (leaderboard).
  - `backend/src/routes/attendance.js:173` — `while (cur < end) { if (cur.getDay() !== 0) workingDays++; ... }` (Excel report).
- `CLAUDE.md` documents the combined-score formula as "Mon–Sat, excludes Sunday".
- Auth middleware + role guard (`requireRole`) exist from Module 1 at `backend/src/middleware/auth.js`. Frontend reads role from `GET /auth/me`.
- Prisma singleton at `backend/libs/prisma.js`; client output `src/generated/prisma`. No `migrate dev` — raw SQL migrations.

### Behavioral change (intended, not a regression)

Switching Mon–Sat → Mon–Fri drops the monthly working-day denominator (~26 → ~22). This changes `attendance_rate = days_present / working_days` and therefore `combined_score` on the leaderboard and the attendance Excel report. This is the correct new behavior and must be applied consistently in both consumers so they never disagree.

## Section 1 — Data Model

Two new tables; one new column on `users`.

```
shift (company-wide shift definitions)
  id          uuid pk   default gen_random_uuid()
  name        varchar(255) NOT NULL          -- 'Shift 1'
  start_time  time NOT NULL                  -- '07:00'
  end_time    time NOT NULL                  -- '15:00'
  active      boolean NOT NULL default true
  created_at  timestamp default now()
  updated_at  timestamp default now()

holiday (calendar exceptions — only non-weekend off days)
  id    uuid pk   default gen_random_uuid()
  date  date NOT NULL UNIQUE
  name  varchar(255)                         -- 'Idul Fitri'
  created_at timestamp default now()

users  (add column)
  shift_id  uuid NULL REFERENCES shift(id)   -- worker's assigned shift; nullable
```

The working-day rule is a **pure function**, not a per-day table: a date is a working day if it is Mon–Fri AND not in the holiday set. Weekends are computed; holidays are the only stored exceptions.

## Section 2 — Shared Working-Days Helper

New file `backend/src/lib/workingDays.js`:

```js
// Mon–Fri working, Sat+Sun off, minus holidays.
function isWorkingDay(date, holidaySet)            // → boolean
function countWorkingDays(start, end, holidaySet)  // → int  (end exclusive)
async function getHolidaySet(prisma, start, end)   // → Set<'YYYY-MM-DD'>
```

- `holidaySet` is a `Set` of `'YYYY-MM-DD'` strings.
- `isWorkingDay`: returns false when `getDay()` is 0 (Sun) or 6 (Sat), or when the date string is in `holidaySet`; true otherwise.
- `countWorkingDays`: iterate `[start, end)` by day, count `isWorkingDay`.
- `getHolidaySet`: query `holiday` where `date >= start AND date < end`, return the set of date strings.

**Retrofit both consumers** to use this helper:
- `performance.js` leaderboard — replace the `getDay() !== 0` loop with `getHolidaySet` + `countWorkingDays(start, end, holidays)`.
- `attendance.js` Excel report — same replacement.

**Docs:** update the `CLAUDE.md` combined-score section from "Mon–Sat, excludes Sunday" to "Mon–Fri, excludes Sat/Sun + holidays".

## Section 3 — API

All routes behind `authMiddleware` (Module 1). Role guard via `requireRole`.

**Shifts — `backend/src/routes/shifts.js`, mounted `/api/shifts`:**

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/api/shifts` | admin + supervisor | list, include assigned worker count |
| POST | `/api/shifts` | admin | create (name, start_time, end_time) |
| PUT | `/api/shifts/:id` | admin | update |
| DELETE | `/api/shifts/:id` | admin | block with 409 if any user has this `shift_id` |

**Holidays — `backend/src/routes/holidays.js`, mounted `/api/holidays`:**

| Method | Path | Role | Notes |
|--------|------|------|-------|
| GET | `/api/holidays?year=YYYY` | admin + supervisor | list for year (default current year) |
| POST | `/api/holidays` | admin | create (date, name); 409 on duplicate date |
| DELETE | `/api/holidays/:id` | admin | |

**Worker shift assignment — extend `backend/src/routes/members.js`:**

- `PATCH /members/:id/shift` (admin) — body `{ shift_id }` (nullable to unassign). Validates the shift exists.

Both new routers mounted in `index.js` behind `authMiddleware`, following the Module 1 pattern.

## Section 4 — Frontend

New page `frontend/src/app/shifts/page.jsx` (admin write, supervisor read-only; role from `GET /auth/me`):

- **Shifts panel** — shift cards (name, start–end, worker count). Admin: add/edit/delete via `Drawer` + a `ShiftForm` component.
- **Holidays panel** — year picker, holiday list, admin add/delete via inline form or small drawer.
- Reuse `Drawer.jsx`, the `gas-dark` palette from `useAppSettings`, `fetchWithAuth`, `apiBaseUrl`. No emojis; inline styles for dynamic colors — per CLAUDE.md.

Supporting changes:
- `frontend/src/app/components/forms/EmployeeForm.jsx` — add a shift dropdown populated from `GET /api/shifts`; submit through the existing employee update (or `PATCH /members/:id/shift`).
- Sidebar — add a "Shifts" nav link.
- `/employee` table — show the worker's assigned shift name (low-cost column).

New form file: `frontend/src/app/shifts/ShiftForm.jsx`.

## Section 5 — Testing

- **Unit (`workingDays.js`):** Mon–Fri → true; Sat/Sun → false; a holiday date → false; `countWorkingDays` over a known month returns the expected count (~22, verified against a hand-counted month).
- **Unit/integration (shifts):** `DELETE` blocked with 409 when a worker is assigned; succeeds when none assigned.
- **Integration:** create shift → assign worker via `PATCH /members/:id/shift` → `GET /api/shifts` shows count 1; leaderboard uses the new Mon–Fri denominator.
- **Regression:** performance leaderboard and attendance Excel still run after the retrofit (no thrown errors, denominator reflects Mon–Fri).

## Out of Scope (later sub-modules)

- B2: punch-to-shift matching, late/early/absent flags, rest-day classification, wiring the overtime `multiplier`.
- B3: roster planning calendar UI, coverage gaps.
- Rotating shift patterns, per-department shift times, per-worker rest days.
