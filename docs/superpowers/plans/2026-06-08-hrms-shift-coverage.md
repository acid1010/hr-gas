# HRMS Module B3 — Shift Coverage Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A read-only Shifts × Departments coverage matrix — one aggregating endpoint plus a Coverage tab on the existing `/shifts` page — so admins/supervisors can spot understaffed shift/department combos.

**Architecture:** `GET /api/shifts/coverage` fetches all active workers once and groups them by `shift_id × departement` in JS, returning shifts, departments, a nested matrix of worker `{id,name,nik}` arrays, and per-shift totals. The `/shifts` page gains a tab switcher (Shifts | Holidays | Coverage); the Coverage tab renders the matrix with count cells (color-scaled), and clicking a cell opens a Drawer listing those workers. No schema change.

**Tech Stack:** Express 5 / CommonJS, Prisma 6, node:test + supertest, Next.js 16 (client components), lucide-react.

**Verified facts (from live codebase):**
- `backend/src/routes/shifts.js`: requires express, prisma, `{ requireRole }`. Routes: `GET /` (12), `POST /` (31), `PUT /:id` (48), `DELETE /:id` (69), `module.exports = router` (83). **No `GET /:id`** — so `GET /coverage` has no route-ordering conflict; place it anywhere before `module.exports`.
- `users` columns: `id, name, nik (Decimal?), departement (String?), shift_id (Uuid?), deletedAt`. Active = `deletedAt: null`.
- `shift`: `id, name, start_time, end_time, active`.
- `/api/shifts` mounted behind `authMiddleware` in `index.js` (B1).
- Frontend `frontend/src/app/shifts/page.jsx` (139 lines): `useAppSettings` palette `p`; helpers `card`/`input` style objects; `hhmm()`; state for shifts/holidays/year/drawer/editing; `Drawer` already imported; main JSX starts line 62, the Shifts+Holidays content is a `grid grid-cols-1 lg:grid-cols-2` at line 69. Header h1 "Shifts & Calendar" at line 66.
- `fetchWithAuth` default export from `@/lib/fetchWithAuth`; `apiBaseUrl` from `@/lib/urlEndPoint`. Test runner `cd backend && npm test`.

---

## File Structure

- Modify `backend/src/routes/shifts.js` — add `GET /coverage`.
- Create `backend/tests/shifts.coverage.test.js` — integration.
- Modify `frontend/src/app/shifts/page.jsx` — tab switcher + Coverage matrix + cell drawer.

---

## Task 1: Coverage endpoint

**Files:**
- Modify: `backend/src/routes/shifts.js`

- [ ] **Step 1: Add GET /coverage before `module.exports`**

In `backend/src/routes/shifts.js`, add this handler immediately before `module.exports = router;`:
```js
// GET /coverage — Shifts × Departments worker matrix (admin + supervisor)
router.get("/coverage", requireRole("admin", "supervisor"), async (req, res) => {
  try {
    const shifts = await prisma.shift.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, start_time: true, end_time: true },
    });
    const users = await prisma.users.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nik: true, departement: true, shift_id: true },
    });

    const DEPT_FALLBACK = "—";
    const deptSet = new Set();
    const matrix = {};   // bucket -> dept -> [ {id,name,nik} ]
    const totals = {};   // bucket -> count

    const bucketFor = (u) => (u.shift_id ? u.shift_id : "unassigned");

    for (const u of users) {
      const bucket = bucketFor(u);
      const dept = u.departement && u.departement.trim() ? u.departement : DEPT_FALLBACK;
      deptSet.add(dept);
      if (!matrix[bucket]) matrix[bucket] = {};
      if (!matrix[bucket][dept]) matrix[bucket][dept] = [];
      matrix[bucket][dept].push({ id: u.id, name: u.name, nik: u.nik ? String(u.nik) : null });
      totals[bucket] = (totals[bucket] || 0) + 1;
    }

    const departments = [...deptSet].sort((a, b) => {
      if (a === DEPT_FALLBACK) return 1;   // push "—" to the end
      if (b === DEPT_FALLBACK) return -1;
      return a.localeCompare(b);
    });

    res.status(200).json({ shifts, departments, matrix, totals });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
```

- [ ] **Step 2: Verify parse**

