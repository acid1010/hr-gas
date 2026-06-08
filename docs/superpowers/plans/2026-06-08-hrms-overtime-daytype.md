# HRMS Module B2 — Overtime Day-Type Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classify each overtime request's date as workday/rest_day/holiday and surface that label in the overtime list, detail, Excel export, and frontend cards — computed live, never stored.

**Architecture:** One pure function `classifyDay(date, holidaySet)` added to the existing `workingDays.js`. The three overtime read handlers (`GET /`, `GET /:id`, `GET /export/excel`) fetch a holiday set for the relevant date span and attach `day_type`. No schema change, no migration. The `/overtime` page renders a day-type badge from the response.

**Tech Stack:** Express 5 / CommonJS, Prisma 6, node:test + supertest, xlsx, Next.js 16 (client components), lucide-react.

**Verified facts (from live codebase):**
- `backend/src/lib/workingDays.js` exports `{ isWorkingDay, countWorkingDays, getHolidaySet }` and has a private `ymd(date)` → `'YYYY-MM-DD'`. `getHolidaySet(prisma, start, end)` returns a `Set` of date strings (end exclusive).
- `backend/src/routes/overtime.js`:
  - requires at top: express, prisma, `{ requireRole }`, XLSX. Has `computeHours`, `isAdmin(req)`.
  - `GET /` (line 54): builds `data` via `prisma.overtime_request.findMany`, then `res.status(200).json({ data })`.
  - `GET /export/excel` (line 80): loads approved `requests` for `[start, end)` month window; builds `rows` (one per line) with keys `NIK, Nama, Departemen, Tanggal, "Jam Mulai", "Jam Selesai", "Total Jam", Pengali, Keterangan`; `ws["!cols"]` has 9 width entries; `json_to_sheet(rows)`.
  - `GET /:id` (line 129): `findUnique` → ownership check → `res.status(200).json({ data: r })`.
- Frontend `frontend/src/app/overtime/page.jsx`: `STATUS_COLOR` map at line 11; status badge at lines 118-121 inside a `<div className="flex items-center gap-2">` (line 117). `r.day_type` will be present on each request after the backend change.
- Test runner: `cd backend && npm test` → `node --test`. Existing `tests/workingDays.test.js` from B1.

---

## File Structure

- Modify `backend/src/lib/workingDays.js` — add + export `classifyDay`.
- Modify `backend/tests/workingDays.test.js` — add `classifyDay` cases.
- Modify `backend/src/routes/overtime.js` — attach `day_type` in list, detail, export.
- Create `backend/tests/overtime.daytype.test.js` — integration for list + export day_type.
- Modify `frontend/src/app/overtime/page.jsx` — day-type badge.

---

## Task 1: classifyDay helper (TDD)

**Files:**
- Modify: `backend/src/lib/workingDays.js`
- Modify: `backend/tests/workingDays.test.js`

- [ ] **Step 1: Add failing tests**

Append to `backend/tests/workingDays.test.js`:
```js
const { classifyDay } = require("../src/lib/workingDays");

test("classifyDay: weekday → workday", () => {
  assert.strictEqual(classifyDay(new Date("2026-06-08"), new Set()), "workday"); // Mon
});
test("classifyDay: Saturday → rest_day", () => {
  assert.strictEqual(classifyDay(new Date("2026-06-13"), new Set()), "rest_day");
});
test("classifyDay: Sunday → rest_day", () => {
  assert.strictEqual(classifyDay(new Date("2026-06-14"), new Set()), "rest_day");
});
test("classifyDay: date in holiday set → holiday", () => {
  assert.strictEqual(classifyDay(new Date("2026-08-17"), new Set(["2026-08-17"])), "holiday");
});
test("classifyDay: holiday on a weekday wins over workday", () => {
  // 2026-08-17 is a Monday
  assert.strictEqual(classifyDay(new Date("2026-08-17"), new Set(["2026-08-17"])), "holiday");
});
test("classifyDay: holiday on a weekend still holiday", () => {
  // 2026-06-13 is a Saturday
  assert.strictEqual(classifyDay(new Date("2026-06-13"), new Set(["2026-06-13"])), "holiday");
});
```

- [ ] **Step 2: Run to verify fail**

Run: `cd backend && node --test tests/workingDays.test.js`
Expected: FAIL — `classifyDay is not a function` (6 new cases error).

- [ ] **Step 3: Implement classifyDay**

