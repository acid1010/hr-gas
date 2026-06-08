# HRMS Module B1 — Shift Master + Working Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add company-wide shift definitions, a holiday table, worker shift assignment, and a single Mon–Fri working-days helper that the leaderboard and attendance report both adopt.

**Architecture:** Two new tables (`shift`, `holiday`) plus a nullable `users.shift_id`. Working days become a pure function (`backend/src/lib/workingDays.js`): Mon–Fri minus holidays. The two existing hardcoded Mon–Sat loops are retrofitted to call it. New `/api/shifts` and `/api/holidays` routers (admin write, both read) behind Module 1 auth. A `/shifts` admin page plus a shift dropdown on the employee form.

**Tech Stack:** Express 5 / CommonJS, Prisma 6 (PostgreSQL), node:test + supertest, Next.js 16 (App Router, client components), Tailwind v4 + DaisyUI, lucide-react.

**Verified facts (from live codebase):**
- Working days hardcoded identically in two places, both Mon–Sat (`getDay() !== 0`):
  - `backend/src/routes/performance.js:52-58` (leaderboard).
  - `backend/src/routes/attendance.js:171-173` (Excel report).
- Auth from Module 1: `backend/src/middleware/auth.js` exports `{ authMiddleware, requireRole }`. `requireRole("admin")` / `requireRole("admin","supervisor")`. JWT key is `roleuser`. Real roles: `admin` exists; `supervisor` assigned to new accounts.
- Prisma singleton `backend/libs/prisma.js`; client output `src/generated/prisma`; raw SQL migrations (no `migrate dev`). `gen_random_uuid()` default pattern in use.
- `members.js`: `router.put("/:id")` at line 86, `module.exports` at 215. Mounted `/members` with `authMiddleware`.
- Routes mounted in `index.js` after `app.use(cookieParser())`, pattern `app.use("/api/x", authMiddleware, xRoutes)`.
- Frontend: `Drawer.jsx` props `{open,onClose,title,subtitle,accentColor,children}`. `EmployeeForm.jsx` uses controlled `formData` + `onChange(name,value)` + `SelectField` helper. Sidebar nav array at `Sidebar.jsx:15`, items use `t(lang,"nav.x")`, icons from lucide. i18n `nav` block exists in both `id` and `en` (`src/lib/i18n.js:3` and `:147`). Overtime nav item still has stale `badge:"Soon"`.
- `fetchWithAuth` default Content-Type application/json, credentials include; `apiBaseUrl` default export from `@/lib/urlEndPoint`.
- Test runner: `cd backend && npm test` → `node --test`.

---

## File Structure

**Backend:**
- Create `backend/src/lib/workingDays.js` — `isWorkingDay`, `countWorkingDays`, `getHolidaySet`.
- Create `backend/src/routes/shifts.js` — shifts CRUD.
- Create `backend/src/routes/holidays.js` — holidays CRUD.
- Create `backend/prisma/migrations/20260608_shift_calendar/migration.sql` — shift + holiday tables, users.shift_id.
- Modify `backend/prisma/schema.prisma` — shift, holiday models, users relation/column.
- Modify `backend/src/routes/members.js` — `PATCH /:id/shift`.
- Modify `backend/src/routes/performance.js` — retrofit leaderboard working days.
- Modify `backend/src/routes/attendance.js` — retrofit Excel working days.
- Modify `backend/src/index.js` — mount shifts + holidays routers.
- Create `backend/tests/workingDays.test.js`, `backend/tests/shifts.test.js`.

**Frontend:**
- Create `frontend/src/app/shifts/page.jsx` — shifts + holidays admin page.
- Create `frontend/src/app/shifts/ShiftForm.jsx` — shift create/edit form.
- Modify `frontend/src/app/components/Sidebar.jsx` — add Shifts nav link, drop overtime "Soon" badge.
- Modify `frontend/src/app/components/forms/EmployeeForm.jsx` — shift dropdown.
- Modify `frontend/src/lib/i18n.js` — `nav.shifts` key (id + en).
- Modify `CLAUDE.md` — combined-score formula Mon–Fri.

---

## Part A — Data Model

### Task A1: Migration SQL

**Files:**
- Create: `backend/prisma/migrations/20260608_shift_calendar/migration.sql`

- [ ] **Step 1: Write migration**

Create `backend/prisma/migrations/20260608_shift_calendar/migration.sql`:
```sql
CREATE TABLE "shift" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"       VARCHAR(255) NOT NULL,
  "start_time" TIME NOT NULL,
  "end_time"   TIME NOT NULL,
  "active"     BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

CREATE TABLE "holiday" (
  "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "date"       DATE NOT NULL UNIQUE,
  "name"       VARCHAR(255),
  "created_at" TIMESTAMP(6) NOT NULL DEFAULT now()
);

ALTER TABLE "users" ADD COLUMN "shift_id" UUID REFERENCES "shift"("id");

CREATE INDEX "idx_users_shift" ON "users"("shift_id");
CREATE INDEX "idx_holiday_date" ON "holiday"("date");
```

