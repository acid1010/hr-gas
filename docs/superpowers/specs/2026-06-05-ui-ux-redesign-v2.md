# UI/UX Redesign V2 — HR System PT. Global Anugerah Setia

**Date:** 2026-06-05  
**Scope:** Dashboard, Employee Table, Attendance, Performance, TV Display (`/display`)  
**Stack:** Next.js 15, Tailwind CSS v4, DaisyUI v5 (gas-dark theme), framer-motion, lucide-react, recharts  
**Typography:** Geist Sans (already loaded)  
**Design language:** Corporate dark navy — `#0b0d14` bg, `#10131c` cards, `#5b8df8` accent  
**No emojis anywhere in the UI**

---

## 1. Design Principles

- **Information hierarchy:** Summary stats visible first, detail on demand
- **Data density without clutter:** Tables are scannable, not crowded
- **Color as signal:** Green = good, amber = warning, red = critical — consistently applied
- **No decorative meta-labels** ("SECTION 01", "QUESTION 05" are banned)
- **Motion is purposeful:** Only on the `/display` TV route and page transitions — not decorative on data tables
- **Corporate tone:** No emojis, no casual copy, no rounded cartoon UI

---

## 2. Global Changes

### Sidebar
- Add `Attendance` link (already done) — no changes needed
- Active link: left border `#5b8df8` + `#1e2d52` background — already implemented

### Shared Table Pattern
All data tables across the app share:
- Sticky `<thead>` with `position: sticky; top: 0; z-index: 10`
- Zebra rows: alternating `#10131c` / `#12161f`
- Hover: row background lifts to `#151a26`
- Status values rendered as badge pills (color-coded)
- "Showing X–Y of Z" count above the table
- Row-count selector: 10 / 25 / 50 per page

### Shared Stat Chip
Reusable `<StatChip>` component: label (xs, muted), value (xl, white), trend arrow (green/red). Used on Dashboard and Attendance.

---

## 3. Dashboard Redesign

### Header Row
- Left: "Good morning, {user.name}" in `text-sm text-muted`, date in `text-2xl font-black text-white`
- Right: Live clock (`HH:MM:SS`) updating every second via `setInterval`

### KPI Row — 4 cards, `grid-cols-4 gap-4`
Each card (`col-span-1`):

| Card | Data source | Color signal |
|------|-------------|--------------|
| Total Employees | `GET /members` count | Static blue |
| Present Today | `GET /api/attendance?date=today` unique device_uids | Green if >80% of total |
| Absent Today | Total − Present | Red if >20% of total |
| Avg Performance | `GET /api/performance` scores averaged | Green ≥80, amber 60–79, red <60 |

Each card shows: icon (lucide), big number (`text-4xl font-black gas-num`), label, trend vs yesterday (↑ / ↓ with percentage).

### Main Content — `grid-cols-12 gap-4 grid-flow-dense`
- **Attendance area chart** (`col-span-7`): recharts `AreaChart`, x=hour (00–23), y=punch count. Gradient fill `#5b8df8` → transparent. Data from `GET /api/attendance?date=today`. Refreshes every 60s.
- **Absent Today list** (`col-span-5`): Scrollable list of employees with no punch-in today. Each row: letter avatar (colored by dept), name, NIK, department. Empty state: "All employees present" in muted text.

### Auto-refresh
Dashboard polls every 60 seconds using `setInterval` in a `useEffect` cleanup pattern.

---

## 4. Employee Table Redesign

### Toolbar
- Search input wired to URL `?keyword=` param — submits on Enter or Search button click
- Department select wired to URL `?dept=` param
- Position select wired to URL `?section=` param
- Rows-per-page select: 10 / 25 / 50 → URL `?limit=` param
- "Showing X–Y of Z employees" count text (right-aligned)
- Action buttons: Create, Export, Import (icons + labels)

### Table Columns
`NIK | Avatar+Name | Department | Position | Join Date | Status | Worker Status | Username | Action`

- **Avatar:** 32px circle, letter initial, background color deterministic from department name
- **Status badge:** `aktif` → green pill, `non-aktif` → red pill
- **Worker status badge:** `pkwt` → blue, `borongan` → amber, `magang` → gray
- **Edit button:** Opens slide-in drawer from right (replaces modal dialog) — more space for the form
- **Delete button:** Inline confirmation — button turns red + shows "Confirm?" text on first click, second click executes

### Slide-in Drawer
- Overlays from right, `w-[480px]`, backdrop `rgba(0,0,0,0.5)`
- Contains `EmployeeForm` unchanged
- Closes on backdrop click or ESC

---

## 5. Attendance Page Redesign

### Summary Chips Row
4 `StatChip` components in a row above the table:
- Total Punches Today
- Unique Employees Present
- First Punch (earliest time)
- Last Punch (latest time)

### Hourly Bar Chart
recharts `BarChart` — punches per hour for selected date. Bar color: `#5b8df8`. Height: 120px. Shown above the table, below chips.

### Auto-sync
- Background `setInterval` every 5 minutes → `POST /api/attendance/sync`
- "Last synced: X min ago" indicator (top-right of toolbar, subtle pulsing green dot)
- No user interruption — silent sync

### Table
Shared table pattern. Additional: "Unregistered" rows (no `user_id`) visually dimmed to 40% opacity with a warning icon in the Name column.

