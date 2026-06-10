# Frontend Bundle Optimization — Design Spec

**Date:** 2026-06-11  
**Scope:** Next.js 16 frontend (`/frontend`)  
**Goal:** Reduce initial JS payload and page-load weight, specifically the `/employee/performance` route which is reported as heavy. Primary lever: remove framer-motion from the shared bundle.

---

## Problem

`template.js` (Next.js layout template — wraps every route) imports `framer-motion` at the top level. This forces framer-motion (~50 KB gzipped) into the base JS chunk downloaded before any page renders. Additionally, 13 other files import framer-motion individually (pages + shared components), meaning it is never code-split away even on routes that don't need animation.

Secondary issues:
- `employee/performance/page.jsx` is 726 lines — one monolithic component, slow to parse and hard to lazy-load
- `recharts` (~70 KB gzipped) loaded eagerly on attendance and dashboard even before charts are visible

---

## Approach

Remove framer-motion from every file except `/display/page.jsx`. Replace with CSS keyframes and transitions. Load the display page itself via `next/dynamic` so framer-motion lives in a separate chunk only fetched by the TV route. Split the performance page. Lazy-load recharts.

---

## Section 1 — Shared bundle (highest impact)

These files are rendered on every authenticated page. Removing framer-motion here reduces the base chunk size for all routes.

### `template.js`

Replace `<motion.div initial opacity+y>` with a plain `<div>` that gets a CSS animation class.