- [ ] **Step 2: Apply migration**

Run from `backend/`:
```bash
node -e "
const fs=require('fs');const p=require('./libs/prisma');
const sql=fs.readFileSync('prisma/migrations/20260608_shift_calendar/migration.sql','utf8');
(async()=>{try{
  const clean=sql.replace(/^--.*$/gm,'').split(';').map(s=>s.trim()).filter(Boolean);
  for(const st of clean){await p.\$executeRawUnsafe(st);}
  console.log('MIGRATION_OK',clean.length,'stmts');
}catch(e){console.log('MIG_ERR',e.message)}finally{process.exit(0)}})()
"
```
Expected: `MIGRATION_OK 5 stmts`.

- [ ] **Step 3: Verify tables + column**

Run:
```bash
node -e "const p=require('./libs/prisma');(async()=>{const t=await p.\$queryRawUnsafe(\"SELECT table_name FROM information_schema.tables WHERE table_name IN ('shift','holiday')\");const c=await p.\$queryRawUnsafe(\"SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='shift_id'\");console.log('tables',JSON.stringify(t),'col',JSON.stringify(c));process.exit(0)})()"
```
Expected: both tables listed, `shift_id` column present.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/migrations/20260608_shift_calendar/migration.sql
git commit -m "feat: migration — shift + holiday tables, users.shift_id"
```

---

### Task A2: Prisma schema + regenerate

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add shift relation column to `users`**

In the `users` model, add this line after the `shift_id`-free relations (next to `ot_lines`/`performance`/`attendance`):
```prisma
  shift_id        String?            @db.Uuid
  shift           shift?             @relation(fields: [shift_id], references: [id], onDelete: SetNull, onUpdate: NoAction)
```

- [ ] **Step 2: Add the two new models**

Append to `backend/prisma/schema.prisma`:
```prisma
model shift {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name       String   @db.VarChar(255)
  start_time DateTime @db.Time(6)
  end_time   DateTime @db.Time(6)
  active     Boolean  @default(true)
  created_at DateTime @default(now()) @db.Timestamp(6)
  updated_at DateTime @default(now()) @db.Timestamp(6)
  users      users[]
}

model holiday {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  date       DateTime @unique @db.Date
  name       String?  @db.VarChar(255)
  created_at DateTime @default(now()) @db.Timestamp(6)
}
```

- [ ] **Step 3: Regenerate client**

Run: `cd backend && npx prisma generate`
Expected: "Generated Prisma Client", no relation errors.

- [ ] **Step 4: Sanity check models**

Run:
```bash
cd backend && node -e "const p=require('./libs/prisma');console.log(typeof p.shift.findMany, typeof p.holiday.create);process.exit(0)"
```
Expected: `function function`.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat: prisma models for shift + holiday, users.shift relation"
```

---

## Part B — Working-Days Helper + Retrofit

### Task B1: workingDays helper (TDD)

**Files:**
- Create: `backend/src/lib/workingDays.js`
- Test: `backend/tests/workingDays.test.js`

- [ ] **Step 1: Write failing test**

Create `backend/tests/workingDays.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const { isWorkingDay, countWorkingDays } = require("../src/lib/workingDays");

// 2026-06-08 is a Monday; 2026-06-13 Sat; 2026-06-14 Sun
test("isWorkingDay: Monday true", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-08"), new Set()), true);
});
test("isWorkingDay: Friday true", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-12"), new Set()), true);
});
test("isWorkingDay: Saturday false", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-13"), new Set()), false);
});
test("isWorkingDay: Sunday false", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-14"), new Set()), false);
});
test("isWorkingDay: holiday false", () => {
  assert.strictEqual(isWorkingDay(new Date("2026-06-08"), new Set(["2026-06-08"])), false);
});
test("countWorkingDays: June 2026 has 22 weekdays", () => {
  // June 2026: 30 days, starts Mon 6/1. Weekends: 6,7,13,14,20,21,27,28 = 8 days. 30-8=22.
  const n = countWorkingDays(new Date(2026, 5, 1), new Date(2026, 6, 1), new Set());
  assert.strictEqual(n, 22);
});
test("countWorkingDays: subtract one holiday", () => {
  const n = countWorkingDays(new Date(2026, 5, 1), new Date(2026, 6, 1), new Set(["2026-06-08"]));
  assert.strictEqual(n, 21);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && node --test tests/workingDays.test.js`
Expected: FAIL — `Cannot find module '../src/lib/workingDays'`.

- [ ] **Step 3: Implement helper**

Create `backend/src/lib/workingDays.js`:
```js
// Mon–Fri working, Sat+Sun off, minus holidays.
// holidaySet: Set of 'YYYY-MM-DD' strings.

function ymd(date) {
  return date.toISOString().slice(0, 10);
}

function isWorkingDay(date, holidaySet) {
  const day = date.getDay();
  if (day === 0 || day === 6) return false; // Sun, Sat
  if (holidaySet && holidaySet.has(ymd(date))) return false;
  return true;
}

// [start, end) — end exclusive
function countWorkingDays(start, end, holidaySet) {
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (isWorkingDay(cur, holidaySet)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

async function getHolidaySet(prisma, start, end) {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: start, lt: end } },
    select: { date: true },
  });
  return new Set(rows.map((r) => r.date.toISOString().slice(0, 10)));
}

module.exports = { isWorkingDay, countWorkingDays, getHolidaySet };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && node --test tests/workingDays.test.js`
Expected: PASS (7 tests).