In `backend/src/lib/workingDays.js`, add the function (after `isWorkingDay`, reusing the existing `ymd`):
```js
// 'workday' | 'rest_day' | 'holiday' — holiday takes precedence
function classifyDay(date, holidaySet) {
  if (holidaySet && holidaySet.has(ymd(date))) return "holiday";
  const day = date.getDay();
  if (day === 0 || day === 6) return "rest_day";
  return "workday";
}
```
Update the exports line to include it:
```js
module.exports = { isWorkingDay, countWorkingDays, getHolidaySet, classifyDay };
```

- [ ] **Step 4: Run to verify pass**

Run: `cd backend && node --test tests/workingDays.test.js`
Expected: PASS (original 7 + 6 new = 13).

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/workingDays.js backend/tests/workingDays.test.js
git commit -m "feat: classifyDay helper (workday/rest_day/holiday)"
```

---

## Task 2: Attach day_type in overtime list + detail

**Files:**
- Modify: `backend/src/routes/overtime.js`

- [ ] **Step 1: Import classifyDay + getHolidaySet**

In `backend/src/routes/overtime.js`, change the workingDays-less requires by adding after the `XLSX` require:
```js
const { classifyDay, getHolidaySet } = require("../lib/workingDays");
```

- [ ] **Step 2: Attach day_type in GET / (list)**

In the `GET /` handler, replace:
```js
    const data = await prisma.overtime_request.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    res.status(200).json({ data });
```
with:
```js
    const requests = await prisma.overtime_request.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        lines: { include: { worker: { select: { name: true, nik: true } } } },
        submitter: { select: { name: true } },
        approver: { select: { name: true } },
      },
    });
    let data = requests;
    if (requests.length > 0) {
      const times = requests.map((r) => new Date(r.date).getTime());
      const min = new Date(Math.min(...times));
      const max = new Date(Math.max(...times));
      const spanEnd = new Date(max);
      spanEnd.setDate(spanEnd.getDate() + 1); // inclusive of max date
      const holidays = await getHolidaySet(prisma, min, spanEnd);
      data = requests.map((r) => ({ ...r, day_type: classifyDay(new Date(r.date), holidays) }));
    }
    res.status(200).json({ data });
