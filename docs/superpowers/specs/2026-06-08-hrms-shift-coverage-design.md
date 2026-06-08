# HRMS Module B3 — Shift Coverage Dashboard

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan

## Context

Final sub-module of the Shift effort. B1 (shift master + working calendar) and B2 (overtime day-type classification) shipped. Roadmap: Overtime → Shift (B1 ✅, B2 ✅, B3 this) → Leave → Contracts.

### Scope reasoning

B1 established a **fixed shift-assignment model**: each worker has one `users.shift_id`, changed rarely, not per-day. A classic drag-a-worker-onto-a-day roster planner assumes variable daily assignment, which would require re-opening B1's data model. That is explicitly out of scope.

What is useful given fixed shifts is a **coverage dashboard**: a read-mostly Shifts × Departments matrix showing how many workers sit in each shift/department combination, so an admin or supervisor can spot understaffed shifts at a glance. Reassignment continues to happen through the existing employee form (`PATCH /members/:id/shift` or the employee edit drawer), not from this view.

### Current-state findings (verified against code)

- `users` has `shift_id uuid?` (nullable, B1). Active workers = `deletedAt: null`.
- `shift` table: `id, name, start_time, end_time, active`. `backend/src/routes/shifts.js` exists with CRUD + `requireRole`.
- Frontend `/shifts` page (`frontend/src/app/shifts/page.jsx`) currently shows Shifts + Holidays panels. `Drawer.jsx`, `fetchWithAuth`, `useAppSettings` palette available.
- Department values live on `users.departement` (free-ish text; existing dept color map in `EmployeeForm`).

## Section 1 — Backend Endpoint

`GET /api/shifts/coverage` — `requireRole("admin", "supervisor")` — added to `backend/src/routes/shifts.js`.

Logic:
- Fetch active shifts (`active: true` or all; use all shifts ordered by name for stable columns-as-rows).
- Fetch all non-deleted users: `select { id, name, nik, departement, shift_id }`.
- Build the matrix grouping users by `shift_id` × `departement`. Workers with `shift_id: null` go to the `unassigned` bucket. Workers with a null/empty `departement` bucket under the label `"—"`.
- `departments` = sorted distinct non-empty `departement` values across users (plus `"—"` if any null-dept workers exist). Derived, not hardcoded.

Response shape:
```json
{
  "shifts": [{ "id": "...", "name": "Shift 1", "start_time": "...", "end_time": "..." }],
  "departments": ["Production", "QC", "—"],
  "matrix": {
    "<shiftId>": { "Production": [{ "id", "name", "nik" }], "QC": [...] },
    "unassigned": { "QC": [...] }
  },
  "totals": { "<shiftId>": 42, "unassigned": 7 }
}
```

- One DB read for users (plus shifts). Grouping in JS.
- `matrix[bucket][dept]` is an array of worker `{id, name, nik}`; absent combos simply omitted (frontend treats missing as count 0).
- `totals[bucket]` = total workers in that shift (or unassigned), across all departments.

## Section 2 — Frontend (Coverage tab on `/shifts`)

Add a tab switcher to `frontend/src/app/shifts/page.jsx`: **Shifts | Holidays | Coverage**. The existing shifts + holidays content moves under their tabs; Coverage is new. One nav entry, related concerns together.

Coverage tab:
- **Matrix table.** Rows = each shift, plus a final **"Unassigned"** row. Columns = each department, plus a trailing **"Total"** column. Cell = worker count for that shift×dept.
- **Color scale** on count: 0 → red tint (`#e0666622`), 1–2 → amber tint (`#d6a23e22`), 3+ → neutral (`p.inputBg`). Helps thin cells jump out. (Thresholds are display-only.)
- **Click a non-zero cell** → open `Drawer` listing that bucket's workers (name + NIK) for the shift×dept.
- Role: admin + supervisor both read. No editing here; include a one-line hint that reassignment happens on the Employee page.

Reuse `Drawer.jsx`, palette, `fetchWithAuth`, `apiBaseUrl`. Data from `GET /api/shifts/coverage`. No emojis; inline styles for dynamic colors — per CLAUDE.md.

## Section 3 — Testing

- **Integration (`backend/tests/shifts.coverage.test.js`):**
  - Create a shift, assign a real worker to it (set `shift_id`), set/note that worker's department; call `GET /api/shifts/coverage`; assert the worker appears in `matrix[shiftId][dept]` and `totals[shiftId] >= 1`.
  - Assert a worker with `shift_id: null` appears under `unassigned`.
  - Assert `departments` is an array and includes the worker's department.
  - Cleanup created shift + restore worker `shift_id`.
- **Role:** supervisor cookie → 200; no cookie → 401 (mount behind `authMiddleware`, already the case for `/api/shifts`).
- **Frontend:** `npm run build` succeeds; `/shifts` compiles with the Coverage tab.

## Out of Scope

- Per-day / variable daily rostering (contradicts B1 fixed-assignment model).
- Drag-and-drop assignment; editing shifts or reassigning workers from the coverage view (use the Employee form).
- Shift-change history / audit.
- Leave and Contracts modules (later roadmap items).