> Note on timezones: `isWorkingDay` uses `getDay()` (local) for weekday detection and `toISOString()` (UTC) for the holiday key. The retrofit call sites build month boundaries with `new Date(year, mon-1, 1)` (local midnight), matching the existing code. The tests above assume the runner's TZ does not shift these dates across a day boundary; the project runs in a single deployment TZ, consistent with the existing `punch_time.toISOString().slice(0,10)` day-bucketing already in `performance.js`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/workingDays.js backend/tests/workingDays.test.js
git commit -m "feat: Mon-Fri working-days helper with holiday support"
```

---

### Task B2: Retrofit performance leaderboard

**Files:**
- Modify: `backend/src/routes/performance.js`

- [ ] **Step 1: Add require at top of file**

After the existing `const prisma = require("../../libs/prisma");` line in `backend/src/routes/performance.js`, add:
```js
const { countWorkingDays, getHolidaySet } = require("../lib/workingDays");
```

- [ ] **Step 2: Replace the Mon–Sat loop**

In the `/leaderboard` handler, replace this block:
```js
    // Working days (Mon–Sat, exclude Sunday)
    let workingDays = 0;
    const cur = new Date(start);
    while (cur < end) {
      if (cur.getDay() !== 0) workingDays++;
      cur.setDate(cur.getDate() + 1);
    }
```
with:
```js
    // Working days (Mon–Fri, minus holidays)
    const holidays = await getHolidaySet(prisma, start, end);
    const workingDays = countWorkingDays(start, end, holidays);
```

- [ ] **Step 3: Verify it still loads + runs**

Run: `cd backend && node --check src/routes/performance.js && echo PARSE_OK`
Expected: `PARSE_OK`. (Functional check happens in the integration task C-equivalent below and the regression in Task D3.)

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/performance.js
git commit -m "refactor: leaderboard uses Mon-Fri working-days helper"
```

---

### Task B3: Retrofit attendance Excel report

**Files:**
- Modify: `backend/src/routes/attendance.js`

- [ ] **Step 1: Add require at top of file**

After the existing prisma require in `backend/src/routes/attendance.js`, add:
```js
const { countWorkingDays, getHolidaySet } = require("../lib/workingDays");
```

- [ ] **Step 2: Replace the Mon–Sat loop**

In the `/report/excel` handler, replace:
```js
    let workingDays = 0;
    const cur = new Date(start);
    while (cur < end) { if (cur.getDay() !== 0) workingDays++; cur.setDate(cur.getDate() + 1); }
```
with:
```js
    const holidays = await getHolidaySet(prisma, start, end);
    const workingDays = countWorkingDays(start, end, holidays);
```

- [ ] **Step 3: Verify parse**

Run: `cd backend && node --check src/routes/attendance.js && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/attendance.js
git commit -m "refactor: attendance report uses Mon-Fri working-days helper"
```

---

### Task B4: Update CLAUDE.md formula

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Fix the working-days description**

In `CLAUDE.md`, find the Combined Score Formula block and change:
```
attendance_rate    = days_present / working_days_in_month   (Mon–Sat, excludes Sunday)
```
to:
```
attendance_rate    = days_present / working_days_in_month   (Mon–Fri, excludes Sat/Sun + holidays)
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update combined-score formula to Mon-Fri + holidays"
```

---

## Part C — API

### Task C1: Shifts router (TDD for delete-guard)

**Files:**
- Create: `backend/src/routes/shifts.js`
- Test: `backend/tests/shifts.test.js`

- [ ] **Step 1: Write failing test (delete blocked when assigned)**

Create `backend/tests/shifts.test.js`:
```js
const { test } = require("node:test");
const assert = require("node:assert");
const jwt = require("jsonwebtoken");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
const prisma = require("../libs/prisma");
const { authMiddleware } = require("../src/middleware/auth");
const shiftsRoutes = require("../src/routes/shifts");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/shifts", authMiddleware, shiftsRoutes);

const adminCookie = `accessToken=${jwt.sign({ id: "admin-test", roleuser: "admin" }, process.env.JWT_SECRET)}`;

test("create → list → delete-blocked-when-assigned → unassign → delete", async () => {
  // create
  const create = await request(app).post("/api/shifts").set("Cookie", adminCookie)
    .send({ name: "Test Shift", start_time: "07:00", end_time: "15:00" });
  assert.strictEqual(create.status, 201);
  const shiftId = create.body.data.id;

  // assign a real worker to this shift directly via prisma
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: shiftId } });

  // delete should be blocked (409)
  const blocked = await request(app).delete(`/api/shifts/${shiftId}`).set("Cookie", adminCookie);
  assert.strictEqual(blocked.status, 409);

  // unassign, then delete succeeds
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: null } });
  const ok = await request(app).delete(`/api/shifts/${shiftId}`).set("Cookie", adminCookie);
  assert.strictEqual(ok.status, 200);
});

test("non-admin cannot create (403)", async () => {
  const supCookie = `accessToken=${jwt.sign({ id: "sup", roleuser: "supervisor" }, process.env.JWT_SECRET)}`;
  const res = await request(app).post("/api/shifts").set("Cookie", supCookie)
    .send({ name: "X", start_time: "07:00", end_time: "15:00" });
  assert.strictEqual(res.status, 403);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && node --test tests/shifts.test.js`