Run: `cd backend && node --check src/routes/shifts.js && echo PARSE_OK`
Expected: `PARSE_OK`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/shifts.js
git commit -m "feat: shift coverage matrix endpoint"
```

---

## Task 2: Coverage integration test

**Files:**
- Create: `backend/tests/shifts.coverage.test.js`

- [ ] **Step 1: Write the test**

Create `backend/tests/shifts.coverage.test.js`:
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

const adminCookie = `accessToken=${jwt.sign({ id: "admin-cov", roleuser: "admin" }, process.env.JWT_SECRET)}`;
const supCookie = `accessToken=${jwt.sign({ id: "sup-cov", roleuser: "supervisor" }, process.env.JWT_SECRET)}`;

test("coverage: assigned worker appears in matrix[shift][dept]; supervisor can read", async () => {
  // pick a real worker, remember its original shift to restore
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true, departement: true, shift_id: true } });
  const created = await request(app).post("/api/shifts").set("Cookie", adminCookie)
    .send({ name: "CovTest", start_time: "07:00", end_time: "15:00" });
  const shiftId = created.body.data.id;
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: shiftId } });

  try {
    const res = await request(app).get("/api/shifts/coverage").set("Cookie", supCookie); // supervisor read
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.shifts));
    assert.ok(Array.isArray(res.body.departments));

    const dept = (worker.departement && worker.departement.trim()) ? worker.departement : "—";
    const bucket = res.body.matrix[shiftId];
    assert.ok(bucket, "shift bucket present in matrix");
    const names = (bucket[dept] || []).map((w) => w.id);
    assert.ok(names.includes(worker.id), "worker listed under its shift × dept");
    assert.ok(res.body.totals[shiftId] >= 1, "shift total counts the worker");
    assert.ok(res.body.departments.includes(dept), "departments includes worker dept");
  } finally {
    await prisma.users.update({ where: { id: worker.id }, data: { shift_id: worker.shift_id } });
    await prisma.shift.delete({ where: { id: shiftId } }).catch(() => {});
  }
});

test("coverage: an unassigned worker appears under 'unassigned'", async () => {
  // ensure at least one unassigned worker exists for the duration of the check
  const worker = await prisma.users.findFirst({ where: { deletedAt: null }, select: { id: true, shift_id: true } });
  await prisma.users.update({ where: { id: worker.id }, data: { shift_id: null } });
  try {
    const res = await request(app).get("/api/shifts/coverage").set("Cookie", adminCookie);
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.matrix.unassigned, "unassigned bucket present");
    assert.ok(res.body.totals.unassigned >= 1, "unassigned total >= 1");
  } finally {
    await prisma.users.update({ where: { id: worker.id }, data: { shift_id: worker.shift_id } });
  }
});

test("coverage: no auth → 401", async () => {
  const res = await request(app).get("/api/shifts/coverage");
  assert.strictEqual(res.status, 401);
});
```

- [ ] **Step 2: Run the test**

Run: `cd backend && node --test tests/shifts.coverage.test.js`
Expected: PASS (3 tests). Requires DB up + at least one non-deleted user.

- [ ] **Step 3: Commit**

```bash
git add backend/tests/shifts.coverage.test.js
git commit -m "test: shift coverage endpoint integration"
```

---

## Task 3: Coverage tab on the shifts page

**Files:**
- Modify: `frontend/src/app/shifts/page.jsx`

This task adds a tab switcher and a Coverage panel. The existing Shifts + Holidays grid stays; it just renders only when its tab is active.

- [ ] **Step 1: Add icon import + coverage state**

In `frontend/src/app/shifts/page.jsx`, add `Grid3x3` and `Users` to the existing `lucide-react` import (keep the existing names; append these two). Then, with the other `useState` declarations near the top of the component, add:
```jsx
  const [tab, setTab] = useState("shifts"); // 'shifts' | 'holidays' | 'coverage'
  const [coverage, setCoverage] = useState(null);
  const [cellWorkers, setCellWorkers] = useState(null); // { title, workers: [] } | null

  const loadCoverage = useCallback(async () => {
    try { const r = await fetchWithAuth(`${apiBaseUrl}/api/shifts/coverage`); setCoverage(r); }
    catch { setCoverage(null); }
  }, []);
  useEffect(() => { if (tab === "coverage") loadCoverage(); }, [tab, loadCoverage]);
```
(`useCallback` and `useEffect` are already imported in this file from B1. If not present in the React import, add them.)

- [ ] **Step 2: Add the tab switcher under the header**

Immediately after the header `</div>` (the block containing the "Shifts & Calendar" h1, around line 67), insert:
```jsx
        <div className="flex gap-2 mb-6">
          {[
            { k: "shifts", label: "Shifts" },
            { k: "holidays", label: "Holidays" },
            { k: "coverage", label: "Coverage" },
          ].map((t) => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{
                background: tab === t.k ? p.primary : p.cardBg,
                color: tab === t.k ? "#fff" : p.muted,
                border: `1px solid ${p.border}`,
              }}>
              {t.label}
            </button>
          ))}
        </div>
```

- [ ] **Step 3: Gate the existing Shifts/Holidays grid behind the tabs**

The existing content is a single `<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">` wrapping the Shifts panel and the Holidays panel. We want the Shifts panel visible only on the `shifts` tab and the Holidays panel only on the `holidays` tab. Wrap each of the two panel `<div className="p-5 rounded-2xl" style={card}>` blocks in a conditional:
- Before the Shifts panel block, change its opening to:
  ```jsx
          {tab === "shifts" && (
          <div className="p-5 rounded-2xl" style={card}>
  ```
  and add a closing `)}` after that panel's closing `</div>`.
- Before the Holidays panel block, change its opening to:
  ```jsx
          {tab === "holidays" && (
          <div className="p-5 rounded-2xl" style={card}>
  ```
  and add a closing `)}` after that panel's closing `</div>`.