Add to `globals.css`:
```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: page-enter 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

`template.js` becomes:
```jsx
export default function Template({ children }) {
  return <div className="page-enter h-full w-full">{children}</div>;
}
```

No `"use client"` needed — this becomes a server component.

### `Sidebar.jsx`

Three animation sites:

1. **Brand logo area** (`motion.div initial opacity+y`): Replace with `<div className="sidebar-brand">` + CSS `@keyframes sidebar-brand-in`.

2. **Nav items stagger** (`motion.div initial opacity+x` with per-item delay): Replace with `<div style={{ animationDelay: \`${i * 55 + 100}ms\` }} className="nav-item-enter">`.  
   Add `@keyframes nav-item-enter` (opacity 0→1, x -14→0) to globals.css.

3. **Active pill** (`motion.div layoutId="nav-active-pill"` spring): Remove `layoutId`. Apply `background` directly on the active `<Link>` with `transition-colors duration-150`. The "sliding pill follows cursor" effect is lost; active state still clearly visible via background color. Tradeoff accepted.

### `Toaster.jsx`

Replace `AnimatePresence` + `motion.div` enter/exit with:
- Enter: CSS `@keyframes toast-in` (x 56→0, scale 0.94→1)
- Exit: controlled via a React state flag `exiting` → add CSS class `toast-out` → `onAnimationEnd` removes toast from list
- Progress bar: replace `motion.div width animation` with CSS `width: 100%` → `width: 0%` transition driven by a `transition-duration` set to the toast's remaining duration

### `CommandPalette.jsx`

Replace backdrop + panel `motion.div` with:
- Backdrop: `<div>` with `data-open` attribute → CSS `opacity` transition
- Panel: `<div>` with CSS `transform: translateY(-18px) scale(0.96)` → `translateY(0) scale(1)` transition, controlled by `open` state class

### `Drawer.jsx`

Replace slide-in `motion.div` with `<div>` using CSS `transform: translateX(100%)` → `translateX(0)` transition via `open` state class. Already uses backdrop click/ESC — no logic changes needed.

### `forms/EmployeeForm.jsx` and `forms/PerformanceForm.jsx`

Strip framer-motion imports. Replace any `motion.div` wrappers with plain `<div>` + CSS transition classes. Dropdown animations in `PerformanceForm` replaced with `max-height` + `opacity` CSS transition.

---

## Section 2 — Individual pages

Each page uses framer-motion for simple card/section entrance animations. All replaced with CSS `@keyframes fade-up` (opacity 0→1, y 8→0) applied via className.

| File | Change |
|------|--------|
| `attendance/page.jsx` | Strip framer-motion; CSS `fade-up` on stat cards |
| `dashboard/page.jsx` | Strip framer-motion; CSS `fade-up`; `Counter` already uses `requestAnimationFrame`, no change |
| `dashboard/performance/page.jsx` | Strip framer-motion; CSS `fade-up` |
| `employee/page.jsx` | Strip framer-motion; CSS `fade-up` |
| `employee/performance/page.jsx` | Strip framer-motion; tab pill replaced with JS `left` offset via `useRef` + CSS `transition: left` (see Section 3) |
| `employee/performance/create/page.jsx` | Strip framer-motion; CSS `fade-up` |
| `shifts/page.jsx` | Strip framer-motion; CSS `fade-up` |
| `overtime/page.jsx` | Strip framer-motion; CSS `fade-up` |
| `login/page.jsx` | Strip framer-motion; CSS `fade-up` |
| `not-found.jsx` | Strip framer-motion; CSS `fade-up` |

### `/display/page.jsx` — keep framer-motion

Wrap in `next/dynamic`:

```
display/
├── page.jsx          (dynamic loader, no framer-motion import)
└── DisplayInner.jsx  (moved content of current page.jsx)
```

`page.jsx`:
```jsx
import dynamic from "next/dynamic";
const DisplayInner = dynamic(() => import("./DisplayInner"), { ssr: false });
export default function DisplayPage() { return <DisplayInner />; }
```

framer-motion now only loads when `/display` is visited.

---

## Section 3 — Performance page split

`employee/performance/page.jsx` (726 lines) split into:

```
employee/performance/
├── page.jsx              ~80 lines   data fetch, state, tab switcher shell
├── _LeaderboardTab.jsx   ~220 lines  leaderboard grid + top stat cards
├── _RecordsTab.jsx       ~280 lines  records table, filters, sort, delete
└── _shared.jsx           ~80 lines   Counter, PerfBadge, ScoreBar, DeleteButton, DEPT_COLORS, getDrivePreview, deptColor
```

Both tabs loaded via `next/dynamic`:
```js
const LeaderboardTab = dynamic(() => import("./_LeaderboardTab"));
const RecordsTab     = dynamic(() => import("./_RecordsTab"));
```

**Tab pill animation** (was `layoutId` spring): Replace with a `pillRef` + `activeRef` per nav item. On tab change, read `activeRef.current.offsetLeft` and `offsetWidth`, set `left`/`width` on the pill `<div>` via state. CSS `transition: left 0.22s, width 0.22s` gives smooth slide without framer-motion.

---

## Section 4 — Dynamic recharts

`recharts` used only on `attendance/page.jsx` and `dashboard/page.jsx`. Extract chart JSX into co-located component files, load with `next/dynamic`:

```
attendance/
├── page.jsx          (existing, strip recharts import)
└── _AttendanceChart.jsx  (BarChart + axes extracted here)

dashboard/
├── page.jsx          (existing, strip recharts import)
└── _DashboardChart.jsx   (AreaChart + axes extracted here)
```

```js
const AttendanceChart = dynamic(() => import("./_AttendanceChart"), { ssr: false, loading: () => <div className="h-48" /> });
```

---

## CSS additions to `globals.css`

All new keyframes/classes go in one block at the end of `globals.css`:

```css
/* --- Bundle optimization: CSS animation replacements --- */
@keyframes page-enter {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-up {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes sidebar-brand-in {
  from { opacity: 0; transform: translateY(-10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes nav-item-enter {
  from { opacity: 0; transform: translateX(-14px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes toast-in {
  from { opacity: 0; transform: translateX(56px) scale(0.94); }
  to   { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes toast-out {
  from { opacity: 1; transform: translateX(0) scale(1); }
  to   { opacity: 0; transform: translateX(56px) scale(0.94); }
}
.page-enter   { animation: page-enter   0.38s cubic-bezier(0.22,1,0.36,1) both; }
.fade-up      { animation: fade-up      0.32s cubic-bezier(0.22,1,0.36,1) both; }
.nav-item-enter { animation: nav-item-enter 0.42s cubic-bezier(0.22,1,0.36,1) both; opacity: 0; animation-fill-mode: both; }
.sidebar-brand-in { animation: sidebar-brand-in 0.5s cubic-bezier(0.22,1,0.36,1) both; }
.toast-in  { animation: toast-in  0.32s cubic-bezier(0.22,1,0.36,1) both; }
.toast-out { animation: toast-out 0.32s cubic-bezier(0.22,1,0.36,1) both; }
```

---

## What does NOT change

- All existing behavior, routing, auth flow
- `/display` animations — kept exactly as-is
- Backend — no changes
- Theme system, i18n, `useAppSettings` — untouched
- `recharts` API surface — same charts, just lazy-loaded

---

## Expected outcome

- framer-motion removed from shared/base JS chunk → all routes lighter
- framer-motion only loads on `/display`
- `recharts` lazy-loaded → attendance + dashboard initial JS lighter
- Performance page split → smaller initial parse cost, inactive tab code deferred
- All visual animations preserved (minor: sidebar active pill loses spring follow; gains CSS slide)