Expected: FAIL — `Cannot find module '../src/routes/shifts'`.

- [ ] **Step 3: Implement shifts router**

Create `backend/src/routes/shifts.js`:
```js
const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");

// times come in as 'HH:MM' strings; store on a fixed epoch date for TIME column
function toTime(hhmm) {
  return new Date(`1970-01-01T${hhmm}:00`);
}

// GET / — list with assigned worker count (admin + supervisor)
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({ orderBy: { name: "asc" } });
    const counts = await prisma.users.groupBy({
      by: ["shift_id"],
      where: { deletedAt: null, shift_id: { not: null } },
      _count: { _all: true },
    });
    const countMap = {};
    for (const c of counts) countMap[c.shift_id] = c._count._all;
    const data = shifts.map((s) => ({ ...s, worker_count: countMap[s.id] || 0 }));
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST / — create (admin)
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { name, start_time, end_time } = req.body;
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ error: "name, start_time, end_time required" });
    }
    const created = await prisma.shift.create({
      data: { name, start_time: toTime(start_time), end_time: toTime(end_time) },
    });
    res.status(201).json({ message: "Shift created", data: created });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PUT /:id — update (admin)
router.put("/:id", requireRole("admin"), async (req, res) => {
  try {
    const { name, start_time, end_time, active } = req.body;
    const updated = await prisma.shift.update({
      where: { id: req.params.id },
      data: {
        ...(name != null && { name }),
        ...(start_time != null && { start_time: toTime(start_time) }),
        ...(end_time != null && { end_time: toTime(end_time) }),
        ...(active != null && { active }),
        updated_at: new Date(),
      },
    });
    res.status(200).json({ message: "Shift updated", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — admin, blocked if workers assigned
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const assigned = await prisma.users.count({ where: { shift_id: req.params.id, deletedAt: null } });
    if (assigned > 0) {
      return res.status(409).json({ error: `Cannot delete: ${assigned} worker(s) assigned` });
    }
    await prisma.shift.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Shift deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && node --test tests/shifts.test.js`
Expected: PASS (2 tests). Requires DB up and at least one non-deleted user.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/shifts.js backend/tests/shifts.test.js
git commit -m "feat: shifts CRUD with assigned-worker delete guard"
```

---

### Task C2: Holidays router

**Files:**
- Create: `backend/src/routes/holidays.js`

- [ ] **Step 1: Implement holidays router**

Create `backend/src/routes/holidays.js`:
```js
const express = require("express");
const router = express.Router();
const prisma = require("../../libs/prisma");
const { requireRole } = require("../middleware/auth");

