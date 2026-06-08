# HRMS Module B2 — Overtime Day-Type Classification

**Date:** 2026-06-08
**Status:** Approved design, pending implementation plan

## Context

Third sub-module in the Shift effort (B1 shipped: shift master + working calendar). Roadmap: Overtime → Shift (B1 ✅, B2 this, B3 roster) → Leave → Contracts.

B2's purpose: classify each overtime request's date as **workday / rest_day / holiday** so the payroll team can apply the correct Kepmenaker overtime rate. This unblocks the multiplier concern deferred since Module 1.

### Constraints established during brainstorming

- **Label only, no numeric multiplier.** Consistent with Module 1's "we feed payroll clean data, payroll prices it." We classify the day type; payroll applies its own legal rates. Avoids duplicating payroll logic and legal drift.
- **Compute on read, store nothing.** No new column, no migration. `day_type` is a cheap pure function computed in GET responses and the Excel export. This sidesteps a staleness bug: if an admin adds a holiday after a request is submitted, a stored `day_type` would go stale and payroll could underpay. Computing live always reflects the current holiday table.
- **Classification keys off the request `date`** (one date per overtime_request), so all lines in a request share one `day_type`.
- The reserved `overtime_line.multiplier` column stays NULL.

### Current-state findings (verified against code)

- `overtime_request.date` is the OT date; `overtime_line` rows hang off it. (Module 1.)
- `backend/src/lib/workingDays.js` (B1) exports `isWorkingDay`, `countWorkingDays`, `getHolidaySet`. Holidays live in the `holiday` table; `getHolidaySet(prisma, start, end)` returns a `Set` of `'YYYY-MM-DD'`.
- `backend/src/routes/overtime.js` has GET `/` (list, role-scoped), GET `/:id` (detail), GET `/export/excel` (admin, approved requests for a month). Excel uses `XLSX.utils.json_to_sheet`.
- Frontend `/overtime` page renders request cards with a status badge; data from `GET /api/overtime`.

## Section 1 — Classification Logic

Add one pure function to `backend/src/lib/workingDays.js`:

```js
// 'workday' | 'rest_day' | 'holiday'
function classifyDay(date, holidaySet) {
  if (holidaySet && holidaySet.has(ymd(date))) return "holiday";  // precedence: holiday wins
  const day = date.getDay();
  if (day === 0 || day === 6) return "rest_day";                  // Sun, Sat
  return "workday";
}
```

- Holiday-first precedence: a holiday falling on a weekday is still `holiday`; a holiday on a weekend is still `holiday`.
- Reuses the existing `ymd` helper. Export alongside the others.

## Section 2 — Compute on Read (no storage)

No schema change. `day_type` is injected into overtime read responses:

- **GET `/api/overtime`** (list): collect the date range spanning all returned requests, call `getHolidaySet` once for that range, then attach `day_type = classifyDay(r.date, holidays)` to each request in the response.
- **GET `/api/overtime/:id`** (detail): fetch a holiday set for that single date (or a tight range around it), attach `day_type`.
- **GET `/api/overtime/export/excel`**: already loads approved requests for the target month; fetch the month's holiday set once, add a **"Tipe Hari"** column per row with the request's `day_type`.

POST / PUT / approve / reject are unchanged. The `multiplier` column remains NULL.

## Section 3 — Implementation Points

`backend/src/routes/overtime.js`:
- Import `classifyDay`, `getHolidaySet` from `../lib/workingDays`.
- List handler: after fetching `requests`, compute min/max `date`, one `getHolidaySet` call across that span (inclusive end), map `day_type` onto each request object before `res.json`.
- Detail handler: compute a one-day span for the request date, classify, attach.
- Excel handler: one `getHolidaySet` for the month window already computed (`start`/`end`), add `"Tipe Hari": classifyDay(new Date(r.date), holidays)` to each row object.

Edge: empty list → skip holiday fetch, return as-is.

## Section 4 — Frontend

`frontend/src/app/overtime/page.jsx`: render a small `day_type` badge on each request card next to the status badge.
- `workday` → neutral/muted; `rest_day` → amber (`#d6a23e`); `holiday` → red (`#e06666`).
- Label text: "Workday" / "Rest Day" / "Holiday".
- Data comes from the GET response (`r.day_type`); no new fetch, no new component.

## Testing

- **Unit (`workingDays.test.js`):** `classifyDay` — a weekday → `workday`; Saturday and Sunday → `rest_day`; a date in the holiday set → `holiday`; a holiday that falls on a weekday → `holiday` (precedence over workday); a holiday on a weekend → `holiday`.
- **Integration:** create an OT request dated on a Saturday → `GET /api/overtime` returns `day_type: 'rest_day'` for it; add a holiday matching an approved request's date → `GET /export/excel` shows `holiday` in "Tipe Hari".

## Out of Scope

- Numeric overtime multiplier / pay computation (payroll prices off the label).
- Late / early-leave / absent flagging (separate attendance-interpretation work).
- Roster planning UI (B3).
- Punch-to-shift matching.