---

## 6. Performance Page Redesign

### Combined Score Formula
```
combined_score = (attendance_rate × 0.6) + (performance_rating × 0.4)

attendance_rate = days_present_this_month / working_days_this_month  (0–1)
performance_rating:
  "best"    → 1.0
  "good"    → 0.75
  "average" → 0.50
  "worst"   → 0.25
```

### Leaderboard Table
Columns: `Rank | Avatar+Name | NIK | Department | Attendance % | Perf Rating | Combined Score`

- Rank column: `#1`, `#2`, `#3` in bold blue; rest in muted gray
- Score column: color-coded bar (thin progress bar under the number) — green ≥80, amber 60–79, red <60
- Sortable by any column (client-side sort)
- Quarter + month selectors at top

### Data source
Frontend fetches both `/api/attendance/summary?month=YYYY-MM` and `/api/performance`, merges by `user_id`, computes score client-side.

---

## 7. `/display` TV Route

### Route details
- Path: `/display`
- No sidebar, no navbar, full viewport
- No authentication required (open route — bypass middleware)
- Auto-refresh data every 5 minutes

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  [GAS] PT. GLOBAL ANUGERAH SETIA          JUNE 2026   17:54:58  │
│         HR PERFORMANCE RANKING             Friday, 6 June 2026  │
├────────────────────────┬─────────────────────────────────────────┤
│   TOP PERFORMERS       │   NEEDS IMPROVEMENT                     │
│                        │                                         │
│   #1  AHMAD FAUZI      │   #1  BUDI SANTOSO                      │
│       Production       │       Warehouse                         │
│       Score: 94.2      │       Score: 31.5                       │
│                        │                                         │
│   #2  SITI RAHAYU      │   #2  ...                               │
│       ...              │                                         │
├────────────────────────┴─────────────────────────────────────────┤
│  GROW ACHIEVE SUCCESS  •  PT. GLOBAL ANUGERAH SETIA  •  [scroll] │
└──────────────────────────────────────────────────────────────────┘
```

### Header bar
- Left: GAS logo box (`#3b6fd4` background, `text-xs font-black`) + company name + "HR PERFORMANCE RANKING"
- Center: Current month + quarter badge
- Right: Live `HH:MM:SS` clock + full date — updates every second

### Split panels
- Left panel (`w-1/2`, green-tinted border): "TOP PERFORMERS" heading in `text-xs tracking-widest uppercase` muted. 5 rank cards stacked.
- Right panel (`w-1/2`, red-tinted border): "NEEDS IMPROVEMENT" heading. 5 rank cards stacked.

### Rank card (per employee)
- Rank number: `text-5xl font-black` in `#5b8df8` (top) or `#ef4444` (bottom)
- Name: `text-3xl font-black text-white tracking-tight`
- Department + NIK: `text-sm text-muted`
- Score: `text-5xl font-black` in green (top) or red (bottom)
- Score bar: full-width thin progress bar

### GSAP Animations (framer-motion on this route)
- **Card stacking entrance:** Cards animate in from bottom, staggered 0.1s delay each, `y: 40 → 0`, `opacity: 0 → 1`
- **Score counter:** Numbers count up from 0 to final value on data load (1.5s duration)
- **Period label scrub:** Month/quarter label fades in with letter-by-letter reveal on mount

### Marquee ticker (bottom)
CSS `animation: marquee 30s linear infinite` — "GROW ACHIEVE SUCCESS  •  PT. GLOBAL ANUGERAH SETIA INDONESIA  •  HR PERFORMANCE RANKING  •" repeating. White text on `#3b6fd4` background strip. No JS required.

### Middleware bypass
Add `/display` to the public routes list in `src/middleware.js` so unauthenticated users (the TV) can access it.

---

## 8. New Backend Endpoint Needed

`GET /api/attendance/summary` already exists. One new endpoint:

`GET /api/performance/leaderboard?month=YYYY-MM`

Returns combined score per user — server computes the formula so the frontend just renders:
```json
{
  "month": "2026-06",
  "data": [
    { "user_id": "...", "name": "Ahmad Fauzi", "nik": "10001", "departement": "production",
      "attendance_rate": 0.95, "performance_rating": 1.0, "combined_score": 97.0 }
  ]
}
```

Sorted descending by `combined_score`.

---

## 9. Files to Create / Modify

| File | Action |
|------|--------|
| `frontend/src/app/dashboard/page.jsx` | Rewrite |
| `frontend/src/app/employee/page.jsx` | Rewrite |
| `frontend/src/app/attendance/page.jsx` | Rewrite |
| `frontend/src/app/employee/performance/page.jsx` | Rewrite |
| `frontend/src/app/display/page.jsx` | Create |
| `frontend/src/app/components/StatChip.jsx` | Create |
| `frontend/src/app/components/Drawer.jsx` | Create |
| `frontend/src/middleware.js` | Modify (add `/display` to public routes) |
| `backend/src/routes/performance.js` | Add `/leaderboard` endpoint |

---

## 10. Out of Scope

- No changes to auth flow, backend architecture, or DB schema
- No changes to the backend attendance sync logic
- No mobile responsive design (internal tool, used on desktop + TV only)
- No dark/light mode toggle