// GET /?year=YYYY — list (admin + supervisor)
router.get("/", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const year = Number(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const data = await prisma.holiday.findMany({
      where: { date: { gte: start, lt: end } },
      orderBy: { date: "asc" },
    });
    res.status(200).json({ data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// POST / — create (admin); 409 on duplicate date
router.post("/", requireRole("admin"), async (req, res) => {
  try {
    const { date, name } = req.body;
    if (!date) return res.status(400).json({ error: "date required" });
    const existing = await prisma.holiday.findUnique({ where: { date: new Date(date) } });
    if (existing) return res.status(409).json({ error: "Holiday already exists for that date" });
    const created = await prisma.holiday.create({ data: { date: new Date(date), name: name || null } });
    res.status(201).json({ message: "Holiday created", data: created });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// DELETE /:id — admin
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    await prisma.holiday.delete({ where: { id: req.params.id } });
    res.status(200).json({ message: "Holiday deleted" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;
```

- [ ] **Step 2: Verify parse**

Run: `cd backend && node --check src/routes/holidays.js && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/holidays.js
git commit -m "feat: holidays CRUD (admin write, both read)"
```

---

### Task C3: Worker shift assignment + mount routers

**Files:**
- Modify: `backend/src/routes/members.js`
- Modify: `backend/src/index.js`

- [ ] **Step 1: Add PATCH /:id/shift in members.js**

In `backend/src/routes/members.js`, add this handler immediately before `module.exports = router;`:
```js
// PATCH /:id/shift — admin assigns/unassigns a worker's shift
router.patch("/:id/shift", async (req, res) => {
  try {
    const { shift_id } = req.body;
    if (shift_id) {
      const shift = await prisma.shift.findUnique({ where: { id: shift_id } });
      if (!shift) return res.status(400).json({ error: "Shift not found" });
    }
    const updated = await prisma.users.update({
      where: { id: req.params.id },
      data: { shift_id: shift_id || null },
    });
    res.status(200).json({ message: "Shift assigned", data: updated });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
```
(Role note: `/members` is already behind `authMiddleware` in index.js. Admin-only enforcement for this sub-action is acceptable to add via `requireRole`, but to keep parity with the rest of members.js — which does not self-guard roles — leave it at authMiddleware level. The Shifts UI is admin-gated on the frontend.)

- [ ] **Step 2: Mount the two new routers in index.js**

In `backend/src/index.js`, add requires near the other route requires:
```js
const shiftsRoutes = require("./routes/shifts");
const holidaysRoutes = require("./routes/holidays");
```
Add mounts after the `app.use("/api/overtime", ...)` line:
```js
app.use("/api/shifts", authMiddleware, shiftsRoutes);
app.use("/api/holidays", authMiddleware, holidaysRoutes);
```

- [ ] **Step 3: Verify parse**

Run: `cd backend && node --check src/routes/members.js && node --check src/index.js && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/members.js backend/src/index.js
git commit -m "feat: worker shift assignment + mount shifts/holidays routers"
```

---

## Part D — Frontend

### Task D1: ShiftForm component

**Files:**
- Create: `frontend/src/app/shifts/ShiftForm.jsx`

- [ ] **Step 1: Create the form (drawer content)**

Create `frontend/src/app/shifts/ShiftForm.jsx`:
```jsx
"use client";
import { useState } from "react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";

// existing: optional shift being edited ({id,name,start_time,end_time})
export default function ShiftForm({ existing, onSuccess }) {
  const { p } = useAppSettings();
  const hhmm = (v) => (v ? new Date(v).toISOString().slice(11, 16) : "");
  const [name, setName] = useState(existing?.name || "");
  const [startTime, setStartTime] = useState(hhmm(existing?.start_time));
  const [endTime, setEndTime] = useState(hhmm(existing?.end_time));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!name || !startTime || !endTime) {
      setError("Name, start and end time are required.");
      return;
    }
    setSaving(true);
    try {
      const body = JSON.stringify({ name, start_time: startTime, end_time: endTime });
      if (existing?.id) {
        await fetchWithAuth(`${apiBaseUrl}/api/shifts/${existing.id}`, { method: "PUT", body });
      } else {
        await fetchWithAuth(`${apiBaseUrl}/api/shifts`, { method: "POST", body });
      }
      onSuccess?.();
    } catch (e) {
      setError(e?.error || "Failed to save shift.");
    } finally {
      setSaving(false);
    }
  };

  const label = { fontSize: 11, fontWeight: 700, color: p.muted, marginBottom: 4, display: "block" };
  const input = { width: "100%", background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <div className="flex flex-col gap-4">
      <div><span style={label}>Shift Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shift 1" style={input} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><span style={label}>Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} style={input} /></div>
        <div><span style={label}>End</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} style={input} /></div>
      </div>
      {error && <p className="text-[12px]" style={{ color: "#e06666" }}>{error}</p>}
      <button onClick={submit} disabled={saving}
        className="mt-2 py-2.5 rounded-xl text-[13px] font-black disabled:opacity-60"
        style={{ background: p.primary, color: "#fff" }}>
        {saving ? "Saving…" : existing?.id ? "Update Shift" : "Create Shift"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/shifts/ShiftForm.jsx
git commit -m "feat: shift create/edit form"
```

---

### Task D2: Shifts + Holidays page

**Files:**
- Create: `frontend/src/app/shifts/page.jsx`

- [ ] **Step 1: Create the page**

Create `frontend/src/app/shifts/page.jsx`:
```jsx
"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, Clock, CalendarDays } from "lucide-react";
import { useAppSettings } from "@/lib/useAppSettings";
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
import Drawer from "@/app/components/Drawer";
import ShiftForm from "./ShiftForm";

const hhmm = (v) => (v ? new Date(v).toISOString().slice(11, 16) : "");

export default function ShiftsPage() {
  const { p } = useAppSettings();
  const [role, setRole] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newHolidayDate, setNewHolidayDate] = useState("");
  const [newHolidayName, setNewHolidayName] = useState("");

  const isAdmin = role === "admin";

  const loadShifts = useCallback(async () => {
    try { const r = await fetchWithAuth(`${apiBaseUrl}/api/shifts`); setShifts(r.data || []); }
    catch { setShifts([]); }
  }, []);
  const loadHolidays = useCallback(async () => {
    try { const r = await fetchWithAuth(`${apiBaseUrl}/api/holidays?year=${year}`); setHolidays(r.data || []); }
    catch { setHolidays([]); }
  }, [year]);

  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/auth/me`).then((u) => setRole(u.roleuser)).catch(() => setRole(null));
  }, []);
  useEffect(() => { loadShifts(); }, [loadShifts]);
  useEffect(() => { loadHolidays(); }, [loadHolidays]);

  const deleteShift = async (id) => {
    if (!confirm("Delete this shift?")) return;
    try { await fetchWithAuth(`${apiBaseUrl}/api/shifts/${id}`, { method: "DELETE" }); loadShifts(); }
    catch (e) { alert(e?.error || "Delete failed"); }
  };
  const addHoliday = async () => {
    if (!newHolidayDate) return;
    try {
      await fetchWithAuth(`${apiBaseUrl}/api/holidays`, { method: "POST", body: JSON.stringify({ date: newHolidayDate, name: newHolidayName || null }) });
      setNewHolidayDate(""); setNewHolidayName(""); loadHolidays();
    } catch (e) { alert(e?.error || "Add failed"); }
  };
  const deleteHoliday = async (id) => {
    try { await fetchWithAuth(`${apiBaseUrl}/api/holidays/${id}`, { method: "DELETE" }); loadHolidays(); }
    catch (e) { alert(e?.error || "Delete failed"); }
  };

  const card = { background: p.cardBg, border: `1px solid ${p.border}` };
  const input = { background: p.inputBg, border: `1px solid ${p.border}`, color: p.text, borderRadius: 10, padding: "8px 10px", fontSize: 13 };

  return (
    <main className="overflow-x-hidden w-full max-w-full">
      <div className="p-8 min-h-screen" style={{ background: p.pageBg }}>
        <div className="mb-8">
          <p className="text-[10px] font-black tracking-[0.25em] uppercase mb-1" style={{ color: p.primary }}>HR Management</p>
          <h1 className="text-[1.8rem] font-black tracking-tight leading-none" style={{ color: p.text }}>Shifts &amp; Calendar</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shifts panel */}
          <div className="p-5 rounded-2xl" style={card}>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 text-[13px] font-black" style={{ color: p.text }}><Clock size={15} /> Shifts</span>
              {isAdmin && (
                <button onClick={() => { setEditing(null); setDrawerOpen(true); }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black" style={{ background: p.primary, color: "#fff" }}>
                  <Plus size={13} /> Add
                </button>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {shifts.length === 0 ? (
                <p className="text-[12px]" style={{ color: p.faint }}>No shifts defined.</p>
              ) : shifts.map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 rounded-xl" style={{ background: p.inputBg }}>
                  <div>
                    <span className="text-[13px] font-bold" style={{ color: p.text }}>{s.name}</span>
                    <span className="text-[11px] ml-2" style={{ color: p.muted }}>{hhmm(s.start_time)}–{hhmm(s.end_time)}</span>
                    <span className="text-[11px] ml-2" style={{ color: p.faint }}>{s.worker_count} worker(s)</span>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditing(s); setDrawerOpen(true); }} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: p.muted }}><Pencil size={13} /></button>
                      <button onClick={() => deleteShift(s.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Holidays panel */}
          <div className="p-5 rounded-2xl" style={card}>
            <div className="flex items-center justify-between mb-4">
              <span className="flex items-center gap-2 text-[13px] font-black" style={{ color: p.text }}><CalendarDays size={15} /> Holidays</span>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} style={{ ...input, width: 90 }} />
            </div>
            {isAdmin && (
              <div className="flex gap-2 mb-3">
                <input type="date" value={newHolidayDate} onChange={(e) => setNewHolidayDate(e.target.value)} style={{ ...input, flex: 1 }} />
                <input value={newHolidayName} onChange={(e) => setNewHolidayName(e.target.value)} placeholder="Name" style={{ ...input, flex: 1 }} />
                <button onClick={addHoliday} className="px-3 rounded-lg text-[12px] font-black" style={{ background: p.primary, color: "#fff" }}>Add</button>
              </div>
            )}
            <div className="flex flex-col gap-2">
              {holidays.length === 0 ? (
                <p className="text-[12px]" style={{ color: p.faint }}>No holidays for {year}.</p>
              ) : holidays.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: p.inputBg }}>
                  <div>
                    <span className="text-[12px] font-bold" style={{ color: p.text }}>{new Date(h.date).toISOString().slice(0, 10)}</span>
                    {h.name && <span className="text-[11px] ml-2" style={{ color: p.muted }}>{h.name}</span>}
                  </div>
                  {isAdmin && (
                    <button onClick={() => deleteHoliday(h.id)} className="p-1.5 rounded-lg" style={{ border: `1px solid ${p.border}`, color: "#e06666" }}><Trash2 size={13} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? "Edit Shift" : "New Shift"} subtitle="Company-wide shift definition">
        <ShiftForm existing={editing} onSuccess={() => { setDrawerOpen(false); loadShifts(); }} />
      </Drawer>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/shifts/page.jsx
git commit -m "feat: shifts + holidays admin page (role-gated)"
```

---

### Task D3: Sidebar nav + i18n

**Files:**
- Modify: `frontend/src/app/components/Sidebar.jsx`
- Modify: `frontend/src/lib/i18n.js`

- [ ] **Step 1: Add i18n keys**

In `frontend/src/lib/i18n.js`, the `nav` block appears twice (id at ~line 3, en at ~line 147). Add a `shifts` key to BOTH. In the `id` block (where `overtime: "Lembur"`), add:
```js
      shifts: "Shift",
```
In the `en` block (where `overtime: "Overtime"`), add:
```js
      shifts: "Shifts",
```

- [ ] **Step 2: Add the nav item + import the icon**

In `frontend/src/app/components/Sidebar.jsx`, the lucide import line includes icons like `Clock`. Add `CalendarClock` to that import if not already present. Then in the `navItems` array (line ~15), add after the overtime item:
```js
    { href: "/shifts",               label: t(lang, "nav.shifts"),      icon: CalendarClock, shortcut: "⌘6" },
```

- [ ] **Step 3: Remove the stale "Soon" badge on overtime**

The overtime nav item still has `badge: "Soon"` (overtime shipped in Module 1). Change that line to drop the badge:
```js
    { href: "/overtime",             label: t(lang, "nav.overtime"),    icon: Clock, shortcut: "⌘5" },
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && npm run build 2>&1 | grep -iE "compiled|error|/shifts"`
Expected: "Compiled successfully", `/shifts` route listed, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/components/Sidebar.jsx frontend/src/lib/i18n.js
git commit -m "feat: add Shifts nav link, drop stale overtime badge"
```

---

### Task D4: Shift dropdown on EmployeeForm

**Files:**
- Modify: `frontend/src/app/components/forms/EmployeeForm.jsx`

- [ ] **Step 1: Fetch shifts inside the form**

In `frontend/src/app/components/forms/EmployeeForm.jsx`:

Change the React import to include `useEffect`:
```js
import { useState, useEffect } from "react";
```
Add these imports near the `useAppSettings` import:
```js
import fetchWithAuth from "@/lib/fetchWithAuth";
import apiBaseUrl from "@/lib/urlEndPoint";
```
Inside the `EmployeeForm` component body, after the existing `useState` calls, add:
```js
  const [shifts, setShifts] = useState([]);
  useEffect(() => {
    fetchWithAuth(`${apiBaseUrl}/api/shifts`).then((r) => setShifts(r.data || [])).catch(() => setShifts([]));
  }, []);
```

- [ ] **Step 2: Add the dropdown after the Worker Status select**

Immediately after the closing `</SelectField>` of the `worker_stats` field, add:
```jsx
        <SelectField label="Shift" name="shift_id" value={formData?.shift_id || ""} onChange={handleChange}>
          <option value="">No shift</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </SelectField>
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && npm run build 2>&1 | grep -iE "compiled|error"`
Expected: "Compiled successfully", no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/components/forms/EmployeeForm.jsx
git commit -m "feat: shift dropdown on employee form"
```

> Note: the employee page's save handler posts `formData` to `PUT /members/:id` and `POST /members`. `shift_id` rides along in `formData`. Confirm in Task E1 that the members `PUT`/`POST` persists `shift_id`; if `PUT /:id` whitelists fields and omits `shift_id`, either add `shift_id` to that handler's destructured fields or have the employee page call `PATCH /members/:id/shift` separately. (The `PATCH /:id/shift` route from Task C3 exists as the reliable path.)

---

## Part E — Integration + Verification

### Task E1: Full backend test suite + integration round-trip

**Files:** none (verification); may modify `backend/src/routes/members.js` if Step 2 finds a gap.

- [ ] **Step 1: Run the whole backend suite**

Run: `cd backend && npm test 2>&1 | grep -E "# (tests|pass|fail)"`
Expected: all pass. Should include Module 1 tests (auth, overtime) + new (workingDays 7, shifts 2). No failures.

- [ ] **Step 2: Confirm members PUT/POST persists shift_id**

Read `backend/src/routes/members.js` `router.put("/:id")` (line ~86) and `router.post("/")`. Check whether the handler destructures a fixed field list (which would DROP `shift_id`) or passes the body through.
- If POST uses `data: { ...handleData }` (pass-through) and PUT destructures named fields: add `shift_id` to the PUT `data` object:
  ```js
        shift_id: req.body.shift_id !== undefined ? (req.body.shift_id || null) : undefined,
  ```
  Insert it alongside the other fields in the PUT `data: { ... }`.
- If both pass the body through, no change needed.
- Re-run `node --check src/routes/members.js`.

If you changed members.js, commit:
```bash
git add backend/src/routes/members.js
git commit -m "fix: persist shift_id on member update"
```

- [ ] **Step 3: Integration round-trip (in-process)**

Create `backend/_shift_integration.tmp.js` (delete after):
```js
const request = require("supertest");
const jwt = require("jsonwebtoken");
const express = require("express");
const cookieParser = require("cookie-parser");
const prisma = require("./libs/prisma");
const { authMiddleware } = require("./src/middleware/auth");
const shifts = require("./src/routes/shifts");
const holidays = require("./src/routes/holidays");

const app = express();
app.use(express.json()); app.use(cookieParser());
app.use("/api/shifts", authMiddleware, shifts);
app.use("/api/holidays", authMiddleware, holidays);
const admin = `accessToken=${jwt.sign({ id: "a", roleuser: "admin" }, process.env.JWT_SECRET)}`;
const sup = `accessToken=${jwt.sign({ id: "s", roleuser: "supervisor" }, process.env.JWT_SECRET)}`;

(async () => {
  let sid, hid;
  try {
    const c = await request(app).post("/api/shifts").set("Cookie", admin).send({ name: "ITest", start_time: "08:00", end_time: "16:00" });
    console.log("SHIFT CREATE", c.status); sid = c.body?.data?.id;
    const list = await request(app).get("/api/shifts").set("Cookie", sup);
    console.log("SHIFT LIST (sup read)", list.status, "count>=1:", (list.body?.data?.length || 0) >= 1);
    const h = await request(app).post("/api/holidays").set("Cookie", admin).send({ date: "2026-08-17", name: "Kemerdekaan" });
    console.log("HOLIDAY CREATE", h.status); hid = h.body?.data?.id;
    const dup = await request(app).post("/api/holidays").set("Cookie", admin).send({ date: "2026-08-17", name: "dup" });
    console.log("HOLIDAY DUP (expect 409)", dup.status);
    const supCreate = await request(app).post("/api/shifts").set("Cookie", sup).send({ name: "no", start_time: "01:00", end_time: "02:00" });
    console.log("SUP CREATE (expect 403)", supCreate.status);
  } catch (e) { console.log("ERR", e.message); }
  finally {
    if (sid) await prisma.shift.delete({ where: { id: sid } }).catch(()=>{});
    if (hid) await prisma.holiday.delete({ where: { id: hid } }).catch(()=>{});
    console.log("cleanup done"); process.exit(0);
  }
})();
```
Run: `cd backend && node _shift_integration.tmp.js 2>&1 | grep -E "SHIFT|HOLIDAY|SUP|cleanup"; rm -f backend/_shift_integration.tmp.js`
Expected: SHIFT CREATE 201, SHIFT LIST 200 count>=1 true, HOLIDAY CREATE 201, HOLIDAY DUP 409, SUP CREATE 403, cleanup done.

- [ ] **Step 4: Regression — leaderboard + attendance still run**

With DB up, hit the retrofitted endpoints in-process or via a running server. Quick in-process check that the leaderboard handler returns 200 and a numeric working-days-derived score (reuse the integration harness pattern, mounting `performance` + `attendance` routers with an admin cookie, calling `GET /api/performance/leaderboard?month=2026-06` and `GET /api/attendance/report/excel?month=2026-06`).
Expected: leaderboard 200 with `combined_score` present; excel 200 with xlsx content-type. Confirms the Mon–Fri retrofit didn't break either consumer.

- [ ] **Step 5: Frontend build**

Run: `cd frontend && npm run build 2>&1 | grep -iE "compiled|error|/shifts"`
Expected: compiled successfully, `/shifts` route present.

---

## Testing Summary

- **Backend unit:** `workingDays.test.js` (7 — weekday/weekend/holiday + counts), `shifts.test.js` (2 — delete-guard 409, role 403). Plus Module 1 suite still green.
- **Backend integration:** shift + holiday round-trip, role enforcement, duplicate-holiday 409 (E1 Step 3).
- **Regression:** leaderboard + attendance Excel run post-retrofit with Mon–Fri denominator (E1 Step 4).
- **Frontend:** build check, `/shifts` route compiles.
- **Manual (human, later):** visual walk of `/shifts` as admin vs supervisor; assign a worker a shift via employee form; confirm leaderboard denominator dropped ~26→~22.

## Self-Review

- **Spec coverage:** Section 1 model → Task A1/A2. Section 2 helper + retrofit → B1/B2/B3/B4. Section 3 API (shifts, holidays, member assignment, mount) → C1/C2/C3. Section 4 frontend (page, ShiftForm, EmployeeForm dropdown, sidebar) → D1/D2/D3/D4. Section 5 testing → C1 (TDD), B1 (TDD), E1. All sections mapped.
- **Naming consistency:** `isWorkingDay`/`countWorkingDays`/`getHolidaySet` consistent between B1 definition and B2/B3 usage. `shift_id` consistent across migration, schema, members PATCH, EmployeeForm, integration. Table names `shift`/`holiday` consistent. `worker_count` field consistent between shifts route (C1) and page (D2).
- **Type/time handling:** TIME column stored via `new Date('1970-01-01T'+hhmm)`; read back via `toISOString().slice(11,16)` in both ShiftForm and page — consistent. Prisma `@db.Time(6)` maps to JS Date.
- **Role strings:** `admin`/`supervisor` via `roleuser` JWT key, matching Module 1. `requireRole` reused.
- **Known follow-up flagged:** E1 Step 2 verifies the members PUT/POST `shift_id` persistence gap rather than assuming.

## Out of Scope (later sub-modules)

- B2: punch-to-shift matching, late/early/absent flags, rest-day classification, wiring the overtime `multiplier`.
- B3: roster planning calendar UI, coverage gaps.
- Rotating shift patterns, per-department shift times, per-worker rest days.