```

- [ ] **Step 3: Attach day_type in GET /:id (detail)**

In the `GET /:id` handler, replace:
```js
    if (!isAdmin(req) && r.submitted_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    res.status(200).json({ data: r });
```
with:
```js
    if (!isAdmin(req) && r.submitted_by !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const d = new Date(r.date);
    const dEnd = new Date(d);
    dEnd.setDate(dEnd.getDate() + 1);
    const holidays = await getHolidaySet(prisma, d, dEnd);
    res.status(200).json({ data: { ...r, day_type: classifyDay(d, holidays) } });
```

- [ ] **Step 4: Verify parse**

Run: `cd backend && node --check src/routes/overtime.js && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/overtime.js
git commit -m "feat: attach day_type to overtime list + detail responses"
```

---

## Task 3: Add Tipe Hari column to Excel export

**Files:**
- Modify: `backend/src/routes/overtime.js`

- [ ] **Step 1: Compute holidays for the month + add column**

In the `GET /export/excel` handler, after the `requests` query and before `const rows = [];`, add:
```js
    const holidays = await getHolidaySet(prisma, start, end);
```
Then in the `rows.push({ ... })` object, add a `"Tipe Hari"` entry right after `Tanggal`:
```js
          Tanggal: new Date(r.date).toISOString().slice(0, 10),
          "Tipe Hari": classifyDay(new Date(r.date), holidays),
```

- [ ] **Step 2: Widen the column layout**

The `ws["!cols"]` array has 9 entries for 9 columns; we added a 10th column. Update it to 10 entries:
```js
    ws["!cols"] = [
      { wch: 12 }, { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 12 },
      { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 30 },
    ];
```

- [ ] **Step 3: Verify parse**

Run: `cd backend && node --check src/routes/overtime.js && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/overtime.js
git commit -m "feat: add Tipe Hari (day-type) column to overtime Excel export"
```

---

## Task 4: Integration test (list + export day_type)

**Files:**
- Create: `backend/tests/overtime.daytype.test.js`

- [ ] **Step 1: Write the integration test**

Create `backend/tests/overtime.daytype.test.js`:
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
const overtimeRoutes = require("../src/routes/overtime");

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use("/api/overtime", authMiddleware, overtimeRoutes);
const admin = `accessToken=${jwt.sign({ id: "a", roleuser: "admin" }, process.env.JWT_SECRET)}`;

test("list returns day_type rest_day for a Saturday OT", async () => {
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  const create = await request(app).post("/api/overtime").set("Cookie", admin).send({
    departement: "Production", date: "2026-06-13", // Saturday
    lines: [{ user_id: worker.id, start_time: "2026-06-13T18:00:00", end_time: "2026-06-13T20:00:00" }],
  });
  const id = create.body.data.id;
  try {
    const list = await request(app).get("/api/overtime?status=pending").set("Cookie", admin);
    const found = list.body.data.find((r) => r.id === id);
    assert.strictEqual(found.day_type, "rest_day");

    const detail = await request(app).get(`/api/overtime/${id}`).set("Cookie", admin);
    assert.strictEqual(detail.body.data.day_type, "rest_day");
  } finally {
    await prisma.overtime_request.delete({ where: { id } }).catch(() => {});
  }
});

test("holiday on the OT date classifies as holiday", async () => {
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true } });
  // 2026-06-10 is a Wednesday (workday) unless a holiday exists
  const holiday = await prisma.holiday.create({ data: { date: new Date("2026-06-10"), name: "TestHol" } });
  const create = await request(app).post("/api/overtime").set("Cookie", admin).send({
    departement: "Production", date: "2026-06-10",
    lines: [{ user_id: worker.id, start_time: "2026-06-10T18:00:00", end_time: "2026-06-10T20:00:00" }],
  });
  const id = create.body.data.id;
  try {
    const detail = await request(app).get(`/api/overtime/${id}`).set("Cookie", admin);
    assert.strictEqual(detail.body.data.day_type, "holiday");
  } finally {
    await prisma.overtime_request.delete({ where: { id } }).catch(() => {});
    await prisma.holiday.delete({ where: { id: holiday.id } }).catch(() => {});
  }
});
```

- [ ] **Step 2: Run the test**

Run: `cd backend && node --test tests/overtime.daytype.test.js`
Expected: PASS (2 tests). Requires DB up + at least one non-deleted user.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/overtime.daytype.test.js
git commit -m "test: overtime day_type integration (rest_day + holiday)"
```

---

## Task 5: Day-type badge on overtime cards

**Files:**
- Modify: `frontend/src/app/overtime/page.jsx`

- [ ] **Step 1: Add a day-type color/label map**

In `frontend/src/app/overtime/page.jsx`, just after the `STATUS_COLOR` definition (line 11), add:
```jsx
const DAYTYPE = {
  workday:  { label: "Workday",  color: "#6b7a99" },
  rest_day: { label: "Rest Day", color: "#d6a23e" },
  holiday:  { label: "Holiday",  color: "#e06666" },
};
```

- [ ] **Step 2: Render the badge before the status badge**

In the request card, inside the `<div className="flex items-center gap-2">` (line 117), add this BEFORE the status `<span>` (line 118):
```jsx
                    {r.day_type && DAYTYPE[r.day_type] && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide"
                        style={{ background: `${DAYTYPE[r.day_type].color}22`, color: DAYTYPE[r.day_type].color }}>
                        {DAYTYPE[r.day_type].label}
                      </span>
                    )}
```

- [ ] **Step 3: Build check**

Run: `cd frontend && npm run build 2>&1 | grep -iE "compiled|error"`
Expected: "Compiled successfully", no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/overtime/page.jsx
git commit -m "feat: day-type badge on overtime cards"
```

---

## Testing Summary

- **Unit:** `classifyDay` — weekday/Sat/Sun/holiday/precedence (6 cases, Task 1).
- **Integration:** list + detail return `rest_day` for a Saturday OT; holiday on the date classifies as `holiday` (Task 4).
- **Regression:** full `npm test` should remain green (Module 1 + B1 + B2). Run after Task 4.
- **Frontend:** build check (Task 5); manual visual badge check on `/overtime` later.

Run all backend tests: `cd backend && npm test`

## Self-Review

- **Spec coverage:** §1 classifyDay → Task 1. §2/§3 compute-on-read in list/detail/export → Tasks 2 + 3. §4 frontend badge → Task 5. Testing → Tasks 1 (unit) + 4 (integration). All mapped.
- **No storage / no migration:** confirmed — no schema or migration task; `multiplier` untouched (stays NULL).
- **Naming consistency:** `classifyDay`, `day_type`, return values `workday`/`rest_day`/`holiday`, Excel column `"Tipe Hari"`, frontend `DAYTYPE` map keyed by the same three values — consistent across all tasks.
- **Span correctness:** list uses min..max+1 day (inclusive of latest date) for `getHolidaySet` (end-exclusive); detail uses date..date+1; export reuses the month `start`/`end`. Consistent with `getHolidaySet` semantics from B1.

## Out of Scope

- Numeric overtime multiplier / pay computation (payroll prices off the label).
- Late / early-leave / absent flagging.
- Roster planning UI (B3). Punch-to-shift matching.