(The outer `grid grid-cols-1 lg:grid-cols-2` wrapper can stay; with one panel hidden the other simply occupies the row. Leave it as-is.)

- [ ] **Step 4: Add the Coverage panel after the existing grid**

Immediately after the closing `</div>` of the `grid grid-cols-1 lg:grid-cols-2` wrapper, insert the coverage matrix:
```jsx
        {tab === "coverage" && (
          <div className="p-5 rounded-2xl overflow-x-auto" style={card}>
            <div className="flex items-center gap-2 mb-4">
              <Grid3x3 size={15} style={{ color: p.text }} />
              <span className="text-[13px] font-black" style={{ color: p.text }}>Coverage</span>
              <span className="text-[11px]" style={{ color: p.faint }}>Reassign workers on the Employee page.</span>
            </div>
            {!coverage ? (
              <p className="text-[12px]" style={{ color: p.faint }}>Loading…</p>
            ) : (
              <table className="w-full text-left" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th className="text-[11px] font-bold p-2" style={{ color: p.muted }}>Shift</th>
                    {coverage.departments.map((d) => (
                      <th key={d} className="text-[11px] font-bold p-2 text-center" style={{ color: p.muted }}>{d}</th>
                    ))}
                    <th className="text-[11px] font-bold p-2 text-center" style={{ color: p.muted }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...coverage.shifts.map((s) => ({ key: s.id, label: s.name })), { key: "unassigned", label: "Unassigned" }].map((row) => (
                    <tr key={row.key} style={{ borderTop: `1px solid ${p.border}` }}>
                      <td className="text-[12px] font-bold p-2" style={{ color: p.text }}>{row.label}</td>
                      {coverage.departments.map((d) => {
                        const workers = coverage.matrix?.[row.key]?.[d] || [];
                        const n = workers.length;
                        const bg = n === 0 ? "#e0666622" : n <= 2 ? "#d6a23e22" : p.inputBg;
                        return (
                          <td key={d} className="p-1.5 text-center">
                            <button
                              disabled={n === 0}
                              onClick={() => setCellWorkers({ title: `${row.label} · ${d}`, workers })}
                              className="w-full py-1.5 rounded-lg text-[12px] font-bold disabled:cursor-default"
                              style={{ background: bg, color: p.text }}>
                              {n}
                            </button>
                          </td>
                        );
                      })}
                      <td className="text-[12px] font-black p-2 text-center" style={{ color: p.text }}>{coverage.totals?.[row.key] || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
```

- [ ] **Step 5: Add the cell-detail Drawer**

Find the existing `<Drawer ...>` for the shift form at the bottom of the JSX. Immediately after it (still inside the returned `<main>`), add a second drawer for cell workers:
```jsx
      <Drawer open={!!cellWorkers} onClose={() => setCellWorkers(null)} title={cellWorkers?.title || "Workers"} subtitle="Assigned workers">
        <div className="flex flex-col gap-2">
          {(cellWorkers?.workers || []).map((w) => (
            <div key={w.id} className="flex items-center justify-between p-2.5 rounded-xl" style={{ background: p.inputBg }}>
              <span className="text-[12px] font-bold" style={{ color: p.text }}>{w.name || "—"}</span>
              {w.nik && <span className="text-[11px]" style={{ color: p.muted }}>{w.nik}</span>}
            </div>
          ))}
        </div>
      </Drawer>
```

- [ ] **Step 6: Build check**

Run: `cd frontend && npm run build 2>&1 | grep -iE "compiled|error|/shifts"`
Expected: "Compiled successfully", `/shifts` listed, no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/shifts/page.jsx
git commit -m "feat: coverage tab with shifts×departments matrix"
```

---

## Testing Summary

- **Integration (Task 2):** assigned worker shows in `matrix[shift][dept]` + `totals`; supervisor reads (200); unassigned worker in `unassigned` bucket; no-auth → 401.
- **Regression:** full `cd backend && npm test` stays green (Module 1 + B1 + B2 + B3).
- **Frontend:** build check (Task 3 Step 6); manual visual check of the matrix + cell drawer later.

## Self-Review

- **Spec coverage:** §1 endpoint (shifts/departments/matrix/totals, unassigned bucket, "—" fallback, derived sorted departments) → Task 1. §2 frontend (tab switcher, matrix rows incl Unassigned, Total column, color scale, click→Drawer, read-only hint) → Task 3. §3 testing (matrix bucketing, unassigned, supervisor read, 401) → Task 2. All mapped.
- **Naming consistency:** response keys `shifts/departments/matrix/totals`, bucket key `"unassigned"`, dept fallback `"—"` — identical between endpoint (Task 1), test (Task 2), and frontend consumption (Task 3).
- **No route-ordering trap:** `shifts.js` has no `GET /:id`, so `GET /coverage` is unambiguous.
- **Color thresholds** (0 red / 1–2 amber / 3+ neutral) are display-only, per spec.

## Out of Scope

- Per-day rostering, drag-assign, editing/reassigning from coverage (use Employee form), shift-change history. Leave + Contracts modules.

